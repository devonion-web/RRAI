import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import * as XLSX from "xlsx";
import { callClaudeJSONStreamed } from "../lib/anthropic";
import { storeDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";

// 50 MB per file — sufficient for large enterprise RFPs / security questionnaires
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
});

const router = Router();

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

// ── GET /api/rfp/health ──────────────────────────────────────────────────────
router.get("/rfp/health", (req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// ── POST /api/rfp/upload-files ───────────────────────────────────────────────
// Accepts multipart file uploads. Extracts text server-side, stores it with a
// UUID and returns ONLY metadata (id, name, charCount). Raw text never travels
// back to the browser — subsequent analysis calls reference docs by ID only.
router.post("/rfp/upload-files", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" }); return;
  }

  req.log.info({ count: files.length, totalBytes: files.reduce((s, f) => s + f.size, 0) }, "rfp upload-files: processing");

  const results: Array<{ id?: string; name: string; charCount?: number; error?: string }> = [];

  for (const file of files) {
    const name = file.originalname;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    try {
      let text = "";
      if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else if (ext === "pdf") {
        const result = await pdfParse(file.buffer);
        text = result.text;
      } else if (ext === "xlsx" || ext === "xls") {
        const wb = XLSX.read(file.buffer, { type: "buffer" });
        const parts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          parts.push(`=== Sheet: ${sheetName} ===`);
          parts.push(XLSX.utils.sheet_to_csv(ws));
        }
        text = parts.join("\n\n");
      } else if (ext === "csv") {
        const wb = XLSX.read(file.buffer, { type: "buffer" });
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      } else {
        text = file.buffer.toString("utf-8");
      }
      const entry = storeDoc(name, text.trim());
      req.log.info({ id: entry.id, name, charCount: entry.charCount, bytes: file.size }, "rfp: stored doc");
      results.push({ id: entry.id, name: entry.name, charCount: entry.charCount });
    } catch (err) {
      req.log.warn({ name, err }, "rfp: failed to extract file");
      results.push({ name, error: (err as Error).message });
    }
  }

  res.json({ files: results });
});

// ── POST /api/rfp/store-text ─────────────────────────────────────────────────
// Accepts pasted/typed text. Stores it server-side and returns metadata only.
router.post("/rfp/store-text", async (req, res): Promise<void> => {
  const { name, text } = req.body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" }); return;
  }
  const safeName = typeof name === "string" && name.trim() ? name.trim() : "Pasted document";
  const entry = storeDoc(safeName, text.trim());
  req.log.info({ id: entry.id, name: safeName, charCount: entry.charCount }, "rfp: stored pasted text");
  res.json({ id: entry.id, name: entry.name, charCount: entry.charCount });
});

// ── DELETE /api/rfp/documents/:id ────────────────────────────────────────────
router.delete("/rfp/documents/:id", (req, res) => {
  removeDoc(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/rfp/extract-requirements ──────────────────────────────────────
// Accepts documentIds (array of server-side UUIDs). Looks up stored text,
// never receiving raw document content from the browser.
router.post("/rfp/extract-requirements", async (req, res): Promise<void> => {
  const { documentIds, vendorContext, company } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    res.status(400).json({ error: "documentIds array is required" }); return;
  }

  const docs = getDocs(documentIds as string[]);
  if (docs.length === 0) {
    res.status(400).json({ error: "No documents found for the provided IDs. They may have expired (4-hour TTL) — please re-upload." }); return;
  }

  const totalChars = docs.reduce((s, d) => s + d.charCount, 0);
  req.log.info({ docCount: docs.length, totalChars, company }, "rfp extract-requirements: start");

  // Cap at 120k chars (≈ 90k tokens) — Claude can handle large contexts
  const combinedText = docs
    .map((d) => `=== Document: ${d.name} ===\n${d.text}`)
    .join("\n\n")
    .slice(0, 120000);

  const system = `You are an expert GRC procurement analyst at Risk Rising. Extract every identifiable question, requirement or response item from the uploaded RFP/RFI documents.
${RR_CONTEXT}

Output ONLY valid JSON. No prose, no code fences.
{
  "health": {
    "company": "<customer name or Unknown>",
    "rfp_type": "<RFI|RFP|Security questionnaire|Implementation questionnaire|Procurement pack|Mixed>",
    "response_deadline": "<date string or null>",
    "total_requirements": <integer>,
    "logicgate_fit": "<High|Medium|Low|Unknown>",
    "panorays_fit": "<High|Medium|Low|Unknown>",
    "rr_delivery_fit": "<High|Medium|Low|Unknown>",
    "managed_service_potential": "<High|Medium|Low|Unknown>",
    "commercial_complexity": "<High|Medium|Low|Unknown>",
    "key_risks": ["<risk>"],
    "recommended_action": "<Proceed|Proceed with vendor input|Clarify|Do not proceed>",
    "recommended_action_rationale": "<one sentence>"
  },
  "requirements": [
    {
      "requirement_id": "REQ-001",
      "source_document": "<filename>",
      "original_question": "<verbatim or closely paraphrased requirement>",
      "category": "<category>",
      "mandatory_optional": "<Mandatory|Optional|Unknown>"
    }
  ]
}
Categories: ${CATEGORIES.join(", ")}.
Extract EVERY distinct question. Do not merge. Aim for completeness over brevity.`;

  const user = `Vendor context: ${String(vendorContext || "Unknown")}\nCompany: ${String(company || "Unknown")}\n\nDocuments:\n${combinedText}`;

  try {
    const result = await callClaudeJSONStreamed<{ health: Record<string, unknown>; requirements: Record<string, unknown>[] }>(
      system, user, res, { maxTokens: 8000 }
    );
    req.log.info({ company, requirementCount: result.requirements?.length, totalChars }, "rfp extract-requirements completed");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp extract-requirements failed");
    res.status(500).json({ error: (err as Error).message });
  }
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

  const user = `Vendor context: ${String(vendorContext || "Unknown")}\nCompany: ${String(company || "Unknown")}\n\nRequirements:\n${JSON.stringify(requirements, null, 2).slice(0, 80000)}`;

  try {
    const result = await callClaudeJSONStreamed<{ requirements: Record<string, unknown>[]; ownership_summary: Record<string, number> }>(
      system, user, res, { maxTokens: 8000 }
    );
    req.log.info({ company, count: result.requirements?.length }, "rfp classify completed");
    res.json(result);
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

  const user = `Company: ${String(company || "Unknown")}\nVendor context: ${String(vendorContext || "Unknown")}\n\nRequirements:\n${JSON.stringify(requirements, null, 2).slice(0, 80000)}`;

  try {
    const result = await callClaudeJSONStreamed<{ responses: Record<string, unknown>[] }>(
      system, user, res, { maxTokens: 8000 }
    );
    req.log.info({ company, count: result.responses?.length }, "rfp generate-responses completed");
    res.json(result);
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
  const user = `Company: ${String(company || "Unknown")}\nVendor context: ${String(vendorContext || "Unknown")}\n\nRequirements needing vendor input:\n${JSON.stringify(toProcess, null, 2).slice(0, 80000)}`;

  try {
    const result = await callClaudeJSONStreamed<{ logicgate_pack: string | null; panorays_pack: string | null; summary: string }>(
      system, user, res, { maxTokens: 6000 }
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

  const user = `Company: ${String(company || "Unknown")}\nVendor context: ${String(vendorContext || "Unknown")}\n\nFull requirement set:\n${JSON.stringify(requirements, null, 2).slice(0, 80000)}`;

  try {
    const result = await callClaudeJSONStreamed<Record<string, unknown>>(
      system, user, res, { maxTokens: 5000 }
    );
    req.log.info({ company }, "rfp generate-gap-analysis completed");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "rfp generate-gap-analysis failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
