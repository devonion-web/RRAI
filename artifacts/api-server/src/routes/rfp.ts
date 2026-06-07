import { Router, type Request } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { readFileSync } from "fs";
import { join } from "path";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import {
  createPack, getPack, setSections, getSection,
  updateSection, saveDraft, updateDraft, advanceDraftStatus,
  COMPONENT_LABELS,
  type DraftComponent, type Placeholder,
} from "../lib/bidPackStore";
import { parseExcelForRequirements } from "../lib/xlsxParser";
import type { Logger } from "pino";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 20 } });
const router = Router();
const PROMPTS_DIR = join(process.cwd(), "prompts");

// ── Context ───────────────────────────────────────────────────────────────────

const RR_CONTEXT = `Risk Rising is a specialist GRC implementation and advisory consultancy partnering with LogicGate (Risk Cloud) and Panorays (third-party cyber risk). Risk Rising owns: all implementation, configuration, project delivery, training, UAT, hypercare, support, managed service and commercial aspects. Software vendors own: functional platform capability, technical architecture, security, hosting, product roadmap and platform SLAs.

Risk Rising delivery capabilities: GRC programme design; LogicGate Risk Cloud and Panorays implementation; agile and waterfall delivery; requirements workshops; app configuration and workflow design; system integration support; user training and train-the-trainer; UAT and go-live hypercare; post-go-live managed service; commercial negotiation.`;

// ── Prompt helpers ────────────────────────────────────────────────────────────

function readPrompt(name: string): string {
  try { return readFileSync(join(PROMPTS_DIR, name), "utf-8"); }
  catch (err) { return ""; }
}

function buildContent(docs: ReturnType<typeof getDocs>, charLimitPerDoc: number): string {
  let content = "";
  for (const doc of docs) {
    if (doc.text) {
      const slice = doc.text.length > charLimitPerDoc
        ? doc.text.slice(0, charLimitPerDoc) + "\n[...truncated]"
        : doc.text;
      content += `\n\n=== ${doc.name} ===\n${slice}`;
    } else if (doc.structuredRows?.length) {
      const reqs = doc.structuredRows.slice(0, 200).map((r) => r.requirement).filter(Boolean).join("\n");
      content += `\n\n=== ${doc.name} (spreadsheet) ===\n${reqs.slice(0, charLimitPerDoc)}`;
    }
  }
  return content;
}

// ── Section detection ─────────────────────────────────────────────────────────

const DETECT_SECTIONS_SYSTEM = `You are an expert bid analyst. Read the provided procurement documents and identify all scored response sections.

A scored response section requires a detailed written response (100+ words) that will be evaluated by the buyer. These are typically numbered (e.g. "Section 2.1", "Q4", "Lot 2 — Technical") and include specific questions or requirements the bidder must address in prose.

NOT scored sections: pricing matrices, administrative forms, declarations, company information templates, tick-box compliance matrices, yes/no questions, or standard terms and conditions.

For each scored section, provide:
- code: section reference exactly as in the document (e.g. "2.1", "Section 4")
- title: concise title
- scoringWeight: stated weighting or null
- summary: one sentence describing what must be addressed

Output ONLY valid JSON — no prose, no code fences:
{ "sections": [{ "code": "string", "title": "string", "scoringWeight": "string|null", "summary": "string" }] }`;

// ── Health ────────────────────────────────────────────────────────────────────

router.get("/rfp/health", (_req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// ── Upload ────────────────────────────────────────────────────────────────────

router.post("/rfp/upload-files", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) { res.status(400).json({ error: "No files uploaded" }); return; }

  req.log.info({ count: files.length }, "rfp: upload-files");
  const results: Array<{ id?: string; name: string; fileType?: string; charCount?: number; rowCount?: number; error?: string }> = [];

  for (const file of files) {
    const name = file.originalname;
    const ext  = name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "xlsx" || ext === "xls") {
        const parsed = parseExcelForRequirements(file.buffer);
        if (!parsed.rows.length) { results.push({ name, error: "No requirement rows detected." }); continue; }
        const entry = storeExcelDoc(name, parsed.rows);
        results.push({ id: entry.id, name, fileType: "excel", rowCount: entry.rowCount });
      } else {
        let text = "";
        if (ext === "docx" || ext === "doc") { const r = await mammoth.extractRawText({ buffer: file.buffer }); text = r.value; }
        else if (ext === "pdf")               { const r = await pdfParse(file.buffer); text = r.text; }
        else                                  { text = file.buffer.toString("utf-8"); }
        if (!text.trim()) { results.push({ name, error: "No text extracted." }); continue; }
        const entry = storeTextDoc(name, text.trim());
        results.push({ id: entry.id, name, fileType: "text", charCount: entry.charCount });
      }
    } catch (err) {
      results.push({ name, error: (err as Error).message });
    }
  }
  res.json({ files: results });
});

router.post("/rfp/store-text", (req, res): void => {
  const { name, text } = req.body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) { res.status(400).json({ error: "text is required" }); return; }
  const safeName = typeof name === "string" && name.trim() ? name.trim() : "Pasted document";
  const entry = storeTextDoc(safeName, text.trim());
  res.json({ id: entry.id, name: entry.name, charCount: entry.charCount, fileType: "text" });
});

router.delete("/rfp/documents/:id", (req, res) => { removeDoc(req.params.id); res.json({ ok: true }); });

// ── Pack: create ──────────────────────────────────────────────────────────────

router.post("/rfp/packs", (req, res): void => {
  const { name, buyer, documentIds } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || !documentIds.length) { res.status(400).json({ error: "documentIds required" }); return; }

  const docs = getDocs(documentIds as string[]);
  if (!docs.length) { res.status(400).json({ error: "No documents found — they may have expired. Please re-upload." }); return; }

  const limit = Math.floor(120_000 / Math.max(docs.length, 1));
  const parsedContent = buildContent(docs, limit);

  const pack = createPack(
    typeof name === "string" && name.trim() ? name.trim() : "Bid Pack",
    typeof buyer === "string" && buyer.trim() ? buyer.trim() : "Unknown Buyer",
    parsedContent,
  );
  req.log.info({ packId: pack.id, buyer: pack.buyer, chars: parsedContent.length }, "rfp: pack created");
  res.json(pack);
});

// ── Pack: get ─────────────────────────────────────────────────────────────────

router.get("/rfp/packs/:id", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found or expired" }); return; }
  res.json(pack);
});

// ── Pack: detect sections ─────────────────────────────────────────────────────

router.post("/rfp/packs/:id/detect-sections", async (req, res): Promise<void> => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }

  req.log.info({ packId: pack.id }, "rfp: detecting sections");
  try {
    const user = `Buyer: ${pack.buyer}\n\nDocument content:\n${pack.parsedContent.slice(0, 80_000)}`;
    const result = await callClaudeJSON<{ sections: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }> }>(
      DETECT_SECTIONS_SYSTEM, user, { maxTokens: 2000 },
    );
    const raw = Array.isArray(result?.sections) ? result.sections : [];
    const sections = setSections(pack.id, raw);
    req.log.info({ packId: pack.id, count: sections.length }, "rfp: sections detected");
    res.json({ sections });
  } catch (err) {
    req.log.error({ err }, "rfp: detect-sections failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Section: extract brief ────────────────────────────────────────────────────

router.post("/rfp/sections/:id/extract-brief", async (req, res): Promise<void> => {
  const section = getSection(req.params.id);
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }

  const pack = getPack(section.packId);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }

  req.log.info({ sectionId: section.id, code: section.code }, "rfp: extracting brief");

  const promptTemplate = readPrompt("extraction.md");
  const system = promptTemplate
    .replace("{{SECTION_CODE}}", section.code)
    .replace("{{SECTION_TITLE}}", section.title);

  const user = `Buyer: ${pack.buyer}\n\nDocument content:\n${pack.parsedContent.slice(0, 60_000)}`;

  try {
    const brief = await callClaudeJSON<{
      requirements?: string[];
      mandated_structure?: string[];
      constraints?: string[];
      key_dates?: string[];
      named_owners?: string[];
      evaluation_notes?: string | null;
      scoring_weight?: string | null;
    }>(system, user, { maxTokens: 2000 });

    const updated = updateSection(section.id, {
      requirements:      Array.isArray(brief?.requirements)      ? brief.requirements      : [],
      mandatedStructure: Array.isArray(brief?.mandated_structure) ? brief.mandated_structure : [],
      constraints:       Array.isArray(brief?.constraints)        ? brief.constraints        : [],
      keyDates:          Array.isArray(brief?.key_dates)          ? brief.key_dates          : [],
      namedOwners:       Array.isArray(brief?.named_owners)       ? brief.named_owners       : [],
      evaluationNotes:   brief?.evaluation_notes ?? null,
      scoringWeight:     brief?.scoring_weight   ?? section.scoringWeight,
      briefStatus:       "extracted",
      briefError:        null,
    });

    req.log.info({ sectionId: section.id }, "rfp: brief extracted");
    res.json({ section: updated });
  } catch (err) {
    updateSection(section.id, { briefStatus: "error", briefError: (err as Error).message });
    req.log.error({ err }, "rfp: extract-brief failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Section: generate draft ───────────────────────────────────────────────────

router.post("/rfp/sections/:id/draft", async (req, res): Promise<void> => {
  const section = getSection(req.params.id);
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }

  const pack = getPack(section.packId);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }

  req.log.info({ sectionId: section.id, code: section.code }, "rfp: generating draft");

  const briefObj = {
    code: section.code, title: section.title, scoringWeight: section.scoringWeight,
    requirements: section.requirements, mandatedStructure: section.mandatedStructure,
    constraints: section.constraints, keyDates: section.keyDates,
    namedOwners: section.namedOwners, evaluationNotes: section.evaluationNotes,
  };

  const promptTemplate = readPrompt("drafting.md");
  const system = promptTemplate
    .replace("{{SECTION_CODE}}", section.code)
    .replace("{{SECTION_TITLE}}", section.title)
    .replace("{{KNOWLEDGE_CONTEXT}}", RR_CONTEXT)
    .replace("{{SECTION_BRIEF}}", JSON.stringify(briefObj, null, 2))
    .replace("{{RFP_CONTENT}}", pack.parsedContent.slice(0, 40_000));

  try {
    const result = await callClaudeJSON<{
      components?: Array<{ id: number; label: string; content: string }>;
      placeholders?: Array<{ id: string; placeholder: string; context: string; guidance: string }>;
    }>(system, "Write the 12-part section response as specified.", { maxTokens: 7000 });

    // Normalise components — ensure all 12 are present
    const raw: DraftComponent[] = Array.isArray(result?.components) ? result.components as DraftComponent[] : [];
    const components: DraftComponent[] = COMPONENT_LABELS.map((label, i) => {
      const id = i + 1;
      const found = raw.find((c) => c.id === id);
      return { id, label, content: found?.content ?? `{{PLACEHOLDER: ${label} — not drafted}}` };
    });

    const placeholders: Placeholder[] = Array.isArray(result?.placeholders)
      ? (result.placeholders as Placeholder[])
      : [];

    const draft = saveDraft(section.id, components, placeholders);
    req.log.info({ sectionId: section.id, placeholderCount: placeholders.length }, "rfp: draft generated");
    res.json({ draft });
  } catch (err) {
    req.log.error({ err }, "rfp: draft generation failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Draft: update ─────────────────────────────────────────────────────────────

router.patch("/rfp/sections/:id/draft", (req, res): void => {
  const { components, placeholders } = req.body as Record<string, unknown>;
  const draft = updateDraft(req.params.id, {
    ...(Array.isArray(components)   ? { components: components as DraftComponent[] }   : {}),
    ...(Array.isArray(placeholders) ? { placeholders: placeholders as Placeholder[] } : {}),
  });
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  res.json({ draft });
});

// ── Draft: advance status ─────────────────────────────────────────────────────

router.post("/rfp/sections/:id/draft/advance", (req, res): void => {
  const draft = advanceDraftStatus(req.params.id);
  if (!draft) { res.status(404).json({ error: "Draft not found or already approved" }); return; }
  res.json({ draft });
});

export default router;
