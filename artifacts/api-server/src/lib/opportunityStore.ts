import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// ── Field schema ──────────────────────────────────────────────────────────────

export interface OIFieldItem {
  value: string;
  source_document: string;
  source_section: string;
  confidence: "High" | "Medium" | "Low";
  explicit_or_inferred: "Explicit" | "Inferred";
  added_at: string;
}

export type OIFields = OIFieldItem[];

// ── Model ─────────────────────────────────────────────────────────────────────

export interface OIModel {
  id: string;
  company: string;
  created_at: string;
  updated_at: string;
  coverage_pct: number;
  enrichment_log: Array<{
    document_name: string;
    enriched_at: string;
    fields_added: number;
  }>;

  customer: {
    name: OIFields;
    industry: OIFields;
    geography: OIFields;
    stakeholders: OIFields;
    sponsors: OIFields;
  };
  objectives: {
    business_objectives: OIFields;
    drivers: OIFields;
    challenges: OIFields;
    desired_outcomes: OIFields;
  };
  use_cases: {
    risk_management: OIFields;
    controls: OIFields;
    audit: OIFields;
    tprm: OIFields;
    compliance: OIFields;
    policy: OIFields;
    incident_management: OIFields;
    reporting: OIFields;
    workflow: OIFields;
    other: OIFields;
  };
  solution: {
    logicgate_modules: OIFields;
    vendor_components: OIFields;
    integrations: OIFields;
    reporting_requirements: OIFields;
    data_model_requirements: OIFields;
  };
  delivery: {
    discovery_requirements: OIFields;
    configuration_requirements: OIFields;
    migration_requirements: OIFields;
    integration_requirements: OIFields;
    testing_requirements: OIFields;
    training_requirements: OIFields;
  };
  support: {
    hypercare_requirements: OIFields;
    managed_service_opportunities: OIFields;
    support_coverage: OIFields;
    administrative_support: OIFields;
    geographic_considerations: OIFields;
  };
  commercial: {
    constraints: OIFields;
    assumptions: OIFields;
    contractual_considerations: OIFields;
    delivery_complexity_indicators: OIFields;
  };
  risks: {
    delivery_risks: OIFields;
    integration_risks: OIFields;
    resource_risks: OIFields;
    dependency_risks: OIFields;
  };
  response_areas: {
    rr_response_required: OIFields;
    logicgate_validation_required: OIFields;
    joint_response_required: OIFields;
  };
}

// Count of all leaf fields across all sections (for coverage %)
const TOTAL_FIELDS = 5 + 4 + 10 + 5 + 6 + 5 + 4 + 4 + 3; // 46

export function computeCoverage(model: OIModel): number {
  let populated = 0;
  const sections: Record<string, OIFields>[] = [
    model.customer as unknown as Record<string, OIFields>,
    model.objectives as unknown as Record<string, OIFields>,
    model.use_cases as unknown as Record<string, OIFields>,
    model.solution as unknown as Record<string, OIFields>,
    model.delivery as unknown as Record<string, OIFields>,
    model.support as unknown as Record<string, OIFields>,
    model.commercial as unknown as Record<string, OIFields>,
    model.risks as unknown as Record<string, OIFields>,
    model.response_areas as unknown as Record<string, OIFields>,
  ];
  for (const section of sections) {
    for (const field of Object.values(section)) {
      if (Array.isArray(field) && field.length > 0) populated++;
    }
  }
  return Math.round((populated / TOTAL_FIELDS) * 100);
}

function emptyModel(id: string, company: string): OIModel {
  const now = new Date().toISOString();
  return {
    id, company, created_at: now, updated_at: now,
    coverage_pct: 0, enrichment_log: [],
    customer: { name: [], industry: [], geography: [], stakeholders: [], sponsors: [] },
    objectives: { business_objectives: [], drivers: [], challenges: [], desired_outcomes: [] },
    use_cases: { risk_management: [], controls: [], audit: [], tprm: [], compliance: [], policy: [], incident_management: [], reporting: [], workflow: [], other: [] },
    solution: { logicgate_modules: [], vendor_components: [], integrations: [], reporting_requirements: [], data_model_requirements: [] },
    delivery: { discovery_requirements: [], configuration_requirements: [], migration_requirements: [], integration_requirements: [], testing_requirements: [], training_requirements: [] },
    support: { hypercare_requirements: [], managed_service_opportunities: [], support_coverage: [], administrative_support: [], geographic_considerations: [] },
    commercial: { constraints: [], assumptions: [], contractual_considerations: [], delivery_complexity_indicators: [] },
    risks: { delivery_risks: [], integration_risks: [], resource_risks: [], dependency_risks: [] },
    response_areas: { rr_response_required: [], logicgate_validation_required: [], joint_response_required: [] },
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

const PERSIST_PATH = path.join("/tmp", "rai-opportunities.json");
const STORE = new Map<string, OIModel>();

function loadFromDisk(): void {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = fs.readFileSync(PERSIST_PATH, "utf8");
      const data = JSON.parse(raw) as OIModel[];
      for (const m of data) STORE.set(m.id, m);
    }
  } catch { /* ignore corrupt file */ }
}

function saveToDisk(): void {
  try {
    fs.writeFileSync(
      PERSIST_PATH,
      JSON.stringify(Array.from(STORE.values()), null, 2),
      "utf8",
    );
  } catch { /* ignore write failure */ }
}

loadFromDisk();

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createOpportunity(company: string): OIModel {
  const model = emptyModel(randomUUID(), company);
  STORE.set(model.id, model);
  saveToDisk();
  return model;
}

export function getOpportunity(id: string): OIModel | null {
  return STORE.get(id) ?? null;
}

export function listOpportunities(): OIModel[] {
  return Array.from(STORE.values()).sort(
    (a, b) => b.updated_at.localeCompare(a.updated_at),
  );
}

export function deleteOpportunity(id: string): boolean {
  const ok = STORE.delete(id);
  if (ok) saveToDisk();
  return ok;
}

export function updateOpportunityCompany(id: string, company: string): void {
  const m = STORE.get(id);
  if (m) { m.company = company; m.updated_at = new Date().toISOString(); saveToDisk(); }
}

// ── Merge logic ───────────────────────────────────────────────────────────────

type DeltaSection = Record<string, OIFieldItem[]>;
type Delta = Record<string, DeltaSection>;

function isDuplicate(existing: OIFieldItem[], incoming: OIFieldItem): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return existing.some((e) => norm(e.value) === norm(incoming.value));
}

export function mergeEnrichment(
  model: OIModel,
  delta: Delta,
  documentName: string,
): { fieldsAdded: number } {
  let fieldsAdded = 0;
  const now = new Date().toISOString();

  const sectionKeys = [
    "customer", "objectives", "use_cases", "solution",
    "delivery", "support", "commercial", "risks", "response_areas",
  ];

  for (const sectionKey of sectionKeys) {
    const deltaSection = delta[sectionKey];
    if (!deltaSection || typeof deltaSection !== "object") continue;
    const modelSection = (model as unknown as Record<string, Record<string, OIFieldItem[]>>)[sectionKey];
    if (!modelSection) continue;

    for (const [fieldKey, items] of Object.entries(deltaSection)) {
      if (!Array.isArray(items) || items.length === 0) continue;
      if (!Array.isArray(modelSection[fieldKey])) modelSection[fieldKey] = [];

      for (const item of items) {
        if (!item?.value?.trim()) continue;
        const withMeta: OIFieldItem = {
          value: item.value.trim(),
          source_document: documentName,
          source_section: item.source_section ?? "",
          confidence: item.confidence ?? "Medium",
          explicit_or_inferred: item.explicit_or_inferred ?? "Inferred",
          added_at: now,
        };
        if (!isDuplicate(modelSection[fieldKey], withMeta)) {
          modelSection[fieldKey].push(withMeta);
          fieldsAdded++;
        }
      }
    }
  }

  model.updated_at = now;
  model.coverage_pct = computeCoverage(model);
  model.enrichment_log.unshift({ document_name: documentName, enriched_at: now, fields_added: fieldsAdded });
  saveToDisk();

  return { fieldsAdded };
}

// ── Summary helper (for prompts) ──────────────────────────────────────────────

export function modelSummaryForPrompt(model: OIModel): string {
  const lines: string[] = [`Existing Opportunity Intelligence Model for "${model.company}" (${model.coverage_pct}% populated):`];

  const sectionKeys = [
    "customer", "objectives", "use_cases", "solution",
    "delivery", "support", "commercial", "risks", "response_areas",
  ];

  for (const sectionKey of sectionKeys) {
    const section = (model as unknown as Record<string, Record<string, OIFieldItem[]>>)[sectionKey];
    if (!section) continue;
    lines.push(`\n[${sectionKey.toUpperCase()}]`);
    for (const [fieldKey, items] of Object.entries(section)) {
      if (Array.isArray(items) && items.length > 0) {
        lines.push(`  ${fieldKey}: ${items.map((i) => i.value).join(" | ")}`);
      }
    }
  }

  return lines.join("\n");
}
