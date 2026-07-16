/**
 * bidPackStore — Phase 1: Persistent Work Item Foundation.
 *
 * All requirement-based operations (packs, profiles, requirements, responses,
 * quality reviews, audit events) are now async and delegate to rfpRepository,
 * which writes to PostgreSQL.
 *
 * The section/draft/revision data model (legacy section-based flow) remains
 * synchronous and in-memory. These routes are not used by the current UI but
 * must continue to function. Section state does NOT survive server restart —
 * this is a known and accepted limitation for Phase 1 (same as before).
 *
 * The PACKS in-memory Map is kept so that legacy section routes
 * (setSections, getSection, updateSection) can still find the pack object
 * they need to look up section IDs. A pack created via createPack() is stored
 * both in PostgreSQL (durable) and in the PACKS Map (session cache).
 * After server restart, PACKS is empty; a call to getPack() will query the DB
 * and cache the result so subsequent calls are fast.
 */

import { randomUUID } from "crypto";
import * as repo from "./rfpRepository";
import type {
  RfpWorkItem,
  RfpRequirement,
  RfpResponse,
  RfpResponseBlock,
  RfpQualityReview,
  RfpAuditEvent,
  StoredProfile,
} from "./rfpRepository";
import type { DocEntry } from "./docStore";
import { logger } from "./logger";

// ── Shared types ───────────────────────────────────────────────────────────────

export type WorkflowStage =
  | "decompose"
  | "validate_decomp"
  | "map_ownership"
  | "validate_ownership"
  | "respond"
  | "validate_response"
  | "rewrite"
  | "revalidate"
  | "assemble"
  | "export";

export type SectionStatus =
  | "not_started"
  | "extracted"
  | "drafted"
  | "in_review"
  | "approved"
  | "reopened";

export type ResponseStage = "pending" | "validating" | "passed" | "failed";
export type OwnerConfidence = "low" | "medium" | "high";

export type AuditEventType =
  | "pack_uploaded"
  | "section_detected"
  | "brief_extracted"
  | "draft_generated"
  | "draft_edited"
  | "placeholder_filled"
  | "component_reviewed"
  | "status_changed"
  | "approved"
  | "exported"
  | "reopened"
  | "profile_saved"
  | "decomposed"
  | "ownership_confirmed"
  | "ownership_overridden"
  | "response_generated"
  | "block_edited"
  | "block_reviewed"
  | "response_advanced"
  | "response_approved"
  | "decomp_validated"
  | "ownership_validated"
  | "gate_overridden"
  | "block_rewritten"
  | "assembled"
  | "validation_run";

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

export interface Placeholder {
  id: string;
  description: string;
  group: string | null;
  value: string | null;
  filled: boolean;
}

// ── Section / Legacy types (in-memory only) ────────────────────────────────────

export type DraftStatus = "draft" | "in_review" | "approved";

export interface SectionDraft {
  id: string;
  sectionId: string;
  lens: string;
  complianceVerdict: string;
  components: DraftComponents;
  requirementContext: Record<string, string>;
  reviewed: Record<string, boolean>;
  placeholders: Placeholder[];
  openDependencies: string[];
  status: DraftStatus;
  createdAt: number;
  updatedAt: number;
}

export interface DraftComponents {
  understanding: string;
  approachAndRecommendedOption: string;
  deliveryPlan: { narrative: string; milestones: Array<Record<string, unknown>> };
  domainComponent: { title: string; content: string };
  resourcing: { deliveryTeam: Array<Record<string, unknown>>; buyerCommitment: string };
  acceptanceGates: Array<Record<string, unknown>>;
  preWork: Array<Record<string, unknown>>;
  assumptions: string[];
  configCustomisationThirdParty: string;
  costs: string;
  risks: Array<Record<string, unknown>>;
}

export interface BriefKeyDate {
  date: string;
  description: string;
}

export interface BriefNamedOwner {
  name: string;
  role: string;
}

export interface BidSection {
  id: string;
  packId: string;
  status: SectionStatus;
  code: string;
  title: string;
  scoringWeight: string | null;
  summary: string;
  mandatedResponseStructure: string[];
  requirements: string[];
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
  draft: SectionDraft | null;
}

export interface SectionRevision {
  id: string;
  sectionId: string;
  components: DraftComponents;
  complianceVerdict: string;
  createdAt: number;
}

export interface BidPack {
  id: string;
  name: string;
  buyer: string;
  parsedContent: string;
  createdAt: number;
  sections: BidSection[];
  workflowStage: WorkflowStage;
}

// ── Engagement-profile types ──────────────────────────────────────────────────

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

// ── Requirement types ─────────────────────────────────────────────────────────

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
  ownerConfidence: OwnerConfidence;
  responseStage: ResponseStage;
  rewriteAttempts: number;
  parentId: string | null;
  crossCuttingConstraints: CrossCuttingConstraint[];
}

// ── Requirement response types ────────────────────────────────────────────────

export type ResponseStatus = "draft" | "in_review" | "approved";

export interface ResponseBlock {
  key: string;
  type: "minimum" | "enrichment";
  prompt: string;
  answer: string;
  placeholders: Placeholder[];
  reviewed: boolean;
  validationState: "pending" | "passed" | "failed" | "rewriting";
  rewriteAttempts: number;
  validationFindings: string[];
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

// ── QualityReview types ───────────────────────────────────────────────────────

export type QualityReviewType = "decomposition" | "ownership" | "response" | "final";

export interface QualityReview {
  id: string;
  bidPackId: string;
  targetType: "pack" | "requirement" | "response" | "block";
  targetId: string;
  reviewType: QualityReviewType;
  score: number;
  passed: boolean;
  findings: string[];
  missingItems: string[];
  recommendedActions: string[];
  checks: Record<string, boolean>;
  overridden: boolean;
  overrideReason: string | null;
  overrideActor: string | null;
  createdAt: number;
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
  if (draft.placeholders.length > 0) {
    return draft.placeholders.filter((p) => !p.filled).length;
  }
  return scanTokens(draft.components);
}

// ── Type mappers ──────────────────────────────────────────────────────────────

function dbWorkItemToBidPack(row: RfpWorkItem): BidPack {
  return {
    id: row.id,
    name: row.name,
    buyer: row.buyerName,
    parsedContent: row.parsedContent,
    createdAt: row.createdAt.getTime(),
    sections: [],  // sections not persisted; legacy in-memory only
    workflowStage: row.workflowStage as WorkflowStage,
  };
}

function dbRequirementToRequirement(row: RfpRequirement): Requirement {
  return {
    id: row.id,
    bidPackId: row.workItemId,
    code: row.requirementCode,
    order: row.displayOrder,
    title: row.title,
    sourceText: row.sourceText,
    scoringWeight: row.scoringWeight,
    minimumExpectations: (row.minimumExpectations as string[]) ?? [],
    considerations: (row.considerations as string[]) ?? [],
    mandatedStructure: row.mandatedStructure,
    owner: row.responseResponsibility as RequirementOwner,
    ownerRationale: row.responsibilityRationale,
    ownerConfirmed: row.responsibilityConfirmed,
    ownerConfidence: (row.responsibilityConfidence ?? "medium") as OwnerConfidence,
    responseStage: row.responseStage as ResponseStage,
    rewriteAttempts: row.rewriteAttempts,
    parentId: row.parentRequirementId,
    crossCuttingConstraints: (row.crossCuttingConstraints as CrossCuttingConstraint[]) ?? [],
  };
}

function dbBlockToResponseBlock(block: RfpResponseBlock): ResponseBlock {
  return {
    key: block.blockKey,
    type: block.blockType as "minimum" | "enrichment",
    prompt: block.promptText ?? "",
    answer: block.answer,
    placeholders: ((block.placeholders as unknown) as Placeholder[]) ?? [],
    reviewed: block.reviewed,
    validationState: (block.validationStatus ?? "pending") as ResponseBlock["validationState"],
    rewriteAttempts: block.rewriteAttempts,
    validationFindings: (block.validationFindings as string[]) ?? [],
  };
}

function dbRowsToRequirementResponse(
  response: RfpResponse,
  blocks: RfpResponseBlock[],
): RequirementResponse {
  return {
    id: response.id,
    requirementId: response.requirementId,
    lens: response.lens,
    blocks: blocks.map(dbBlockToResponseBlock),
    openDependencies: (response.openDependencies as string[]) ?? [],
    status: response.status as ResponseStatus,
    createdAt: response.createdAt.getTime(),
    updatedAt: response.updatedAt.getTime(),
  };
}

function dbQualityReviewToQualityReview(row: RfpQualityReview): QualityReview {
  return {
    id: row.id,
    bidPackId: row.workItemId,
    targetType: row.targetType as "pack" | "requirement" | "response" | "block",
    targetId: row.targetId,
    reviewType: row.reviewType as QualityReviewType,
    score: Number(row.score ?? 0),
    passed: row.passed ?? false,
    findings: (row.findings as string[]) ?? [],
    missingItems: (row.missingItems as string[]) ?? [],
    recommendedActions: (row.recommendedActions as string[]) ?? [],
    checks: (row.checks as Record<string, boolean>) ?? {},
    overridden: row.overridden,
    overrideReason: row.overrideReason,
    overrideActor: row.overrideActor,
    createdAt: row.createdAt.getTime(),
  };
}

function dbAuditEventToAuditEvent(row: RfpAuditEvent): AuditEvent {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const sectionId = typeof payload["sectionId"] === "string" ? payload["sectionId"] : null;
  return {
    id: row.id,
    bidPackId: row.workItemId,
    sectionId,
    type: row.eventType as AuditEventType,
    summary: row.summary,
    actor: row.actorType,
    payload,
    createdAt: row.createdAt.getTime(),
  };
}

function storedProfileToEngagementProfile(p: StoredProfile): EngagementProfile {
  return {
    id: p.id,
    bidPackId: p.bidPackId,
    ourRole: p.ourRole,
    primePartner: p.primePartner,
    ourRemit: p.ourRemit ?? [],
    otherParties: p.otherParties ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ── In-memory section cache (legacy section-based flow only) ──────────────────
// PACKS Map holds sections[] for the legacy routes. Populated on pack create
// and on getPack() cache miss. Does NOT survive server restart (by design).

const PACKS           = new Map<string, BidPack>();
const SECTION_TO_PACK = new Map<string, string>();
const REVISIONS       = new Map<string, SectionRevision[]>();

// ── Audit ─────────────────────────────────────────────────────────────────────

export async function appendAuditEvent(
  bidPackId: string,
  sectionId: string | null,
  type: AuditEventType,
  summary: string,
  actor = "system",
  payload: Record<string, unknown> = {},
): Promise<AuditEvent> {
  const payloadWithSection = sectionId ? { ...payload, sectionId } : payload;
  try {
    const row = await repo.appendAuditEvent({
      workItemId: bidPackId,
      requirementId: null,
      eventType: type,
      summary,
      actorType: actor,
      payload: payloadWithSection,
    });
    return dbAuditEventToAuditEvent(row);
  } catch (err) {
    logger.error({ err, bidPackId, type }, "rfpStore: appendAuditEvent failed");
    // Return a synthetic event so callers don't crash
    return {
      id: randomUUID(), bidPackId, sectionId, type, summary, actor,
      payload: payloadWithSection, createdAt: Date.now(),
    };
  }
}

export async function getAuditEvents(
  bidPackId: string,
  sectionId?: string,
): Promise<AuditEvent[]> {
  try {
    const rows = await repo.getAuditEvents(bidPackId);
    const events = rows.map(dbAuditEventToAuditEvent);
    if (sectionId) {
      return events.filter((e) => e.sectionId === sectionId || e.sectionId === null);
    }
    return events;
  } catch (err) {
    logger.error({ err, bidPackId }, "rfpStore: getAuditEvents failed");
    return [];
  }
}

// ── Revisions (legacy, in-memory only) ───────────────────────────────────────

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

export async function createPack(
  name: string,
  buyer: string,
  parsedContent: string,
  options?: {
    userId?: string;
    orgId?: string;
    docs?: DocEntry[];
  },
): Promise<BidPack> {
  const row = await repo.createWorkItem({
    name,
    buyerName: buyer,
    parsedContent,
    lens: "commercial",
    workflowStage: "decompose",
    status: "active",
    createdByUserId: options?.userId,
    orgId: options?.orgId,
  });

  const pack = dbWorkItemToBidPack(row);

  // Persist uploaded document metadata and extracted text now that we have a
  // work item ID. Documents in the in-memory docStore are transient; this
  // provides the durable link between documents and the Work Item.
  if (options?.docs?.length) {
    for (const doc of options.docs) {
      try {
        await repo.storeDocument({
          id: doc.id,
          workItemId: pack.id,
          originalFilename: doc.name,
          mimeType: doc.fileType === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/plain",
          characterCount: doc.charCount,
          extractedText: doc.text ?? null,
          structuredContent: doc.structuredRows
            ? (doc.structuredRows as unknown as Record<string, unknown>[])
            : null,
          extractionStatus: "extracted",
        });
      } catch (err) {
        // Document persistence failure is non-fatal; parsedContent is already
        // stored on the work item and is sufficient for AI operations.
        logger.warn({ err, docId: doc.id, packId: pack.id }, "rfpStore: document persist failed (non-fatal)");
      }
    }
  }

  // Cache in PACKS Map for legacy section routes
  PACKS.set(pack.id, pack);
  return pack;
}

export async function getPack(id: string): Promise<BidPack | null> {
  // Check in-memory cache first (for section routes that need the sections array)
  const cached = PACKS.get(id);
  if (cached) return cached;

  // Cache miss — query the DB (e.g. after server restart or cross-device access)
  try {
    const row = await repo.getWorkItem(id);
    if (!row) return null;
    const pack = dbWorkItemToBidPack(row);
    PACKS.set(pack.id, pack);
    return pack;
  } catch (err) {
    logger.error({ err, packId: id }, "rfpStore: getPack failed");
    return null;
  }
}

// ── Section CRUD (legacy in-memory — section flow only) ───────────────────────

export function setSections(
  packId: string,
  raw: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }>,
): BidSection[] {
  const pack = PACKS.get(packId);
  if (!pack) return [];
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

export async function saveProfile(
  packId: string,
  data: Pick<EngagementProfile, "ourRole" | "primePartner" | "ourRemit" | "otherParties">,
): Promise<EngagementProfile | null> {
  try {
    const stored = await repo.saveProfile(packId, data);
    if (!stored) return null;
    return storedProfileToEngagementProfile(stored);
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: saveProfile failed");
    return null;
  }
}

export async function getProfile(packId: string): Promise<EngagementProfile | null> {
  try {
    const stored = await repo.getProfile(packId);
    if (!stored) return null;
    return storedProfileToEngagementProfile(stored);
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: getProfile failed");
    return null;
  }
}

// ── Requirements CRUD ─────────────────────────────────────────────────────────

export async function saveRequirements(
  packId: string,
  reqs: Array<
    Omit<Requirement, "id" | "bidPackId" | "ownerConfidence" | "responseStage" | "rewriteAttempts"> & {
      ownerConfidence?: OwnerConfidence;
      responseStage?:   ResponseStage;
      rewriteAttempts?: number;
    }
  >,
): Promise<Requirement[]> {
  try {
    const rows = await repo.replaceRequirements(
      packId,
      reqs.map((r) => ({
        requirementCode: r.code,
        displayOrder: r.order,
        title: r.title,
        sourceText: r.sourceText,
        scoringWeight: r.scoringWeight ?? null,
        minimumExpectations: r.minimumExpectations,
        considerations: r.considerations,
        mandatedStructure: r.mandatedStructure ?? null,
        responseResponsibility: r.owner,
        responsibilityRationale: r.ownerRationale,
        responsibilityConfirmed: r.ownerConfirmed,
        responsibilityConfidence: r.ownerConfidence ?? "medium",
        responseStage: r.responseStage ?? "pending",
        crossCuttingConstraints: r.crossCuttingConstraints,
        parentRequirementId: r.parentId ?? null,
        rewriteAttempts: r.rewriteAttempts ?? 0,
      })),
    );
    return rows.map(dbRequirementToRequirement);
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: saveRequirements failed");
    return [];
  }
}

export async function getRequirements(packId: string): Promise<Requirement[]> {
  try {
    const rows = await repo.getRequirements(packId);
    return rows.map(dbRequirementToRequirement);
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: getRequirements failed");
    return [];
  }
}

export async function getRequirement(reqId: string): Promise<Requirement | null> {
  try {
    const row = await repo.getRequirement(reqId);
    return row ? dbRequirementToRequirement(row) : null;
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: getRequirement failed");
    return null;
  }
}

export async function updateRequirementOwnership(
  reqId: string,
  owner: RequirementOwner,
  ownerRationale: string,
  ownerConfirmed: boolean,
  ownerConfidence?: OwnerConfidence,
): Promise<Requirement | null> {
  try {
    const row = await repo.updateRequirement(reqId, {
      responseResponsibility: owner,
      responsibilityRationale: ownerRationale,
      responsibilityConfirmed: ownerConfirmed,
      ...(ownerConfidence !== undefined ? { responsibilityConfidence: ownerConfidence } : {}),
    });
    return row ? dbRequirementToRequirement(row) : null;
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: updateRequirementOwnership failed");
    return null;
  }
}

// ── Requirement response CRUD ─────────────────────────────────────────────────

export async function saveResponse(
  reqId: string,
  data: {
    lens?: string;
    blocks: Array<
      Omit<ResponseBlock, "validationState" | "rewriteAttempts" | "validationFindings"> & {
        validationState?:    ResponseBlock["validationState"];
        rewriteAttempts?:    number;
        validationFindings?: string[];
      }
    >;
    openDependencies: string[];
  },
): Promise<RequirementResponse | null> {
  try {
    // Resolve work_item_id from the requirement
    const reqRow = await repo.getRequirement(reqId);
    if (!reqRow) return null;

    const response = await repo.upsertResponse(reqRow.workItemId, reqId, {
      lens: data.lens ?? "Commercial",
      openDependencies: data.openDependencies,
    });

    const blocks: Array<Omit<import("@workspace/db").InsertRfpResponseBlock, "responseId">> =
      data.blocks.map((b) => ({
        blockKey: b.key,
        blockType: b.type,
        promptText: b.prompt,
        answer: b.answer,
        placeholders: b.placeholders as unknown as Record<string, unknown>[],
        reviewed: b.reviewed,
        validationStatus: b.validationState ?? "pending",
        validationFindings: b.validationFindings ?? [],
        rewriteAttempts: b.rewriteAttempts ?? 0,
      }));

    const savedBlocks = await repo.replaceResponseBlocks(response.id, blocks);
    return dbRowsToRequirementResponse(response, savedBlocks);
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: saveResponse failed");
    return null;
  }
}

export async function getResponse(reqId: string): Promise<RequirementResponse | null> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return null;
    return dbRowsToRequirementResponse(result.response, result.blocks);
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: getResponse failed");
    return null;
  }
}

export async function updateBlockAnswer(
  reqId: string,
  blockKey: string,
  answer: string,
): Promise<ResponseBlock | null> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return null;
    const updated = await repo.updateBlock(result.response.id, blockKey, { answer });
    return updated ? dbBlockToResponseBlock(updated) : null;
  } catch (err) {
    logger.error({ err, reqId, blockKey }, "rfpStore: updateBlockAnswer failed");
    return null;
  }
}

export async function fillBlockPlaceholder(
  reqId: string,
  blockKey: string,
  phId: string,
  value: string,
): Promise<Placeholder | null> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return null;
    const block = result.blocks.find((b) => b.blockKey === blockKey);
    if (!block) return null;

    const placeholders = (block.placeholders as unknown as Placeholder[]).map((p) =>
      p.id === phId ? { ...p, value, filled: true } : p,
    );
    const ph = placeholders.find((p) => p.id === phId);
    if (!ph) return null;

    await repo.updateBlock(result.response.id, blockKey, {
      placeholders: placeholders as unknown as Record<string, unknown>[],
    });
    return ph;
  } catch (err) {
    logger.error({ err, reqId, blockKey, phId }, "rfpStore: fillBlockPlaceholder failed");
    return null;
  }
}

export async function setBlockReviewed(
  reqId: string,
  blockKey: string,
  reviewed: boolean,
): Promise<boolean> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return false;
    const updated = await repo.updateBlock(result.response.id, blockKey, { reviewed });
    return !!updated;
  } catch (err) {
    logger.error({ err, reqId, blockKey }, "rfpStore: setBlockReviewed failed");
    return false;
  }
}

const RESP_STATUS_FLOW: Record<ResponseStatus, ResponseStatus | null> = {
  draft:     "in_review",
  in_review: "approved",
  approved:  null,
};

export type AdvanceResponseResult =
  | { ok: true; response: RequirementResponse }
  | { ok: false; error: string };

export async function advanceResponseStatus(reqId: string): Promise<AdvanceResponseResult> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return { ok: false, error: "Response not found" };

    const blocks = result.blocks.map(dbBlockToResponseBlock);

    const unreviewed = blocks.filter((b) => b.type === "minimum" && !b.reviewed);
    if (unreviewed.length > 0)
      return { ok: false, error: `${unreviewed.length} minimum block(s) not yet reviewed` };

    const unfilled = blocks.flatMap((b) => b.placeholders).filter((p) => !p.filled);
    if (unfilled.length > 0)
      return { ok: false, error: `${unfilled.length} placeholder(s) not yet filled` };

    const currentStatus = result.response.status as ResponseStatus;
    const next = RESP_STATUS_FLOW[currentStatus];
    if (!next) return { ok: false, error: "Already approved" };

    const updated = await repo.updateResponse(result.response.id, { status: next });
    if (!updated) return { ok: false, error: "Response update failed" };

    return { ok: true, response: dbRowsToRequirementResponse(updated, result.blocks) };
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: advanceResponseStatus failed");
    return { ok: false, error: "Internal error" };
  }
}

export async function reopenResponse(reqId: string): Promise<RequirementResponse | null> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return null;
    const updated = await repo.updateResponse(result.response.id, { status: "draft" });
    if (!updated) return null;
    return dbRowsToRequirementResponse(updated, result.blocks);
  } catch (err) {
    logger.error({ err, reqId }, "rfpStore: reopenResponse failed");
    return null;
  }
}

// ── QualityReview CRUD ────────────────────────────────────────────────────────

export async function saveQualityReview(
  packId: string,
  review: Omit<QualityReview, "id" | "bidPackId" | "overridden" | "overrideReason" | "overrideActor" | "createdAt">,
): Promise<QualityReview> {
  const row = await repo.insertQualityReview({
    workItemId: packId,
    targetType: review.targetType,
    targetId: review.targetId,
    reviewType: review.reviewType,
    score: String(review.score),
    passed: review.passed,
    findings: review.findings,
    missingItems: review.missingItems,
    recommendedActions: review.recommendedActions,
    checks: review.checks,
    overridden: false,
    overrideReason: null,
    overrideActor: null,
  });

  // Also append audit event (non-blocking on error)
  appendAuditEvent(packId, null, "validation_run",
    `${review.reviewType} validation: ${review.passed ? "PASSED" : "FAILED"} (score ${review.score})`,
    "system", { reviewType: review.reviewType, targetId: review.targetId },
  ).catch((err: unknown) => {
    logger.warn({ err }, "rfpStore: saveQualityReview audit event failed");
  });

  return dbQualityReviewToQualityReview(row);
}

export async function getQualityReviews(
  packId: string,
  reviewType?: QualityReviewType,
  targetId?: string,
): Promise<QualityReview[]> {
  try {
    const rows = await repo.getQualityReviews(packId, { reviewType, targetId });
    return rows.map(dbQualityReviewToQualityReview);
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: getQualityReviews failed");
    return [];
  }
}

export async function getLatestQualityReview(
  packId: string,
  reviewType: QualityReviewType,
  targetId?: string,
): Promise<QualityReview | null> {
  try {
    const row = await repo.getLatestQualityReview(packId, reviewType, targetId);
    return row ? dbQualityReviewToQualityReview(row) : null;
  } catch (err) {
    logger.error({ err, packId, reviewType }, "rfpStore: getLatestQualityReview failed");
    return null;
  }
}

export async function overrideGate(
  packId: string,
  reviewType: QualityReviewType,
  reason: string,
  actor: string,
  targetId?: string,
): Promise<QualityReview | null> {
  try {
    const latest = await repo.getLatestQualityReview(packId, reviewType, targetId);
    if (!latest) return null;
    const updated = await repo.overrideQualityReview(latest.id, reason, actor);
    if (!updated) return null;

    await appendAuditEvent(packId, null, "gate_overridden",
      `Gate override: ${reviewType} — ${reason}`, actor, { reviewType, targetId });

    return dbQualityReviewToQualityReview(updated);
  } catch (err) {
    logger.error({ err, packId, reviewType }, "rfpStore: overrideGate failed");
    return null;
  }
}

export async function canPassGate(
  packId: string,
  reviewType: QualityReviewType,
  targetId?: string,
): Promise<boolean> {
  const qr = await getLatestQualityReview(packId, reviewType, targetId);
  if (!qr) return false;
  return qr.passed || qr.overridden;
}

// ── Workflow stage ─────────────────────────────────────────────────────────────

export async function setWorkflowStage(packId: string, stage: WorkflowStage): Promise<boolean> {
  try {
    const updated = await repo.updateWorkItem(packId, { workflowStage: stage });
    if (!updated) return false;
    // Update in-memory cache too
    const cached = PACKS.get(packId);
    if (cached) cached.workflowStage = stage;
    await appendAuditEvent(packId, null, "status_changed",
      `Workflow advanced to: ${stage}`);
    return true;
  } catch (err) {
    logger.error({ err, packId, stage }, "rfpStore: setWorkflowStage failed");
    return false;
  }
}

export async function getWorkflowStage(packId: string): Promise<WorkflowStage | null> {
  const pack = await getPack(packId);
  return pack?.workflowStage ?? null;
}

// ── Requirement response stage ─────────────────────────────────────────────────

export async function setRequirementResponseStage(
  reqId: string,
  stage: ResponseStage,
): Promise<boolean> {
  try {
    const row = await repo.updateRequirement(reqId, { responseStage: stage });
    return !!row;
  } catch (err) {
    logger.error({ err, reqId, stage }, "rfpStore: setRequirementResponseStage failed");
    return false;
  }
}

// ── Block validation helpers ──────────────────────────────────────────────────

export async function setBlockValidation(
  reqId: string,
  blockKey: string,
  state: ResponseBlock["validationState"],
  findings: string[] = [],
): Promise<boolean> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return false;

    const block = result.blocks.find((b) => b.blockKey === blockKey);
    const updates: Partial<import("@workspace/db").InsertRfpResponseBlock> = {
      validationStatus: state,
      validationFindings: findings,
    };
    if (state === "rewriting") {
      updates.rewriteAttempts = (block?.rewriteAttempts ?? 0) + 1;
    }

    const updated = await repo.updateBlock(result.response.id, blockKey, updates);
    return !!updated;
  } catch (err) {
    logger.error({ err, reqId, blockKey, state }, "rfpStore: setBlockValidation failed");
    return false;
  }
}

export async function replaceBlockAnswer(
  reqId: string,
  blockKey: string,
  answer: string,
  placeholders: Placeholder[],
): Promise<ResponseBlock | null> {
  try {
    const result = await repo.getResponseForRequirement(reqId);
    if (!result) return null;
    const updated = await repo.updateBlock(result.response.id, blockKey, {
      answer,
      placeholders: placeholders as unknown as Record<string, unknown>[],
      reviewed: false,
    });
    return updated ? dbBlockToResponseBlock(updated) : null;
  } catch (err) {
    logger.error({ err, reqId, blockKey }, "rfpStore: replaceBlockAnswer failed");
    return null;
  }
}

// ── Recent work items (recovery) ──────────────────────────────────────────────

export async function listRecentWorkItems(limit = 10): Promise<Array<{
  id: string; name: string; buyer: string; workflowStage: WorkflowStage;
  status: string; createdAt: number; updatedAt: number;
}>> {
  try {
    const rows = await repo.listRecentWorkItems(limit);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      buyer: r.buyerName,
      workflowStage: r.workflowStage as WorkflowStage,
      status: r.status,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));
  } catch (err) {
    logger.error({ err }, "rfpStore: listRecentWorkItems failed");
    return [];
  }
}

// ── Assemble ──────────────────────────────────────────────────────────────────

export interface AssembledRequirement {
  requirement: Requirement;
  response:    RequirementResponse;
}

export async function assembleResponses(packId: string): Promise<AssembledRequirement[]> {
  try {
    const reqs = (await getRequirements(packId)).filter((r) =>
      (r.owner === "RR" || r.owner === "shared") && r.ownerConfirmed,
    );
    const results: AssembledRequirement[] = [];
    for (const req of reqs) {
      const resp = await getResponse(req.id);
      if (resp && resp.status === "approved") {
        results.push({ requirement: req, response: resp });
      }
    }
    return results;
  } catch (err) {
    logger.error({ err, packId }, "rfpStore: assembleResponses failed");
    return [];
  }
}
