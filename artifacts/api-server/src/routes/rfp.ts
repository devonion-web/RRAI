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
  fillPlaceholder, markComponentReviewed,
  appendAuditEvent, getAuditEvents, getRevisions, saveRevision,
  saveProfile, getProfile,
  saveRequirements, getRequirements, getRequirement, updateRequirementOwnership,
  saveResponse, getResponse, updateBlockAnswer, fillBlockPlaceholder, setBlockReviewed,
  advanceResponseStatus, reopenResponse,
  saveQualityReview, getQualityReviews, getLatestQualityReview, overrideGate, canPassGate,
  setWorkflowStage, setRequirementResponseStage, setBlockValidation, replaceBlockAnswer,
  assembleResponses,
  type DraftComponents, type Placeholder, type RequirementOwner, type ResponseBlock,
  type CrossCuttingConstraint, type QualityReviewType, type OwnerConfidence,
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

  type DraftResult = {
    lens?: string;
    complianceVerdict?: string;
    components?: Partial<DraftComponents>;
    placeholders?: Array<string | { id?: string; description?: string; group?: string }>;
    requirementContext?: Record<string, string>;
    openDependencies?: string[];
  };
  try {
    let result: DraftResult | null = null;
    for (const maxTokens of [16_000, 32_000]) {
      try {
        result = await callClaudeJSON<DraftResult>(system, userContent, { maxTokens });
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

    const rawPHs = Array.isArray(result?.placeholders) ? result.placeholders : [];
    const placeholders: Placeholder[] = rawPHs.map((p: unknown, idx: number) => {
      if (typeof p === "string") {
        return { id: `ph_${String(idx + 1).padStart(3, "0")}`, description: p, group: null, value: null, filled: false };
      }
      const ph = p as { id?: string; description?: string; group?: string };
      return {
        id: ph.id || `ph_${String(idx + 1).padStart(3, "0")}`,
        description: ph.description || "",
        group: ph.group || null,
        value: null,
        filled: false,
      };
    });
    const rawReqCtx = result?.requirementContext;
    const requirementContext: Record<string, string> =
      rawReqCtx && typeof rawReqCtx === "object" && !Array.isArray(rawReqCtx)
        ? (rawReqCtx as Record<string, string>)
        : {};

    const draft = saveDraft(section.id, {
      lens:               result?.lens ?? "Commercial",
      complianceVerdict:  result?.complianceVerdict ?? "Partially Complies",
      components,
      requirementContext,
      placeholders,
      openDependencies:   Array.isArray(result?.openDependencies) ? result.openDependencies : [],
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
  const updates = req.body as Partial<{
    components: DraftComponents;
    placeholders: Placeholder[];
    openDependencies: string[];
    complianceVerdict: string;
    reviewed: Record<string, boolean>;
  }>;
  const draft = updateDraft(req.params.id, updates);
  if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
  appendAuditEvent(section.packId, section.id, "draft_edited", `${section.code} components saved`, "user");
  res.json({ draft });
});

// ── Fill placeholder ──────────────────────────────────────────────────────────

router.post("/rfp/sections/:id/placeholders/:phId/fill", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section?.draft) { res.status(404).json({ error: "Draft not found" }); return; }
  const { value } = req.body as { value?: string };
  if (!value?.trim()) { res.status(400).json({ error: "value is required" }); return; }
  const ph = fillPlaceholder(req.params.id, req.params.phId, value.trim());
  if (!ph) { res.status(404).json({ error: "Placeholder not found" }); return; }
  appendAuditEvent(section.packId, section.id, "placeholder_filled",
    `Gap filled: "${ph.description}" → "${ph.value?.slice(0, 40)}"`, "user",
    { phId: ph.id, description: ph.description });
  res.json({ placeholder: ph });
});

// ── Mark component reviewed ───────────────────────────────────────────────────

router.patch("/rfp/sections/:id/components/:compName/reviewed", (req, res): void => {
  const section = getSection(req.params.id);
  if (!section?.draft) { res.status(404).json({ error: "Draft not found" }); return; }
  const { reviewed } = req.body as { reviewed?: boolean };
  const ok = markComponentReviewed(req.params.id, req.params.compName, !!reviewed);
  if (!ok) { res.status(404).json({ error: "Section or draft not found" }); return; }
  if (reviewed) {
    appendAuditEvent(section.packId, section.id, "component_reviewed",
      `${req.params.compName} reviewed in ${section.code}`, "user",
      { component: req.params.compName });
  }
  res.json({ reviewed: !!reviewed });
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

// ── Engagement profile ────────────────────────────────────────────────────────

router.get("/rfp/packs/:id/profile", (req, res): void => {
  const profile = getProfile(req.params.id);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ profile });
});

router.post("/rfp/packs/:id/profile", (req, res): void => {
  const { ourRole, primePartner, ourRemit, otherParties } = req.body as {
    ourRole?: string; primePartner?: string; ourRemit?: string[]; otherParties?: string[];
  };
  if (!ourRole || !primePartner || !Array.isArray(ourRemit)) {
    res.status(400).json({ error: "ourRole, primePartner, and ourRemit are required" }); return;
  }
  const profile = saveProfile(req.params.id, {
    ourRole, primePartner, ourRemit, otherParties: otherParties ?? [],
  });
  if (!profile) { res.status(404).json({ error: "Pack not found" }); return; }
  appendAuditEvent(req.params.id, null, "profile_saved",
    `Engagement profile saved: RR as ${ourRole}, prime = ${primePartner}`, "user");
  res.json({ profile });
});

// ── Decompose helpers ─────────────────────────────────────────────────────────

interface DocSection {
  sectionCode: string;
  headingText: string;
  sectionText: string;
  startIndex: number;
}

/** Split parsedContent into sections by numbered headings (1, 1.2, 1.2.3 …). */
function splitDocumentSections(text: string): DocSection[] {
  const headingRe = /^(\d+(?:\.\d+)*\.?)\s+([^\n]{1,150})/gm;
  const matches: Array<{ index: number; code: string; heading: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(text)) !== null) {
    matches.push({ index: m.index, code: m[1].replace(/\.$/, ""), heading: m[0].trim() });
  }
  if (matches.length === 0) {
    return [{ sectionCode: "DOC", headingText: "Document", sectionText: text, startIndex: 0 }];
  }
  return matches.map((match, i) => ({
    sectionCode:  match.code,
    headingText:  match.heading,
    sectionText:  text.slice(match.index, matches[i + 1]?.index ?? text.length).trim(),
    startIndex:   match.index,
  }));
}

/**
 * Merge consecutive tiny sections so each group is ~targetSize chars.
 * Keeps the first section's code/heading/startIndex for the group.
 * Hard-caps at MAX_SECTION to avoid oversized LLM calls.
 */
function mergeSections(sections: DocSection[], targetSize = 2_500, maxSize = 5_000): DocSection[] {
  if (sections.length === 0) return sections;
  const groups: DocSection[] = [];
  let cur = { ...sections[0] };
  for (let i = 1; i < sections.length; i++) {
    const s = sections[i];
    if (cur.sectionText.length + s.sectionText.length + 2 <= maxSize &&
        cur.sectionText.length < targetSize) {
      cur = { ...cur, sectionText: cur.sectionText + "\n\n" + s.sectionText };
    } else {
      groups.push(cur);
      cur = { ...s };
    }
  }
  groups.push(cur);
  return groups;
}

/**
 * Locate startAnchor + endAnchor within sectionText and slice the verbatim span.
 * Falls back to the full sectionText when anchors are absent or not found.
 */
function resolveSourceText(
  sectionText: string,
  startAnchor: string | null | undefined,
  endAnchor:   string | null | undefined,
): { text: string; resolved: boolean } {
  if (!startAnchor || !endAnchor) return { text: sectionText, resolved: true };

  // Build a regex from N words joined by \s+ so newlines / double-spaces in the
  // original text don't prevent a match (the previous indexOf approach failed on these).
  const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordsRe = (anchor: string, take: "first" | "last", n: number): RegExp => {
    const words = anchor.trim().split(/\s+/);
    const chosen = take === "first" ? words.slice(0, n) : words.slice(-n);
    return new RegExp(chosen.map(escRe).join("\\s+"), "i");
  };

  for (const n of [6, 4, 3]) {
    const startRe = wordsRe(startAnchor, "first", n);
    const startMatch = startRe.exec(sectionText);
    if (!startMatch) continue;
    const si = startMatch.index;

    for (const m of [6, 4, 3]) {
      const endRe = wordsRe(endAnchor, "last", m);
      const tail  = sectionText.slice(si + startMatch[0].length);
      const endMatch = endRe.exec(tail);
      if (!endMatch) continue;
      const endPos = si + startMatch[0].length + endMatch.index + endMatch[0].length;
      return { text: sectionText.slice(si, endPos).trim(), resolved: true };
    }
  }
  return { text: sectionText, resolved: false };
}

/** Run tasks with at most `limit` in-flight at once, preserving result order. */
async function runConcurrent<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── Decompose (SSE) ───────────────────────────────────────────────────────────

router.post("/rfp/packs/:id/decompose", async (req, res): Promise<void> => {
  const pack    = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const profile = getProfile(req.params.id);
  if (!profile) { res.status(400).json({ error: "Save an engagement profile first" }); return; }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ packId: pack.id }, "rfp: decomposing bid document");

  try {
    const profileSnippet = JSON.stringify({
      ourRole:      profile.ourRole,
      primePartner: profile.primePartner,
      ourRemit:     profile.ourRemit,
      otherParties: profile.otherParties,
    }, null, 2);

    // ── 1. Pre-split document into sections ──────────────────────────────────
    const rawSections = splitDocumentSections(pack.parsedContent);
    const sections    = mergeSections(rawSections);
    req.log.info({ packId: pack.id, rawSections: rawSections.length, sections: sections.length }, "rfp: document split into sections");

    // ── 2. Prompt templates ──────────────────────────────────────────────────

    type SectionReqRaw = {
      code: string; title: string; order: number;
      scoringWeight: string | null;
      minimumExpectations: string[];
      considerations: string[];
      mandatedStructure: string | null;
      owner: string; ownerRationale: string; ownerConfidence?: string;
      parentId: string | null;
      startAnchor: string | null;
      endAnchor:   string | null;
    };

    const SECTION_SYSTEM =
      `You are RRAI, Risk Rising's bid intelligence platform. Decompose ONE section of an RFP into structured requirements. Return JSON only — no prose, no markdown fences.
Rules:
1. Return requirements in document order; "order" integers are sequential within this section.
2. "startAnchor": first 8 words of the requirement's span in the section text. "endAnchor": last 8 words. Set both null when the section maps to exactly one requirement.
3. minimumExpectations: verbatim items from "at a minimum" / "must include" lists.
4. considerations: buyer hints, guidance notes, evaluation criteria.
5. owner classification — RR: implementation/delivery/training/support/consulting; LogicGate: platform product/licensing/capabilities; shared: joint contribution required; M&S: buyer-only activities.`;

    const buildSectionUser = (sec: DocSection) =>
      `Buyer: ${pack.buyer}
Engagement profile: ${profileSnippet}

Section code: ${sec.sectionCode}
Section heading: ${sec.headingText}

Section text:
${sec.sectionText}

Return this JSON only:
{
  "requirements": [
    {
      "code": "string",
      "title": "string",
      "order": 1,
      "scoringWeight": "string | null",
      "minimumExpectations": ["string"],
      "considerations": ["string"],
      "mandatedStructure": "string | null",
      "owner": "RR | LogicGate | shared | M&S",
      "ownerRationale": "string",
      "ownerConfidence": "low | medium | high",
      "parentId": "string | null",
      "startAnchor": "string | null",
      "endAnchor": "string | null"
    }
  ]
}`;

    const CONSTRAINTS_SYSTEM =
      `You are RRAI. Extract all cross-cutting constraints from this RFP — facts that apply to ALL requirements. Return JSON only.
Types: timeline (dates/milestones), module (mandatory platform capabilities), integration (required integrations), commercial (pricing/payment constraints), other.`;

    const constraintsUser =
      `Buyer: ${pack.buyer}

Document (first 30 000 chars):
${pack.parsedContent.slice(0, 30_000)}

Return: { "crossCuttingConstraints": [{ "type": "timeline|module|integration|commercial|other", "text": "string" }] }`;

    // ── 3. Run all calls concurrently (cap 5 in-flight) ─────────────────────

    const constraintsTask = (): Promise<{ crossCuttingConstraints: Array<{ type: string; text: string }> }> =>
      callClaudeJSON(CONSTRAINTS_SYSTEM, constraintsUser, { maxTokens: 4_000 })
        .catch((e: unknown) => {
          req.log.warn({ err: e }, "rfp: constraints pass failed, using empty");
          return { crossCuttingConstraints: [] };
        });

    const sectionTasks = sections.map(
      (sec) => (): Promise<{ sec: DocSection; reqs: SectionReqRaw[] }> =>
        callClaudeJSON<{ requirements: SectionReqRaw[] }>(
          SECTION_SYSTEM, buildSectionUser(sec), { maxTokens: 8_000 },
        )
          .then((r) => ({ sec, reqs: Array.isArray(r.requirements) ? r.requirements : [] }))
          .catch((e: unknown) => {
            req.log.warn({ err: e, sectionCode: sec.sectionCode }, "rfp: section decompose failed, skipping");
            return { sec, reqs: [] };
          }),
    );

    type ConstraintsResult = { crossCuttingConstraints: Array<{ type: string; text: string }> };
    type SectionResult     = { sec: DocSection; reqs: SectionReqRaw[] };

    const allTasks   = [constraintsTask, ...sectionTasks] as Array<() => Promise<ConstraintsResult | SectionResult>>;
    const allResults = await runConcurrent(allTasks, 5);

    const constraintsRaw = allResults[0] as ConstraintsResult;
    const sectionResults = (allResults.slice(1) as SectionResult[]);

    // ── 4. Reassemble in document order ─────────────────────────────────────
    const sorted = sectionResults.slice().sort((a, b) => a.sec.startIndex - b.sec.startIndex);

    let globalOrder = 0;
    const assembled: Array<SectionReqRaw & { _sectionText: string }> = [];
    for (const { sec, reqs } of sorted) {
      for (const r of reqs.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
        assembled.push({ ...r, order: ++globalOrder, _sectionText: sec.sectionText });
      }
    }

    // ── 5. Extract verbatim sourceText from anchors in code ──────────────────
    const VALID_OWNERS = new Set(["RR", "LogicGate", "shared", "M&S"]);

    const crossCuttingConstraints: CrossCuttingConstraint[] =
      (Array.isArray(constraintsRaw.crossCuttingConstraints) ? constraintsRaw.crossCuttingConstraints : [])
        .map((c) => ({
          type: (["timeline","module","integration","commercial","other"].includes(c.type) ? c.type : "other") as CrossCuttingConstraint["type"],
          text: String(c.text ?? ""),
        }));

    let unresolvedCount = 0;
    const requirements = saveRequirements(req.params.id, assembled.map((r, i) => {
      const { text: sourceText, resolved } = resolveSourceText(r._sectionText, r.startAnchor, r.endAnchor);
      if (!resolved) unresolvedCount++;
      return {
        code:                r.code ?? `REQ${i + 1}`,
        order:               r.order ?? (i + 1),
        title:               r.title ?? "",
        sourceText,
        scoringWeight:       r.scoringWeight ?? null,
        minimumExpectations: Array.isArray(r.minimumExpectations) ? r.minimumExpectations : [],
        considerations:      Array.isArray(r.considerations) ? r.considerations : [],
        mandatedStructure:   r.mandatedStructure ?? null,
        owner:               (VALID_OWNERS.has(r.owner) ? r.owner : "shared") as RequirementOwner,
        ownerRationale:      r.ownerRationale ?? "",
        ownerConfirmed:      false,
        ownerConfidence:     (["low","medium","high"].includes(r.ownerConfidence ?? "") ? r.ownerConfidence : "medium") as OwnerConfidence,
        responseStage:       "pending" as const,
        rewriteAttempts:     0,
        parentId:            r.parentId ?? null,
        crossCuttingConstraints,
      };
    }));

    appendAuditEvent(pack.id, null, "decomposed",
      `Decomposed ${requirements.length} requirements across ${sections.length} sections (${unresolvedCount} anchors fell back to section text)`, "RRAI");
    req.log.info({ packId: pack.id, count: requirements.length, sections: sections.length, unresolvedCount }, "rfp: decompose complete");
    finish({ requirements, crossCuttingConstraints });
  } catch (err) {
    req.log.error({ err }, "rfp: decompose failed");
    finish({ error: (err as Error).message });
  }
});

// ── Requirements ──────────────────────────────────────────────────────────────

router.get("/rfp/packs/:id/requirements", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const reqs = getRequirements(req.params.id);
  const withResponse = reqs.map((r) => ({ ...r, response: getResponse(r.id) ?? null }));
  res.json({ requirements: withResponse });
});

router.patch("/rfp/requirements/:id/ownership", (req, res): void => {
  const { owner, ownerRationale, ownerConfirmed, ownerConfidence } = req.body as {
    owner?: string; ownerRationale?: string; ownerConfirmed?: boolean; ownerConfidence?: string;
  };
  const req_ = getRequirement(req.params.id);
  if (!req_) { res.status(404).json({ error: "Requirement not found" }); return; }

  const VALID_OWNERS = ["RR", "LogicGate", "shared", "M&S"];
  if (owner && !VALID_OWNERS.includes(owner)) {
    res.status(400).json({ error: `owner must be one of ${VALID_OWNERS.join(", ")}` }); return;
  }
  const finalOwner      = (owner ?? req_.owner) as RequirementOwner;
  const finalRationale  = ownerRationale ?? req_.ownerRationale;
  const finalConfirmed  = ownerConfirmed ?? req_.ownerConfirmed;
  const finalConfidence = (["low","medium","high"].includes(ownerConfidence ?? "") ? ownerConfidence : undefined) as OwnerConfidence | undefined;
  const updated = updateRequirementOwnership(req.params.id, finalOwner, finalRationale, finalConfirmed, finalConfidence);
  if (!updated) { res.status(404).json({ error: "Requirement not found" }); return; }

  const wasOverride = owner && owner !== req_.owner;
  appendAuditEvent(req_.bidPackId, null,
    wasOverride ? "ownership_overridden" : "ownership_confirmed",
    `${req_.code}: ownership ${finalConfirmed ? "confirmed" : "set"} as ${finalOwner}`, "user",
    { reqId: req.params.id, owner: finalOwner, rationale: finalRationale, confidence: finalConfidence });
  res.json({ requirement: updated });
});

// ── Respond (SSE) ─────────────────────────────────────────────────────────────

router.post("/rfp/requirements/:id/respond", async (req, res): Promise<void> => {
  const requirement = getRequirement(req.params.id);
  if (!requirement) { res.status(404).json({ error: "Requirement not found" }); return; }
  const pack    = getPack(requirement.bidPackId);
  if (!pack)    { res.status(404).json({ error: "Pack not found" }); return; }
  const profile = getProfile(requirement.bidPackId);

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ reqId: requirement.id, code: requirement.code }, "rfp: generating response");

  try {
    const bidderCtx = profile
      ? `${profile.primePartner} (platform provider, prime contractor); Risk Rising (${profile.ourRemit.join(", ")})`
      : BIDDER_CONTEXT;

    const reqJson = JSON.stringify({
      code:                 requirement.code,
      title:                requirement.title,
      sourceText:           requirement.sourceText,
      scoringWeight:        requirement.scoringWeight,
      minimumExpectations:  requirement.minimumExpectations,
      considerations:       requirement.considerations,
      mandatedStructure:    requirement.mandatedStructure,
      owner:                requirement.owner,
    }, null, 2);

    const { system: rawSystem, userTemplate } = parsePromptFile(readPrompt("respond.md"));
    const system = rawSystem.replace("{{HOUSE_VOICE}}", HOUSE_VOICE);
    const userContent = userTemplate
      .replace("{{BUYER_NAME}}",       pack.buyer)
      .replace("{{BIDDER_CONTEXT}}",   bidderCtx)
      .replace("{{REQUIREMENT_JSON}}", reqJson)
      .replace("{{CROSS_CUTTING}}",    JSON.stringify(requirement.crossCuttingConstraints, null, 2))
      .replace("{{KNOWLEDGE}}",        RR_KNOWLEDGE)
      .replace("{{HOUSE_VOICE}}",      HOUSE_VOICE);

    type RawBlock = {
      key: string; type: string; prompt: string; answer: string;
      placeholders: Array<{ id: string; description: string; blockKey: string }>;
    };
    type RespondResult = {
      lens?: string;
      blocks: RawBlock[];
      enrichmentBlocks?: RawBlock[];
      openDependencies?: string[];
    };

    let result: RespondResult | null = null;
    for (const maxTokens of [16_000, 32_000]) {
      try {
        result = await callClaudeJSON<RespondResult>(system, userContent, { maxTokens });
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("truncated") && maxTokens === 16_000) { continue; }
        throw err;
      }
    }
    if (!result) throw new Error("Respond: no output after retry");

    const minBlocks   = Array.isArray(result.blocks)          ? result.blocks          : [];
    const enrichBlocks = Array.isArray(result.enrichmentBlocks) ? result.enrichmentBlocks : [];
    const allRaw      = [...minBlocks, ...enrichBlocks];

    const blocks = allRaw.map((b) => ({
      key:      b.key  ?? `block_${Math.random().toString(36).slice(2, 7)}`,
      type:     (b.type === "minimum" ? "minimum" : "enrichment") as "minimum" | "enrichment",
      prompt:   b.prompt  ?? "",
      answer:   b.answer  ?? "",
      placeholders: (Array.isArray(b.placeholders) ? b.placeholders : []).map((p) => ({
        id:          p.id || "ph_000",
        description: p.description ?? "",
        group:       b.key,
        value:       null,
        filled:      false,
      })),
      reviewed: false,
    }));

    const response = saveResponse(requirement.id, {
      lens:             result.lens ?? "Commercial",
      blocks,
      openDependencies: Array.isArray(result.openDependencies) ? result.openDependencies : [],
    });

    appendAuditEvent(pack.id, null, "response_generated",
      `Response generated for ${requirement.code}: ${requirement.title}`, "RRAI",
      { reqId: requirement.id });
    req.log.info({ reqId: requirement.id, blocks: blocks.length }, "rfp: response generated");
    finish({ response });
  } catch (err) {
    req.log.error({ err }, "rfp: respond failed");
    finish({ error: (err as Error).message });
  }
});

// ── Response block CRUD ───────────────────────────────────────────────────────

router.get("/rfp/requirements/:id/response", (req, res): void => {
  const response = getResponse(req.params.id);
  if (!response) { res.status(404).json({ error: "Response not found" }); return; }
  res.json({ response });
});

router.patch("/rfp/requirements/:id/response/blocks/:blockKey", (req, res): void => {
  const { answer } = req.body as { answer?: string };
  if (typeof answer !== "string") { res.status(400).json({ error: "answer is required" }); return; }
  const block = updateBlockAnswer(req.params.id, req.params.blockKey, answer);
  if (!block) { res.status(404).json({ error: "Block not found" }); return; }
  const req_ = getRequirement(req.params.id);
  if (req_) appendAuditEvent(req_.bidPackId, null, "block_edited",
    `Block ${req.params.blockKey} edited`, "user", { reqId: req.params.id });
  res.json({ block });
});

router.post("/rfp/requirements/:id/response/blocks/:blockKey/placeholders/:phId/fill", (req, res): void => {
  const { value } = req.body as { value?: string };
  if (typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: "value is required" }); return;
  }
  const ph = fillBlockPlaceholder(req.params.id, req.params.blockKey, req.params.phId, value.trim());
  if (!ph) { res.status(404).json({ error: "Placeholder not found" }); return; }
  res.json({ placeholder: ph });
});

router.patch("/rfp/requirements/:id/response/blocks/:blockKey/reviewed", (req, res): void => {
  const { reviewed } = req.body as { reviewed?: boolean };
  if (typeof reviewed !== "boolean") { res.status(400).json({ error: "reviewed must be boolean" }); return; }
  const ok = setBlockReviewed(req.params.id, req.params.blockKey, reviewed);
  if (!ok) { res.status(404).json({ error: "Block not found" }); return; }
  const req_ = getRequirement(req.params.id);
  if (req_) appendAuditEvent(req_.bidPackId, null, "block_reviewed",
    `Block ${req.params.blockKey} ${reviewed ? "reviewed" : "un-reviewed"}`, "user", { reqId: req.params.id });
  res.json({ ok: true });
});

router.post("/rfp/requirements/:id/response/advance", (req, res): void => {
  const result = advanceResponseStatus(req.params.id);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  const req_ = getRequirement(req.params.id);
  if (req_) appendAuditEvent(req_.bidPackId, null,
    result.response.status === "approved" ? "response_approved" : "response_advanced",
    `Response for ${req_?.code} advanced to ${result.response.status}`, "user");
  res.json({ response: result.response });
});

router.post("/rfp/requirements/:id/response/reopen", (req, res): void => {
  const response = reopenResponse(req.params.id);
  if (!response) { res.status(404).json({ error: "Response not found" }); return; }
  const req_ = getRequirement(req.params.id);
  if (req_) appendAuditEvent(req_.bidPackId, null, "response_advanced",
    `Response for ${req_?.code} reopened`, "user");
  res.json({ response });
});

// ── Quality reviews ────────────────────────────────────────────────────────────

router.get("/rfp/packs/:id/quality-reviews", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const { reviewType, targetId } = req.query as { reviewType?: string; targetId?: string };
  const reviews = getQualityReviews(
    req.params.id,
    reviewType as QualityReviewType | undefined,
    targetId,
  );
  res.json({ reviews });
});

// ── Validate decomposition (SSE) ──────────────────────────────────────────────

router.post("/rfp/packs/:id/validate-decomp", async (req, res): Promise<void> => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const requirements = getRequirements(req.params.id);
  if (!requirements.length) { res.status(400).json({ error: "No requirements to validate — decompose first" }); return; }
  const profile = getProfile(req.params.id);

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ packId: pack.id, reqCount: requirements.length }, "rfp: validating decomposition");

  try {
    // ── Deterministic checks ──────────────────────────────────────────────────
    const sorted = [...requirements].sort((a, b) => a.order - b.order);
    const orderPreserved = sorted.every((r, i) => r.order === i + 1);
    const constraintsCaptured = sorted.some((r) => r.crossCuttingConstraints.length > 0);
    const minimumExpectationsCaptured = sorted.every((r) => {
      const hasMustInclude = /at a minimum|must include|your response/i.test(r.sourceText);
      return hasMustInclude ? r.minimumExpectations.length > 0 : true;
    });

    const detFindings: string[] = [];
    if (!orderPreserved)                detFindings.push("Requirements are not in sequential order");
    if (!minimumExpectationsCaptured)   detFindings.push("Some requirements with 'at a minimum' language have empty minimumExpectations");
    if (!constraintsCaptured)           detFindings.push("No cross-cutting constraints captured");

    // ── LLM review ────────────────────────────────────────────────────────────
    const profileJson = JSON.stringify(profile ?? {}, null, 2);
    const reqsJson    = JSON.stringify(sorted.map((r) => ({
      code: r.code, order: r.order, title: r.title,
      minimumExpectations: r.minimumExpectations,
      owner: r.owner, ownerConfidence: r.ownerConfidence,
      crossCuttingConstraintsCount: r.crossCuttingConstraints.length,
    })), null, 2);

    const { system, userTemplate } = parsePromptFile(readPrompt("validate-decomp.md"));
    const userContent = userTemplate
      .replace("{{PROFILE_JSON}}",      profileJson)
      .replace("{{SOURCE_TEXT}}",       pack.parsedContent.slice(0, 40_000))
      .replace("{{REQUIREMENTS_JSON}}", reqsJson)
      .replace("{{CONSTRAINTS_JSON}}",  JSON.stringify(sorted[0]?.crossCuttingConstraints ?? [], null, 2));

    type ValidateDecompResult = {
      score: number; passed: boolean;
      checks: Record<string, boolean>;
      findings: string[]; missingItems: string[]; recommendedActions: string[];
    };

    const llmResult = await callClaudeJSON<ValidateDecompResult>(system, userContent, { maxTokens: 8192 });

    const checks = {
      ...((llmResult?.checks) ?? {}),
      orderPreserved,
      minimumExpectationsCaptured,
      constraintsCaptured,
    };
    const passed = (llmResult?.passed ?? false) && orderPreserved && minimumExpectationsCaptured;
    const score  = passed ? (llmResult?.score ?? 80) : Math.min(llmResult?.score ?? 50, 69);

    const qr = saveQualityReview(req.params.id, {
      targetType:         "pack",
      targetId:           req.params.id,
      reviewType:         "decomposition",
      score,
      passed,
      findings:           [...detFindings, ...(llmResult?.findings ?? [])],
      missingItems:       llmResult?.missingItems ?? [],
      recommendedActions: llmResult?.recommendedActions ?? [],
      checks,
    });

    if (passed) setWorkflowStage(req.params.id, "map_ownership");
    req.log.info({ packId: pack.id, passed, score }, "rfp: decomp validation complete");
    finish({ qualityReview: qr, workflowStage: pack.workflowStage });
  } catch (err) {
    req.log.error({ err }, "rfp: validate-decomp failed");
    finish({ error: (err as Error).message });
  }
});

// ── Gate override ─────────────────────────────────────────────────────────────

router.post("/rfp/packs/:id/gate/override", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const { reviewType, reason, actor, targetId, advanceTo } = req.body as {
    reviewType?: string; reason?: string; actor?: string;
    targetId?: string; advanceTo?: string;
  };
  if (!reviewType || !reason) {
    res.status(400).json({ error: "reviewType and reason are required" }); return;
  }
  const VALID_TYPES = ["decomposition", "ownership", "response", "final"];
  if (!VALID_TYPES.includes(reviewType)) {
    res.status(400).json({ error: `reviewType must be one of ${VALID_TYPES.join(", ")}` }); return;
  }
  const qr = overrideGate(req.params.id, reviewType as QualityReviewType, reason, actor ?? "user", targetId);
  if (!qr) { res.status(404).json({ error: "No quality review found for this reviewType — run validation first" }); return; }

  // Optionally advance workflowStage after override
  const VALID_STAGES = ["decompose","validate_decomp","map_ownership","validate_ownership","respond","validate_response","rewrite","revalidate","assemble","export"];
  if (advanceTo && VALID_STAGES.includes(advanceTo)) {
    setWorkflowStage(req.params.id, advanceTo as Parameters<typeof setWorkflowStage>[1]);
  }
  res.json({ qualityReview: qr, workflowStage: pack.workflowStage });
});

// ── Validate ownership (deterministic gate) ───────────────────────────────────

router.post("/rfp/packs/:id/validate-ownership", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const requirements = getRequirements(req.params.id);

  const rrOrShared     = requirements.filter((r) => r.owner === "RR" || r.owner === "shared");
  const unconfirmedLow    = rrOrShared.filter((r) => r.ownerConfidence === "low"    && !r.ownerConfirmed);
  const unconfirmedMed    = rrOrShared.filter((r) => r.ownerConfidence === "medium" && !r.ownerConfirmed);
  const unconfirmedShared = requirements.filter((r) => r.owner === "shared"         && !r.ownerConfirmed);

  const findings: string[] = [];
  const missingItems: string[] = [];
  if (unconfirmedLow.length)    findings.push(`${unconfirmedLow.length} low-confidence requirement(s) need human confirmation`);
  if (unconfirmedMed.length)    findings.push(`${unconfirmedMed.length} medium-confidence requirement(s) need human confirmation`);
  if (unconfirmedShared.length) findings.push(`${unconfirmedShared.length} shared requirement(s) need human confirmation`);
  for (const r of [...unconfirmedLow, ...unconfirmedMed, ...unconfirmedShared]) {
    missingItems.push(`${r.code}: ${r.title} (owner=${r.owner}, confidence=${r.ownerConfidence})`);
  }

  const passed = findings.length === 0 && rrOrShared.every((r) => r.ownerConfirmed);
  const score  = passed ? 100 : Math.max(0, 100 - ([...new Set([...unconfirmedLow, ...unconfirmedMed, ...unconfirmedShared])].length * 15));

  const qr = saveQualityReview(req.params.id, {
    targetType: "pack", targetId: req.params.id, reviewType: "ownership",
    score, passed, findings, missingItems,
    recommendedActions: missingItems.map((m) => `Confirm ownership: ${m}`),
    checks: {
      allLowConfirmed:    unconfirmedLow.length    === 0,
      allMediumConfirmed: unconfirmedMed.length    === 0,
      allSharedConfirmed: unconfirmedShared.length === 0,
      allConfirmed:       passed,
    },
  });

  if (passed) setWorkflowStage(req.params.id, "respond");
  req.log.info({ packId: pack.id, passed }, "rfp: ownership validation complete");
  res.json({
    qualityReview: qr,
    workflowStage: pack.workflowStage,
    needsConfirmation: [...new Set([...unconfirmedLow, ...unconfirmedMed, ...unconfirmedShared])]
      .map((r) => ({ id: r.id, code: r.code, title: r.title, owner: r.owner, ownerConfidence: r.ownerConfidence })),
  });
});

// ── Validate response (per requirement, JSON) ─────────────────────────────────

router.post("/rfp/requirements/:id/validate-response", async (req, res): Promise<void> => {
  const requirement = getRequirement(req.params.id);
  if (!requirement) { res.status(404).json({ error: "Requirement not found" }); return; }
  const response = getResponse(req.params.id);
  if (!response)    { res.status(404).json({ error: "Response not found — generate a response first" }); return; }
  const profile  = getProfile(requirement.bidPackId);

  setRequirementResponseStage(req.params.id, "validating");
  req.log.info({ reqId: requirement.id, blocks: response.blocks.length }, "rfp: validating response blocks");

  try {
    const profileJson     = JSON.stringify(profile ?? {}, null, 2);
    const requirementJson = JSON.stringify({
      code: requirement.code, title: requirement.title,
      sourceText:          requirement.sourceText,
      minimumExpectations: requirement.minimumExpectations,
      owner:               requirement.owner,
      crossCuttingConstraints: requirement.crossCuttingConstraints,
    }, null, 2);

    const { system, userTemplate } = parsePromptFile(readPrompt("validate-response.md"));

    type ValidateRespResult = {
      blockKey: string; score: number; passed: boolean;
      checks: Record<string, boolean>;
      findings: string[]; missingItems: string[]; recommendedActions: string[];
    };

    const blockResults: ValidateRespResult[] = [];
    for (const block of response.blocks.filter((b) => b.type === "minimum")) {
      const userContent = userTemplate
        .replace("{{PROFILE_JSON}}",     profileJson)
        .replace("{{REQUIREMENT_JSON}}", requirementJson)
        .replace(/\{\{BLOCK_KEY\}\}/g,   block.key)
        .replace("{{BLOCK_TYPE}}",       block.type)
        .replace("{{BLOCK_PROMPT}}",     block.prompt)
        .replace("{{BLOCK_ANSWER}}",     block.answer);

      const llmResult = await callClaudeJSON<ValidateRespResult>(system, userContent, { maxTokens: 2048 });
      const passed    = llmResult?.passed ?? false;
      const findings  = llmResult?.findings ?? [];
      setBlockValidation(req.params.id, block.key, passed ? "passed" : "failed", findings);
      blockResults.push({
        blockKey:           block.key,
        score:              llmResult?.score ?? 0,
        passed,
        checks:             llmResult?.checks ?? {},
        findings,
        missingItems:       llmResult?.missingItems ?? [],
        recommendedActions: llmResult?.recommendedActions ?? [],
      });
    }

    const allPassed    = blockResults.every((b) => b.passed);
    const overallScore = blockResults.length > 0
      ? Math.round(blockResults.reduce((s, b) => s + b.score, 0) / blockResults.length)
      : 100;

    const qr = saveQualityReview(requirement.bidPackId, {
      targetType:  "requirement", targetId: requirement.id, reviewType: "response",
      score:       overallScore, passed:   allPassed,
      findings:    blockResults.flatMap((b) => b.findings),
      missingItems: blockResults.flatMap((b) => b.missingItems),
      recommendedActions: blockResults.flatMap((b) => b.recommendedActions),
      checks:      Object.fromEntries(blockResults.map((b) => [b.blockKey, b.passed])),
    });

    setRequirementResponseStage(req.params.id, allPassed ? "passed" : "failed");
    req.log.info({ reqId: requirement.id, passed: allPassed, score: overallScore }, "rfp: response validation complete");
    res.json({ qualityReview: qr, blockResults });
  } catch (err) {
    setRequirementResponseStage(req.params.id, "failed");
    req.log.error({ err }, "rfp: validate-response failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Rewrite block (SSE) ───────────────────────────────────────────────────────

router.post("/rfp/requirements/:id/blocks/:blockKey/rewrite", async (req, res): Promise<void> => {
  const requirement = getRequirement(req.params.id);
  if (!requirement) { res.status(404).json({ error: "Requirement not found" }); return; }
  const response = getResponse(req.params.id);
  if (!response)    { res.status(404).json({ error: "Response not found" }); return; }
  const profile  = getProfile(requirement.bidPackId);

  const { blockKey } = req.params;
  const block = response.blocks.find((b) => b.key === blockKey);
  if (!block) { res.status(404).json({ error: "Block not found" }); return; }

  const MAX_REWRITES = 2;
  if ((block.rewriteAttempts ?? 0) >= MAX_REWRITES) {
    res.status(400).json({
      error: `Block has reached the maximum of ${MAX_REWRITES} auto-rewrites. Human review required.`,
      escalated: true,
    });
    return;
  }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ reqId: requirement.id, blockKey, attempt: (block.rewriteAttempts ?? 0) + 1 }, "rfp: rewriting block");

  try {
    setBlockValidation(req.params.id, blockKey, "rewriting", block.validationFindings ?? []);

    const profileJson     = JSON.stringify(profile ?? {}, null, 2);
    const requirementJson = JSON.stringify({
      code: requirement.code, title: requirement.title,
      sourceText:          requirement.sourceText,
      minimumExpectations: requirement.minimumExpectations,
      owner: requirement.owner,
      crossCuttingConstraints: requirement.crossCuttingConstraints,
    }, null, 2);

    const latestQr = getLatestQualityReview(requirement.bidPackId, "response", requirement.id);

    const { system, userTemplate } = parsePromptFile(readPrompt("rewrite-block.md"));
    const userContent = userTemplate
      .replace("{{PROFILE_JSON}}",       profileJson)
      .replace("{{REQUIREMENT_JSON}}",   requirementJson)
      .replace("{{BLOCK_KEY}}",          blockKey)
      .replace("{{BLOCK_TYPE}}",         block.type)
      .replace("{{BLOCK_PROMPT}}",       block.prompt)
      .replace("{{ORIGINAL_ANSWER}}",    block.answer)
      .replace("{{FINDINGS_JSON}}",      JSON.stringify(block.validationFindings ?? [], null, 2))
      .replace("{{MISSING_ITEMS_JSON}}", JSON.stringify(latestQr?.missingItems ?? [], null, 2))
      .replace("{{ATTEMPT_NUMBER}}",     String((block.rewriteAttempts ?? 0) + 1));

    type RewriteResult = {
      answer: string;
      placeholders: Array<{ id: string; description: string; group: string | null }>;
      changesLog: string[];
    };

    const llmResult = await callClaudeJSON<RewriteResult>(system, userContent, { maxTokens: 8192 });
    if (!llmResult?.answer) throw new Error("Rewrite: no answer returned");

    const newPlaceholders: Placeholder[] = (Array.isArray(llmResult.placeholders) ? llmResult.placeholders : []).map((p) => ({
      id:          p.id ?? "ph_000",
      description: p.description ?? "",
      group:       p.group ?? blockKey,
      value:       null,
      filled:      false,
    }));

    replaceBlockAnswer(req.params.id, blockKey, llmResult.answer, newPlaceholders);
    setBlockValidation(req.params.id, blockKey, "pending", []);

    appendAuditEvent(requirement.bidPackId, null, "block_rewritten",
      `Block ${blockKey} rewritten (attempt ${(block.rewriteAttempts ?? 0) + 1})`, "RRAI",
      { reqId: req.params.id, blockKey, changesLog: llmResult.changesLog ?? [] });

    const updatedBlock = getResponse(req.params.id)?.blocks.find((b) => b.key === blockKey) ?? null;
    req.log.info({ reqId: requirement.id, blockKey }, "rfp: block rewrite complete");
    finish({ block: updatedBlock });
  } catch (err) {
    setBlockValidation(req.params.id, blockKey, "failed", block.validationFindings ?? []);
    req.log.error({ err }, "rfp: rewrite-block failed");
    finish({ error: (err as Error).message });
  }
});

// ── Assemble ──────────────────────────────────────────────────────────────────

router.post("/rfp/packs/:id/assemble", (req, res): void => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const assembled = assembleResponses(req.params.id);
  if (!assembled.length) {
    res.status(400).json({ error: "No approved RR/shared responses to assemble. Approve all responses first." }); return;
  }
  setWorkflowStage(req.params.id, "assemble");
  appendAuditEvent(req.params.id, null, "assembled",
    `Assembled ${assembled.length} requirement response(s)`, "user");
  req.log.info({ packId: pack.id, count: assembled.length }, "rfp: assembled");
  res.json({ assembled, workflowStage: pack.workflowStage, count: assembled.length });
});

// ── Validate final (SSE) ──────────────────────────────────────────────────────

router.post("/rfp/packs/:id/validate-final", async (req, res): Promise<void> => {
  const pack = getPack(req.params.id);
  if (!pack) { res.status(404).json({ error: "Pack not found" }); return; }
  const profile   = getProfile(req.params.id);
  const assembled = assembleResponses(req.params.id);
  if (!assembled.length) {
    res.status(400).json({ error: "Nothing assembled — run assemble first" }); return;
  }

  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15_000);
  const finish    = (payload: Record<string, unknown>) => {
    clearInterval(keepAlive);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.end();
  };

  req.log.info({ packId: pack.id, count: assembled.length }, "rfp: running final validation");

  try {
    const profileJson   = JSON.stringify(profile ?? {}, null, 2);
    const assembledJson = JSON.stringify(assembled.map((a) => ({
      requirement: {
        id: a.requirement.id, code: a.requirement.code, title: a.requirement.title,
        owner: a.requirement.owner, minimumExpectations: a.requirement.minimumExpectations,
      },
      blocks: a.response.blocks.map((b) => ({ key: b.key, type: b.type, answer: b.answer })),
    })), null, 2);

    const { system, userTemplate } = parsePromptFile(readPrompt("validate-final.md"));
    const userContent = userTemplate
      .replace("{{PROFILE_JSON}}",   profileJson)
      .replace("{{ASSEMBLED_JSON}}", assembledJson.slice(0, 40_000));

    type ValidateFinalResult = {
      score: number; passed: boolean;
      checks: Record<string, boolean>;
      findings: string[]; missingItems: string[]; recommendedActions: string[];
      requirementFlags: Array<{ requirementId: string; issue: string }>;
    };

    const llmResult = await callClaudeJSON<ValidateFinalResult>(system, userContent, { maxTokens: 4096 });

    const qr = saveQualityReview(req.params.id, {
      targetType:         "pack", targetId: req.params.id, reviewType: "final",
      score:              llmResult?.score ?? 0,
      passed:             llmResult?.passed ?? false,
      findings:           llmResult?.findings ?? [],
      missingItems:       llmResult?.missingItems ?? [],
      recommendedActions: llmResult?.recommendedActions ?? [],
      checks:             llmResult?.checks ?? {},
    });

    if (qr.passed) setWorkflowStage(req.params.id, "export");
    req.log.info({ packId: pack.id, passed: qr.passed, score: qr.score }, "rfp: final validation complete");
    finish({
      qualityReview:    qr,
      requirementFlags: llmResult?.requirementFlags ?? [],
      workflowStage:    pack.workflowStage,
    });
  } catch (err) {
    req.log.error({ err }, "rfp: validate-final failed");
    finish({ error: (err as Error).message });
  }
});

export default router;
