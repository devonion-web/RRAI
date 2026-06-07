import { Router, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import { createJob, getJob, updateJob, updateProgress } from "../lib/jobStore";
import { parseExcelForRequirements, chunkText } from "../lib/xlsxParser";
import type { Logger } from "pino";

const MAX_CHARS_PER_CHUNK = 18_000;
const MAX_SUMMARY_CHARS  = 80_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

const router = Router();

// ── Shared context ────────────────────────────────────────────────────────────

const RR_CONTEXT = `Risk Rising is a specialist GRC implementation and advisory consultancy partnering with LogicGate (Risk Cloud) and Panorays (third-party cyber / supply chain risk). Risk Rising owns all implementation, configuration, project delivery, training, UAT, hypercare, support, managed service and commercial aspects. Software vendors own functional platform capability, technical architecture, security, hosting, product roadmap and platform SLAs.

Risk Rising delivery capabilities: GRC programme design and advisory; LogicGate Risk Cloud implementation and configuration; Panorays implementation; agile and waterfall project delivery; stakeholder workshops; app configuration and workflow design; system integration and data migration support; user training and train-the-trainer; UAT support and go-live hypercare; post-go-live managed service and ongoing optimisation; commercial negotiation support.

Risk Rising does NOT own: LogicGate platform features, Panorays platform features, vendor SLAs, vendor security certifications, product roadmap commitments, or technical platform architecture.`;

const OWNERSHIP_GUIDE = `Ownership categories:
- RR: implementation, project delivery, configuration, training, UAT, hypercare, support model, managed service, commercials, advisory, delivery governance.
- LogicGate: functional product capabilities, platform features, workflow engine, dashboards, reporting, integrations, technical architecture, security, hosting, product roadmap, platform SLAs.
- Panorays: third-party cyber monitoring, vendor assessment, external attack surface, questionnaire automation.
- Joint: RR provides implementation/service context AND vendor provides functional/platform detail.`;

const DOC_TYPES = [
  "Requirements Matrix", "RFP Overview", "Scope Document", "Evaluation Criteria",
  "Procurement Instructions", "Commercial Requirements", "Security Requirements", "Supporting Material",
] as const;

// ── Document classification ───────────────────────────────────────────────────

async function claudeClassifyDocuments(
  docs: ReturnType<typeof getDocs>,
  log: Logger,
): Promise<Record<string, string>[]> {
  const docList = docs.map((d) => ({
    id: d.id, name: d.name, fileType: d.fileType,
    preview: d.text ? d.text.slice(0, 500) : `[Excel spreadsheet: ${(d.structuredRows ?? []).length} rows]`,
  }));

  const system = `Classify each document.
Types: ${DOC_TYPES.join(", ")}.
Rules: Excel with requirement rows → "Requirements Matrix". PDFs/Word with RFP background → "RFP Overview". Scope/deliverables → "Scope Document". Scoring methodology → "Evaluation Criteria". Bidder instructions → "Procurement Instructions". Pricing/contract → "Commercial Requirements". Security standards → "Security Requirements". Otherwise → "Supporting Material".
Output ONLY valid JSON: { "classifications": [ { "id": "<id>", "name": "<name>", "docType": "<type>" } ] }`;

  try {
    const result = await callClaudeJSON<{ classifications: Record<string, string>[] }>(
      system, `Documents:\n${JSON.stringify(docList, null, 2)}`, { maxTokens: 800 },
    );
    return Array.isArray(result?.classifications) ? result.classifications : [];
  } catch (err) {
    log.warn({ err }, "claudeClassifyDocuments failed — using defaults");
    return docs.map((d) => ({ id: d.id, name: d.name, docType: d.fileType === "excel" ? "Requirements Matrix" : "RFP Overview" }));
  }
}

// ── Intelligence Summary ──────────────────────────────────────────────────────

async function claudeIntelligenceSummary(
  allContent: string,
  company: string,
  vendorContext: string,
  log: Logger,
): Promise<Record<string, unknown>> {
  const system = `You are a senior RFP analyst at Risk Rising reviewing a procurement pack for the first time.

Extract actionable bid intelligence across 8 panels. Every item must be specific to this RFP — no generic statements.

${RR_CONTEXT}

Rules:
- key_dates: only dates explicitly stated in the documents. If none, use [].
- evaluation_criteria: how responses will be scored or evaluated. Include weightings if stated.
- submission_requirements: format, length, font, page limits, file type, submission portal, any structural rules.
- key_constraints: commercial, legal, geographic, regulatory, technical or timeline constraints that constrain the response or engagement.
- rr_response_areas: topics where Risk Rising owns the response (implementation, delivery, support, commercials, training). Each must have a one-sentence reason.
- logicgate_response_areas: topics where LogicGate must validate or respond (platform features, security, SLAs, roadmap). Each with a reason.
- open_questions: specific gaps or ambiguities in the RFP that must be resolved before a high-quality response can be submitted.
- key_risks: risks to submitting a winning response or to the engagement if won. Each with impact level and a concrete action.

Output ONLY valid JSON — no prose, no code fences:
{
  "key_dates": [{"label": "string", "date": "string", "note": "string|null"}],
  "evaluation_criteria": [{"criterion": "string", "weight": "string|null", "note": "string|null"}],
  "submission_requirements": ["string"],
  "key_constraints": ["string"],
  "rr_response_areas": [{"topic": "string", "why": "string"}],
  "logicgate_response_areas": [{"topic": "string", "why": "string"}],
  "open_questions": ["string"],
  "key_risks": [{"risk": "string", "impact": "High|Medium|Low", "action": "string"}]
}`;

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nDocument content:\n${allContent}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 3000 });
    return result ?? {};
  } catch (err) {
    log.warn({ err }, "claudeIntelligenceSummary failed — returning empty summary");
    return {};
  }
}

// ── Section Identification ────────────────────────────────────────────────────

async function claudeIdentifySections(
  allContent: string,
  company: string,
  vendorContext: string,
  log: Logger,
): Promise<Record<string, unknown>[]> {
  const system = `You are a senior bid consultant at Risk Rising. Read the RFP and identify every section requiring a written prose response.

A "response section" is a part of the RFP asking for a narrative written answer of 100+ words — such as describing an implementation approach, training methodology, support model, migration strategy, or company capabilities.

NOT response sections: pricing tables, tick-box matrices, simple yes/no questions, company registration details, contract terms, or administrative instructions.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}

For each section:
- id: "S001", "S002", etc.
- section_ref: section number or identifier from the document (e.g. "2.1", "Section 4", "Q12", "Lot 2")
- title: concise title (e.g. "Implementation Approach", "Training Methodology", "Support Model")
- owner: "RR" | "LogicGate" | "Joint"
- question_text: verbatim question text or close paraphrase if too long (max 200 words)
- priority: "High" | "Medium" | "Low" — based on evaluation weighting or strategic importance
- notes: one-line note, or null

If the RFP has an evaluation criteria section, use weightings to set priority.
If no explicit sections are found (e.g. only a requirements matrix), identify the top-level response areas instead.

Output ONLY valid JSON — no prose, no code fences:
{ "sections": [ { "id": "S001", "section_ref": "string", "title": "string", "owner": "RR|LogicGate|Joint", "question_text": "string", "priority": "High|Medium|Low", "notes": "string|null" } ] }`;

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nDocument content:\n${allContent.slice(0, 60_000)}`;

  try {
    const result = await callClaudeJSON<{ sections: Record<string, unknown>[] }>(system, user, { maxTokens: 4000 });
    return Array.isArray(result?.sections) ? result.sections : [];
  } catch (err) {
    log.warn({ err }, "claudeIdentifySections failed — returning empty sections");
    return [];
  }
}

// ── Workbench job orchestrator ────────────────────────────────────────────────

async function runWorkbenchJob(
  jobId: string,
  documentIds: string[],
  vendorContext: string,
  company: string,
  log: Logger,
): Promise<void> {
  try {
    updateJob(jobId, { status: "running" });

    const docs = getDocs(documentIds);
    if (docs.length === 0) {
      updateJob(jobId, { status: "error", error: "Documents not found or expired. Please re-upload." });
      return;
    }

    // Step 1: Classify documents
    updateProgress(jobId, 0, 3, "Classifying documents…");
    const classifications = await claudeClassifyDocuments(docs, log);
    updateJob(jobId, { documentClassifications: classifications });

    // Build combined content for summary and sections
    let content = "";
    for (const doc of docs) {
      if (doc.text) {
        const toAdd = `\n\n=== ${doc.name} ===\n${doc.text}`;
        if (content.length + toAdd.length <= MAX_SUMMARY_CHARS) content += toAdd;
      } else if (doc.structuredRows && doc.structuredRows.length > 0) {
        const reqs = doc.structuredRows.slice(0, 150).map((r) => r.requirement).filter(Boolean).join("\n");
        const toAdd = `\n\n=== ${doc.name} (requirements) ===\n${reqs}`;
        if (content.length + toAdd.length <= MAX_SUMMARY_CHARS) content += toAdd;
      }
    }

    if (!content.trim()) {
      updateJob(jobId, { status: "error", error: "No readable content found in uploaded documents." });
      return;
    }

    // Step 2: Generate intelligence summary
    updateProgress(jobId, 1, 3, "Generating RFP Intelligence Summary…");
    const intelligenceSummary = await claudeIntelligenceSummary(content, company, vendorContext, log);
    updateJob(jobId, { intelligenceSummary });
    log.info({ jobId }, "intelligence summary complete");

    // Step 3: Identify response sections
    updateProgress(jobId, 2, 3, "Identifying response sections…");
    const responseSections = await claudeIdentifySections(content, company, vendorContext, log);
    updateJob(jobId, { responseSections });
    log.info({ jobId, sectionCount: responseSections.length }, "sections identified");

    updateJob(jobId, {
      status: "done",
      progress: { done: 3, total: 3, stage: `Done — ${responseSections.length} response sections identified` },
    });
    log.info({ jobId }, "workbench job complete");
  } catch (err) {
    log.error({ jobId, err }, "workbench job crashed");
    updateJob(jobId, { status: "error", error: (err as Error).message });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/rfp/health", (_req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// Upload files
router.post("/rfp/upload-files", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) { res.status(400).json({ error: "No files uploaded" }); return; }

  req.log.info({ count: files.length }, "rfp upload-files: processing");

  const results: Array<{ id?: string; name: string; fileType?: string; charCount?: number; rowCount?: number; error?: string }> = [];

  for (const file of files) {
    const name = file.originalname;
    const ext  = name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "xlsx" || ext === "xls") {
        const parsed = parseExcelForRequirements(file.buffer);
        if (parsed.rows.length === 0) { results.push({ name, error: "No requirement rows detected." }); continue; }
        const entry = storeExcelDoc(name, parsed.rows);
        results.push({ id: entry.id, name, fileType: "excel", rowCount: entry.rowCount });
      } else {
        let text = "";
        if (ext === "docx" || ext === "doc") {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          text = result.value;
        } else if (ext === "pdf") {
          const result = await pdfParse(file.buffer);
          text = result.text;
        } else {
          text = file.buffer.toString("utf-8");
        }
        const trimmed = text.trim();
        if (!trimmed) { results.push({ name, error: "No text could be extracted." }); continue; }
        const entry = storeTextDoc(name, trimmed);
        results.push({ id: entry.id, name, fileType: "text", charCount: entry.charCount });
      }
    } catch (err) {
      req.log.warn({ name, err }, "rfp: failed to process file");
      results.push({ name, error: (err as Error).message });
    }
  }

  res.json({ files: results });
});

// Store pasted text
router.post("/rfp/store-text", async (req, res): Promise<void> => {
  const { name, text } = req.body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) { res.status(400).json({ error: "text is required" }); return; }
  const safeName = typeof name === "string" && name.trim() ? name.trim() : "Pasted document";
  const entry = storeTextDoc(safeName, text.trim());
  req.log.info({ id: entry.id, name: safeName, charCount: entry.charCount }, "rfp: stored pasted text");
  res.json({ id: entry.id, name: entry.name, charCount: entry.charCount, fileType: "text" });
});

// Delete document
router.delete("/rfp/documents/:id", (req, res) => {
  removeDoc(req.params.id);
  res.json({ ok: true });
});

// Fire workbench analysis job
router.post("/rfp/analyse", (req: Request, res): void => {
  const { documentIds, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    res.status(400).json({ error: "documentIds array is required" }); return;
  }
  const job = createJob();
  req.log.info({ jobId: job.id, documentIds, company }, "rfp: workbench job created");
  void runWorkbenchJob(job.id, documentIds as string[], String(vendorContext ?? "LogicGate"), String(company ?? "Unknown"), req.log);
  res.json({ jobId: job.id });
});

// Poll job status
router.get("/rfp/jobs/:id", (req, res): void => {
  const job = getJob(req.params.id);
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    intelligenceSummary: job.intelligenceSummary,
    responseSections: job.responseSections,
    documentClassifications: job.documentClassifications,
    error: job.error,
  });
});

// Generate section brief (synchronous)
router.post("/rfp/section-brief", async (req, res): Promise<void> => {
  const { section, intelligenceSummary, company, vendorContext } = req.body as Record<string, unknown>;
  if (!section || typeof section !== "object") { res.status(400).json({ error: "section is required" }); return; }

  const s = section as Record<string, unknown>;

  const system = `You are a senior bid consultant at Risk Rising preparing a response brief.
Given the RFP intelligence summary and a specific response section, produce a brief to guide the person writing the response.
DO NOT write the response itself — only the brief.

${RR_CONTEXT}

The brief should be opinionated and specific — not generic. If you recognise the type of question (e.g. implementation approach, support model), use your knowledge of what RR does well.

Output ONLY valid JSON — no prose, no code fences:
{
  "what_they_want": "One sentence: the core intent of this section",
  "what_good_looks_like": "One sentence: what an excellent response demonstrates",
  "key_points_to_cover": ["2-5 specific points to address"],
  "evidence_and_examples": ["1-3 specific things to reference from RR's experience or capabilities"],
  "pitfalls_to_avoid": ["1-3 things to avoid in this response"],
  "suggested_word_count": 400
}`;

  const summaryStr = intelligenceSummary ? `\nRFP Intelligence Summary:\n${JSON.stringify(intelligenceSummary, null, 2)}` : "";
  const user = `Company: ${company}\nVendor context: ${vendorContext}\nSection: ${s.section_ref} — ${s.title}\n\nQuestion:\n${s.question_text}${summaryStr}`;

  try {
    const brief = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 1200 });
    req.log.info({ section: s.id }, "rfp: section brief generated");
    res.json({ brief });
  } catch (err) {
    req.log.error({ err }, "rfp: section-brief failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// Draft a response section (synchronous)
router.post("/rfp/draft-section", async (req, res): Promise<void> => {
  const { section, brief, company, vendorContext } = req.body as Record<string, unknown>;
  if (!section || typeof section !== "object") { res.status(400).json({ error: "section is required" }); return; }
  if (!brief || typeof brief !== "object") { res.status(400).json({ error: "brief is required" }); return; }

  const s = section as Record<string, unknown>;
  const b = brief as Record<string, unknown>;

  const system = `You are a senior bid consultant at Risk Rising writing an RFP response section.

${RR_CONTEXT}

Writing rules:
- UK English throughout
- Professional but confident and direct tone  
- Write in the third person ("Risk Rising will..." or "Our approach...") — avoid "I"
- Address the question directly and specifically — demonstrate you understand the customer's context
- Be concrete — reference specific methodologies, tools, and approaches
- Do NOT use generic marketing language or filler phrases
- Do NOT make up capabilities Risk Rising does not have
- Do NOT include pricing or commercial terms
- Do NOT make platform capability commitments on behalf of LogicGate
- Structure the response as 2-4 well-structured paragraphs
- Length: approximately ${b.suggested_word_count ?? 400} words

Output ONLY valid JSON — no prose, no code fences:
{
  "draft": "The full response text. 2-4 paragraphs. Professional prose.",
  "assumptions": ["Key assumption that underpins this response — e.g. about scope, data, or access"],
  "vendor_inputs_needed": ["Specific input needed from LogicGate or Panorays before finalising — or empty array if none"]
}`;

  const user = `Company: ${String(company)}\nVendor context: ${String(vendorContext)}\nSection: ${s.section_ref} — ${s.title}

Question:
${s.question_text}

Response Brief:
What they want: ${b.what_they_want}
What good looks like: ${b.what_good_looks_like}
Key points to cover: ${JSON.stringify(b.key_points_to_cover)}
Evidence and examples: ${JSON.stringify(b.evidence_and_examples)}
Pitfalls to avoid: ${JSON.stringify(b.pitfalls_to_avoid)}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 1500 });
    req.log.info({ section: s.id }, "rfp: section draft generated");
    res.json(result ?? {});
  } catch (err) {
    req.log.error({ err }, "rfp: draft-section failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
