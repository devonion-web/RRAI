import { randomUUID } from "crypto";

// ── Extraction types ───────────────────────────────────────────────────────────

export interface BriefRequirement {
  id: string | null;
  text: string;
  priority: string | null;
}
export interface BriefKeyDate   { date: string; event: string }
export interface BriefNamedOwner { name: string; area: string }

// ── Draft types ───────────────────────────────────────────────────────────────

export interface DeliveryMilestone { phase: string; timing: string; activities: string; exit: string }
export interface DeliveryTeamMember { role: string; responsibility: string; phases: string }
export interface AcceptanceGate { gate: string; entry: string; exit: string }
export interface RiskItem { risk: string; likelihoodImpact: string; mitigation: string; owner: string }

export interface DraftComponents {
  understanding: string;
  approachAndRecommendedOption: string;
  deliveryPlan: { narrative: string; milestones: DeliveryMilestone[] };
  domainComponent: { title: string; content: string };
  resourcing: { deliveryTeam: DeliveryTeamMember[]; buyerCommitment: string };
  acceptanceGates: AcceptanceGate[];
  preWork: string[];
  assumptions: string[];
  configCustomisationThirdParty: string;
  costs: string;
  risks: RiskItem[];
}

export interface SectionDraft {
  id: string;
  sectionId: string;
  lens: string;
  complianceVerdict: string;
  components: DraftComponents;
  placeholders: string[];
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

// ── Store ─────────────────────────────────────────────────────────────────────

const PACKS = new Map<string, BidPack>();
const SECTION_TO_PACK = new Map<string, string>();
const TTL_MS = 6 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, pack] of PACKS) {
    if (now - pack.createdAt > TTL_MS) {
      for (const s of pack.sections) SECTION_TO_PACK.delete(s.id);
      PACKS.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createPack(name: string, buyer: string, parsedContent: string): BidPack {
  const pack: BidPack = { id: randomUUID(), name, buyer, createdAt: Date.now(), parsedContent, sections: [] };
  PACKS.set(pack.id, pack);
  return pack;
}

export function getPack(id: string): BidPack | null { return PACKS.get(id) ?? null; }

export function setSections(
  packId: string,
  raw: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }>,
): BidSection[] {
  const pack = PACKS.get(packId);
  if (!pack) return [];
  for (const s of pack.sections) SECTION_TO_PACK.delete(s.id);
  pack.sections = raw.map((s) => {
    const id = randomUUID();
    SECTION_TO_PACK.set(id, packId);
    return {
      id, packId,
      code: s.code, title: s.title, scoringWeight: s.scoringWeight ?? null, summary: s.summary,
      mandatedResponseStructure: [], requirements: [], minimumResponseItems: [], buyerActivities: [],
      buyerChallenges: [], considerations: [], keyDates: [], constraints: [], commercialTerms: [],
      namedOwners: [], regulatoryAnchors: [], crossReferences: [], discrepancies: [], gaps: [],
      briefStatus: "pending", briefError: null, draft: null,
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
  data: { lens?: string; complianceVerdict: string; components: DraftComponents; placeholders: string[]; openDependencies: string[] },
): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section) return null;
  const draft: SectionDraft = {
    id: randomUUID(), sectionId,
    lens: data.lens ?? "Commercial",
    complianceVerdict: data.complianceVerdict,
    components: data.components,
    placeholders: data.placeholders,
    openDependencies: data.openDependencies,
    status: "draft",
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  section.draft = draft;
  return draft;
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

const STATUS_FLOW: Record<string, SectionDraft["status"]> = { draft: "in_review", in_review: "approved" };

export function advanceDraftStatus(sectionId: string): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  const next = STATUS_FLOW[section.draft.status];
  if (next) { section.draft.status = next; section.draft.updatedAt = Date.now(); }
  return section.draft;
}
