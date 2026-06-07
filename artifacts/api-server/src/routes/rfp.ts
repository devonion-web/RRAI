import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { readFileSync } from "fs";
import { join } from "path";
import { callClaudeJSON } from "../lib/anthropic";
import { storeTextDoc, storeExcelDoc, getDocs, removeDoc, storeSize } from "../lib/docStore";
import {
  createPack, getPack, setSections, getSection, updateSection,
  saveDraft, updateDraft, advanceDraftStatus, reopenDraft,
  appendAuditEvent, getAuditEvents, getRevisions, saveRevision,
  type DraftComponents,
} from "../lib/bidPackStore";
import { parseExcelForRequirements } from "../lib/xlsxParser";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 20 } });
const router = Router();
const PROMPTS_DIR = join(process.cwd(), "prompts");

// ── Constants ─────────────────────────────────────────────────────────────────

const BIDDER_CONTEXT = "LogicGate (platform, prime); Risk Rising (implementation / services partner)";
const HOUSE_VOICE    = "outcome-first, concise, UK English, no superlatives, evidence-led";

const RR_KNOWLEDGE = `## Risk Rising — Delivery Capability

Risk Rising is a specialist GRC implementation and advisory consultancy. Core capabilities:
- LogicGate Risk Cloud implementation and configuration (primary partner)
- Panorays third-party cyber risk implementation
- GRC programme design and advisory
- Agile and waterfall project delivery
- Stakeholder workshops and requirements gathering
- Workflow and app configuration design
- System integration and data migration support
- User training, train-the-trainer, and change management
- UAT support and go-live hypercare
- Post-go-live managed service and ongoing optimisation
- Commercial negotiation support

## Ownership boundaries

Risk Rising OWNS: implementation, project delivery, configuration, training, UAT, hypercare, support model, managed service, commercials, advisory, delivery governance, account management.

LogicGate OWNS: functional platform features, workflow engine, dashboards, reporting, integrations catalogue, technical architecture, security posture, hosting, product roadmap, platform SLAs.

## Delivery approach

Typical phases: Discovery & Design → Build & Configure → Integrate → Test (SIT → UAT) → Go-live → Hypercare → Managed Service.
Typical governance: weekly project steering, bi-weekly sponsor review, risk register maintained by RR PM.
Typical team: Delivery Lead, Lead Consultant(s), Technical Consultant (integration), Change Manager, Project Manager.`;

// ── Prompt parser ─────────────────────────────────────────────────────────────

function parsePromptFile(content: string): { system: string; userTemplate: string } {
  const userMatch = content.match(/\n## USER\s*\n/);
  if (!userMatch || userMatch.index === undefined) return { system: content.trim(), userTemplate: "" };
  const sysMatch = content.match(/\n## SYSTEM\s*\n/);
  const sysStart = sysMatch?.index !== undefined ? sysMatch.index + sysMatch[0].length : 0;
  return {
    system:       content.slice(sysStart, userMatch.index).trim(),
    userTemplate: content.slice(userMatch.index + userMatch[0].length).trim(),
  };
}

function readPrompt(name: string): string {
  try { return readFileSync(join(PROMPTS_DIR, name), "utf-8"); } catch { return ""; }
}

// ── Content builder ───────────────────────────────────────────────────────────

function buildContent(docs: ReturnType<typeof getDocs>, charLimitPerDoc: number): string {
  let out = "";
  for (const doc of docs) {
    if (doc.text) {
      const slice = doc.text.length > charLimitPerDoc ? doc.text.slice(0, charLimitPerDoc) + "\n[...truncated]" : doc.text;
      out += `\n\n=== ${doc.name} ===\n${slice}`;
    } else if (doc.structuredRows?.length) {
      const reqs = doc.structuredRows.slice(0, 200).map((r) => r.requirement).filter(Boolean).join("\n");
      out += `\n\n=== ${doc.name} (spreadsheet) ===\n${reqs.slice(0, charLimitPerDoc)}`;
    }
  }
  return out;
}

// ── Section detection system prompt ──────────────────────────────────────────

const DETECT_SYSTEM = `You are an expert bid analyst. Read the provided procurement documents and identify all scored response sections.

A scored response section requires a detailed written response (100+ words) that will be evaluated by the buyer. These are typically numbered (e.g. "Section 2.1", "Q4") and include specific questions or requirements the bidder must address.

NOT scored sections: pricing matrices, administrative forms, declarations, company info templates, tick-boxes, standard T&Cs.

Output ONLY valid JSON — no prose, no code fences:
{ "sections": [{ "code": "string", "title": "string", "scoringWeight": "string|null", "summary": "one sentence" }] }`;

// ── Default components (fallback) ─────────────────────────────────────────────

function defaultComponents(): DraftComponents {
  return {
    understanding:                "{{PLACEHOLDER: understanding of buyer challenge and context}}",
    approachAndRecommendedOption: "{{PLACEHOLDER: approach and recommended option}}",
    deliveryPlan:       { narrative: "{{PLACEHOLDER: delivery plan narrative}}", milestones: [] },
    domainComponent:    { title: "{{PLACEHOLDER: domain component title}}", content: "{{PLACEHOLDER: domain component content}}" },
    resourcing:         { deliveryTeam: [], buyerCommitment: "{{PLACEHOLDER: buyer-side commitment required}}" },
    acceptanceGates:    [],
    preWork:            [],
    assumptions:        [],
    configCustomisationThirdParty: "{{PLACEHOLDER: configuration and customisation details}}",
    costs:  "{{PLACEHOLDER: cost reference — see pricing submission}}",
    risks:  [],
  };
}

// ── Health ────────────────────────────────────────────────────────────────────

router.get("/rfp/health", (_req, res) => {
  res.json({ status: "ok", module: "rfp", storedDocs: storeSize() });
});

// ── Upload ────────────────────────────────────────────────────────────────────

router.post("/rfp/upload-files", upload.array("files", 20), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) { res.status(400).json({ error: "No files uploaded" }); return; }
  const results: Array<Record<string, unknown>> = [];
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
        else if (ext === "pdf")              { const r = await pdfParse(file.buffer); text = r.text; }
        else                                 { text = file.buffer.toString("utf-8"); }
        if (!text.trim()) { results.push({ name, error: "No text extracted." }); continue; }
        const entry = storeTextDoc(name, text.trim());
        results.push({ id: entry.id, name, fileType: "text", charCount: entry.charCount });
      }
    } catch (err) { results.push({ name, error: (err as Error).message }); }
  }
  res.json({ files: results });
});

router.post("/rfp/store-text", (req, res): void => {
  const { name, text } = req.body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim()) { res.status(400).json({ error: "text is required" }); return; }
  const entry = storeTextDoc(typeof name === "string" && name.trim() ? name.trim() : "Pasted document", text.trim());
  res.json({ id: entry.id, name: entry.name, charCount: entry.charCount, fileType: "text" });
});

router.delete("/rfp/documents/:id", (req, res) => { removeDoc(req.params.id); res.json({ ok: true }); });

// ── Pack ──────────────────────────────────────────────────────────────────────

router.post("/rfp/packs", (req, res): void => {
  const { name, buyer, documentIds } = req.body as Record<string, unknown>;
  if (!Array.isArray(documentIds) || !documentIds.length) { res.status(400).json({ error: "documentIds required" }); return; }
  const docs = getDocs(documentIds as string[]);
  if (!docs.length) { res.status(400).json({ error: "No documents found — they may have expired. Please re-upload." }); return; }
  const limit = Math.floor(120_000 / Math.max(docs.length, 1));
  const parsedContent = buildContent(docs, limit);
  const pack = createPack(
    typeof name  === "string" && name.trim()  ? name.trim()  : "Bid Pack",
    typeof buyer === "string" && buyer.trim() ? buyer.trim() : "Unknown Buyer",
    parsedContent,
  );
  appendAuditEvent(pack.id, null, "pack_uploaded", `Pack "${pack.name}" created for ${pack.buyer}`, "user");
  req.log.info({ packId: pack.id, chars: parsedContent.length }, "rfp: pack created");
  res.json(pack);
});

router.get("/rfp/packs/:id", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found or expired" }); return; }
  res.json(pack);
});

router.get("/rfp/packs/:id/audit", (req, res): void => {
  const events = getAuditEvents(req.params.id);
  res.json({ events });
});

// ── Detect sections ───────────────────────────────────────────────────────────

router.post("/rfp/packs/:id/detect-sections", async (req, res): Promise<void> => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  req.log.info({ packId: pack.id }, "rfp: detecting sections");
  try {
    const user   = `Buyer: ${pack.buyer}\n\nDocument content:\n${pack.parsedContent.slice(0, 80_000)}`;
    const result = await callClaudeJSON<{ sections: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }> }>(
      DETECT_SYSTEM, user, { maxTokens: 4096 },
    );
    const sections = setSections(pack.id, Array.isArray(result?.sections) ? result.sections : []);
    appendAuditEvent(pack.id, null, "section_detected", `Detected ${sections.length} scored section${sections.length !== 1 ? "s" : ""}`, "RRAI");
    req.log.info({ packId: pack.id, count: sections.length }, "rfp: sections detected");
    res.json({ sections });
  } catch (err) {
    req.log.error({ err }, "rfp: detect-sections failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Extract brief ─────────────────────────────────────────────────────────────

router.post("/rfp/sections/:id/extract-brief", async (req, res): Promise<void> => {
  const section = getSection(req.params.id);
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }
  const pack = getPack(section.packId);
  if (!pack)    { res.status(404).json({ error: "Pack not found" }); return; }

  req.log.info({ sectionId: section.id, code: section.code }, "rfp: extracting brief");

  const { system, userTemplate } = parsePromptFile(readPrompt("extraction.md"));
  const userContent = userTemplate
    .replace("{{SECTION_CODE}}",       section.code)
    .replace("{{SECTION_TITLE_HINT}}", section.title)
    .replace("{{PARSED_PACK}}",        pack.parsedContent.slice(0, 60_000));

  try {
    let brief: Record<string, unknown> | null = null;
    for (const maxTokens of [16_000, 32_000]) {
      try {
        brief = await callClaudeJSON<Record<string, unknown>>(system, userContent, { maxTokens });
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("truncated") && maxTokens === 16_000) {
          req.log.warn({ sectionId: section.id, code: section.code },
            "rfp: extract-brief truncated at 16k — retrying at 32k");
          continue;
        }
        req.log.error({ err, sectionId: section.id }, "rfp: extract-brief JSON parse failed");
        throw err;
      }
    }
    if (!brief) throw new Error("extract-brief: no output after retry");
    const arr   = <T>(v: unknown): T[] => Array.isArray(v) ? v as T[] : [];

    const updated = updateSection(section.id, {
      mandatedResponseStructure: arr(brief?.mandatedResponseStructure),
      requirements:              arr(brief?.requirements),
      minimumResponseItems:      arr(brief?.minimumResponseItems),
      buyerActivities:           arr(brief?.buyerActivities),
      buyerChallenges:           arr(brief?.buyerChallenges),
      considerations:            arr(brief?.considerations),
      keyDates:                  arr(brief?.keyDates),
      constraints:               arr(brief?.constraints),
      commercialTerms:           arr(brief?.commercialTerms),
      namedOwners:               arr(brief?.namedOwners),
      regulatoryAnchors:         arr(brief?.regulatoryAnchors),
      crossReferences:           arr(brief?.crossReferences),
      discrepancies:             arr(brief?.discrepancies),
      gaps:                      arr(brief?.gaps),
      scoringWeight:  (brief?.scoringWeight as string | null) ?? section.scoringWeight,
      briefStatus:    "extracted",
      briefError:     null,
      status:         "extracted",
    });

    appendAuditEvent(pack.id, section.id, "brief_extracted", `Brief extracted for ${section.code}: ${section.title}`, "RRAI");
    req.log.info({ sectionId: section.id }, "rfp: brief extracted");
    res.json({ section: updated });
  } catch (err) {
    updateSection(section.id, { briefStatus: "error", briefError: (err as Error).message });
    req.log.error({ err }, "rfp: extract-brief failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Generate draft ────────────────────────────────────────────────────────────
// Uses SSE so the Replit proxy (120 s hard timeout) sees keepalive traffic while
// the model call runs (often 90–180 s). Final payload arrives as a `data:` event.

router.post("/rfp/sections/:id/draft", async (req, res): Promise<void> => {
  const section = getSection(req.params.id);
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }
  const pack = getPack(section.packId);
  if (!pack)    { res.status(404).json({ error: "Pack not found" }); return; }

  // Switch to SSE before any async work
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");   // Disable nginx buffering
  res.flushHeaders();

  // Send a keepalive comment every 15 s — invisible to the client but enough to
  // prevent the proxy from treating the connection as idle and closing it.
  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ sectionId: section.id, code: section.code }, "rfp: generating draft");

  const briefJson = JSON.stringify({
    section:               { code: section.code, title: section.title },
    scoringWeight:         section.scoringWeight,
    mandatedResponseStructure: section.mandatedResponseStructure,
    requirements:          section.requirements,
    minimumResponseItems:  section.minimumResponseItems,
    buyerActivities:       section.buyerActivities,
    buyerChallenges:       section.buyerChallenges,
    considerations:        section.considerations,
    keyDates:              section.keyDates,
    constraints:           section.constraints,
    commercialTerms:       section.commercialTerms,
    namedOwners:           section.namedOwners,
    regulatoryAnchors:     section.regulatoryAnchors,
    discrepancies:         section.discrepancies,
    gaps:                  section.gaps,
  }, null, 2);

  const { system: rawSystem, userTemplate } = parsePromptFile(readPrompt("drafting.md"));
  const system      = rawSystem.replace("{{HOUSE_VOICE}}", HOUSE_VOICE);
  const userContent = userTemplate
    .replace("{{BUYER_NAME}}",     pack.buyer)
    .replace("{{BIDDER_CONTEXT}}", BIDDER_CONTEXT)
    .replace("{{BRIEF_JSON}}",     briefJson)
    .replace("{{KNOWLEDGE}}",      RR_KNOWLEDGE)
    .replace("{{HOUSE_VOICE}}",    HOUSE_VOICE);

  try {
    let result: {
      lens?: string; complianceVerdict?: string;
      components?: Partial<DraftComponents>; placeholders?: string[]; openDependencies?: string[];
    } | null = null;
    for (const maxTokens of [16_000, 32_000]) {
      try {
        result = await callClaudeJSON<typeof result>(system, userContent, { maxTokens });
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("truncated") && maxTokens === 16_000) {
          req.log.warn({ sectionId: section.id, code: section.code },
            "rfp: draft truncated at 16k — retrying at 32k");
          continue;
        }
        throw err;
      }
    }
    if (!result) throw new Error("draft: no output after retry");

    const def  = defaultComponents();
    const comp = (result?.components ?? {}) as Partial<DraftComponents>;
    const components: DraftComponents = {
      understanding:                comp.understanding                   ?? def.understanding,
      approachAndRecommendedOption: comp.approachAndRecommendedOption    ?? def.approachAndRecommendedOption,
      deliveryPlan:                 comp.deliveryPlan                    ?? def.deliveryPlan,
      domainComponent:              comp.domainComponent                 ?? def.domainComponent,
      resourcing:                   comp.resourcing                      ?? def.resourcing,
      acceptanceGates:              comp.acceptanceGates                 ?? def.acceptanceGates,
      preWork:                      comp.preWork                         ?? def.preWork,
      assumptions:                  comp.assumptions                     ?? def.assumptions,
      configCustomisationThirdParty: comp.configCustomisationThirdParty  ?? def.configCustomisationThirdParty,
      costs:                        comp.costs                           ?? def.costs,
      risks:                        comp.risks                           ?? def.risks,
    };

    const draft = saveDraft(section.id, {
      lens:             result?.lens ?? "Commercial",
      complianceVerdict: result?.complianceVerdict ?? "Partially Complies",
      components,
      placeholders:     Array.isArray(result?.placeholders)      ? result.placeholders      : [],
      openDependencies: Array.isArray(result?.openDependencies)  ? result.openDependencies  : [],
    });
    appendAuditEvent(pack.id, section.id, "draft_generated", `Draft generated for ${section.code}: ${section.title}`, "RRAI");
    req.log.info({ sectionId: section.id }, "rfp: draft generated");
    finish({ draft, sectionStatus: "drafted" });
  } catch (err) {
    req.log.error({ err }, "rfp: draft generation failed");
    finish({ error: (err as Error).message });
  }
});

// ── Update draft ──────────────────────────────────────────────────────────────

router.patch("/rfp/sections/:id/draft", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section?.draft) { res.status(404).json({ error: "Draft not found" }); return; }
  const updates = req.body as Partial<{ components: DraftComponents; placeholders: string[]; openDependencies: string[]; complianceVerdict: string }>;
  const draft = updateDraft(req.params.id, updates);
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  appendAuditEvent(section.packId, section.id, "draft_edited", `${section.code} components saved`, "user");
  res.json({ draft });
});

// ── Advance status ────────────────────────────────────────────────────────────

router.post("/rfp/sections/:id/draft/advance", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section?.draft) { res.status(404).json({ error: "Draft not found" }); return; }
  const prevStatus = section.draft.status;
  const result = advanceDraftStatus(req.params.id);
  if (!result.ok) { res.status(422).json({ error: result.error }); return; }

  const type    = result.draft.status === "approved" ? "approved" : "status_changed";
  const summary = result.draft.status === "approved"
    ? `${section.code} approved`
    : `${section.code}: ${prevStatus} → ${result.draft.status}`;
  appendAuditEvent(section.packId, section.id, type, summary, "user", { from: prevStatus, to: result.draft.status });
  res.json({ draft: result.draft, sectionStatus: result.sectionStatus });
});

// ── Reopen ────────────────────────────────────────────────────────────────────

router.post("/rfp/sections/:id/draft/reopen", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section?.draft) { res.status(404).json({ error: "Draft not found" }); return; }
  const result = reopenDraft(req.params.id);
  if (!result) { res.status(404).json({ error: "Section not found" }); return; }
  appendAuditEvent(section.packId, section.id, "reopened", `${section.code} reopened for editing`, "user");
  res.json(result);
});

// ── Audit & revisions ─────────────────────────────────────────────────────────

router.get("/rfp/sections/:id/audit", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section) { res.status(404).json({ error: "Section not found" }); return; }
  const events = getAuditEvents(section.packId, section.id);
  res.json({ events });
});

router.get("/rfp/sections/:id/revisions", (req, res): void => {
  res.json({ revisions: getRevisions(req.params.id) });
});

export default router;
