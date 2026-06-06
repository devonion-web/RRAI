import { Router, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import { createJob, getJob, updateJob, updateProgress, appendRequirements, appendMappingRows } from "../lib/jobStore";
import { parseExcelForRequirements, batchRows, chunkText, type ParsedRow } from "../lib/xlsxParser";
import type { Logger } from "pino";

const MAX_CHARS_PER_CHUNK = 18_000;   // hard ceiling per Claude call
const ROWS_PER_BATCH      = 30;       // Excel rows per Claude call

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

const router = Router();

// ── Shared prompts ────────────────────────────────────────────────────────────
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
  "Functional capability","Technical architecture","Security","Compliance",
  "Data / integrations","Reporting / dashboards","Workflow / configuration",
  "Implementation approach","Project delivery","Training","UAT / testing",
  "Hypercare","Support","Managed service","Commercials","Legal / contractual",
  "Case studies / references","Company information","Other / unknown",
];

// ── Claude helpers ────────────────────────────────────────────────────────────

function padId(n: number): string {
  return `REQ-${String(n).padStart(3, "0")}`;
}

/**
 * Extract requirements from a prose text chunk.
 * Returns an empty array on any parse failure so the job continues.
 */
async function claudeExtractFromTextChunk(
  text: string,
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const system = `You are an expert GRC procurement analyst. Extract every identifiable question or requirement from the following document text chunk.
${RR_CONTEXT}

Rules:
- Extract EVERY distinct question or requirement, even brief ones.
- Do not merge multiple requirements into one.
- Ignore table of contents, headers, page numbers, footers.
- If the chunk contains no requirements, return an empty array.

Output ONLY valid JSON — no prose, no code fences:
{
  "requirements": [
    {
      "requirement_id": "REQ-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim or closely paraphrased>",
      "category": "<category from list>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>"
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.`;

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\n${text}`;

  try {
    const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(
      system, user, { maxTokens: 4000 }
    );
    const reqs = Array.isArray(result?.requirements) ? result.requirements : [];
    return reqs.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeExtractFromTextChunk failed — skipping chunk");
    return [];
  }
}

/**
 * Enrich / classify a batch of pre-parsed Excel rows.
 * Rows already have requirement text + optional category/priority from spreadsheet.
 */
async function claudeEnrichExcelBatch(
  rows: ParsedRow[],
  docName: string,
  vendorContext: string,
  company: string,
  startIndex: number,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const system = `You are an expert GRC procurement analyst. Given these structured requirement rows extracted from a spreadsheet, produce normalized requirement objects.
${RR_CONTEXT}

For each row:
- Use the existing requirement text verbatim as original_question.
- Use the provided category if present and sensible; otherwise infer from the list.
- Use the provided priority to set mandatory_optional (Mandatory / Optional / Unknown).
- Do NOT invent or hallucinate requirements not in the input rows.

Output ONLY valid JSON — no prose, no code fences:
{
  "requirements": [
    {
      "requirement_id": "REQ-NNN",
      "source_document": "<filename>",
      "original_question": "<verbatim requirement text>",
      "category": "<category from list>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>"
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

  const user = `Vendor context: ${vendorContext}\nCompany: ${company}\nDocument: ${docName}\n\nRows:\n${JSON.stringify(rowsSummary, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(
      system, user, { maxTokens: 4000 }
    );
    const reqs = Array.isArray(result?.requirements) ? result.requirements : [];
    return reqs.map((r, i) => ({
      ...r,
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
    }));
  } catch (err) {
    log.warn({ err, docName }, "claudeEnrichExcelBatch failed — generating fallback rows");
    // Fallback: create plain requirement objects from rows without Claude enrichment
    return rows.map((r, i) => ({
      requirement_id: padId(startIndex + i + 1),
      source_document: docName,
      original_question: r.requirement,
      category: r.category ?? "Other / unknown",
      mandatory_optional: r.priority?.toLowerCase().includes("mand") ? "Mandatory" : "Unknown",
    }));
  }
}

/**
 * Generate the health/meta summary after all requirements are extracted.
 */
async function claudeGenerateHealth(
  requirements: Record<string, unknown>[],
  company: string,
  vendorContext: string,
  log: Logger
): Promise<Record<string, unknown>> {
  const system = `You are an expert GRC procurement analyst at Risk Rising. Based on the extracted requirements, produce a health/fit assessment.
${RR_CONTEXT}

Output ONLY valid JSON — no prose, no code fences:
{
  "company": "<name or Unknown>",
  "rfp_type": "<RFI|RFP|Security questionnaire|Implementation questionnaire|Procurement pack|Mixed>",
  "response_deadline": null,
  "total_requirements": <integer>,
  "logicgate_fit": "<High|Medium|Low|Unknown>",
  "panorays_fit": "<High|Medium|Low|Unknown>",
  "rr_delivery_fit": "<High|Medium|Low|Unknown>",
  "managed_service_potential": "<High|Medium|Low|Unknown>",
  "commercial_complexity": "<High|Medium|Low|Unknown>",
  "key_risks": ["<risk>"],
  "recommended_action": "<Proceed|Proceed with vendor input|Clarify|Do not proceed>",
  "recommended_action_rationale": "<one sentence>"
}`;

  const sample = requirements.slice(0, 60).map((r) => ({
    category: r.category,
    mandatory_optional: r.mandatory_optional,
    original_question: typeof r.original_question === "string"
      ? r.original_question.slice(0, 120) : "",
  }));

  const user = `Company: ${company}\nVendor context: ${vendorContext}\nTotal requirements extracted: ${requirements.length}\n\nSample requirements:\n${JSON.stringify(sample, null, 2)}`;

  try {
    return await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 1500 });
  } catch (err) {
    log.warn({ err }, "claudeGenerateHealth failed — returning minimal health");
    return {
      company,
      rfp_type: "Unknown",
      response_deadline: null,
      total_requirements: requirements.length,
      logicgate_fit: "Unknown",
      panorays_fit: "Unknown",
      rr_delivery_fit: "Unknown",
      managed_service_potential: "Unknown",
      commercial_complexity: "Unknown",
      key_risks: [],
      recommended_action: "Clarify",
      recommended_action_rationale: "Health summary could not be generated automatically.",
    };
  }
}

// ── Background job runner ─────────────────────────────────────────────────────

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

    // Build the step list up-front so we know total
    type Step =
      | { type: "text"; text: string; docName: string }
      | { type: "excel"; rows: ParsedRow[]; docName: string };

    const steps: Step[] = [];

    for (const doc of docs) {
      if (doc.fileType === "excel" && doc.structuredRows && doc.structuredRows.length > 0) {
        const batches = batchRows(doc.structuredRows, ROWS_PER_BATCH);
        batches.forEach((b) => steps.push({ type: "excel", rows: b, docName: doc.name }));
      } else if (doc.text) {
        const chunks = chunkText(doc.text, MAX_CHARS_PER_CHUNK);
        chunks.forEach((c) => steps.push({ type: "text", text: c, docName: doc.name }));
      }
    }

    const totalSteps = steps.length + 1; // +1 for health generation
    let reqCounter = 0;

    log.info({ jobId, stepCount: steps.length, docCount: docs.length }, "extraction job started");

    for (const [i, step] of steps.entries()) {
      const stageLabel = steps.length === 1
        ? `Processing ${step.docName}…`
        : `${step.docName} — batch ${i + 1} of ${steps.length}`;

      updateProgress(jobId, i, totalSteps, stageLabel);

      let reqs: Record<string, unknown>[];

      if (step.type === "excel") {
        reqs = await claudeEnrichExcelBatch(step.rows, step.docName, vendorContext, company, reqCounter, log);
      } else {
        reqs = await claudeExtractFromTextChunk(step.text, step.docName, vendorContext, company, reqCounter, log);
      }

      reqCounter += reqs.length;
      appendRequirements(jobId, reqs);
      log.info({ jobId, step: i + 1, totalSteps, reqsThisStep: reqs.length, totalReqs: reqCounter }, "step complete");
    }

    // Final step: health
    updateProgress(jobId, steps.length, totalSteps, "Generating assessment…");
    const job = getJob(jobId)!;
    const health = await claudeGenerateHealth(job.requirements, company, vendorContext, log);

    updateJob(jobId, {
      status: "done",
      health,
      progress: { done: totalSteps, total: totalSteps, stage: `Done — ${reqCounter} requirements extracted` },
    });

    log.info({ jobId, requirementCount: reqCounter }, "extraction job complete");
  } catch (err) {
    log.error({ jobId, err }, "extraction job crashed");
    updateJob(jobId, { status: "error", error: (err as Error).message });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/rfp/health", (_req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// ── POST /api/rfp/upload-files ───────────────────────────────────────────────
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
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "xlsx" || ext === "xls") {
        // Smart structural parse — no CSV dump
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
        req.log.info({ id: entry.id, name, rowCount: entry.rowCount }, "rfp: stored excel doc");
        results.push({ id: entry.id, name, fileType: "excel", rowCount: entry.rowCount });
      } else {
        // Text extraction for PDF, Word, plain text
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
        req.log.info({ id: entry.id, name, charCount: entry.charCount }, "rfp: stored text doc");
        results.push({ id: entry.id, name, fileType: "text", charCount: entry.charCount });
      }
    } catch (err) {
      req.log.warn({ name, err }, "rfp: failed to process file");
      results.push({ name, error: (err as Error).message });
    }
  }

  res.json({ files: results });
});

// ── POST /api/rfp/store-text ─────────────────────────────────────────────────
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

// ── DELETE /api/rfp/documents/:id ────────────────────────────────────────────
router.delete("/rfp/documents/:id", (req, res) => {
  removeDoc(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/rfp/extract-requirements ───────────────────────────────────────
// Returns {jobId} immediately. Processing runs in the background.
// Poll GET /api/rfp/jobs/:id for progress and results.
router.post("/rfp/extract-requirements", (req: Request, res): void => {
  const { documentIds, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    res.status(400).json({ error: "documentIds array is required" }); return;
  }

  const job = createJob();
  req.log.info({ jobId: job.id, documentIds, company }, "rfp: extraction job created");

  // Fire-and-forget — runs after response is sent
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
    health: job.health,
    requirements: job.requirements,
    mappingRows: job.mappingRows,
    mappingSummary: job.mappingSummary,
    error: job.error,
  });
});

// ── POST /api/rfp/classify ───────────────────────────────────────────────────
router.post("/rfp/classify", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }

  const system = `You are an expert GRC procurement analyst at Risk Rising. Classify each requirement by owner.
${RR_CONTEXT}
${OWNERSHIP_GUIDE}

Output ONLY valid JSON. No prose, no code fences.
{
  "requirements": [
    {
      "requirement_id": "<same ID as input>",
      "owner": "<RR|LogicGate|Panorays|Joint|Unknown>",
      "vendor_context": "<LogicGate|Panorays|Both|RR only|Unknown>",
      "priority": "<High|Medium|Low>",
      "confidence": "<High|Medium|Low>",
      "vendor_response_needed": <true|false>,
      "notes": "<brief rationale>"
    }
  ],
  "ownership_summary": {
    "rr_count": <int>, "logicgate_count": <int>, "panorays_count": <int>, "joint_count": <int>, "unknown_count": <int>
  }
}
Classify EVERY item. Return SAME requirement_id values. If unsure, use Unknown.`;

  // Classify in batches of 50 to stay within token limits
  const allClassified: Record<string, unknown>[] = [];
  const reqs = requirements as Record<string, unknown>[];
  const batches = batchRows(reqs, 50);

  try {
    for (const batch of batches) {
      const user = `Vendor context: ${String(vendorContext ?? "Unknown")}\nCompany: ${String(company ?? "Unknown")}\n\nRequirements:\n${JSON.stringify(batch, null, 2)}`;
      const result = await callClaudeJSON<{ requirements: Record<string, unknown>[] }>(system, user, { maxTokens: 6000 });
      if (Array.isArray(result?.requirements)) allClassified.push(...result.requirements);
    }

    // Compute ownership summary across all batches
    const ownership_summary = allClassified.reduce<Record<string, number>>((acc, r) => {
      const key = `${String(r.owner ?? "unknown").toLowerCase()}_count`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    req.log.info({ company, count: allClassified.length }, "rfp classify completed");
    res.json({ requirements: allClassified, ownership_summary });
  } catch (err) {
    req.log.error({ err }, "rfp classify failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/rfp/generate-responses ────────────────────────────────────────
router.post("/rfp/generate-responses", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }

  const system = `You are a senior consultant at Risk Rising writing RFP/RFI responses.
${RR_CONTEXT}

RR-owned items: write a concise, professional response (max 120 words). Be specific about implementation, delivery, support or commercial approach. Flag assumptions. UK spelling. Do NOT overclaim or invent product capabilities.
Joint items: write the RR element first, then add a "Vendor validation required:" note.
Vendor-owned (LogicGate/Panorays): provide only a suggested vendor response request.

Output ONLY valid JSON. No prose, no code fences.
{
  "responses": [
    {
      "requirement_id": "<same ID>",
      "rr_response_draft": "<drafted response or null if vendor-only>",
      "vendor_prompt": "<what to ask the vendor, or null if RR-only>",
      "response_confidence": "<High|Medium|Low>",
      "assumptions": "<key assumptions or null>"
    }
  ]
}`;

  const allResponses: Record<string, unknown>[] = [];
  const reqs = requirements as Record<string, unknown>[];
  const batches = batchRows(reqs, 40);

  try {
    for (const batch of batches) {
      const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\nRequirements:\n${JSON.stringify(batch, null, 2)}`;
      const result = await callClaudeJSON<{ responses: Record<string, unknown>[] }>(system, user, { maxTokens: 5000 });
      if (Array.isArray(result?.responses)) allResponses.push(...result.responses);
    }
    req.log.info({ company, count: allResponses.length }, "rfp generate-responses completed");
    res.json({ responses: allResponses });
  } catch (err) {
    req.log.error({ err }, "rfp generate-responses failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/rfp/generate-vendor-pack ──────────────────────────────────────
router.post("/rfp/generate-vendor-pack", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }

  const system = `You are a senior consultant at Risk Rising preparing a vendor input request pack to send to LogicGate or Panorays.
${RR_CONTEXT}

Generate a structured vendor response request document in markdown. Include: opportunity summary (2-3 sentences); items requiring vendor input grouped by category; for each item the question, why vendor input is needed, and what to address. UK spelling. No filler.

Output ONLY valid JSON. No prose, no code fences.
{
  "logicgate_pack": "<markdown or null>",
  "panorays_pack": "<markdown or null>",
  "summary": "<2-3 sentence overview of vendor input needed>"
}`;

  const vendorItems = (requirements as Array<Record<string, unknown>>).filter(
    (r) => r.owner === "LogicGate" || r.owner === "Panorays" || r.owner === "Joint"
  );
  const toProcess = vendorItems.length > 0 ? vendorItems : (requirements as Array<Record<string, unknown>>);
  // Summarise each requirement to avoid huge payloads
  const summary = toProcess.slice(0, 100).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    owner: r.owner,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 200) : "",
    vendor_prompt: r.vendor_prompt,
  }));

  const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\nRequirements needing vendor input:\n${JSON.stringify(summary, null, 2)}`;

  try {
    const result = await callClaudeJSON<{ logicgate_pack: string | null; panorays_pack: string | null; summary: string }>(
      system, user, { maxTokens: 6000 }
    );
    req.log.info({ company }, "rfp generate-vendor-pack completed");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp generate-vendor-pack failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/rfp/generate-gap-analysis ─────────────────────────────────────
router.post("/rfp/generate-gap-analysis", async (req, res): Promise<void> => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(requirements) || requirements.length === 0) {
    res.status(400).json({ error: "requirements array is required" }); return;
  }

  const system = `You are a senior GRC consultant at Risk Rising conducting a gap and risk analysis on an RFP/RFI response.
${RR_CONTEXT}
${OWNERSHIP_GUIDE}

Identify: missing information; product claims needing vendor confirmation; unsupported requirements; risks to response quality; questions for the customer; questions for the vendor.

Output ONLY valid JSON. No prose, no code fences.
{
  "gaps": [{ "id": "GAP-001", "description": "<missing>", "severity": "<High|Medium|Low>", "mitigation": "<action>" }],
  "risks": [{ "id": "RISK-001", "description": "<risk>", "severity": "<High|Medium|Low>", "owner": "<RR|LogicGate|Panorays|Customer>" }],
  "customer_questions": ["<question>"],
  "vendor_questions": ["<question>"],
  "unknown_items": [{ "requirement_id": "<id>", "reason": "<why unclear>" }],
  "summary": "<2-3 sentence overall summary>"
}`;

  // Summarise to avoid huge payloads
  const summary = (requirements as Record<string, unknown>[]).slice(0, 120).map((r) => ({
    requirement_id: r.requirement_id,
    category: r.category,
    owner: r.owner,
    mandatory_optional: r.mandatory_optional,
    original_question: typeof r.original_question === "string" ? r.original_question.slice(0, 150) : "",
  }));

  const user = `Company: ${String(company ?? "Unknown")}\nVendor context: ${String(vendorContext ?? "Unknown")}\n\nRequirements:\n${JSON.stringify(summary, null, 2)}`;

  try {
    const result = await callClaudeJSON<Record<string, unknown>>(system, user, { maxTokens: 5000 });
    req.log.info({ company }, "rfp generate-gap-analysis completed");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp generate-gap-analysis failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// RR MAPPING PACK
// ═════════════════════════════════════════════════════════════════════════════

const MAPPING_BATCH_SIZE = 25;

async function claudeMapBatch(
  batch: Record<string, unknown>[],
  vendorContext: string,
  company: string,
  log: Logger
): Promise<Record<string, unknown>[]> {
  const system = `You are a senior GRC consultant at Risk Rising creating a detailed RFP/RFI Response Mapping Pack.

${RR_CONTEXT}
${OWNERSHIP_GUIDE}

For each requirement, produce a complete mapping entry.

owner: Assign using the ownership guide. Use exactly one of: RR, LogicGate, Panorays, Joint, Unknown.
rr_capability_mapping: What Risk Rising can genuinely own and deliver. Max 80 words. Null if not relevant.
logicgate_mapping: What LogicGate Risk Cloud provides for this requirement. Max 80 words. Null if not relevant.
panorays_mapping: What Panorays provides. Max 80 words. Null if not relevant.
draft_rr_response: Concise Risk Rising response. Max 120 words. UK English. Rules by owner:
  - RR: write a specific implementation/delivery/support/commercial response.
  - Joint: write only the RR element; vendor element goes in vendor_question_or_prompt.
  - LogicGate / Panorays / Unknown: null — do not draft a response.
vendor_validation_required: true if vendor input is needed before a complete answer can be given.
vendor_question_or_prompt: Specific question to send to the vendor. Null if not needed.
confidence: High (clear boundary), Medium (some ambiguity), Low (complex or unclear).
assumptions: Key assumptions. Null if none.
status: Always "Draft".
notes: One-sentence rationale for owner assignment.

Rules:
- Never invent platform capabilities not listed above.
- UK English throughout (organisation, recognise, customise, programme).
- "Risk Rising" not "RiskRising".
- draft_rr_response max 120 words.
- Classify every item — never leave owner blank.

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
      owner: "Unknown",
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
  log: Logger
): Promise<Record<string, unknown>> {
  const system = `You are a senior GRC consultant at Risk Rising. Based on the complete RFP/RFI Response Mapping Pack, produce an executive summary.

${RR_CONTEXT}

Produce four lists:
- gaps_and_risks: Specific gaps or risks in the response approach (missing vendor input, unclear ownership, unsupported claims). Be specific.
- assumptions: Key assumptions underpinning the pack as a whole.
- commercial_delivery_considerations: Commercial, contractual or delivery points to factor into the response or proposal.
- recommended_next_actions: Ordered list of concrete next actions for the pursuit team.

UK English. Concise. Each item max 40 words.

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

  const user = `Company: ${company}\nVendor context: ${vendorContext}\nTotal requirements: ${mappingRows.length}\nOwnership breakdown: ${JSON.stringify(ownerCounts)}\n\nSample rows:\n${JSON.stringify(sample, null, 2)}`;

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
  log: Logger
): Promise<void> {
  try {
    updateJob(jobId, { status: "running" });

    const batches: Record<string, unknown>[][] = [];
    for (let i = 0; i < requirements.length; i += MAPPING_BATCH_SIZE) {
      batches.push(requirements.slice(i, i + MAPPING_BATCH_SIZE));
    }

    const total = batches.length + 1; // +1 for summary
    log.info({ jobId, batches: batches.length, requirements: requirements.length }, "mapping job started");

    for (const [i, batch] of batches.entries()) {
      const stage = batches.length === 1
        ? "Mapping requirements…"
        : `Mapping requirements — batch ${i + 1} of ${batches.length}`;
      updateProgress(jobId, i, total, stage);

      const rows = await claudeMapBatch(batch, vendorContext, company, log);
      appendMappingRows(jobId, rows);

      log.info({ jobId, batch: i + 1, total, rowsThisBatch: rows.length }, "mapping batch done");
    }

    updateProgress(jobId, batches.length, total, "Generating pack summary…");
    const job = getJob(jobId)!;
    const summary = await claudeGenerateMappingSummary(job.mappingRows, company, vendorContext, log);

    updateJob(jobId, {
      status: "done",
      mappingSummary: summary,
      progress: {
        done: total,
        total,
        stage: `Done — ${job.mappingRows.length} requirements mapped`,
      },
    });

    log.info({ jobId, rowCount: job.mappingRows.length }, "mapping job complete");
  } catch (err) {
    log.error({ jobId, err }, "mapping job crashed");
    updateJob(jobId, { status: "error", error: (err as Error).message });
  }
}

// ── POST /api/rfp/generate-mapping-pack ──────────────────────────────────────
// Returns {jobId} immediately. Polls via GET /api/rfp/jobs/:id.
// Job result: mappingRows[], mappingSummary.
router.post("/rfp/generate-mapping-pack", (req: Request, res): void => {
  const { requirements, vendorContext, company } = req.body as Record<string, unknown>;
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
    req.log
  );

  res.json({ jobId: job.id });
});

// ── POST /api/rfp/regenerate-mapping-row ─────────────────────────────────────
// Synchronous — processes a single row, returns the updated row.
router.post("/rfp/regenerate-mapping-row", async (req, res): Promise<void> => {
  const { requirement, vendorContext, company } = req.body as Record<string, unknown>;
  if (!requirement || typeof requirement !== "object") {
    res.status(400).json({ error: "requirement object is required" }); return;
  }

  try {
    const rows = await claudeMapBatch(
      [requirement as Record<string, unknown>],
      String(vendorContext ?? "Unknown"),
      String(company ?? "Unknown"),
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
