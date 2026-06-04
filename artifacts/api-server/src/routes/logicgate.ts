import { Router, type IRouter } from "express";
import multer from "multer";
import { callClaude, callClaudeJSON } from "../lib/anthropic";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── In-memory stores ─────────────────────────────────────────────────────────

interface Opportunity {
  opportunity_id: string;
  company: string;
  created_at: string;
  events: OpportunityEvent[];
  contacts: Contact[];
}

interface OpportunityEvent {
  id: string;
  type: string;
  description: string;
  stage: string;
  created_at: string;
  output_snapshot?: Record<string, unknown>;
}

interface Contact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  notes?: string;
  opportunity_id?: string;
  created_at: string;
}

const opportunityStore = new Map<string, Opportunity>();
const contactStore = new Map<string, Contact>();

function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const VALUE_DRIVER_LIBRARY = [
  {
    key: "tprm_assessment_time",
    app: "Third Party Risk Management",
    label: "Vendor Assessment Time Reduction",
    unit: "currency_via_time",
    inputs: [
      { key: "currentDays", label: "Current days per assessment", defaultValue: 10 },
      { key: "targetDays", label: "Target days per assessment", defaultValue: 3 },
      { key: "vendorsPerYear", label: "Vendors assessed per year", defaultValue: 100 },
    ],
  },
  {
    key: "risk_review_cycle",
    app: "Risk Management",
    label: "Risk Review Cycle Reduction",
    unit: "currency_via_time",
    inputs: [
      { key: "currentDays", label: "Current days per risk review cycle", defaultValue: 15 },
      { key: "targetDays", label: "Target days per risk review cycle", defaultValue: 5 },
      { key: "cyclesPerYear", label: "Review cycles per year", defaultValue: 4 },
    ],
  },
  {
    key: "audit_prep_time",
    app: "Audit Management",
    label: "Audit Preparation Time Reduction",
    unit: "currency_via_time",
    inputs: [
      { key: "currentDays", label: "Current days to prepare per audit", defaultValue: 20 },
      { key: "targetDays", label: "Target days to prepare per audit", defaultValue: 7 },
      { key: "auditsPerYear", label: "Audits per year", defaultValue: 6 },
    ],
  },
  {
    key: "compliance_monitoring_cost",
    app: "Compliance Management",
    label: "Compliance Monitoring Cost Reduction",
    unit: "currency",
    inputs: [
      { key: "currentCost", label: "Current annual cost per compliance program ($)", defaultValue: 50000 },
      { key: "targetCost", label: "Target annual cost per compliance program ($)", defaultValue: 20000 },
      { key: "cyclesPerYear", label: "Number of compliance programs", defaultValue: 3 },
    ],
  },
  {
    key: "policy_management_cost",
    app: "Policy Management",
    label: "Policy Review & Attestation Cost Reduction",
    unit: "currency",
    inputs: [
      { key: "currentCost", label: "Current annual policy management cost ($)", defaultValue: 30000 },
      { key: "targetCost", label: "Target annual policy management cost ($)", defaultValue: 10000 },
      { key: "cyclesPerYear", label: "Policy suites managed", defaultValue: 1 },
    ],
  },
  {
    key: "incident_resolution_time",
    app: "Incident Management",
    label: "Incident Resolution Time Reduction",
    unit: "currency_via_time",
    inputs: [
      { key: "currentDays", label: "Current days to resolve per incident", defaultValue: 5 },
      { key: "targetDays", label: "Target days to resolve per incident", defaultValue: 1 },
      { key: "cyclesPerYear", label: "Incidents per year", defaultValue: 50 },
    ],
  },
  {
    key: "regulatory_risk_reduction",
    app: "Compliance Management",
    label: "Regulatory Risk Reduction",
    unit: "risk",
    inputs: [],
  },
];

const OPERATIONAL_METRICS_LIBRARY = [
  { key: "day_rate", label: "Internal staff day rate (£/day)", defaultValue: 500 },
  { key: "vendor_count", label: "Number of active vendors", defaultValue: 150 },
  { key: "audit_count", label: "Audits conducted per year", defaultValue: 8 },
  { key: "risk_reviews_per_year", label: "Risk review cycles per year", defaultValue: 4 },
  { key: "compliance_programs", label: "Active compliance programs", defaultValue: 4 },
  { key: "policy_count", label: "Policy suites managed", defaultValue: 5 },
  { key: "incidents_per_year", label: "IT/operational incidents per year", defaultValue: 60 },
];

const SOW_PROFILES = [
  {
    id: "riskcloud_standard",
    name: "Risk Cloud — Standard",
    description: "Core GRC implementation for mid-market accounts",
    modules: {
      core: [
        { id: "risk_mgmt", name: "Risk Management", description: "Centralised risk register, scoring & workflow", days: 10 },
        { id: "issue_mgmt", name: "Issue & Action Management", description: "Issue tracking, action assignment & closure", days: 5 },
        { id: "policy_mgmt", name: "Policy Management", description: "Policy library, review cycles & attestation", days: 5 },
        { id: "workflow", name: "Workflow Builder", description: "Custom approval & escalation workflows", days: 5 },
        { id: "reporting", name: "Dashboards & Reporting", description: "Executive dashboards, heatmaps & exports", days: 5 },
      ],
      optional: [
        { id: "tprm", name: "Third Party Risk Management", description: "Vendor assessment, scoring & monitoring", days: 10 },
        { id: "audit", name: "Audit Management", description: "Audit planning, fieldwork & reporting", days: 8 },
        { id: "compliance", name: "Compliance Management", description: "Control framework mapping & evidence collection", days: 8 },
        { id: "incident", name: "Incident Management", description: "Incident triage, response & lessons learned", days: 6 },
      ],
    },
    complexity_drivers: [
      { id: "sso", label: "SSO / SAML integration", days: 2 },
      { id: "data_migration", label: "Data migration from legacy system", days: 5 },
      { id: "api_integration", label: "API integration with existing tools", days: 5 },
      { id: "custom_reporting", label: "Custom reporting & BI integration", days: 3 },
    ],
  },
  {
    id: "riskcloud_enterprise",
    name: "Risk Cloud — Enterprise",
    description: "Full-suite GRC for enterprise accounts with complex requirements",
    modules: {
      core: [
        { id: "risk_mgmt", name: "Risk Management", description: "Enterprise risk register with pillar structure", days: 15 },
        { id: "issue_mgmt", name: "Issue & Action Management", description: "Multi-stakeholder issue tracking & escalation", days: 8 },
        { id: "policy_mgmt", name: "Policy Management", description: "Hierarchical policy library & global attestation", days: 8 },
        { id: "tprm", name: "Third Party Risk Management", description: "Tiered vendor assessment, due diligence & monitoring", days: 15 },
        { id: "audit", name: "Audit Management", description: "Internal audit lifecycle & external audit support", days: 12 },
        { id: "compliance", name: "Compliance Management", description: "Multi-framework control mapping & evidence mgmt", days: 12 },
        { id: "workflow", name: "Workflow Builder", description: "Complex approval chains & conditional routing", days: 8 },
        { id: "reporting", name: "Executive Dashboards", description: "Board-ready reporting, heatmaps & trend analysis", days: 8 },
      ],
      optional: [
        { id: "incident", name: "Incident Management", description: "Incident triage, response & post-mortem", days: 8 },
        { id: "bcp", name: "Business Continuity", description: "BIA, BCP authoring & test management", days: 10 },
        { id: "esg", name: "ESG / Sustainability Risk", description: "ESG risk register & reporting framework", days: 8 },
      ],
    },
    complexity_drivers: [
      { id: "sso", label: "SSO / SAML integration", days: 2 },
      { id: "mfa", label: "MFA / advanced auth", days: 1 },
      { id: "data_migration", label: "Data migration from legacy system", days: 8 },
      { id: "api_integration", label: "API / webhook integration", days: 8 },
      { id: "multi_entity", label: "Multi-entity / subsidiary structure", days: 5 },
      { id: "custom_reporting", label: "Custom BI / Power BI integration", days: 5 },
      { id: "change_mgmt", label: "Change management & comms support", days: 3 },
    ],
  },
];

// ─── Prompt helpers ───────────────────────────────────────────────────────────

const LOGICGATE_CONTEXT = `
LogicGate Risk Cloud is a leading enterprise GRC (Governance, Risk & Compliance) platform used by mid-market and enterprise organisations to manage risk, compliance, audits, vendor risk, policies, and incidents in one connected system.

Risk Rising is a LogicGate Gold Partner based in the UK. Risk Rising specialises in LogicGate implementations, GRC consulting, and enterprise risk advisory. The team sells LogicGate Risk Cloud to CISO, CRO, Head of Risk, Head of Compliance, Head of Internal Audit, and similar roles.

LogicGate Risk Cloud key apps/modules:
- Risk Management (risk register, bow-tie, heat maps)
- Issue & Action Management
- Policy Management & Attestation
- Third Party Risk Management (TPRM) / Vendor Risk
- Audit Management
- Compliance Management (SOC 2, ISO 27001, DORA, NIS2, etc.)
- Incident Management
- Business Continuity Planning
- ESG Risk

Typical deal sizes: £50k–£500k+ ARR. Sales cycle: 3–9 months. Key competitors: ServiceNow GRC, OneTrust, Riskonnect, MetricStream, Archer (legacy).
`.trim();

const DASHBOARD_SCHEMA = `
Return a "dashboard" object with EXACTLY these fields (scoring_model_version must always be 2):
{
  "prospect_match_score": <integer 0-100>,
  "score_direction": "<New|Improving|Declining|Flat>",
  "logicgate_use_case_fit_level": "<Strong|Moderate|Weak>",
  "logicgate_use_case_fit_reason": "<1-2 sentence rationale>",
  "implementation_scope_and_vision": "<brief scope description e.g. 'Risk + TPRM + Compliance'>",
  "implementation_scope_reason": "<1-2 sentence rationale>",
  "competition_status": "<Known|Unknown|None>",
  "competition_detail": "<1-2 sentences>",
  "budget_status": "<Confirmed|Indicated|Unknown>",
  "budget_detail": "<1-2 sentences>",
  "executive_sponsors": "<Strong|Weak|Unknown>",
  "executive_sponsor_detail": "<1-2 sentences>",
  "compelling_event": "<Strong|Weak|None|Unknown>",
  "compelling_event_detail": "<1-2 sentences>",
  "next_steps": "<actionable next step string>",
  "scoring_model_version": 2
}

SCORING GUIDE (four-pillar model v2):
Start at 40 as base.
- Use Case Fit: Strong +30, Moderate +15, Weak +0
- Budget: Confirmed +15, Indicated +8, Unknown +0  
- Executive Sponsors: Strong +15, Weak +5, Unknown +0
- Compelling Event: Strong +20, Weak +10, None -10, Unknown +0
Mandatory penalties: deduct 5 for each critical field where information is absent/unknown when it should be knowable.
`.trim();

// ─── Routes: health ───────────────────────────────────────────────────────────

router.get("/health", (_req, res): void => {
  res.json({ status: "ok" });
});

// ─── Routes: AI generation ────────────────────────────────────────────────────

router.post("/generate-prep", async (req, res): Promise<void> => {
  const { company, sdrNotes, emailNotes, uploadedText, previousDealScore, previousStructuredOutput } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate sales preparation expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate a comprehensive pre-discovery briefing for an upcoming discovery call.

${DASHBOARD_SCHEMA}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "result": "<comprehensive markdown briefing — company overview, why LogicGate fits, key risks, recommended discovery angle, MEDDIC analysis, top 5 discovery questions>",
  "dashboard": { <dashboard object as described above with score_direction always "New" for first run> },
  "structured": {
    "company": "<company name>",
    "industry": "<inferred industry>",
    "deal_snapshot": {
      "product_fit": "<Strong|Moderate|Weak>",
      "key_use_cases": ["<use case 1>", "<use case 2>"],
      "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"]
    },
    "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"]
  },
  "resolved_snapshot": {
    "score": <integer matching dashboard.prospect_match_score>,
    "stance": "<Highly Qualified|Qualified|Developing|Early Stage>",
    "fit_level": "<Strong|Moderate|Weak>",
    "product_fit": "<Strong|Moderate|Weak>"
  },
  "prep_packet": {
    "company": "<company name>",
    "generated_at": "<ISO timestamp>",
    "stage": "pre_discovery"
  },
  "dashboard_summary": "<one-line summary e.g. '72/100 — Moderate fit, budget unknown'>",
  "source_notes": {
    "has_sdr_notes": <true|false>,
    "has_email_notes": <true|false>,
    "has_uploaded_docs": <true|false>
  }
}`;

  const contextParts: string[] = [];
  if (company) contextParts.push(`Company: ${company}`);
  if (sdrNotes) contextParts.push(`SDR/Rep Notes:\n${sdrNotes}`);
  if (emailNotes) contextParts.push(`Email/Correspondence Notes:\n${emailNotes}`);
  if (uploadedText) contextParts.push(`Uploaded Document Content:\n${uploadedText}`);
  if (previousDealScore) contextParts.push(`Previous Deal Score: ${previousDealScore}`);
  if (previousStructuredOutput) contextParts.push(`Previous Structured Output:\n${JSON.stringify(previousStructuredOutput, null, 2)}`);

  const user = contextParts.length ? contextParts.join("\n\n") : `Company: ${String(company || "Unknown")}`;

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, user);
    req.log.info({ company }, "generate-prep completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-prep failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/post-discovery", async (req, res): Promise<void> => {
  const { company, previousPrep, transcript, extraNotes, uploadedText, previousDealScore, previousStructuredOutput } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate post-discovery analysis expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: given the discovery call transcript and prior prep, generate an updated deal assessment.

${DASHBOARD_SCHEMA}

Return ONLY valid JSON:
{
  "result": "<comprehensive markdown post-discovery update — what was confirmed, what changed, updated MEDDIC, key signals, recommended next actions>",
  "dashboard": { <dashboard object — score_direction reflects change from previous score if previousDealScore given, else 'Flat'> },
  "structured": {
    "company": "<company>",
    "industry": "<industry>",
    "deal_snapshot": {
      "product_fit": "<Strong|Moderate|Weak>",
      "key_use_cases": ["<use case>"],
      "top_risks": ["<risk>"]
    },
    "top_risks": ["<risk 1>", "<risk 2>", "<risk 3>"]
  },
  "resolved_snapshot": {
    "score": <integer>,
    "stance": "<Highly Qualified|Qualified|Developing|Early Stage>",
    "fit_level": "<Strong|Moderate|Weak>",
    "product_fit": "<Strong|Moderate|Weak>"
  },
  "post_discovery_packet": {
    "company": "<company>",
    "generated_at": "<ISO timestamp>",
    "stage": "post_discovery"
  },
  "source_notes": {
    "has_transcript": <true|false>,
    "has_extra_notes": <true|false>,
    "has_uploaded_docs": <true|false>
  }
}`;

  const contextParts: string[] = [];
  if (company) contextParts.push(`Company: ${company}`);
  if (previousPrep) contextParts.push(`Previous Pre-Discovery Briefing:\n${previousPrep}`);
  if (transcript) contextParts.push(`Discovery Call Transcript:\n${transcript}`);
  if (extraNotes) contextParts.push(`Additional Notes:\n${extraNotes}`);
  if (uploadedText) contextParts.push(`Uploaded Document:\n${uploadedText}`);
  if (previousDealScore) contextParts.push(`Previous Score: ${previousDealScore}`);
  if (previousStructuredOutput) contextParts.push(`Previous Structured Output:\n${JSON.stringify(previousStructuredOutput, null, 2)}`);

  const user = contextParts.join("\n\n") || `Company: ${String(company || "Unknown")}`;

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, user);
    req.log.info({ company }, "post-discovery completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "post-discovery failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/deal-strategy", async (req, res): Promise<void> => {
  const { postDiscoveryOutput, company } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate deal strategy expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate a detailed deal execution strategy from the post-discovery assessment.

Return ONLY valid JSON:
{
  "result": "<comprehensive markdown deal strategy — executive summary, MEDDIC status, key plays, risk mitigation, commercial strategy, champion development plan, competitive positioning, 30/60/90 day plan>",
  "structured": {
    "key_plays": ["<play 1>", "<play 2>"],
    "risks": ["<risk 1>", "<risk 2>"],
    "commercial_approach": "<string>"
  },
  "execution_packet": {
    "company": "<company>",
    "generated_at": "<ISO timestamp>",
    "stage": "execution"
  }
}`;

  const user = [
    company ? `Company: ${company}` : "",
    postDiscoveryOutput ? `Post-Discovery Output:\n${postDiscoveryOutput}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, user);
    req.log.info({ company }, "deal-strategy completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "deal-strategy failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-rich-briefing", async (req, res): Promise<void> => {
  const { company, stage, dashboard, source_notes, previousOutput, transcript, extraNotes, previousBriefing } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate expert briefing writer for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate or update a comprehensive executive briefing document that expands on the deal dashboard without recalculating scores.

The briefing should be structured, long-form markdown suitable for sharing with the sales team or as a deal brief. It should include:
- Executive summary
- Company & market context  
- GRC maturity assessment
- LogicGate fit analysis
- Use case deep-dive
- Competitive landscape
- Stakeholder map
- Risk factors & mitigation
- Recommended approach
- Key open questions

If previousBriefing is provided, UPDATE and EXPAND it — do not restart from scratch.

Return ONLY valid JSON:
{
  "briefing": "<full markdown briefing document>"
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    `Stage: ${String(stage || "pre_discovery")}`,
    dashboard ? `Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    source_notes ? `Source Notes:\n${JSON.stringify(source_notes, null, 2)}` : "",
    previousOutput ? `Prior Analysis Output:\n${previousOutput}` : "",
    transcript ? `Call Transcript:\n${transcript}` : "",
    extraNotes ? `Additional Notes:\n${extraNotes}` : "",
    previousBriefing ? `Previous Briefing (update/expand this):\n${previousBriefing}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<{ briefing: string }>(system, contextParts.join("\n\n"));
    req.log.info({ company, stage }, "generate-rich-briefing completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-rich-briefing failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-emails", async (req, res): Promise<void> => {
  const { company, stage, dashboard, source_notes, previousOutput, transcript, extraNotes } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate sales email expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate three distinct follow-up email variants from the deal context. Each should have a different angle/tone:
- followup1: Value-focused — lead with the key business outcome/pain
- followup2: Social proof / proof of concept — reference similar deployments or a relevant case study  
- followup3: Urgency / next step — focus on the compelling event and moving forward

Each email should be concise, personalised to the prospect, and have a clear CTA. Avoid generic language.

Return ONLY valid JSON:
{
  "emails": {
    "followup1": { "subject": "<subject line>", "body": "<email body — plain text with line breaks>" },
    "followup2": { "subject": "<subject line>", "body": "<email body>" },
    "followup3": { "subject": "<subject line>", "body": "<email body>" }
  }
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    `Stage: ${String(stage || "pre_discovery")}`,
    dashboard ? `Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    previousOutput ? `Prior Analysis:\n${previousOutput}` : "",
    transcript ? `Transcript Excerpt:\n${String(transcript).slice(0, 3000)}` : "",
    extraNotes ? `Notes:\n${extraNotes}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<{ emails: Record<string, unknown> }>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "generate-emails completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-emails failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-post-demo", async (req, res): Promise<void> => {
  const { company, previousDashboard, postDiscoveryDashboard, demoTranscript, demoNotes, source_notes, previousOutput } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate post-demo analysis expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: update the deal dashboard after a product demo, reflecting what changed, new buying signals, and any risks surfaced.

${DASHBOARD_SCHEMA}

Return ONLY valid JSON:
{
  "result": "<markdown post-demo update — what changed, demo effectiveness, buying signals, objections, updated deal stance>",
  "dashboard": { <updated dashboard — score_direction reflects movement from priorScore> },
  "post_demo_summary": {
    "what_changed": ["<field or signal that changed>"],
    "buying_signals": ["<positive signal from demo>"],
    "new_risks": ["<risk surfaced during demo>"],
    "demo_effectiveness": "<Strong|Moderate|Weak>"
  },
  "source_notes": {
    "has_transcript": <true|false>,
    "has_notes": <true|false>
  }
}`;

  const priorDash = postDiscoveryDashboard || previousDashboard;
  const priorScore = priorDash && typeof (priorDash as Record<string, unknown>).prospect_match_score === "number"
    ? (priorDash as Record<string, unknown>).prospect_match_score
    : null;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    priorScore !== null ? `Prior Deal Score: ${priorScore}` : "",
    priorDash ? `Prior Dashboard:\n${JSON.stringify(priorDash, null, 2)}` : "",
    previousOutput ? `Prior Analysis:\n${previousOutput}` : "",
    demoTranscript ? `Demo Transcript:\n${demoTranscript}` : "",
    demoNotes ? `Demo Notes:\n${demoNotes}` : "",
    source_notes ? `Source Notes:\n${JSON.stringify(source_notes, null, 2)}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "generate-post-demo completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-post-demo failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-solution-breakdown", async (req, res): Promise<void> => {
  const { company, dashboard, postDemoSummary, demoTranscript, demoNotes, postDiscoveryTranscript, sourceNotes, prepNotes, sdrNotes } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate solution scoping expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate a phased Risk Cloud implementation scope based on the deal context.

Phase 1 = must-have apps to solve the primary pain (deploy in months 1-6).
Phase 2 = high-value expansion apps (months 7-18).
Optional = nice-to-have or future consideration.

Each app entry: { "app": "<app name>", "rationale": "<1 sentence why>", "priority": "<High|Medium|Low>" }

Return ONLY valid JSON:
{
  "result": {
    "proposed_scope": {
      "phase_1": [{ "app": "<name>", "rationale": "<why>", "priority": "High" }],
      "phase_2": [{ "app": "<name>", "rationale": "<why>", "priority": "Medium" }],
      "optional": [{ "app": "<name>", "rationale": "<why>", "priority": "Low" }]
    },
    "commercial_view": "<1-2 sentences on expected commercial scope / deal size>",
    "implementation_notes": "<key delivery considerations>"
  }
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    dashboard ? `Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    postDemoSummary ? `Post-Demo Summary:\n${JSON.stringify(postDemoSummary, null, 2)}` : "",
    sdrNotes ? `SDR Notes:\n${sdrNotes}` : "",
    prepNotes ? `Pre-Discovery Notes:\n${String(prepNotes).slice(0, 2000)}` : "",
    postDiscoveryTranscript ? `Post-Discovery Transcript:\n${String(postDiscoveryTranscript).slice(0, 2000)}` : "",
    demoTranscript ? `Demo Transcript:\n${String(demoTranscript).slice(0, 2000)}` : "",
    demoNotes ? `Demo Notes:\n${demoNotes}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "generate-solution-breakdown completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-solution-breakdown failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-proposal-email", async (req, res): Promise<void> => {
  const { company, dashboard, postDemoSummary, solutionResult, demoTranscript, demoNotes } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate proposal email expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: write a compelling, personalised proposal summary email to send alongside or before the formal proposal document. It should:
- Reference the specific pain/use case discussed
- Articulate the proposed solution scope at a high level
- Quantify or reference value where possible
- Have a clear CTA (proposal review call)
- Be professional but warm

Return ONLY valid JSON:
{
  "email": {
    "subject": "<compelling subject line>",
    "body": "<full email body — plain text with line breaks, signed from the Risk Rising team>"
  }
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    dashboard ? `Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    solutionResult ? `Proposed Solution Scope:\n${JSON.stringify(solutionResult, null, 2)}` : "",
    postDemoSummary ? `Post-Demo Summary:\n${JSON.stringify(postDemoSummary, null, 2)}` : "",
    demoTranscript ? `Demo Transcript (excerpt):\n${String(demoTranscript).slice(0, 1500)}` : "",
    demoNotes ? `Demo Notes:\n${demoNotes}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<{ email: { subject: string; body: string } }>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "generate-proposal-email completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-proposal-email failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-proposal-document", async (req, res): Promise<void> => {
  const { company, dashboard, postDemoSummary, solutionResult, demoTranscript, demoNotes, richBriefing, pricing } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate proposal document writer for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: produce a professional proposal document in markdown. Structure:
1. Executive Summary
2. Understanding of Your Requirements
3. Why LogicGate Risk Cloud
4. Proposed Solution (Phase 1 & Phase 2 scope)
5. Implementation Approach & Timeline
6. Commercial Proposal (use the pricing data if provided)
7. Why Risk Rising
8. Next Steps

Make it compelling, specific to the company, and focused on business outcomes.

Return ONLY valid JSON:
{
  "document": "<full markdown proposal document>"
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    dashboard ? `Deal Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    solutionResult ? `Proposed Scope:\n${JSON.stringify(solutionResult, null, 2)}` : "",
    pricing ? `Pricing:\n${JSON.stringify(pricing, null, 2)}` : "",
    postDemoSummary ? `Post-Demo Summary:\n${JSON.stringify(postDemoSummary, null, 2)}` : "",
    richBriefing ? `Deal Briefing (for context):\n${String(richBriefing).slice(0, 3000)}` : "",
    demoNotes ? `Demo Notes:\n${demoNotes}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<{ document: string }>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "generate-proposal-document completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "generate-proposal-document failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/suggest-value-drivers", async (req, res): Promise<void> => {
  const { company, dashboard, solutionResult, postDemoSummary, demoTranscript, demoNotes, operationalMetrics } = req.body as Record<string, unknown>;

  const system = `You are a LogicGate value case expert for Risk Rising.

${LOGICGATE_CONTEXT}

Available value driver keys and their units:
${VALUE_DRIVER_LIBRARY.map((d) => `- ${d.key} (${d.app}): ${d.label} [unit: ${d.unit}]`).join("\n")}

Input keys per unit:
- currency_via_time: currentDays, targetDays, cyclesPerYear/vendorsPerYear/auditsPerYear
- currency: currentCost, targetCost, cyclesPerYear/vendorsPerYear/auditsPerYear
- risk: (no inputs — qualitative)

Your job: suggest the most relevant value drivers for this deal. For each, provide realistic default inputs based on the deal context and industry norms. Also write a brief business case narrative.

Return ONLY valid JSON:
{
  "drivers": [
    {
      "key": "<driver key from list above>",
      "app": "<app name>",
      "label": "<driver label>",
      "unit": "<currency_via_time|currency|risk>",
      "rationale": "<1 sentence why this applies to this prospect>",
      "inputs": { "<inputKey>": <number> }
    }
  ],
  "narrative": "<2-3 paragraph business case narrative for this prospect — quantify where possible>"
}`;

  const contextParts = [
    `Company: ${String(company || "Unknown")}`,
    dashboard ? `Dashboard:\n${JSON.stringify(dashboard, null, 2)}` : "",
    solutionResult ? `Proposed Scope:\n${JSON.stringify(solutionResult, null, 2)}` : "",
    operationalMetrics ? `Operational Metrics:\n${JSON.stringify(operationalMetrics, null, 2)}` : "",
    postDemoSummary ? `Post-Demo Summary:\n${JSON.stringify(postDemoSummary, null, 2)}` : "",
    demoNotes ? `Demo Notes:\n${demoNotes}` : "",
  ].filter(Boolean);

  try {
    const data = await callClaudeJSON<{ drivers: unknown[]; narrative: string }>(system, contextParts.join("\n\n"));
    req.log.info({ company }, "suggest-value-drivers completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "suggest-value-drivers failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/generate-scorecard", async (req, res): Promise<void> => {
  const { dashboard, company } = req.body as Record<string, unknown>;
  res.json({ scorecard: dashboard, company, generated_at: new Date().toISOString() });
});

router.post("/update-score", async (req, res): Promise<void> => {
  res.json({ ok: true });
});

// ─── Routes: enrichment ───────────────────────────────────────────────────────

router.post("/enrich/deal-risk", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const prep = typeof body === "string" ? body : (body.prep as string) || "";
  const company = (body.company as string) || "";

  const system = `You are a LogicGate deal risk analyst for Risk Rising.

${LOGICGATE_CONTEXT}

Given a pre-discovery briefing, identify the top deal risks.

Return ONLY valid JSON:
{
  "title": "Top 3 Deal Risks",
  "bullets": ["<risk 1>", "<risk 2>", "<risk 3>"]
}`;

  try {
    const data = await callClaudeJSON<{ title: string; bullets: string[] }>(
      system,
      [company ? `Company: ${company}` : "", `Briefing:\n${String(prep).slice(0, 4000)}`].filter(Boolean).join("\n\n")
    );
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "enrich/deal-risk failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/enrich/discovery-questions", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const prep = typeof body === "string" ? body : (body.prep as string) || "";
  const company = (body.company as string) || "";

  const system = `You are a LogicGate discovery expert for Risk Rising.

${LOGICGATE_CONTEXT}

Given a pre-discovery briefing, generate the top discovery questions.

Return ONLY valid JSON:
{
  "title": "Top Discovery Questions",
  "bullets": ["<question 1>", "<question 2>", "<question 3>", "<question 4>", "<question 5>"]
}`;

  try {
    const data = await callClaudeJSON<{ title: string; bullets: string[] }>(
      system,
      [company ? `Company: ${company}` : "", `Briefing:\n${String(prep).slice(0, 4000)}`].filter(Boolean).join("\n\n")
    );
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "enrich/discovery-questions failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/enrich/product-fit", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const prep = typeof body === "string" ? body : (body.prep as string) || "";
  const company = (body.company as string) || "";

  const system = `You are a LogicGate product fit analyst for Risk Rising.

${LOGICGATE_CONTEXT}

Given a pre-discovery briefing, analyse LogicGate product fit.

Return ONLY valid JSON:
{
  "title": "Product Fit Analysis",
  "bullets": ["<fit signal 1>", "<fit signal 2>", "<fit consideration 3>"]
}`;

  try {
    const data = await callClaudeJSON<{ title: string; bullets: string[] }>(
      system,
      [company ? `Company: ${company}` : "", `Briefing:\n${String(prep).slice(0, 4000)}`].filter(Boolean).join("\n\n")
    );
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "enrich/product-fit failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Routes: contacts & extraction ───────────────────────────────────────────

router.post("/extract-contacts", async (req, res): Promise<void> => {
  const { textContent, company } = req.body as Record<string, unknown>;

  const system = `You are a contact extraction specialist.

Extract named contacts from the provided text. For each contact include every field you can identify.

Return ONLY valid JSON:
{
  "contacts": [
    {
      "name": "<full name>",
      "title": "<job title or null>",
      "email": "<email or null>",
      "phone": "<phone or null>",
      "linkedin": "<linkedin URL or null>",
      "notes": "<any additional context or null>"
    }
  ]
}

If no contacts are found, return { "contacts": [] }.`;

  try {
    const data = await callClaudeJSON<{ contacts: unknown[] }>(
      system,
      [company ? `Company: ${company}` : "", textContent ? `Text:\n${textContent}` : ""].filter(Boolean).join("\n\n")
    );
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "extract-contacts failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/contacts", (req, res): void => {
  const contacts = req.body as unknown[];
  if (!Array.isArray(contacts)) {
    res.status(400).json({ error: "Expected array of contacts" });
    return;
  }
  const saved = contacts.map((c) => {
    const contact = { ...(c as Record<string, unknown>), id: makeId(), created_at: new Date().toISOString() } as Contact;
    contactStore.set(contact.id, contact);
    return contact;
  });
  res.json({ saved });
});

router.post("/contacts/:id/enrich", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const id = String(raw);
  const { company } = req.body as Record<string, unknown>;
  const contact = contactStore.get(id) || ({ name: "Unknown" } as Contact);

  const system = `You are a B2B contact research specialist.

Given a contact's name and company, provide relevant professional context that would help a GRC software salesperson.

Return ONLY valid JSON:
{
  "enriched": {
    "likely_priorities": ["<priority 1>", "<priority 2>"],
    "engagement_tips": "<1-2 sentences on how to engage this persona>",
    "relevant_pain_points": ["<pain point 1>", "<pain point 2>"]
  }
}`;

  try {
    const data = await callClaudeJSON<{ enriched: Record<string, unknown> }>(
      system,
      `Contact: ${contact.name}${contact.title ? `, ${contact.title}` : ""}\nCompany: ${String(company || "Unknown")}`
    );
    const updated = { ...contact, enriched: data.enriched };
    contactStore.set(id, updated);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "contacts/enrich failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Routes: file extraction ──────────────────────────────────────────────────

router.post("/extract-files", upload.array("files", 10), async (req, res): Promise<void> => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!files.length) {
    res.status(400).json({ error: "No files provided" });
    return;
  }

  const extracted: string[] = [];
  for (const file of files) {
    const mimeType = file.mimetype || "";
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      extracted.push(`--- ${file.originalname} ---\n${file.buffer.toString("utf-8")}`);
    } else if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) {
      const attempt = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, " ");
      if (attempt.length > 50) {
        extracted.push(`--- ${file.originalname} (extracted text) ---\n${attempt.slice(0, 5000)}`);
      } else {
        extracted.push(`--- ${file.originalname} ---\n[Binary file — please paste the text content directly]`);
      }
    } else {
      const attempt = file.buffer.toString("utf-8");
      extracted.push(`--- ${file.originalname} ---\n${attempt.slice(0, 5000)}`);
    }
  }

  res.json({ text: extracted.join("\n\n"), files: files.map((f) => f.originalname) });
});

// ─── Routes: opportunities ────────────────────────────────────────────────────

router.post("/opportunities", (req, res): void => {
  const { company } = req.body as { company: string };
  if (!company?.trim()) {
    res.status(400).json({ error: "company is required" });
    return;
  }
  const opp: Opportunity = {
    opportunity_id: makeId(),
    company: company.trim(),
    created_at: new Date().toISOString(),
    events: [],
    contacts: [],
  };
  opportunityStore.set(opp.opportunity_id, opp);
  res.status(201).json(opp);
});

router.get("/opportunities/:id", (req, res): void => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const opp = opportunityStore.get(String(raw));
  if (!opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  res.json(opp);
});

router.post("/opportunities/:id/events", (req, res): void => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const opp = opportunityStore.get(String(raw));
  if (!opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }
  const { type, description, stage, output_snapshot } = req.body as Record<string, unknown>;
  const event: OpportunityEvent = {
    id: makeId(),
    type: String(type || "note"),
    description: String(description || ""),
    stage: String(stage || "pre_discovery"),
    created_at: new Date().toISOString(),
    output_snapshot: output_snapshot as Record<string, unknown> | undefined,
  };
  opp.events.push(event);
  res.status(201).json(event);
});

router.get("/opportunities/:id/contacts", (req, res): void => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const opp = opportunityStore.get(String(raw));
  if (!opp) {
    res.status(404).json({ contacts: [] });
    return;
  }
  const contacts = opp.contacts.map((c) => contactStore.get(c.id) ?? c).filter(Boolean);
  res.json({ contacts });
});

router.get("/opportunities/:id/contacts/export", (req, res): void => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const opp = opportunityStore.get(String(raw));
  const contacts = opp ? opp.contacts.map((c) => contactStore.get(c.id) ?? c).filter(Boolean) : [];

  const rows = [
    "Name,Title,Email,Phone,LinkedIn,Notes",
    ...contacts.map((c) => {
      const ct = c as Contact;
      const esc = (v?: string) => `"${(v || "").replace(/"/g, '""')}"`;
      return [esc(ct.name), esc(ct.title), esc(ct.email), esc(ct.phone), esc(ct.linkedin), esc(ct.notes)].join(",");
    }),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="contacts_${String(raw)}.csv"`);
  res.send(rows.join("\n"));
});

// ─── Routes: SoW ─────────────────────────────────────────────────────────────

router.get("/sow/profiles", (_req, res): void => {
  res.json(SOW_PROFILES.map(({ id, name, description }) => ({ id, name, description })));
});

router.get("/sow/profiles/:id", (req, res): void => {
  const raw = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const profile = SOW_PROFILES.find((p) => p.id === String(raw));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.post("/sow/generate", async (req, res): Promise<void> => {
  const { profileId, selectedModules, consultantInputs, selectedComplexity } = req.body as {
    profileId: string;
    selectedModules: string[];
    consultantInputs: Array<{ id: string; value: string }>;
    selectedComplexity: string[];
  };

  const profile = SOW_PROFILES.find((p) => p.id === profileId);
  if (!profile) {
    res.status(400).json({ error: "Invalid profile ID" });
    return;
  }

  const allModules = [...profile.modules.core, ...profile.modules.optional];
  const chosenModules = allModules.filter((m) => selectedModules.includes(m.id));
  const complexityDrivers = profile.complexity_drivers.filter((d) => selectedComplexity.includes(d.id));
  const implementationDays = chosenModules.reduce((sum, m) => sum + m.days, 0) + complexityDrivers.reduce((sum, d) => sum + d.days, 0);

  const inputs: Record<string, string> = {};
  if (Array.isArray(consultantInputs)) {
    for (const inp of consultantInputs) inputs[inp.id] = inp.value;
  }

  const system = `You are a LogicGate implementation expert for Risk Rising.

${LOGICGATE_CONTEXT}

Your job: generate a professional Statement of Work document in markdown.

The SoW should include:
1. Project Overview
2. Scope of Work (covering each selected module)
3. Deliverables
4. Implementation Methodology (Risk Rising's phased approach)
5. Timeline & Resource Plan
6. Assumptions & Dependencies
7. Out of Scope
8. Commercial Terms (reference the estimated days, leave pricing blank for consultant to fill)
9. Acceptance Criteria
10. Change Management Process

Return ONLY valid JSON:
{
  "result": "<full SoW markdown document>",
  "summary": {
    "total_days": ${implementationDays},
    "modules": [${chosenModules.map((m) => `"${m.name}"`).join(", ")}],
    "complexity_drivers": [${complexityDrivers.map((d) => `"${d.label}"`).join(", ")}]
  }
}`;

  const userContext = [
    `Profile: ${profile.name}`,
    `Selected Modules: ${chosenModules.map((m) => m.name).join(", ")}`,
    `Complexity Drivers: ${complexityDrivers.map((d) => d.label).join(", ") || "None"}`,
    `Estimated Implementation Days: ${implementationDays}`,
    inputs["customer_name"] ? `Customer: ${inputs["customer_name"]}` : "",
    inputs["project_start"] ? `Proposed Start: ${inputs["project_start"]}` : "",
  ].filter(Boolean).join("\n");

  try {
    const data = await callClaudeJSON<Record<string, unknown>>(system, userContext);
    req.log.info({ profileId, selectedModules }, "sow/generate completed");
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "sow/generate failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Routes: static libraries ─────────────────────────────────────────────────

router.get("/value-drivers", (_req, res): void => {
  res.json({ library: VALUE_DRIVER_LIBRARY });
});

router.get("/operational-metrics", (_req, res): void => {
  res.json({ library: OPERATIONAL_METRICS_LIBRARY });
});

export default router;
