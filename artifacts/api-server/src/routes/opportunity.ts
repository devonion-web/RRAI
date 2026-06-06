import { Router } from "express";
import type { Logger } from "pino";
import {
  createOpportunity,
  getOpportunity,
  listOpportunities,
  deleteOpportunity,
  updateOpportunityCompany,
  mergeEnrichment,
  modelSummaryForPrompt,
  type OIFieldItem,
} from "../lib/opportunityStore.js";
import { callClaudeJSON } from "../lib/anthropic.js";

const router = Router();

// ── Context ───────────────────────────────────────────────────────────────────

const FIELD_SCHEMA = `Each item in every field array has this shape:
{
  "value": "<one concise sentence or noun phrase>",
  "source_section": "<heading, section name, or page reference in the document>",
  "confidence": "High | Medium | Low",
  "explicit_or_inferred": "Explicit | Inferred"
}

Explicit = directly stated in the document.
Inferred = implied by context, not stated verbatim.
Confidence = how certain you are of the interpretation.`;

const SECTION_SCHEMA = `Output a JSON object. Only include sections and fields where you found relevant information. Omit empty fields entirely. Use this exact key structure:

{
  "customer": {
    "name": [],
    "industry": [],
    "geography": [],
    "stakeholders": [],
    "sponsors": []
  },
  "objectives": {
    "business_objectives": [],
    "drivers": [],
    "challenges": [],
    "desired_outcomes": []
  },
  "use_cases": {
    "risk_management": [],
    "controls": [],
    "audit": [],
    "tprm": [],
    "compliance": [],
    "policy": [],
    "incident_management": [],
    "reporting": [],
    "workflow": [],
    "other": []
  },
  "solution": {
    "logicgate_modules": [],
    "vendor_components": [],
    "integrations": [],
    "reporting_requirements": [],
    "data_model_requirements": []
  },
  "delivery": {
    "discovery_requirements": [],
    "configuration_requirements": [],
    "migration_requirements": [],
    "integration_requirements": [],
    "testing_requirements": [],
    "training_requirements": []
  },
  "support": {
    "hypercare_requirements": [],
    "managed_service_opportunities": [],
    "support_coverage": [],
    "administrative_support": [],
    "geographic_considerations": []
  },
  "commercial": {
    "constraints": [],
    "assumptions": [],
    "contractual_considerations": [],
    "delivery_complexity_indicators": []
  },
  "risks": {
    "delivery_risks": [],
    "integration_risks": [],
    "resource_risks": [],
    "dependency_risks": []
  },
  "response_areas": {
    "rr_response_required": [],
    "logicgate_validation_required": [],
    "joint_response_required": []
  }
}`;

// ── Claude enrichment call ────────────────────────────────────────────────────

async function claudeEnrichModel(
  documentContent: string,
  documentName: string,
  existingSummary: string,
  vendorContext: string,
  log: Logger,
): Promise<Record<string, Record<string, OIFieldItem[]>>> {
  const system = `You are a senior Risk Rising consultant building an Opportunity Intelligence Model.

Your task: read the provided document and extract information that should be recorded in the model.

The model is used internally to understand what Risk Rising would need to DELIVER, IMPLEMENT, SUPPORT and RESPOND TO if we won the engagement.

DO NOT generate responses. DO NOT draft proposals. DO NOT recommend pursuit strategy.
DO NOT repeat information already in the model (shown below).
Only extract NEW or HIGHER-CONFIDENCE information.

Vendor context: ${vendorContext}

${FIELD_SCHEMA}

Rules:
- Keep each value concise: one line, no paragraph answers
- "use_cases" fields (e.g. risk_management, controls): populate if that use case is present — the value should be a short description of WHY it's needed, not a generic label
- "response_areas": only populate if you can identify specific questions that need a response
- Do not hallucinate — only extract what is in the document
- Do not repeat values already listed in the existing model

${SECTION_SCHEMA}

Output ONLY valid JSON — no prose, no code fences.`;

  const user = `${existingSummary}\n\n---\n\nDocument name: ${documentName}\n\nDocument content:\n${documentContent.slice(0, 60_000)}`;

  try {
    const result = await callClaudeJSON<Record<string, Record<string, OIFieldItem[]>>>(system, user, { maxTokens: 4000 });
    return result ?? {};
  } catch (err) {
    log.warn({ err }, "claudeEnrichModel failed — returning empty delta");
    return {};
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// List all opportunities
router.get("/opportunity", (_req, res) => {
  res.json({ opportunities: listOpportunities() });
});

// Create opportunity
router.post("/opportunity", (req, res) => {
  const company = String(req.body?.company ?? "").trim() || "Unknown";
  const model = createOpportunity(company);
  res.json(model);
});

// Get single opportunity
router.get("/opportunity/:id", (req, res) => {
  const model = getOpportunity(req.params.id);
  if (!model) return res.status(404).json({ error: "Not found" });
  return res.json(model);
});

// Update company name
router.patch("/opportunity/:id", (req, res) => {
  const model = getOpportunity(req.params.id);
  if (!model) return res.status(404).json({ error: "Not found" });
  if (req.body?.company) updateOpportunityCompany(req.params.id, String(req.body.company).trim());
  return res.json(getOpportunity(req.params.id));
});

// Delete opportunity
router.delete("/opportunity/:id", (req, res) => {
  const ok = deleteOpportunity(req.params.id);
  res.json({ ok });
});

// Enrich opportunity from document content
router.post("/opportunity/:id/enrich", async (req, res) => {
  const log = req.log;
  const model = getOpportunity(req.params.id);
  if (!model) return res.status(404).json({ error: "Not found" });

  const { content, documentName = "Document", vendorContext = "LogicGate" } = req.body as {
    content: string;
    documentName?: string;
    vendorContext?: string;
  };

  if (!content?.trim()) return res.status(400).json({ error: "content is required" });

  log.info({ id: req.params.id, documentName }, "opportunity: enriching model");

  const existingSummary = modelSummaryForPrompt(model);
  const delta = await claudeEnrichModel(content, documentName, existingSummary, vendorContext, log);
  const { fieldsAdded } = mergeEnrichment(model, delta, documentName);

  log.info({ id: req.params.id, fieldsAdded }, "opportunity: enrichment complete");

  const updated = getOpportunity(req.params.id);
  return res.json({ model: updated, fieldsAdded });
});

export default router;
