import { Router, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import { createJob, getJob, updateJob, updateProgress, appendRequirements, appendMappingRows } from "../lib/jobStore";
import { parseExcelForRequirements, batchRows, chunkText, type ParsedRow } from "../lib/xlsxParser";
import type { Logger } from "pino";

const MAX_CHARS_PER_CHUNK  = 18_000;
const ROWS_PER_BATCH       = 30;
const MAX_UNDERSTANDING_CHARS = 60_000;
const MAPPING_BATCH_SIZE   = 25;

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
- RR: implementation, project delivery, configuration, training, UAT, hypercare, support model, managed service, commercials, advisory, delivery governance, customer engagement.
- LogicGate: functional product capabilities, platform features, workflow engine, dashboards, reporting, integrations, technical architecture, security, hosting, product roadmap, platform SLAs.
- Panorays: third-party cyber monitoring, vendor assessment, external attack surface, questionnaire automation, continuous monitoring, platform-specific functionality, technical/security answers, product roadmap.
- Joint: RR provides implementation/service context AND vendor provides functional/platform detail.
- Unknown: ownership unclear — flag for human review, never guess silently.`;

const CATEGORIES = [
  "Functional capability", "Technical architecture", "Security", "Compliance",
  "Data / integrations", "Reporting / dashboards", "Workflow / configuration",
  "Implementation approach", "Project delivery", "Training", "UAT / testing",
  "Hypercare", "Support", "Managed service", "Commercials", "Legal / contractual",
  "Case studies / references", "Company information", "Other / unknown",
];

const DOC_TYPES = [
  "Requirements Matrix",
  "RFP Overview",
  "Scope Document",
  "Evaluation Criteria",
  "Procurement Instructions",
  "Commercial Requirements",
  "Security Requirements",
  "Supporting Material",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function padId(n: number): string {
  return `REQ-${String(n).padStart(3, "0")}`;
}

// ── Stage 1: Classify documents ───────────────────────────────────────────────

async function claudeClassifyDocuments(
  docs: ReturnType<typeof getDocs>,
  log: Logger
): Promise<Record<string, string>[]> {
  const docList = docs.map((d) => ({
    id: d.id,
    name: d.name,
    fileType: d.fileType,
    preview: d.text
      ? d.text.slice(0, 500)
      : `[Excel spreadsheet: ${(d.structuredRows ?? []).length} rows]`,
  }));

  const system = `Classify each document uploaded to an RFP/RFI response tool.

Document types:
${DOC_TYPES.map((t) => `- ${t}`).join("\n")}

Rules:
- Excel spreadsheets with requirement rows → always "Requirements Matrix".
- PDFs/Word with RFP background, executive overview, context → "RFP Overview".
- Documents defining project scope, deliverables, coverage → "Scope Document".
- Documents with scoring methodology, evaluation rubric, award criteria → "Evaluation Criteria".
- Bidder instructions, submission requirements, clarification process → "Procurement Instructions".
- Pricing structures, contract terms, commercial model → "Commercial Requirements".
- Security standards, data handling, certifications required → "Security Requirements".
- Anything else → "Supporting Material".

Output ONLY valid JSON — no prose, no code fences:
{ "classifications": [ { "id": "<id>", "name": "<name>", "docType": "<type>" } ] }`;

  const user = `Documents to classify:\n${JSON.stringify(docList, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ classifications: Record<string, string>[] }>(
      system, user, { maxTokens: 1000 }
    );
    return Array.isArray(result?.classifications) ? result.classifications : [];
  } catch (err) {
    log.warn({ err }, "claudeClassifyDocuments failed — using defaults");
    return docs.map((d) => ({
      id: d.id,
      name: d.name,
      docType: d.fileType === "excel" ? "Requirements Matrix" : "RFP Overview",
    }));
  }
}

// ── Stage 2: Extract RFP Understanding Model ──────────────────────────────────

async function claudeExtractUnderstanding(
  combinedText: string,
  company: string,
  vendorContext: string,
  log: Logger
): Promise<Record<string, unknown>> {
  const system = `You are a senior GRC consultant at Risk Rising reading an RFP/RFI procurement pack.

Extract a structured understanding of this procurement. Be specific — extract actual content from the document. Do not hallucinate or invent information not present.

Output ONLY valid JSON — no prose, no code fences:
{
  "customer_name": "<string or null>",
  "industry": "<string or null>",
  "objectives": ["<business objective the procurement aims to achieve>"],
  "current_challenges": ["<problem or pain point driving this procurement>"],
  "desired_outcomes": ["<specific outcome they want to achieve>"],
  "scope": "<scope of the contract or project — what is included and excluded>",
  "success_criteria": ["<how they will measure success>"],
  "evaluation_criteria": ["<how responses will be evaluated — include weightings if stated>"],
  "mandatory_requirements": ["<non-negotiable requirements explicitly stated in the document>"],
  "timeline": "<key dates, deadlines, or project timeline>",
  "procurement_process": "<stages of the procurement process>",
  "commercial_constraints": ["<commercial, budget or contractual constraints>"],
  "key_themes": ["<overarching themes or priorities that should inform all responses>"]
}

If a field cannot be determined from the documents, set it to null (strings) or [] (arrays).`;

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nDocument content:\n${combinedText}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 3000 });
    return result ?? {};
  } catch (err) {
    log.warn({ err }, "claudeExtractUnderstanding failed — returning empty model");
    return {};
  }
}

// ── Stage 3a: Enrich worklist from Excel rows ─────────────────────────────────

async function claudeEnrichWorklist(
  rows: ParsedRow[],
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  understanding: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const understandingCtx = understanding
    ? `\nRFP Context:
- Customer objectives: ${JSON.stringify(understanding.objectives ?? [])}
- Evaluation criteria: ${JSON.stringify(understanding.evaluation_criteria ?? [])}
- Key themes: ${JSON.stringify(understanding.key_themes ?? [])}
- Current challenges: ${JSON.stringify(understanding.current_challenges ?? [])}
- Scope: ${understanding.scope ?? "Not specified"}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising triaging an RFP/RFI for the first time.

Your goal is NOT to write responses. Your goal is to assess each requirement and help the team decide where to focus effort.

Think like an experienced consultant reviewing an RFP: "Should we respond to this? Why does it matter? Who should own it? Is it even relevant to us?"

${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${understandingCtx}

For each requirement row, produce an enriched worklist entry with these fields:
- requirement_id: padded ID (REQ-NNN)
- source_document: document filename
- original_question: verbatim requirement text from the row
- category: from the categories list
- mandatory_optional: Mandatory | Optional | Unknown (use the row's priority field as a guide)
- relevance: "Relevant" | "Not Relevant" | "Uncertain"
  - Relevant: RR, LogicGate, or Panorays can meaningfully respond
  - Not Relevant: administrative, legal boilerplate, or completely outside scope
  - Uncertain: needs clarification before assessing
- why_it_matters: one sentence explaining its significance to winning this bid (null if Not Relevant)
- logicgate_mapping: what LogicGate Risk Cloud provides for this requirement (null if not applicable)
- rr_mapping: what Risk Rising delivers for this requirement (null if not applicable)
- recommended_owner: RR | LogicGate | Panorays | Joint | Not Relevant
- recommended_response_type: 
  - "Direct" — RR can respond without vendor input
  - "Vendor Validation" — needs LogicGate or Panorays to confirm
  - "Collaborative" — RR and vendor each contribute a part
  - "Decline" — outside scope or not applicable
- priority: High | Medium | Low
  - High: mandatory or directly impacts evaluation score
  - Medium: important but secondary to High items
  - Low: optional, informational, or low-weight
- linked_objectives: which customer objectives this requirement addresses (max 2, verbatim from the list above, empty array if none or no objectives known)
- notes: brief additional context (null if none)

Rules:
- Use verbatim requirement text — do not paraphrase or summarise original_question.
- Be selective with priority — not everything can be High.
- Not Relevant items still need recommended_owner: "Not Relevant" and recommended_response_type: "Decline".
- Never guess at platform capabilities — if uncertain, use "Vendor Validation" or "Uncertain".

Output ONLY valid JSON — no prose, no code fences:
{
  "requirements": [
    {
      "requirement_id": "REQ-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim text>",
      "category": "<category>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>",
      "relevance": "<Relevant|Not Relevant|Uncertain>",
      "why_it_matters": "<one sentence or null>",
      "logicgate_mapping": "<brief description or null>",
      "rr_mapping": "<brief description or null>",
      "recommended_owner": "<RR|LogicGate|Panorays|Joint|Not Relevant>",
      "recommended_response_type": "<Direct|Vendor Validation|Collaborative|Decline>",
      "priority": "<High|Medium|Low>",
      "linked_objectives": [],
      "notes": null
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.`;

  const rowsSummary = rows.map((r, i) => ({
    index: startIndex + i + 1,
    id: r.id,
    requirement: r.requirement,
    category: r.category,
    subcategory: r.subcategory,
    priority: r.priority,
  }));

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\nRows to assess:\n${JSON.stringify(rowsSummary, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(
      system, user, { maxTokens: 8000 }
    );
    const reqs = Array.isArray(result?.requirements) ? result.requirements : [];
    return reqs.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeEnrichWorklist failed — generating fallback rows");
    return rows.map((r, i) => ({
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
      original_question: r.requirement,
      category: r.category ?? "Other / unknown",
      mandatory_optional: r.priority?.toLowerCase().includes("mand") ? "Mandatory" : "Unknown",
      relevance: "Uncertain",
      why_it_matters: null,
      logicgate_mapping: null,
      rr_mapping: null,
      recommended_owner: "Unknown",
      recommended_response_type: "Vendor Validation",
      priority: "Medium",
      linked_objectives: [],
      notes: "Enrichment failed — please review manually.",
    }));
  }
}

// ── Stage 3b: Extract worklist from text docs ─────────────────────────────────

async function claudeExtractWorklistFromText(
  text: string,
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  understanding: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const understandingCtx = understanding
    ? `\nRFP Context:
- Customer objectives: ${JSON.stringify(understanding.objectives ?? [])}
- Evaluation criteria: ${JSON.stringify(understanding.evaluation_criteria ?? [])}
- Key themes: ${JSON.stringify(understanding.key_themes ?? [])}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising triaging an RFP/RFI.

Extract every identifiable question or requirement from this document text, then assess each one.
${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${understandingCtx}

Rules for extraction:
- Extract EVERY distinct question or requirement, even brief ones.
- Do not merge multiple requirements into one.
- Ignore table of contents, headers, page numbers, footers.
- If the chunk contains no requirements, return an empty array.

For each extracted requirement, produce a worklist entry:
- requirement_id, source_document, original_question (verbatim), category, mandatory_optional
- relevance: Relevant | Not Relevant | Uncertain
- why_it_matters (one sentence or null)
- logicgate_mapping (brief or null)
- rr_mapping (brief or null)
- recommended_owner: RR | LogicGate | Panorays | Joint | Not Relevant
- recommended_response_type: Direct | Vendor Validation | Collaborative | Decline
- priority: High | Medium | Low
- linked_objectives: [] (from objectives list above)
- notes: null

Output ONLY valid JSON — no prose, no code fences:
{
  "requirements": [
    {
      "requirement_id": "REQ-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim or closely paraphrased>",
      "category": "<category>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>",
      "relevance": "<Relevant|Not Relevant|Uncertain>",
      "why_it_matters": "<one sentence or null>",
      "logicgate_mapping": "<brief or null>",
      "rr_mapping": "<brief or null>",
      "recommended_owner": "<RR|LogicGate|Panorays|Joint|Not Relevant>",
      "recommended_response_type": "<Direct|Vendor Validation|Collaborative|Decline>",
      "priority": "<High|Medium|Low>",
      "linked_objectives": [],
      "notes": null
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.`;

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\n${text}`;

  try {
    const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(
      system, user, { maxTokens: 6000 }
    );
    const reqs = Array.isArray(result?.requirements) ? result.requirements : [];
    return reqs.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeExtractWorklistFromText failed — skipping chunk");
    return [];
  }
}

// ── Stage 4: Generate assessment sections ─────────────────────────────────────

async function claudeGenerateAssessmentSections(
  understanding: Record<string, unknown>,
  worklist: Record<string, unknown>[],
  company: string,
  vendorContext: string,
  log: Logger
): Promise<Record<string, unknown>> {
  const system = `You are a senior GRC consultant at Risk Rising producing a strategic opportunity assessment.

This is NOT about writing responses. This is about helping the pursuit team decide where to focus effort.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}

Based on the RFP Understanding Model and the worklist, produce a strategic assessment with these sections:

- opportunity_summary: 2–3 sentence executive overview of what this RFP is about and what winning it means for RR.
- customer_objectives: list of specific business objectives extracted from the RFP (be specific, not generic).
- key_themes: overarching themes that should inform all response decisions.
- logicgate_capability_mapping: list of strings — how LogicGate Risk Cloud modules map to this opportunity. Mention specific LogicGate features or modules where relevant (Risk Cloud, Controls, Frameworks, Assessments, Incidents, Reporting etc.).
- rr_service_mapping: list of strings — how RR's implementation, delivery, support and managed service capabilities map. Be specific about what RR brings.
- risks_and_assumptions: { "risks": ["<specific risk>"], "assumptions": ["<assumption>"] }
  - Risks: real gaps, uncertainties, or potential issues (not boilerplate).
  - Assumptions: things RR is assuming to be true when assessing this opportunity.
- recommended_strategy: 3–4 sentence recommended pursuit and response strategy. Where should the team focus? What should they lead with?
- pursuit_recommendation: "Proceed" | "Qualify" | "Do not pursue"
- pursuit_rationale: one sentence rationale.
- response_confidence: "High" | "Medium" | "Low"

Output ONLY valid JSON — no prose, no code fences.`;

  // Summarise the worklist for context
  const ownerCounts = worklist.reduce<Record<string, number>>((acc, r) => {
    const k = String(r.recommended_owner ?? "Unknown");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const relevanceCounts = worklist.reduce<Record<string, number>>((acc, r) => {
    const k = String(r.relevance ?? "Uncertain");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const highPriority = worklist
    .filter((r) => r.priority === "High")
    .slice(0, 10)
    .map((r) => ({
      id: r.requirement_id,
      q: typeof r.original_question === "string" ? r.original_question.slice(0, 100) : "",
      owner: r.recommended_owner,
      type: r.recommended_response_type,
    }));

  const user = `Company: ${company}
Vendor context: ${vendorContext}

RFP Understanding Model:
${JSON.stringify(understanding, null, 2)}

Worklist summary:
- Total requirements: ${worklist.length}
- By owner: ${JSON.stringify(ownerCounts)}
- By relevance: ${JSON.stringify(relevanceCounts)}
- High-priority items: ${JSON.stringify(highPriority)}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 3000 });
    return result ?? {};
  } catch (err) {
    log.warn({ err }, "claudeGenerateAssessmentSections failed — returning minimal assessment");
    return {
      opportunity_summary: "Assessment generation failed. Please review the worklist manually.",
      customer_objectives: (understanding.objectives as string[]) ?? [],
      key_themes: (understanding.key_themes as string[]) ?? [],
      logicgate_capability_mapping: [],
      rr_service_mapping: [],
      risks_and_assumptions: { risks: [], assumptions: [] },
      recommended_strategy: "Manual review required.",
      pursuit_recommendation: "Qualify",
      pursuit_rationale: "Automatic assessment failed — manual review needed.",
      response_confidence: "Low",
    };
  }
}

// ── Background extraction job ─────────────────────────────────────────────────

async function runExtractionJob(
  jobId: string,
  documentIds: string[],
  vendorContext: string,
  company: string,
  log: Logger
): Promise<void> {
  try {
    updateJob(jobId, { status: "running" });

    const docs = getDocs(documentIds);
    if (docs.length === 0) {
      updateJob(jobId, { status: "error", error: "Documents not found or expired. Please re-upload." });
      return;
    }

    // ── Step 1: Classify documents ─────────────────────────────────────────
    updateProgress(jobId, 0, 1, "Classifying documents…");
    const classifications = await claudeClassifyDocuments(docs, log);
    updateJob(jobId, { documentClassifications: classifications });
    log.info({ jobId, classifications }, "documents classified");

    // Separate contextual docs from requirements docs
    const requirementIds = new Set(
      classifications.filter((c) => c.docType === "Requirements Matrix").map((c) => c.id)
    );
    const excelIds = new Set(docs.filter((d) => d.fileType === "excel").map((d) => d.id));

    const requirementDocs = docs.filter((d) => excelIds.has(d.id) || requirementIds.has(d.id));
    const contextualDocs  = docs.filter((d) => !excelIds.has(d.id) && !requirementIds.has(d.id));

    // Build worklist processing steps
    type Step =
      | { type: "excel"; rows: ParsedRow[]; docName: string }
      | { type: "text";  text: string;      docName: string };

    const worklistSteps: Step[] = [];
    for (const doc of requirementDocs) {
      if (doc.fileType === "excel" && doc.structuredRows && doc.structuredRows.length > 0) {
        batchRows(doc.structuredRows, ROWS_PER_BATCH).forEach((b) =>
          worklistSteps.push({ type: "excel", rows: b, docName: doc.name })
        );
      } else if (doc.text) {
        chunkText(doc.text, MAX_CHARS_PER_CHUNK).forEach((c) =>
          worklistSteps.push({ type: "text", text: c, docName: doc.name })
        );
      }
    }

    // Build combined contextual text for understanding
    let contextCombined = "";
    for (const doc of contextualDocs) {
      if (doc.text) {
        const toAdd = `\n\n=== ${doc.name} ===\n${doc.text}`;
        if (contextCombined.length + toAdd.length <= MAX_UNDERSTANDING_CHARS) {
          contextCombined += toAdd;
        }
      }
    }

    const hasContext  = contextCombined.trim().length > 0;
    const totalSteps  = 1 + (hasContext ? 1 : 0) + worklistSteps.length + 1;
    let stepIdx = 1;

    // ── Step 2: Extract RFP Understanding Model ────────────────────────────
    let rfpUnderstanding: Record<string, unknown> = {};
    if (hasContext) {
      updateProgress(jobId, stepIdx, totalSteps, "Understanding the opportunity…");
      rfpUnderstanding = await claudeExtractUnderstanding(contextCombined, company, vendorContext, log);
      updateJob(jobId, { rfpUnderstanding });
      log.info({ jobId, understanding: rfpUnderstanding }, "understanding model extracted");
      stepIdx++;
    }

    // ── Step 3: Build enriched worklist ───────────────────────────────────
    let reqCounter = 0;
    for (const [i, step] of worklistSteps.entries()) {
      const label =
        worklistSteps.length === 1
          ? `Assessing requirements…`
          : `Assessing requirements — batch ${i + 1} of ${worklistSteps.length}`;
      updateProgress(jobId, stepIdx, totalSteps, label);

      let reqs: Record<string, unknown>[];
      if (step.type === "excel") {
        reqs = await claudeEnrichWorklist(
          step.rows, step.docName, vendorContext, company, reqCounter, rfpUnderstanding, log
        );
      } else {
        reqs = await claudeExtractWorklistFromText(
          step.text, step.docName, vendorContext, company, reqCounter, rfpUnderstanding, log
        );
      }

      reqCounter += reqs.length;
      appendRequirements(jobId, reqs);
      log.info({ jobId, step: i + 1, totalSteps, batch: reqs.length, total: reqCounter }, "worklist batch done");
      stepIdx++;
    }

    // ── Step 4: Generate high-level assessment sections ────────────────────
    updateProgress(jobId, stepIdx, totalSteps, "Generating opportunity assessment…");
    const currentJob = getJob(jobId)!;
    const assessment = await claudeGenerateAssessmentSections(
      rfpUnderstanding, currentJob.requirements, company, vendorContext, log
    );

    updateJob(jobId, {
      status: "done",
      assessment,
      progress: {
        done: totalSteps,
        total: totalSteps,
        stage: `Done — ${reqCounter} requirements assessed`,
      },
    });

    log.info({ jobId, reqCounter, hasUnderstanding: hasContext }, "extraction job complete");
  } catch (err) {
    log.error({ jobId, err }, "extraction job crashed");
    updateJob(jobId, { status: "error", error: (err as Error).message });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/rfp/health", (_req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// ── POST /api/rfp/upload-files ────────────────────────────────────────────────
router.post("/rfp/upload-files", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" }); return;
  }

  req.log.info(
    { count: files.length, totalBytes: files.reduce((s, f) => s + f.size, 0) },
    "rfp upload-files: processing"
  );

  const results: Array<{
    id?: string; name: string; fileType?: string;
    charCount?: number; rowCount?: number; error?: string;
  }> = [];

  for (const file of files) {
    const name = file.originalname;
    const ext  = name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "xlsx" || ext === "xls") {
        const parsed = parseExcelForRequirements(file.buffer);
        req.log.info(
          { name, sheets: parsed.sheets, usefulRows: parsed.usefulRows, totalRawRows: parsed.totalRawRows },
          "rfp: excel parsed"
        );
        if (parsed.rows.length === 0) {
          results.push({ name, error: "No requirement rows detected. Check column headers include keywords like 'requirement', 'question', or 'description'." });
          continue;
        }
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
        if (!trimmed) {
          results.push({ name, error: "No text could be extracted from this file." });
          continue;
        }
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

// ── POST /api/rfp/store-text ──────────────────────────────────────────────────
router.post("/rfp/store-text", async (req, res): Promise<void> => {
  const { name, text } = req.body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" }); return;
  }
  const safeName = typeof name === "string" && name.trim() ? name.trim() : "Pasted document";
  const entry = storeTextDoc(safeName, text.trim());
  req.log.info({ id: entry.id, name: safeName, charCount: entry.charCount }, "rfp: stored pasted text");
  res.json({ id: entry.id, name: entry.name, charCount: entry.charCount, fileType: "text" });
});

// ── DELETE /api/rfp/documents/:id ─────────────────────────────────────────────
router.delete("/rfp/documents/:id", (req, res) => {
  removeDoc(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/rfp/extract-requirements ───────────────────────────────────────
router.post("/rfp/extract-requirements", (req: Request, res): void => {
  const { documentIds, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    res.status(400).json({ error: "documentIds array is required" }); return;
  }

  const job = createJob();
  req.log.info({ jobId: job.id, documentIds, company }, "rfp: assessment job created");

  void runExtractionJob(
    job.id,
    documentIds as string[],
    String(vendorContext ?? "Unknown"),
    String(company ?? "Unknown"),
    req.log
  );

  res.json({ jobId: job.id });
});

// ── GET /api/rfp/jobs/:id ─────────────────────────────────────────────────────
router.get("/rfp/jobs/:id", (req, res): void => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" }); return;
  }
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    rfpUnderstanding: job.rfpUnderstanding,
    documentClassifications: job.documentClassifications,
    assessment: job.assessment,
    requirements: job.requirements,
    mappingRows: job.mappingRows,
    mappingSummary: job.mappingSummary,
    error: job.error,
  });
});

// ── Legacy routes (preserved for backward compatibility) ──────────────────────

router.post("/rfp/classify", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }
  const system = `You are an expert GRC procurement analyst at Risk Rising. Classify each requirement by owner.
${RR_CONTEXT}\n${OWNERSHIP_GUIDE}
Output ONLY valid JSON:
{ "requirements": [{ "requirement_id": "<id>", "owner": "<RR|LogicGate|Panorays|Joint|Unknown>", "vendor_context": "<string>", "priority": "<High|Medium|Low>", "confidence": "<High|Medium|Low>", "vendor_response_needed": <bool>, "notes": "<string>" }], "ownership_summary": { "rr_count": 0, "logicgate_count": 0, "panorays_count": 0, "joint_count": 0, "unknown_count": 0 } }`;
  const allClassified: Record<string, unknown>[] = [];
  try {
    for (const batch of batchRows(requirements as Record<string, unknown>[], 50)) {
      const user = `Vendor context: ${String(vendorContext ?? "Unknown")}\nCompany: ${String(company ?? "Unknown")}\n\nRequirements:\n${JSON.stringify(batch, null, 2)}`;
      const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(system, user, { maxTokens: 6000 });
      if (Array.isArray(result?.requirements)) allClassified.push(...result.requirements);
    }
    const ownership_summary = allClassified.reduce<Record<string, number>>((acc, r) => {
      const key = `${String(r.owner ?? "unknown").toLowerCase()}_count`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    res.json({ requirements: allClassified, ownership_summary });
  } catch (err) {
    req.log.error({ err }, "rfp classify failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/rfp/generate-responses", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }
  const system = `You are a senior consultant at Risk Rising writing RFP/RFI responses.
${RR_CONTEXT}
Output ONLY valid JSON:
{ "responses": [{ "requirement_id": "<id>", "rr_response_draft": "<string or null>", "vendor_prompt": "<string or null>", "response_confidence": "<High|Medium|Low>", "assumptions": "<string or null>" }] }`;
  const allResponses: Record<string, unknown>[] = [];
  try {
    for (const batch of batchRows(requirements as Record<string, unknown>[], 40)) {
      const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\nRequirements:\n${JSON.stringify(batch, null, 2)}`;
      const result = await callClaudeJSON<{ responses: Record<string, unknown>[] }>(system, user, { maxTokens: 5000 });
      if (Array.isArray(result?.responses)) allResponses.push(...result.responses);
    }
    res.json({ responses: allResponses });
  } catch (err) {
    req.log.error({ err }, "rfp generate-responses failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/rfp/generate-vendor-pack", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }
  const system = `You are a senior consultant at Risk Rising preparing a vendor input request pack.
${RR_CONTEXT}
Output ONLY valid JSON:
{ "logicgate_pack": "<markdown or null>", "panorays_pack": "<markdown or null>", "summary": "<string>" }`;
  const vendorItems = (requirements as Array<Record<string, unknown>>).filter(
    (r) => r.owner === "LogicGate" || r.owner === "Panorays" || r.owner === "Joint"
  );
  const toProcess = vendorItems.length > 0 ? vendorItems : (requirements as Array<Record<string, unknown>>);
  const summary = toProcess.slice(0, 100).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    owner: r.owner,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 200) : "",
  }));
  const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\n${JSON.stringify(summary, null, 2)}`;
  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 6000 });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp generate-vendor-pack failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/rfp/generate-gap-analysis", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }
  const system = `You are a senior GRC consultant at Risk Rising conducting a gap and risk analysis.
${RR_CONTEXT}
Output ONLY valid JSON:
{ "gaps": [{ "id": "GAP-001", "description": "<string>", "severity": "<High|Medium|Low>", "mitigation": "<string>" }], "risks": [{ "id": "RISK-001", "description": "<string>", "severity": "<High|Medium|Low>", "owner": "<string>" }], "customer_questions": ["<string>"], "vendor_questions": ["<string>"], "unknown_items": [{ "requirement_id": "<id>", "reason": "<string>" }], "summary": "<string>" }`;
  const reqSummary = (requirements as Record<string, unknown>[]).slice(0, 120).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    owner: r.owner ?? r.recommended_owner,
    mandatory_optional: r.mandatory_optional,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 150) : "",
  }));
  const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\n${JSON.stringify(reqSummary, null, 2)}`;
  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 5000 });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp generate-gap-analysis failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// RR MAPPING PACK
// ═════════════════════════════════════════════════════════════════════════════

async function claudeMapBatch(
  batch: Record<string, unknown>[],
  vendorContext: string,
  company: string,
  rfpUnderstanding: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const understandingCtx = rfpUnderstanding
    ? `\nRFP Context (use to inform response quality):
- Customer objectives: ${JSON.stringify(rfpUnderstanding.objectives ?? [])}
- Evaluation criteria: ${JSON.stringify(rfpUnderstanding.evaluation_criteria ?? [])}
- Key themes: ${JSON.stringify(rfpUnderstanding.key_themes ?? [])}
- Scope: ${rfpUnderstanding.scope ?? "Not specified"}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising creating a detailed RFP/RFI Response Mapping Pack.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${understandingCtx}

For each requirement, produce a complete mapping entry.

Use the assessment fields already provided (recommended_owner, logicgate_mapping, rr_mapping, why_it_matters) as your starting point — validate and build on them, do not contradict them without good reason.

Fields to produce:
- owner: RR | LogicGate | Panorays | Joint | Unknown
- rr_capability_mapping: What Risk Rising can genuinely own and deliver. Max 80 words. Null if not relevant.
- logicgate_mapping: What LogicGate Risk Cloud provides. Max 80 words. Null if not relevant.
- panorays_mapping: What Panorays provides. Max 80 words. Null if not relevant.
- draft_rr_response: Concise RR response. Max 120 words. UK English. Rules by owner:
  - RR: write a specific implementation/delivery/support/commercial response that addresses the customer's objective.
  - Joint: write only the RR element; vendor element goes in vendor_question_or_prompt.
  - LogicGate / Panorays / Unknown: null.
- vendor_validation_required: true if vendor input is needed before a complete answer.
- vendor_question_or_prompt: Specific question to send to the vendor. Null if not needed.
- confidence: High (clear) | Medium (some ambiguity) | Low (complex or unclear).
- assumptions: Key assumptions. Null if none.
- status: Always "Draft".
- notes: One-sentence rationale for owner assignment.

Rules:
- Never invent platform capabilities.
- UK English throughout.
- draft_rr_response max 120 words.
- Responses must reflect the customer's stated objectives and evaluation criteria where relevant.

Output ONLY valid JSON — no prose, no code fences:
{
  "rows": [
    {
      "requirement_id": "REQ-001",
      "owner": "RR",
      "rr_capability_mapping": "...",
      "logicgate_mapping": null,
      "panorays_mapping": null,
      "draft_rr_response": "...",
      "vendor_validation_required": false,
      "vendor_question_or_prompt": null,
      "confidence": "High",
      "assumptions": null,
      "status": "Draft",
      "notes": "..."
    }
  ]
}`;

  const input = batch.map((r) => ({
    requirement_id: r.requirement_id,
    source_document: r.source_document,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 300) : "",
    category: r.category,
    mandatory_optional: r.mandatory_optional,
    // Pass through assessment enrichment fields as context
    why_it_matters: r.why_it_matters ?? null,
    recommended_owner: r.recommended_owner ?? null,
    logicgate_mapping: r.logicgate_mapping ?? null,
    rr_mapping: r.rr_mapping ?? null,
    priority: r.priority ?? null,
    linked_objectives: r.linked_objectives ?? [],
  }));

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nRequirements to map:\n${JSON.stringify(input, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ rows: Record<string, unknown>[] }>(system, user, { maxTokens: 8000 });
    return Array.isArray(result?.rows) ? result.rows : [];
  } catch (err) {
    log.warn({ err }, "claudeMapBatch failed — returning stub rows");
    return batch.map((r) => ({
      requirement_id: r.requirement_id,
      original_question: r.original_question,
      category: r.category,
      owner: r.recommended_owner ?? "Unknown",
      rr_capability_mapping: null,
      logicgate_mapping: null,
      panorays_mapping: null,
      draft_rr_response: null,
      vendor_validation_required: false,
      vendor_question_or_prompt: null,
      confidence: "Low",
      assumptions: null,
      status: "Draft",
      notes: "Automatic mapping failed — please review manually.",
    }));
  }
}

async function claudeGenerateMappingSummary(
  mappingRows: Record<string, unknown>[],
  company: string,
  vendorContext: string,
  rfpUnderstanding: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>> {
  const understandingCtx = rfpUnderstanding
    ? `\nRFP objectives: ${JSON.stringify(rfpUnderstanding.objectives ?? [])}\nKey themes: ${JSON.stringify(rfpUnderstanding.key_themes ?? [])}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising. Based on the completed RFP/RFI Response Mapping Pack, produce an executive summary.
${RR_CONTEXT}
${understandingCtx}

Produce four lists:
- gaps_and_risks: Specific gaps or risks in the response approach. Be specific and actionable.
- assumptions: Key assumptions underpinning the pack.
- commercial_delivery_considerations: Commercial, contractual or delivery points to factor into the response.
- recommended_next_actions: Ordered list of concrete next actions for the pursuit team.

UK English. Each item max 40 words.

Output ONLY valid JSON — no prose, no code fences:
{
  "gaps_and_risks": ["..."],
  "assumptions": ["..."],
  "commercial_delivery_considerations": ["..."],
  "recommended_next_actions": ["..."]
}`;

  const ownerCounts = mappingRows.reduce<Record<string, number>>((acc, r) => {
    const o = String(r.owner ?? "Unknown");
    acc[o] = (acc[o] ?? 0) + 1;
    return acc;
  }, {});

  const sample = mappingRows.slice(0, 80).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    owner: r.owner,
    vendor_validation_required: r.vendor_validation_required,
    confidence: r.confidence,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 100) : "",
  }));

  const user = `Company: ${company}\nVendor context: ${vendorContext}\nTotal: ${mappingRows.length}\nOwnership: ${JSON.stringify(ownerCounts)}\n\nSample rows:\n${JSON.stringify(sample, null, 2)}`;

  try {
    return await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 2500 });
  } catch (err) {
    log.warn({ err }, "claudeGenerateMappingSummary failed");
    return {
      gaps_and_risks: ["Summary generation failed — please review requirements manually."],
      assumptions: [],
      commercial_delivery_considerations: [],
      recommended_next_actions: [
        "Review ownership assignments",
        "Obtain vendor input for flagged items",
        "Complete draft responses before submission",
      ],
    };
  }
}

async function runMappingJob(
  jobId: string,
  requirements: Record<string, unknown>[],
  vendorContext: string,
  company: string,
  rfpUnderstanding: Record<string, unknown> | null,
  log: Logger
): Promise<void> {
  try {
    updateJob(jobId, { status: "running" });

    const batches: Record<string, unknown>[][] = [];
    for (let i = 0; i < requirements.length; i += MAPPING_BATCH_SIZE) {
      batches.push(requirements.slice(i, i + MAPPING_BATCH_SIZE));
    }

    const total = batches.length + 1;
    log.info({ jobId, batches: batches.length, requirements: requirements.length }, "mapping job started");

    for (const [i, batch] of batches.entries()) {
      const stage = batches.length === 1
        ? "Drafting responses…"
        : `Drafting responses — batch ${i + 1} of ${batches.length}`;
      updateProgress(jobId, i, total, stage);

      const rows = await claudeMapBatch(batch, vendorContext, company, rfpUnderstanding, log);
      appendMappingRows(jobId, rows);

      log.info({ jobId, batch: i + 1, total, rowsThisBatch: rows.length }, "mapping batch done");
    }

    updateProgress(jobId, batches.length, total, "Generating pack summary…");
    const job = getJob(jobId)!;
    const summary = await claudeGenerateMappingSummary(
      job.mappingRows, company, vendorContext, rfpUnderstanding, log
    );

    updateJob(jobId, {
      status: "done",
      mappingSummary: summary,
      progress: { done: total, total, stage: `Done — ${job.mappingRows.length} requirements mapped` },
    });

    log.info({ jobId, rowCount: job.mappingRows.length }, "mapping job complete");
  } catch (err) {
    log.error({ jobId, err }, "mapping job crashed");
    updateJob(jobId, { status: "error", error: (err as Error).message });
  }
}

// ── POST /api/rfp/generate-mapping-pack ──────────────────────────────────────
router.post("/rfp/generate-mapping-pack", (req: Request, res): void => {
  const { requirements, vendorContext, company, rfpUnderstanding } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }

  const job = createJob();
  req.log.info({ jobId: job.id, count: requirements.length, company }, "rfp: mapping job created");

  void runMappingJob(
    job.id,
    requirements as Record<string, unknown>[],
    String(vendorContext ?? "Unknown"),
    String(company ?? "Unknown"),
    (rfpUnderstanding as Record<string, unknown> | null) ?? null,
    req.log
  );

  res.json({ jobId: job.id });
});

// ── POST /api/rfp/regenerate-mapping-row ─────────────────────────────────────
router.post("/rfp/regenerate-mapping-row", async (req, res): Promise<void> => {
  const { requirement, vendorContext, company, rfpUnderstanding } = req.body as Record<string, unknown>;
  if (!requirement || typeof requirement !== "object") {
    res.status(400).json({ error: "requirement object is required" }); return;
  }

  try {
    const rows = await claudeMapBatch(
      [requirement as Record<string, unknown>],
      String(vendorContext ?? "Unknown"),
      String(company ?? "Unknown"),
      (rfpUnderstanding as Record<string, unknown> | null) ?? null,
      req.log
    );
    req.log.info(
      { requirementId: (requirement as Record<string, unknown>).requirement_id },
      "rfp: row regenerated"
    );
    res.json({ row: rows[0] ?? null });
  } catch (err) {
    req.log.error({ err }, "rfp: regenerate-mapping-row failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
