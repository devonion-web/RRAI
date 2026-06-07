import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BidPack {
  id: string;
  name: string;
  buyer: string;
  createdAt: number;
  parsedContent: string;          // Combined text from all files for Claude
  sections: BidSection[];
}

export interface BidSection {
  id: string;
  packId: string;
  code: string;                   // e.g. "2.1"
  title: string;
  scoringWeight: string | null;   // e.g. "25%" or "Pass/Fail"
  summary: string;                // one-line from detection

  // Populated after extract-brief
  requirements: string[];
  mandatedStructure: string[];
  constraints: string[];
  keyDates: string[];
  namedOwners: string[];
  evaluationNotes: string | null;
  briefStatus: "pending" | "extracted" | "error";
  briefError: string | null;

  // Populated after draft
  draft: SectionDraft | null;
}

export interface SectionDraft {
  id: string;
  sectionId: string;
  components: DraftComponent[];
  placeholders: Placeholder[];
  status: "draft" | "in_review" | "approved";
  createdAt: number;
  updatedAt: number;
}

export interface DraftComponent {
  id: number;
  label: string;
  content: string;
}

export interface Placeholder {
  id: string;
  placeholder: string;   // the full {{PLACEHOLDER: ...}} token
  context: string;       // component label where it appears
  guidance: string;      // human-readable description
}

export const COMPONENT_LABELS = [
  "Compliance Verdict",
  "Understanding of the Challenge",
  "Approach / Recommended Option",
  "Delivery Plan",
  "Domain Component",
  "Resourcing",
  "Acceptance & Quality Gates",
  "Pre-Work Required by Buyer",
  "Assumptions, Limitations & Dependencies",
  "Configuration / Customisation / Third-Party Confirmation",
  "Costs & Fit-Gaps",
  "Risks & Mitigations",
] as const;

// ── Store ─────────────────────────────────────────────────────────────────────

const PACKS = new Map<string, BidPack>();
const SECTION_TO_PACK = new Map<string, string>(); // sectionId → packId
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

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
  const pack: BidPack = {
    id: randomUUID(), name, buyer, createdAt: Date.now(),
    parsedContent, sections: [],
  };
  PACKS.set(pack.id, pack);
  return pack;
}

export function getPack(id: string): BidPack | null {
  return PACKS.get(id) ?? null;
}

export function setSections(packId: string, rawSections: Array<{ code: string; title: string; scoringWeight: string | null; summary: string }>): BidSection[] {
  const pack = PACKS.get(packId);
  if (!pack) return [];

  // Remove old section index entries
  for (const s of pack.sections) SECTION_TO_PACK.delete(s.id);

  pack.sections = rawSections.map((s) => {
    const id = randomUUID();
    SECTION_TO_PACK.set(id, packId);
    return {
      id, packId,
      code: s.code, title: s.title,
      scoringWeight: s.scoringWeight ?? null,
      summary: s.summary,
      requirements: [], mandatedStructure: [], constraints: [],
      keyDates: [], namedOwners: [], evaluationNotes: null,
      briefStatus: "pending", briefError: null,
      draft: null,
    };
  });
  return pack.sections;
}

export function getSection(sectionId: string): BidSection | null {
  const packId = SECTION_TO_PACK.get(sectionId);
  if (!packId) return null;
  const pack = PACKS.get(packId);
  return pack?.sections.find((s) => s.id === sectionId) ?? null;
}

export function updateSection(sectionId: string, updates: Partial<BidSection>): BidSection | null {
  const section = getSection(sectionId);
  if (!section) return null;
  Object.assign(section, updates);
  return section;
}

export function saveDraft(
  sectionId: string,
  components: DraftComponent[],
  placeholders: Placeholder[],
): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section) return null;
  const draft: SectionDraft = {
    id: randomUUID(), sectionId,
    components, placeholders,
    status: "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  section.draft = draft;
  return draft;
}

export function updateDraft(sectionId: string, updates: Partial<Pick<SectionDraft, "components" | "placeholders" | "status">>): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  Object.assign(section.draft, updates);
  section.draft.updatedAt = Date.now();
  return section.draft;
}

const STATUS_FLOW: Record<string, SectionDraft["status"]> = {
  draft: "in_review",
  in_review: "approved",
};

export function advanceDraftStatus(sectionId: string): SectionDraft | null {
  const section = getSection(sectionId);
  if (!section?.draft) return null;
  const next = STATUS_FLOW[section.draft.status];
  if (next) {
    section.draft.status = next;
    section.draft.updatedAt = Date.now();
  }
  return section.draft;
}
