import { Router, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import { createJob, getJob, updateJob, updateProgress, appendRequirements, appendMappingRows } from "../lib/jobStore";
import { parseExcelForRequirements, batchRows, chunkText, type ParsedRow } from "../lib/xlsxParser";
import type { Logger } from "pino";

const MAX_CHARS_PER_CHUNK    = 18_000;
const ROWS_PER_BATCH         = 30;
const MAX_OI_CHARS           = 80_000;
const MAPPING_BATCH_SIZE     = 25;

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
  return `RC-${String(n).padStart(3, "0")}`;
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

// ── Stage 2: Opportunity Intelligence Assessment ──────────────────────────────

async function claudeOpportunityIntelligence(
  allContent: string,
  company: string,
  vendorContext: string,
  log: Logger
): Promise<Record<string, unknown>> {
  const system = `You are a senior Risk Rising consultant reviewing an RFP/RFI procurement pack for the first time.

OBJECTIVE: Understand this opportunity. Do NOT write responses. Do NOT draft a proposal. Do NOT recommend pursuit strategy. Do NOT speculate beyond what the documents contain.

Think like a senior consultant doing a first read-through: What does the customer need to achieve? What would RR need to deliver, support, implement and respond to? What questions remain unanswered?

${RR_CONTEXT}
${OWNERSHIP_GUIDE}

Produce a structured Opportunity Intelligence Assessment. Extract actual content from the documents — do not hallucinate or invent details not present. If a field cannot be determined, use null (strings), [] (arrays), or "Unknown" (enums).

Keep all list items concise — one line each. No long descriptions. No marketing language.

Output ONLY valid JSON — no prose, no code fences:
{
  "customer_objectives": [
    "<what the customer states they are trying to achieve — specific, not generic>"
  ],
  "business_use_cases": [
    "<likely use case implied by the RFP — e.g. Risk Management, TPRM, Policy Attestation, Incident Management, Regulatory Compliance, Audit Management, Controls Testing, Executive Reporting>"
  ],
  "capability_requirements": [
    {
      "capability": "<specific capability required>",
      "rr_area": "<ERM | Controls Compliance | TPRM | Regulatory Compliance | Policy Management | Incident Management | Audit | Assessments | Reporting | Integrations | Workflow | Implementation | Support | Other>"
    }
  ],
  "logicgate_mapping": [
    {
      "requirement_area": "<capability area or use case>",
      "logicgate_module": "<specific LogicGate module — e.g. Risk Cloud ERM, TPRM, Policy Management, Incident Management, Controls, Assessments, Reporting>"
    }
  ],
  "scope_assessment": {
    "in_scope": ["<what is clearly in scope>"],
    "likely_out_of_scope": ["<what appears out of scope or is not mentioned>"],
    "mandatory_items": ["<non-negotiable requirements explicitly stated>"],
    "optional_items": ["<items flagged as optional, desirable, or phase 2>"]
  },
  "suggested_delivery_phases": [
    {
      "phase": 1,
      "name": "<phase name>",
      "items": ["<capability or workstream in this phase>"]
    }
  ],
  "resource_assessment": [
    {
      "role": "<role title — e.g. Project Manager, Solution Architect, LogicGate Consultant, Business Analyst, Trainer, Integration Specialist, Data Migration Support>",
      "justification": "<one-line reason based on what is in scope>"
    }
  ],
  "integration_assessment": {
    "likely_integrations": ["<system or platform likely needing integration>"],
    "data_sources": ["<data source likely to be involved>"],
    "api_dependencies": ["<specific API integration that may be required>"]
  },
  "data_migration_assessment": {
    "likely_requirements": ["<data migration requirement>"],
    "complexity": "Low | Medium | High | Unknown",
    "assumptions": ["<assumption RR is making about migration>"]
  },
  "support_assessment": {
    "support_expectations": ["<level or type of support expected>"],
    "hypercare_requirements": ["<hypercare or go-live support requirement>"],
    "training_obligations": ["<training requirement or obligation>"]
  },
  "geographic_assessment": {
    "operating_regions": ["<region where customer operates>"],
    "implementation_timezone_impacts": ["<timezone consideration for delivery>"],
    "support_timezone_impacts": ["<timezone requirement for ongoing support>"]
  },
  "risk_assessment": {
    "delivery_risks": ["<risk to successful delivery>"],
    "integration_risks": ["<risk related to integrations or data>"],
    "resource_risks": ["<resourcing risk>"],
    "platform_risks": ["<risk related to platform, vendor, or technical architecture>"]
  },
  "open_questions": {
    "customer_clarification": ["<question RR needs answered by the customer before responding>"],
    "vendor_clarification": ["<question RR needs answered by LogicGate or Panorays>"],
    "scope_clarification": ["<scope ambiguity that needs resolving>"]
  },
  "response_candidates": {
    "rr_responds": ["<requirement area where RR should own the response — implementation, delivery, support, commercials>"],
    "logicgate_validates": ["<requirement area where LogicGate must validate — platform features, architecture, security, SLAs>"],
    "joint_response": ["<requirement area requiring both RR implementation context and vendor platform detail>"],
    "can_be_ignored": ["<requirement area that is administrative, legal boilerplate, or out of scope>"]
  }
}`;

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nDocument content:\n${allContent}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 6000 });
    return result ?? {};
  } catch (err) {
    log.warn({ err }, "claudeOpportunityIntelligence failed — returning empty assessment");
    return {};
  }
}

// ── Stage 3a: Identify response candidates from Excel rows ────────────────────

async function claudeIdentifyResponseCandidates(
  rows: ParsedRow[],
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  oiAssessment: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const oiCtx = oiAssessment
    ? `\nOpportunity context (from the OI Assessment):
- Customer objectives: ${JSON.stringify((oiAssessment.customer_objectives as string[]) ?? [])}
- In-scope capabilities: ${JSON.stringify((oiAssessment.scope_assessment as Record<string,unknown> | null)?.in_scope ?? [])}
- Response candidates overview: ${JSON.stringify(oiAssessment.response_candidates ?? {})}`
    : "";

  const system = `You are a bid manager at Risk Rising categorising RFP/RFI requirements into response buckets.

Do NOT write responses. Do NOT provide strategy. Just categorise each requirement.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${oiCtx}

For each requirement, determine:
1. Bucket: RR | LogicGate | Joint | Ignore
2. Mandatory or Optional
3. One sentence explaining why

Bucket definitions:
- RR: RR owns the response — implementation, configuration, project delivery, training, UAT, hypercare, support model, managed service, commercials, advisory.
- LogicGate: LogicGate must validate or respond — platform features, technical architecture, security certifications, product roadmap, platform SLAs, hosting.
- Joint: RR provides implementation/service context AND vendor provides platform/product detail.
- Ignore: Administrative, legal boilerplate, company information, completely out of scope, or clearly not relevant.

Output ONLY valid JSON — no prose, no code fences:
{
  "candidates": [
    {
      "requirement_id": "RC-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim text — do not alter>",
      "category": "<from categories list>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>",
      "bucket": "<RR|LogicGate|Joint|Ignore>",
      "reason": "<one factual sentence>"
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.`;

  const rowsSummary = rows.map((r, i) => ({
    index: startIndex + i + 1,
    id: r.id,
    requirement: r.requirement,
    category: r.category,
    priority: r.priority,
  }));

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\nRequirements to categorise:\n${JSON.stringify(rowsSummary, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ candidates: Record<string, unknown>[] }>(
      system, user, { maxTokens: 6000 }
    );
    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    return candidates.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeIdentifyResponseCandidates failed — generating fallback rows");
    return rows.map((r, i) => ({
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
      original_question: r.requirement,
      category: r.category ?? "Other / unknown",
      mandatory_optional: r.priority?.toLowerCase().includes("mand") ? "Mandatory" : "Unknown",
      bucket: "RR",
      reason: "Categorisation failed — please review manually.",
    }));
  }
}

// ── Stage 3b: Identify response candidates from text docs ─────────────────────

async function claudeExtractCandidatesFromText(
  text: string,
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  oiAssessment: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const oiCtx = oiAssessment
    ? `\nOpportunity context (from the OI Assessment):
- Customer objectives: ${JSON.stringify((oiAssessment.customer_objectives as string[]) ?? [])}
- In-scope capabilities: ${JSON.stringify((oiAssessment.scope_assessment as Record<string,unknown> | null)?.in_scope ?? [])}`
    : "";

  const system = `You are a bid manager at Risk Rising extracting and categorising requirements from an RFP/RFI document.

Extract every distinct question or requirement, then categorise each one. Do NOT write responses. Do NOT provide strategy.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${oiCtx}

Extraction rules:
- Extract EVERY distinct question or requirement, even brief ones.
- Do not merge multiple requirements into one.
- Ignore table of contents, headers, page numbers, footers.
- If this chunk contains no requirements, return an empty array.

Bucket definitions:
- RR: RR owns the response — implementation, configuration, delivery, training, UAT, hypercare, support, managed service, commercials.
- LogicGate: LogicGate must validate — platform features, technical architecture, security, SLAs, roadmap, hosting.
- Joint: RR provides service context AND vendor provides platform detail.
- Ignore: Administrative, legal boilerplate, company info, or out of scope.

Output ONLY valid JSON — no prose, no code fences:
{
  "candidates": [
    {
      "requirement_id": "RC-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim text>",
      "category": "<from categories list>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>",
      "bucket": "<RR|LogicGate|Joint|Ignore>",
      "reason": "<one factual sentence>"
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.`;

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\n${text}`;

  try {
    const result = await callClaudeJSON<{ candidates: Record<string, unknown>[] }>(
      system, user, { maxTokens: 5000 }
    );
    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    return candidates.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeExtractCandidatesFromText failed — skipping chunk");
    return [];
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

    // Separate requirements matrices from contextual docs
    const requirementIds = new Set(
      classifications.filter((c) => c.docType === "Requirements Matrix").map((c) => c.id)
    );
    const excelIds = new Set(docs.filter((d) => d.fileType === "excel").map((d) => d.id));
    const requirementDocs = docs.filter((d) => excelIds.has(d.id) || requirementIds.has(d.id));
    const contextualDocs  = docs.filter((d) => !excelIds.has(d.id) && !requirementIds.has(d.id));

    // Build combined content for OI Assessment — ALL docs (contextual first, then req matrices abbreviated)
    let oiContent = "";
    for (const doc of contextualDocs) {
      if (doc.text) {
        const toAdd = `\n\n=== ${doc.name} ===\n${doc.text}`;
        if (oiContent.length + toAdd.length <= MAX_OI_CHARS) oiContent += toAdd;
      }
    }
    // Include abbreviated requirements matrix content so OI has full picture
    for (const doc of requirementDocs) {
      if (doc.structuredRows && doc.structuredRows.length > 0) {
        const reqs = doc.structuredRows.slice(0, 100).map((r) => r.requirement).filter(Boolean).join("\n");
        const toAdd = `\n\n=== ${doc.name} (requirements list) ===\n${reqs}`;
        if (oiContent.length + toAdd.length <= MAX_OI_CHARS) oiContent += toAdd;
      } else if (doc.text) {
        const toAdd = `\n\n=== ${doc.name} ===\n${doc.text.slice(0, 8000)}`;
        if (oiContent.length + toAdd.length <= MAX_OI_CHARS) oiContent += toAdd;
      }
    }

    // Build candidate-extraction steps (requirements matrices only)
    type Step =
      | { type: "excel"; rows: ParsedRow[]; docName: string }
      | { type: "text";  text: string;      docName: string };

    const candidateSteps: Step[] = [];
    for (const doc of requirementDocs) {
      if (doc.fileType === "excel" && doc.structuredRows && doc.structuredRows.length > 0) {
        batchRows(doc.structuredRows, ROWS_PER_BATCH).forEach((b) =>
          candidateSteps.push({ type: "excel", rows: b, docName: doc.name })
        );
      } else if (doc.text) {
        chunkText(doc.text, MAX_CHARS_PER_CHUNK).forEach((c) =>
          candidateSteps.push({ type: "text", text: c, docName: doc.name })
        );
      }
    }

    const hasContent = oiContent.trim().length > 0;
    const totalSteps = 1 + (hasContent ? 1 : 0) + candidateSteps.length;
    let stepIdx = 1;

    // ── Step 2: Opportunity Intelligence Assessment ─────────────────────────
    let oiAssessment: Record<string, unknown> = {};
    if (hasContent) {
      updateProgress(jobId, stepIdx, totalSteps, "Running Opportunity Intelligence Assessment…");
      oiAssessment = await claudeOpportunityIntelligence(oiContent, company, vendorContext, log);
      updateJob(jobId, { rfpUnderstanding: oiAssessment, assessment: oiAssessment });
      log.info({ jobId }, "OI Assessment complete");
      stepIdx++;
    }

    // ── Step 3: Extract Response Candidates ────────────────────────────────
    let candidateCounter = 0;
    for (const [i, step] of candidateSteps.entries()) {
      const label = candidateSteps.length === 1
        ? "Identifying response candidates…"
        : `Identifying response candidates — batch ${i + 1} of ${candidateSteps.length}`;
      updateProgress(jobId, stepIdx, totalSteps, label);

      let candidates: Record<string, unknown>[];
      if (step.type === "excel") {
        candidates = await claudeIdentifyResponseCandidates(
          step.rows, step.docName, vendorContext, company, candidateCounter, oiAssessment, log
        );
      } else {
        candidates = await claudeExtractCandidatesFromText(
          step.text, step.docName, vendorContext, company, candidateCounter, oiAssessment, log
        );
      }

      candidateCounter += candidates.length;
      appendRequirements(jobId, candidates);
      log.info({ jobId, batch: i + 1, total: candidateSteps.length, count: candidates.length, runningTotal: candidateCounter }, "candidate batch done");
      stepIdx++;
    }

    updateJob(jobId, {
      status: "done",
      progress: {
        done: totalSteps,
        total: totalSteps,
        stage: `Done — OI Assessment complete${candidateCounter > 0 ? `, ${candidateCounter} response candidates identified` : ""}`,
      },
    });

    log.info({ jobId, candidateCounter, hasOI: hasContent }, "extraction job complete");
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
  req.log.info({ jobId: job.id, documentIds, company }, "rfp: OI assessment job created");

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

// ── Legacy routes ─────────────────────────────────────────────────────────────

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
    (r) => r.bucket === "LogicGate" || r.bucket === "Joint"
  );
  const toProcess = vendorItems.length > 0 ? vendorItems : (requirements as Array<Record<string, unknown>>);
  const summary = toProcess.slice(0, 100).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    bucket: r.bucket,
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
    bucket: r.bucket,
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
  oiAssessment: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const oiCtx = oiAssessment
    ? `\nOpportunity context (from OI Assessment):
- Customer objectives: ${JSON.stringify((oiAssessment.customer_objectives as string[]) ?? [])}
- Business use cases: ${JSON.stringify((oiAssessment.business_use_cases as string[]) ?? [])}
- In-scope capabilities: ${JSON.stringify((oiAssessment.scope_assessment as Record<string,unknown> | null)?.in_scope ?? [])}
- Open questions — customer: ${JSON.stringify((oiAssessment.open_questions as Record<string,unknown> | null)?.customer_clarification ?? [])}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising creating a detailed RFP/RFI Response Mapping Pack.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}
${oiCtx}

For each response candidate, produce a complete mapping entry.

Use the bucket and reason fields already provided as your starting point — validate and build on them, do not contradict without good reason.

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
- confidence: High | Medium | Low
- assumptions: Key assumptions. Null if none.
- status: Always "Draft".
- notes: One-sentence rationale for owner assignment.

Rules:
- Never invent platform capabilities.
- UK English throughout.
- draft_rr_response max 120 words.
- Responses must reflect the customer's stated objectives where relevant.

Output ONLY valid JSON — no prose, no code fences:
{
  "rows": [
    {
      "requirement_id": "RC-001",
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
    bucket: r.bucket ?? null,
    reason: r.reason ?? null,
  }));

  const user = `Company: ${company}\nVendor context: ${vendorContext}\n\nCandidates to map:\n${JSON.stringify(input, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ rows: Record<string, unknown>[] }>(system, user, { maxTokens: 8000 });
    return Array.isArray(result?.rows) ? result.rows : [];
  } catch (err) {
    log.warn({ err }, "claudeMapBatch failed — returning stub rows");
    return batch.map((r) => ({
      requirement_id: r.requirement_id,
      original_question: r.original_question,
      category: r.category,
      owner: r.bucket ?? "Unknown",
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
  oiAssessment: Record<string, unknown> | null,
  log: Logger
): Promise<Record<string, unknown>> {
  const oiCtx = oiAssessment
    ? `\nCustomer objectives: ${JSON.stringify((oiAssessment.customer_objectives as string[]) ?? [])}`
    : "";

  const system = `You are a senior GRC consultant at Risk Rising. Based on the completed RFP/RFI Response Mapping Pack, produce an executive summary.
${RR_CONTEXT}
${oiCtx}

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
  oiAssessment: Record<string, unknown> | null,
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

      const rows = await claudeMapBatch(batch, vendorContext, company, oiAssessment, log);
      appendMappingRows(jobId, rows);

      log.info({ jobId, batch: i + 1, total, rowsThisBatch: rows.length }, "mapping batch done");
    }

    updateProgress(jobId, batches.length, total, "Generating pack summary…");
    const job = getJob(jobId)!;
    const summary = await claudeGenerateMappingSummary(
      job.mappingRows, company, vendorContext, oiAssessment, log
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
