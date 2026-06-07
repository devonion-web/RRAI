import { randomUUID } from "crypto";

// ── Status & event types ──────────────────────────────────────────────────────

export type SectionStatus =
  | "not_started" | "extracted" | "drafted"
  | "in_review"   | "approved"  | "reopened";

export type AuditEventType =
  | "pack_uploaded"       | "section_detected"   | "brief_extracted"
  | "draft_generated"     | "draft_edited"       | "placeholder_filled"    | "component_reviewed"
  | "status_changed"      | "approved"           | "exported"              | "reopened"
  | "profile_saved"       | "decomposed"
  | "ownership_confirmed" | "ownership_overridden"
  | "response_generated"  | "block_edited"       | "block_reviewed"
  | "response_advanced"   | "response_approved";

export interface AuditEvent {
  id: string;
  bidPackId: string;
  sectionId: string | null;
  type: AuditEventType;
  summary: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface SectionRevision {
  id: string;
  sectionId: string;
  components: DraftComponents;
  complianceVerdict: string;
  createdAt: number;
}

// ── Placeholder type ──────────────────────────────────────────────────────────

export interface Placeholder {
  id: string;           // e.g. "ph_001" — matches {{PH:ph_001}} tokens in content
  description: string;  // human label, e.g. "day rate for senior consultant"
  group: string | null; // component name this placeholder primarily belongs to
  value: string | null; // filled value, null until filled
  filled: boolean;
}

// ── Extraction types ──────────────────────────────────────────────────────────

export interface BriefRequirement  { id: string | null; text: string; priority: string | null }
export interface BriefKeyDate      { date: string; event: string }
export interface BriefNamedOwner   { name: string; area: string }

// ── Draft types ───────────────────────────────────────────────────────────────

export interface DeliveryMilestone  { phase: string; timing: string; activities: string; exit: string }
export interface DeliveryTeamMember { role: string; responsibility: string; phases: string }
export interface AcceptanceGate     { gate: string; entry: string; exit: string }
export interface RiskItem           { risk: string; likelihoodImpact: string; mitigation: string; owner: string }

export interface DraftComponents {
  understanding:                string;
  approachAndRecommendedOption: string;
  deliveryPlan:                 { narrative: string; milestones: DeliveryMilestone[] };
  domainComponent:              { title: string; content: string };
  resourcing:                   { deliveryTeam: DeliveryTeamMember[]; buyerCommitment: string };
  acceptanceGates:              AcceptanceGate[];
  preWork:                      string[];
  assumptions:                  string[];
  configCustomisationThirdParty:string;
  costs:                        string;
  risks:                        RiskItem[];
}

export interface SectionDraft {
  id: string;
  sectionId: string;
  lens: string;
  complianceVerdict: string;
  components: DraftComponents;
  requirementContext: Record<string, string>;  // component name → what the buyer asks for
  reviewed: Record<string, boolean>;           // component name → reviewed by human
  placeholders: Placeholder[];
  openDependencies: string[];
  status: "draft" | "in_review" | "approved";
  createdAt: number;
  updatedAt: number;
}

// ── Pack / Section types ──────────────────────────────────────────────────────

export interface BidPack {
  id: string;
  name: string;
  buyer: string;
  createdAt: number;
  parsedContent: string;
  sections: BidSection[];
}

export interface BidSection {
  id: string;
  packId: string;
  status: SectionStatus;
  // From detect-sections
  code: string;
  title: string;
  scoringWeight: string | null;
  summary: string;
  // From extract-brief
  mandatedResponseStructure: string[];
  requirements: BriefRequirement[];
  minimumResponseItems: string[];
  buyerActivities: string[];
  buyerChallenges: string[];
  considerations: string[];
  keyDates: BriefKeyDate[];
  constraints: string[];
  commercialTerms: string[];
  namedOwners: BriefNamedOwner[];
  regulatoryAnchors: string[];
  crossReferences: string[];
  discrepancies: string[];
  gaps: string[];
  briefStatus: "pending" | "extracted" | "error";
  briefError: string | null;
  // Draft
  draft: SectionDraft | null;
}

// ── Placeholder scanner ───────────────────────────────────────────────────────

function scanTokens(v: unknown): number {
  if (typeof v === "string") {
    const s = v as string;
    return [...s.matchAll(/\{\{PLACEHOLDER:/g)].length + [...s.matchAll(/\{\{PH:/g)].length;
  }
  if (Array.isArray(v)) return (v as unknown[]).reduce<number>((n, x) => n + scanTokens(x), 0);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).reduce<number>((n, x) => n + scanTokens(x), 0);
  return 0;
}

export function countUnfilledPlaceholders(draft: SectionDraft): number {
  // New format: use structured placeholder array
  if (draft.placeholders.length > 0) {
    return draft.placeholders.filter((p) => !p.filled).length;
  }
  // Fallback: scan component text for old-style tokens
  return scanTokens(draft.components);
}

// ── New: engagement-profile types ─────────────────────────────────────────────

export interface EngagementProfile {
  id: string;
  bidPackId: string;
  ourRole: string;
  primePartner: string;
  ourRemit: string[];
  otherParties: string[];
  createdAt: number;
  updatedAt: number;
}

// ── New: requirement types ─────────────────────────────────────────────────────

export type RequirementOwner = "RR" | "LogicGate" | "shared" | "M&S";

export interface CrossCuttingConstraint {
  type: "timeline" | "module" | "integration" | "commercial" | "other";
  text: string;
}

export interface Requirement {
  id: string;
  bidPackId: string;
  code: string;
  order: number;
  title: string;
  sourceText: string;
  scoringWeight: string | null;
  minimumExpectations: string[];
  considerations: string[];
  mandatedStructure: string | null;
  owner: RequirementOwner;
  ownerRationale: string;
  ownerConfirmed: boolean;
  parentId: string | null;
  crossCuttingConstraints: CrossCuttingConstraint[];
}

// ── New: requirement response types ───────────────────────────────────────────

export type ResponseStatus = "draft" | "in_review" | "approved";

export interface ResponseBlock {
  key: string;
  type: "minimum" | "enrichment";
  prompt: string;
  answer: string;
  placeholders: Placeholder[];
  reviewed: boolean;
}

export interface RequirementResponse {
  id: string;
  requirementId: string;
  lens: string;
  blocks: ResponseBlock[];
  openDependencies: string[];
  status: ResponseStatus;
  createdAt: number;
  updatedAt: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const PACKS           = new Map<string, BidPack>();
const SECTION_TO_PACK = new Map<string, string>();
const AUDIT_LOG       = new Map<string, AuditEvent[]>();
const REVISIONS       = new Map<string, SectionRevision[]>();

const PROFILES        = new Map<string, EngagementProfile>();   // packId → profile
const REQUIREMENTS    = new Map<string, Requirement[]>();        // packId → requirements
const REQ_TO_PACK     = new Map<string, string>();               // reqId → packId
const RESPONSES       = new Map<string, RequirementResponse>();  // reqId → response

const TTL_MS = 6 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, pack] of PACKS) {
    if (now - pack.createdAt > TTL_MS) {
      for (const s of pack.sections) {
        SECTION_TO_PACK.delete(s.id);
        REVISIONS.delete(s.id);
      }
      const reqs = REQUIREMENTS.get(id) ?? [];
      for (const r of reqs) {
        REQ_TO_PACK.delete(r.id);
        RESPONSES.delete(r.id);
      }
      PACKS.delete(id);
      AUDIT_LOG.delete(id);
      PROFILES.delete(id);
      REQUIREMENTS.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ── Audit ─────────────────────────────────────────────────────────────────────

export function appendAuditEvent(
  bidPackId: string,
  sectionId: string | null,
  type: AuditEventType,
  summary: string,
  actor: string = "system",
  payload: Record<string, unknown> = {},
): AuditEvent {
  const ev: AuditEvent = { id: randomUUID(), bidPackId, sectionId, type, summary, actor, payload, createdAt: Date.now() };
  if (!AUDIT_LOG.has(bidPackId)) AUDIT_LOG.set(bidPackId, []);
  AUDIT_LOG.get(bidPackId)!.push(ev);
  return ev;
}

export function getAuditEvents(bidPackId: string, sectionId?: string): AuditEvent[] {
  const events = AUDIT_LOG.get(bidPackId) ?? [];
  return sectionId ? events.filter((e) => e.sectionId === sectionId || e.sectionId === null) : events;
}

// ── Revisions ─────────────────────────────────────────────────────────────────

export function saveRevision(section: BidSection): SectionRevision | null {
  if (!section.draft) return null;
  const rev: SectionRevision = {
    id: randomUUID(), sectionId: section.id,
    components: JSON.parse(JSON.stringify(section.draft.components)) as DraftComponents,
    complianceVerdict: section.draft.complianceVerdict,
    createdAt: Date.now(),
  };
  if (!REVISIONS.has(section.id)) REVISIONS.set(section.id, []);
  REVISIONS.get(section.id)!.push(rev);
  return rev;
}

export function getRevisions(sectionId: string): SectionRevision[] {
  return REVISIONS.get(sectionId) ?? [];
}

// ── Pack CRUD ─────────────────────────────────────────────────────────────────

export function createPack(name: string, buyer: string, parsedContent: string): BidPack {
  const pack: BidPack = { id: randomUUID(), name, buyer, createdAt: Date.now(), parsedContent, sections: [] };
  PACKS.set(pack.id, pack);
  AUDIT_LOG.set(pack.id, []);
  return pack;
}

export function getPack(id: string): BidPack | null { return PACKS.get(id) ?? null; }

export function setSections(
  packId: string,
  raw: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }>,
): BidSection[] {
  const pack = PACKS.get(packId);
  if (!pack) return [];
  // Preserve status for sections already worked on (match by code)
  const existing = new Map(pack.sections.map((s) => [s.code, s]));
  for (const s of pack.sections) SECTION_TO_PACK.delete(s.id);

  pack.sections = raw.map((s) => {
    const prev = existing.get(s.code);
    const id = prev?.id ?? randomUUID();
    SECTION_TO_PACK.set(id, packId);
    return {
      id, packId,
      status:       prev?.status       ?? "not_started",
      code:         s.code, title: s.title,
      scoringWeight: s.scoringWeight ?? null,
      summary:      s.summary,
      mandatedResponseStructure: prev?.mandatedResponseStructure ?? [],
      requirements:     prev?.requirements     ?? [],
      minimumResponseItems: prev?.minimumResponseItems ?? [],
      buyerActivities:  prev?.buyerActivities  ?? [],
      buyerChallenges:  prev?.buyerChallenges  ?? [],
      considerations:   prev?.considerations   ?? [],
      keyDates:         prev?.keyDates         ?? [],
      constraints:      prev?.constraints      ?? [],
      commercialTerms:  prev?.commercialTerms  ?? [],
      namedOwners:      prev?.namedOwners      ?? [],
      regulatoryAnchors: prev?.regulatoryAnchors ?? [],
      crossReferences:  prev?.crossReferences  ?? [],
      discrepancies:    prev?.discrepancies    ?? [],
      gaps:             prev?.gaps             ?? [],
      briefStatus:  prev?.briefStatus  ?? "pending",
      briefError:   prev?.briefError   ?? null,
      draft:        prev?.draft        ?? null,
    };
  });
  return pack.sections;
}

export function getSection(sectionId: string): BidSection | null {
  const packId = SECTION_TO_PACK.get(sectionId);
  if (!packId) return null;
  return PACKS.get(packId)?.sections.find((s) => s.id === sectionId) ?? null;
}

export function updateSection(sectionId: string, updates: Partial<BidSection>): BidSection | null {
  const s = getSection(sectionId);
  if (!s) return null;
  Object.assign(s, updates);
  return s;
}

export function saveDraft(
  sectionId: string,
  data: {
    lens?: string;
    complianceVerdict: string;
    components: DraftComponents;
    requirementContext?: Record<string, string>;
    placeholders: Placeholder[];
    openDependencies: string[];
  },
): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section) return null;
  const draft: SectionDraft = {
    id: randomUUID(), sectionId,
    lens:                data.lens ?? "Commercial",
    complianceVerdict:   data.complianceVerdict,
    components:          data.components,
    requirementContext:  data.requirementContext ?? {},
    reviewed:            {},
    placeholders:        data.placeholders,
    openDependencies:    data.openDependencies,
    status:              "draft",
    createdAt:           Date.now(),
    updatedAt:           Date.now(),
  };
  section.draft = draft;
  section.status = "drafted";
  saveRevision(section);
  return draft;
}

export function fillPlaceholder(sectionId: string, phId: string, value: string): Placeholder | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  const ph = section.draft.placeholders.find((p) => p.id === phId);
  if (!ph) return null;
  ph.value = value;
  ph.filled = true;
  section.draft.updatedAt = Date.now();
  return ph;
}

export function markComponentReviewed(sectionId: string, compName: string, reviewed: boolean): boolean {
  const section = getSection(sectionId);
  if (!section?.draft) return false;
  section.draft.reviewed[compName] = reviewed;
  section.draft.updatedAt = Date.now();
  return true;
}

export function updateDraft(
  sectionId: string,
  updates: Partial<Omit<SectionDraft, "id" | "sectionId" | "createdAt">>,
): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  Object.assign(section.draft, updates);
  section.draft.updatedAt = Date.now();
  return section.draft;
}

const STATUS_FLOW: Record<string, SectionDraft["status"]> = {
  draft:     "in_review",
  in_review: "approved",
};
const SECTION_STATUS_FLOW: Record<string, SectionStatus> = {
  draft:     "in_review",
  in_review: "approved",
};

export type AdvanceResult =
  | { ok: true; draft: SectionDraft; sectionStatus: SectionStatus }
  | { ok: false; error: string };

export function advanceDraftStatus(sectionId: string): AdvanceResult {
  const section = getSection(sectionId);
  if (!section?.draft) return { ok: false, error: "Draft not found" };

  const next = STATUS_FLOW[section.draft.status];
  if (!next) return { ok: false, error: "Already at final status" };

  // Gate: cannot approve with unfilled placeholders
  if (next === "approved") {
    const unfilled = countUnfilledPlaceholders(section.draft);
    if (unfilled > 0) {
      return { ok: false, error: `Cannot approve: ${unfilled} placeholder${unfilled !== 1 ? "s" : ""} still unfilled` };
    }
    section.status = "approved";
  } else {
    section.status = SECTION_STATUS_FLOW[section.draft.status] ?? section.status;
  }

  section.draft.status = next;
  section.draft.updatedAt = Date.now();
  if (next === "in_review") saveRevision(section);

  return { ok: true, draft: section.draft, sectionStatus: section.status };
}

export function reopenDraft(sectionId: string): { draft: SectionDraft; sectionStatus: SectionStatus } | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  section.draft.status    = "draft";
  section.draft.updatedAt = Date.now();
  section.status          = "reopened";
  return { draft: section.draft, sectionStatus: section.status };
}

// ── Engagement profile CRUD ───────────────────────────────────────────────────

export function saveProfile(
  packId: string,
  data: Pick<EngagementProfile, "ourRole" | "primePartner" | "ourRemit" | "otherParties">,
): EngagementProfile | null {
  if (!getPack(packId)) return null;
  const existing = PROFILES.get(packId);
  const profile: EngagementProfile = {
    id:          existing?.id ?? randomUUID(),
    bidPackId:   packId,
    ourRole:     data.ourRole,
    primePartner: data.primePartner,
    ourRemit:    data.ourRemit,
    otherParties: data.otherParties,
    createdAt:   existing?.createdAt ?? Date.now(),
    updatedAt:   Date.now(),
  };
  PROFILES.set(packId, profile);
  return profile;
}

export function getProfile(packId: string): EngagementProfile | null {
  return PROFILES.get(packId) ?? null;
}

// ── Requirements CRUD ─────────────────────────────────────────────────────────

export function saveRequirements(
  packId: string,
  reqs: Array<Omit<Requirement, "id" | "bidPackId">>,
): Requirement[] {
  if (!getPack(packId)) return [];
  const old = REQUIREMENTS.get(packId) ?? [];
  for (const r of old) { REQ_TO_PACK.delete(r.id); RESPONSES.delete(r.id); }

  const requirements: Requirement[] = reqs.map((r) => {
    const id = randomUUID();
    REQ_TO_PACK.set(id, packId);
    return { id, bidPackId: packId, ...r };
  });
  REQUIREMENTS.set(packId, requirements);
  return requirements;
}

export function getRequirements(packId: string): Requirement[] {
  return REQUIREMENTS.get(packId) ?? [];
}

export function getRequirement(reqId: string): Requirement | null {
  const packId = REQ_TO_PACK.get(reqId);
  if (!packId) return null;
  return REQUIREMENTS.get(packId)?.find((r) => r.id === reqId) ?? null;
}

export function updateRequirementOwnership(
  reqId: string,
  owner: RequirementOwner,
  ownerRationale: string,
  ownerConfirmed: boolean,
): Requirement | null {
  const req = getRequirement(reqId);
  if (!req) return null;
  req.owner          = owner;
  req.ownerRationale = ownerRationale;
  req.ownerConfirmed = ownerConfirmed;
  return req;
}

// ── Requirement response CRUD ─────────────────────────────────────────────────

export function saveResponse(
  reqId: string,
  data: { lens?: string; blocks: ResponseBlock[]; openDependencies: string[] },
): RequirementResponse | null {
  if (!getRequirement(reqId)) return null;
  const existing = RESPONSES.get(reqId);
  const response: RequirementResponse = {
    id:               existing?.id ?? randomUUID(),
    requirementId:    reqId,
    lens:             data.lens ?? "Commercial",
    blocks:           data.blocks,
    openDependencies: data.openDependencies,
    status:           existing?.status ?? "draft",
    createdAt:        existing?.createdAt ?? Date.now(),
    updatedAt:        Date.now(),
  };
  RESPONSES.set(reqId, response);
  return response;
}

export function getResponse(reqId: string): RequirementResponse | null {
  return RESPONSES.get(reqId) ?? null;
}

export function updateBlockAnswer(reqId: string, blockKey: string, answer: string): ResponseBlock | null {
  const resp = RESPONSES.get(reqId);
  if (!resp) return null;
  const block = resp.blocks.find((b) => b.key === blockKey);
  if (!block) return null;
  block.answer   = answer;
  resp.updatedAt = Date.now();
  return block;
}

export function fillBlockPlaceholder(reqId: string, blockKey: string, phId: string, value: string): Placeholder | null {
  const resp = RESPONSES.get(reqId);
  if (!resp) return null;
  const block = resp.blocks.find((b) => b.key === blockKey);
  if (!block) return null;
  const ph = block.placeholders.find((p) => p.id === phId);
  if (!ph) return null;
  ph.value   = value;
  ph.filled  = true;
  resp.updatedAt = Date.now();
  return ph;
}

export function setBlockReviewed(reqId: string, blockKey: string, reviewed: boolean): boolean {
  const resp = RESPONSES.get(reqId);
  if (!resp) return false;
  const block = resp.blocks.find((b) => b.key === blockKey);
  if (!block) return false;
  block.reviewed = reviewed;
  resp.updatedAt = Date.now();
  return true;
}

const RESP_STATUS_FLOW: Record<ResponseStatus, ResponseStatus | null> = {
  draft:     "in_review",
  in_review: "approved",
  approved:  null,
};

export type AdvanceResponseResult =
  | { ok: true; response: RequirementResponse }
  | { ok: false; error: string };

export function advanceResponseStatus(reqId: string): AdvanceResponseResult {
  const resp = RESPONSES.get(reqId);
  if (!resp) return { ok: false, error: "Response not found" };

  const unreviewed = resp.blocks.filter((b) => b.type === "minimum" && !b.reviewed);
  if (unreviewed.length > 0)
    return { ok: false, error: `${unreviewed.length} minimum block(s) not yet reviewed` };

  const unfilled = resp.blocks.flatMap((b) => b.placeholders).filter((p) => !p.filled);
  if (unfilled.length > 0)
    return { ok: false, error: `${unfilled.length} placeholder(s) not yet filled` };

  const next = RESP_STATUS_FLOW[resp.status];
  if (!next) return { ok: false, error: "Already approved" };

  resp.status    = next;
  resp.updatedAt = Date.now();
  return { ok: true, response: resp };
}

export function reopenResponse(reqId: string): RequirementResponse | null {
  const resp = RESPONSES.get(reqId);
  if (!resp) return null;
  resp.status    = "draft";
  resp.updatedAt = Date.now();
  return resp;
}
