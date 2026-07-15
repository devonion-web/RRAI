# RRAI Platform Architecture

| | |
|---|---|
| **Document** | `01_RRAI_Platform_Architecture_v1_0.md` |
| **Repository layer** | 02 — Platform Architecture |
| **Sits directly beneath** | Strategy layer (`strategy/`), which is itself subordinate to `00_RRAI_Master_Context_v2_0.md` |
| **Status** | **Version 1.0 — approved implementation architecture.** Complements, does not replace, the Master Context or the Strategy layer. |
| **Authority** | Subordinate to the Master Context and the Strategy layer. Where this document conflicts with either, the higher document prevails. |

---

## 1. Purpose and Authority

This document defines how the RRAI platform is organised to implement, at runtime, the constitutional principles set out in the Master Context. It is an implementation architecture: it explains how the operating system functions — what its runtime elements are, how they depend on one another, and where its guarantees are enforced.

It holds the following relationship to the Master Context:

- It **implements** the Master Context. Every enforcement mechanism described here exists to make a constitutional commitment real in running software.
- It **does not replace, reinterpret or weaken** the Master Context. It adds no principle, relaxes no commitment, and narrows no protection.
- Where this document and the Master Context **conflict, the Master Context prevails**, and this document is treated as defective on the point of conflict until amended.

This document sits at repository layer 02 (Platform Architecture), beneath the Master Context (layer 00) and the Strategy layer (layer 01). It governs how the runtime implements the constitution; it is in turn served by the operating frameworks, knowledge and templates beneath it. A change to the Master Context or the Strategy layer cascades into this document; a change to this document cascades into everything beneath it (Section 17).

## 2. Scope and Non-Goals

**In scope.** The runtime organisation of the RRAI operating system across its two homes — the Claude Project and the Replit application — expressed as functional elements: the platform substrate; the Knowledge and Memory stores; the classification model; partition and one-way-valve enforcement; lens routing; access control; the Intelligence and Execution layers; human accountability controls; and the Learning loop. The document is explicit about the dependencies between these elements and the boundaries each enforces.

**Non-goals.** This document is not:

- a constitution — that is the Master Context;
- a build specification, API definition, or database schema — implementation-level detail is deliberately excluded (Section 16 states where it lives);
- a product roadmap or commercial strategy;
- a definition of domain-knowledge content — that is held in the knowledge layers of the repository.

**Current-state and target-state.** Some elements described here are in place today; others are target-state architecture that the foundation is designed to host but which is not yet built. Where the distinction matters, this document marks it explicitly (notably Sections 5, 13 and 15). Nothing in this document should be read as asserting that a target-state capability already exists.

## 3. Architectural Overview

The platform is organised around two ideas:

1. **A capability flow on a substrate.** Information is held in governed stores, admitted through enforcement, reasoned over, executed into outputs, and fed back through learning. This flow runs on a single technical substrate.
2. **Governance as the enforcing spine.** Partition and one-way-valve enforcement, lens routing, and human accountability are not stages in the flow — they are controls that bind every stage. They are where the constitution is enforced in running software.

The directional model below reads upward: authority and flow move from the substrate at the base to outputs at the top. Governance elements (partition/valve, lens routing, accountability) are the enforcing spine. Learning is the only return path.

```
                    ┌─────────────────────────────────┐
                    │         OUTPUTS & ACTIONS         │
                    └─────────────────▲─────────────────┘
                     approval-gated for the eight mandatory action classes
        ╔═════════════════════════════╧═════════════════════════════╗
        ║  HUMAN ACCOUNTABILITY CONTROLS            [governance]      ║
        ║  Mandatory approval gates · internal work labelled not      ║
        ║  gated · no binding commitments · audit trail              ║
        ╚═════════════════════════════▲═════════════════════════════╝
        ┌─────────────────────────────┴─────────────────────────────┐
        │  EXECUTION                                                  │──feedback──┐
        │  agents · workflows · document generation · research ·     │            │
        │  proposal / marketing / sales / delivery                   │            │
        │  Each agent runs in ONE active lens (inherits partitions,  │            ▼
        │  sensitivity ceiling, posture, approval rules, audit)      │   ┌──────────────────────┐
        └─────────────────────────────▲─────────────────────────────┘   │  LEARNING            │
        ┌─────────────────────────────┴─────────────────────────────┐   │  writes UNVERIFIED    │
        │  INTELLIGENCE                                               │   │  learning state to    │
        │  retrieval (reasoning-level) · synthesis · assessment ·    │   │  Memory; cannot       │
        │  recommendations · scoring · analysis                      │   │  overwrite            │
        │  Evidence precedence T1–T5 · conflicts surfaced, never     │   │  authoritative fact   │
        │  silently resolved                                        │   │                       │
        └─────────────────────────────▲─────────────────────────────┘   │  ──writes──────────►  │──► MEMORY
              retrieval-time lens + sensitivity filter                    │  ──proposes─ ─ ─ ─►   │─ ─►KNOWLEDGE
        ══════════════════════════════╪══ prohibited content never       │     (human review)    │   (review
              exposed to Intelligence  │                                  └──────────────────────┘    gate)
        ╔═════════════════════════════╧═════════════════════════════╗
        ║  PARTITION & ONE-WAY VALVE + SENSITIVITY  │  LENS ROUTING   ║
        ║  canonical partitions (both stores) ·     │  hybrid select ·║
        ║  sensitivity axis (overrides where more   │  always visible·║
        ║  restrictive) · enforced write + retrieval│  user override  ║
        ╚═════════════════════════════▲═════════════════════════════╝
                stores are read ONLY through the membrane
        ┌──────────────────────────┐  │  ┌──────────────────────────┐
        │  KNOWLEDGE STORE         │ ─┴─ │  MEMORY STORE            │
        │  governed · authored ·   │wall │  opportunity/org/project/│
        │  versioned · approved    │ ╫╫  │  user/conversation/      │
        │  only                    │     │  learning · runtime data │
        │  classified at write time│     │  classified at write time│
        └────────────▲─────────────┘     └────────────▲─────────────┘
                     └───────────────┬───────────────────┘
                       substrate underpins everything
        ┌────────────────────────────┴────────────────────────────┐
        │  PLATFORM SUBSTRATE                                       │
        │  Replit app · database · authentication · APIs ·         │
        │  audit log · platform retrieval (index/query/filter/     │
        │  rank/vector)                                           │
        └──────────────────────────────────────────────────────────┘
```

**Reading the model.**

- Everything depends on the **substrate**.
- **Knowledge** and **Memory** are separate stores with separate governance and write paths.
- Stores are read only through the **partition/valve + sensitivity** membrane; the active **lens** determines what may be retrieved.
- **Intelligence** reasons over admitted evidence and **supports Execution**; Execution never reaches around Intelligence to the stores.
- **Human accountability controls** gate consequential outputs and actions.
- **Learning** is the only return path: it writes unverified state to Memory and proposes governed changes to Knowledge through human review.

## 4. Relationship to the Existing Repository Architecture

RRAI is described by two complementary models. Confusing them is a category error, so this section separates them.

**The repository model** organises the governed files and specifications that constitute RRAI. It is a static, versioned structure of documents and assets. Its working areas are: architecture, product, capabilities, engines, knowledge, prompts, templates, engineering, and implementation. Its **authority ordering** is defined by Master Context §7, under which authority flows downward from the Master Context and, where documents conflict, the higher layer prevails.

**The platform architecture model** (this document) describes how the RRAI operating system **functions at runtime** — its live elements, their dependencies, and where enforcement happens.

The two are **complementary, not competing**:

- The repository model answers *"where is this governed file, and what governs it?"*
- The platform architecture model answers *"how does the running system behave, and where are its guarantees enforced?"*
- **Repository authority continues to flow downward from the Master Context.** This document does not alter that; it is itself a governed file subject to it.
- **A runtime element may consume files from several repository areas.** The runtime is not a mirror of the folder structure; it draws on whichever governed files it needs.

Indicative mapping of runtime elements to the repository areas they consume:

| Runtime element | Repository areas it typically consumes |
|---|---|
| Knowledge Store | knowledge; templates; product; capabilities |
| Intelligence | engines; capabilities; knowledge; prompts |
| Lens routing & enforcement | architecture; capabilities; engines |
| Execution | prompts; templates; capabilities; engines |
| Human accountability controls | architecture; implementation |
| Learning loop | engines; capabilities; knowledge |

The mapping is indicative, not exhaustive, and is not an authority statement. Authority is governed solely by Master Context §7.

> **Note on a naming discrepancy.** Master Context §7 defines an eight-layer repository (`00 Master Context` through `07 Archive`), which is a **stability-ordered authority** model. The nine functional working areas listed above are a different, function-based decomposition. These two descriptions do not reconcile on either count or content. This document uses the §7 model for all authority questions and the functional areas only for organisation. Reconciling the two into a single canonical statement is flagged for resolution (see the conflict report accompanying this draft) and is out of scope here.

## 5. Platform Substrate

The substrate is the technical foundation on which every other element runs. It is a dependency of all layers above it, not a peer to them.

| Component | Function | State |
|---|---|---|
| Replit application | The runtime host for the platform. | Current — foundation built (React + Vite / Express / PostgreSQL / Drizzle). |
| Database | Persistent store for Memory and application state. | Current — PostgreSQL / Drizzle. |
| Authentication | Establishes identity and role; feeds lens routing and sensitivity clearance. | Current (baseline); role-scoped access designed from day one. |
| APIs | Interfaces between runtime elements and, in target-state, external systems. | Current (internal); external integrations are target-state. |
| Audit logging | Records meaningful actions, approvals, access grants and the active lens. | Current per build design; scope extends with the capabilities above it. |
| Platform retrieval | The **technical** retrieval service: indexing, querying, filtering, ranking and vector retrieval. Distinct from Intelligence retrieval (Section 12). | Target-state where vector retrieval is concerned; the foundation is designed to host it. |

**Cross-cutting dependencies originating in the substrate.** Audit logging serves the human accountability controls (Section 14). Authentication serves lens routing (Section 10) and the sensitivity and Delivery-access checks (Section 11).

## 6. Knowledge Store

The Knowledge Store holds RRAI's governed, authored, versioned subject-matter and reference knowledge. It is the authoritative source of truth.

- **Contents.** Approved knowledge only. Governed, authored and versioned assets.
- **Current-state home.** The Claude Project is the current human-managed repository for governed knowledge.
- **Write path.** Controlled. Knowledge is admitted only through governed authoring and review. There is no automated write path into approved Knowledge.
- **Classification.** Every item is classified at write time (Section 8).
- **Relationship to Learning.** Learning may **propose** changes to Knowledge through the human review gate only; it can never write to, or overwrite, approved Knowledge automatically (Section 15).

## 7. Memory Store

The Memory Store holds RRAI's accrued, operational, runtime state. It is distinct from Knowledge in content, governance and write path.

- **State types.** Opportunity, organisation, project, user, conversation, and learning state.
- **Home.** Runtime application data, held in the substrate database.
- **Write path.** Separate from Knowledge, with its own governance. Memory accrues through operation and through the Learning loop.
- **Unverified learning state.** Memory holds learning-derived state that is explicitly marked as unverified (Section 15). Unverified state is subject to the retrieval conditions in Section 12 and never carries authoritative weight.
- **Classification.** Every item is classified at write time (Section 8).

Knowledge and Memory are separated deliberately. Neither writes to the other except through the governed Learning paths.

## 8. Classification Model

Every item admitted to either store is classified **at write time** along the axes below. Classification is the first of the two enforcement points for the one-way valve (Section 9).

**Write-time classification axes:** partition, sensitivity, source, confidence, and verification state.

**Canonical partition taxonomy** (identical across Knowledge and Memory):

| Partition | Purpose |
|---|---|
| neutral | Vendor-neutral GRC domain knowledge and explicitly-neutral operational content. |
| intelligence | Approved market, regulatory and vendor intelligence. |
| commercial | Bid, deal and commercial context. |
| delivery | Client-delivery context and artefacts. |
| restricted | Content that must never be served to the reasoning layer under any lens. |

*"Explicitly neutral" is a classification outcome, not a separate partition.* An item is treated as explicitly neutral only where it has been classified as such.

**Sensitivity axis** (separate from partition — see Section 11):

| Sensitivity | Meaning |
|---|---|
| Public | May be shared externally, subject to approval. |
| Internal | Internal use only. |
| Confidential | Restricted to authorised roles and lenses. |
| Highly Restricted | Blocked by default; explicit authorisation only. |

**Verification state** underpins the evidence tiers used in reasoning (Section 12): items are recorded as approved governed Knowledge, verified authoritative Memory, verified operational Memory, or unverified. Confidence is recorded alongside.

## 9. Partition and One-Way-Valve Enforcement

The one-way valve is the mechanism that protects the independence of RRAI's published work (Master Context §5–6). This document enforces it at **two points**.

**Enforcement point 1 — write time.** Items are classified by partition, source, confidence, sensitivity and verification state as they enter either store (Section 8).

**Enforcement point 2 — retrieval time.** The active lens filters permitted content **before it enters model context**. Content the active lens is not permitted to see is withheld.

**The directional rule (from Master Context §6), enforced here:**

- **Neutral knowledge flows into every lens.**
- **Commercial and delivery context flow only into the lenses permitted to receive them** (Section 11).
- **Nothing flows back from commercial or delivery work into Analyst outputs.** Neutral analysis may flow forward into Commercial or Delivery work; the reverse is prohibited.

**Absolute guarantee.** Prohibited content is never exposed to Intelligence. The guarantee is structural — enforced by classification and retrieval-time filtering — not procedural. `restricted`-partition content is served to no lens.

## 10. Lens Routing

RRAI operates through the four lenses defined in Master Context §4: **Analyst**, **Intelligence**, **Commercial**, and **Delivery**. This document does not redefine them; it specifies how the active lens is set and enforced at runtime.

**Hybrid lens selection.**

- The user or workflow **explicitly selects** a lens where possible.
- RRAI **may infer** the lens where intent is clear.
- The active lens is **always visible**.
- The user **may override** an inferred lens.

**Ambiguity handling.** Where the active lens is unclear, RRAI:

- defaults to the **most restrictive reasonable lens**;
- does **not** retrieve commercial or delivery context;
- **displays** the inferred lens;
- allows the user to **override** it;
- **requests confirmation only** where the ambiguity materially affects the result.

**Agents and lenses.** Every agent runs inside one active lens (Section 13). **Cross-lens tasks are executed as separate, lens-bound passes; no single reasoning pass may span multiple lenses** (Sections 12–13).

## 11. Access-Control Rules

Access is governed by two independent axes. **Partition** determines purpose and lens access. **Sensitivity** determines who may retrieve, view, quote, export or publish content, and **overrides** the partition/lens grant wherever it is more restrictive.

**Partition access by lens** (applies identically to Knowledge and Memory):

| Lens | neutral | intelligence | commercial | delivery | restricted |
|---|---|---|---|---|---|
| Analyst | ✔ (explicitly-neutral only) | ✘ | ✘ | ✘ | ✘ |
| Intelligence | ✔ | ✔ (approved intelligence/market) | ✘ | ✘ | ✘ |
| Commercial | ✔ | ✔ | ✔ | ✘ | ✘ |
| Delivery | ✔ | ✔ | △ conditional | ✔ | ✘ |

Legend: ✔ permitted · ✘ denied · △ conditional (no standing access). For the Analyst lens, Memory access is limited to items classified explicitly neutral.

**Sensitivity ceiling** (overrides the table above where more restrictive):

| Sensitivity | Retrieve into reasoning | Quote / export | External publication |
|---|---|---|---|
| Public | permitted | permitted | permitted (subject to approval) |
| Internal | permitted | internal only | blocked |
| Confidential | authorised roles/lenses only | authorised only | blocked |
| Highly Restricted | blocked by default; explicit authorisation only | blocked | blocked |

**Resolution rule.** Effective access = (the active lens permits the partition) **AND** (the actor clears the sensitivity ceiling). If either test fails, the content is withheld and never enters model context.

**Delivery access to commercial information.** There is **no standing commercial access for the Delivery lens**. Where a Delivery task requires commercial content, access must be:

- task-specific;
- explicitly authorised by the user, workflow owner or an authorised role;
- time-bound to the task;
- limited to the minimum records required;
- recorded in the audit log.

## 12. Intelligence

Intelligence is the reasoning layer. It selects and applies permitted evidence and produces analysis; it does not act in the world (that is Execution) and it reads the stores only through the enforcement membrane.

**Functions.** Retrieval (reasoning-level), synthesis, assessment, recommendations, scoring, analysis.

**Two-level retrieval.** *Platform retrieval* (Section 5) is the technical service that mechanically fetches candidate content. *Intelligence retrieval* is the reasoning-level function that selects and applies the relevant, permitted evidence for the specific task, lens and output. Intelligence retrieval operates only on content the enforcement membrane has already permitted.

**Evidence precedence.** When synthesising, Intelligence applies this order:

| Tier | Source |
|---|---|
| T1 | Approved governed Knowledge |
| T2 | Verified authoritative Memory |
| T3 | Verified operational Memory |
| T4 | Unverified Memory and learning signals |
| T5 | Model inference |

**Conflict surfacing.** Where evidence conflicts, RRAI must **identify and surface the conflict rather than silently resolving it**. This upholds the Master Context principles of fact before opinion and transparency of confidence.

**Retrieval of unverified Memory (T4).** Unverified Memory and learning state may be retrieved **only when all** of the following hold:

- the active lens permits it;
- it is relevant to the task;
- its unverified status is exposed to the reasoning layer;
- its confidence is included;
- it is labelled clearly in any output where it materially affects the result;
- it is **not** used as the sole basis for a consequential claim, recommendation or action.

## 13. Execution

Execution produces outputs and performs work. It is supported by Intelligence and never reaches around Intelligence to the stores.

**Functions.** Agents, workflows, document generation, research, and proposal, marketing, sales and delivery activities.

**One lens per agent.** Every agent runs inside **one active lens**. It inherits that lens's permitted partitions, sensitivity ceiling, output posture, approval rules and audit context. **An agent cannot span lenses within a single reasoning run.**

**Cross-lens work.** Tasks that require more than one lens are executed as **separate, lens-bound passes**. Neutral analysis may flow forward into Commercial or Delivery work; commercial or delivery context may not flow back into Analyst outputs.

**Output labelling.** Outputs carry, at minimum, the active lens, the evidence tier(s) relied upon, and any unverified-state flag where unverified content materially affected the result. Internal work is labelled rather than gated (Section 14).

**State.** Workflows, document generation and research are current-state. Autonomous agents are target-state architecture: the foundation is designed to host them, and the rules in this section bind them once implemented. Nothing here asserts that autonomous agents exist today.

## 14. Human Accountability Controls

RRAI recommends and prepares; people decide, commit and remain accountable (Master Context §5). RRAI never makes a binding commitment on Risk Rising's behalf. This section makes that operative.

**Human approval is mandatory for:**

1. external publication;
2. customer commitments;
3. pricing or commercial terms;
4. legal or regulatory assertions;
5. changes to approved Knowledge;
6. sending communications;
7. changes to opportunity or project status;
8. external system actions.

**Internal work.** Internal drafts, research and recommendations may be produced **without** approval, but must be **labelled appropriately** — including the active lens, evidence tier, and any unverified-state flag.

**Audit trail.** Approvals, access grants (including Delivery-to-commercial grants under Section 11), the active lens, and consequential actions are recorded in the audit log.

## 15. Learning Loop

Learning is the platform's only return path. It improves RRAI over time without compromising the integrity of the stores.

**Inputs.** Feedback from Execution and from downstream outcomes.

**Writes to Memory.** Learning may write observations, outcome signals, candidate lessons and confidence ratings into Memory. These writes are:

- marked as **unverified learning state**;
- classified by partition like any other write (Section 8);
- subject to the retrieval conditions in Section 12.

Learning **cannot overwrite authoritative facts automatically.**

**Proposes to Knowledge.** Learning may **only propose** changes to governed Knowledge, and only **through human review** (the review gate). It can never alter approved Knowledge directly.

**State.** The Learning-to-Memory and Learning-to-Knowledge paths and their constraints are architectural and binding. The **degree of automation** of the loop is target-state; this document defines the governed paths that any such automation must follow.

## 16. Cross-Cutting Concerns

- **Audit logging.** Spans the platform. Records approvals, access grants, the active lens and consequential actions. Sourced from the substrate (Section 5), consumed by accountability (Section 14).
- **Authentication and roles.** Identity and role established at the substrate feed lens routing (Section 10), sensitivity clearance and Delivery-to-commercial authorisation (Section 11).
- **Confidence and verification.** Recorded at write time (Section 8), carried through retrieval and reasoning (Section 12), and exposed in outputs (Section 13). Confidence and verification state are never silently dropped.
- **Lens visibility.** The active lens is visible at all times (Section 10) and recorded in the audit trail.
- **Implementation-level specifications.** Database schemas, API definitions and field-level specifications are deliberately excluded from this document. They belong to the engineering and implementation areas of the repository and are governed by, but not stated in, this architecture.

## 17. Conformance and Change Control

**Position.** This document is a governed file at repository layer 01, directly beneath the Master Context. It is subject to Master Context §7: authority flows downward, and where documents conflict the higher layer prevails.

**Conformance.** The runtime must not exceed what this document permits. Where the runtime and this document diverge, this document prevails until it is amended; the divergence is treated as a defect to be corrected or as a change to be proposed.

**Change control.**

- A change to this document is proposed, reviewed and versioned.
- A change to the Master Context cascades into this document, which must be reviewed for conformance.
- A change to this document cascades into the frameworks, knowledge and templates beneath it, which must be reviewed in turn.
- No change to this document may weaken, reinterpret or override a Master Context commitment. Any proposed change that would do so is out of order and resolved in favour of the Master Context.

## 18. Glossary

| Term | Definition |
|---|---|
| Partition | Classification axis determining an item's purpose and which lenses may access it: neutral, intelligence, commercial, delivery, restricted. |
| Sensitivity | Independent classification axis determining who may retrieve, view, quote, export or publish an item: Public, Internal, Confidential, Highly Restricted. Overrides lens/partition where more restrictive. |
| Sensitivity ceiling | The most permissive handling allowed for an item's sensitivity level. |
| Lens | The purpose and posture RRAI adopts for a task: Analyst, Intelligence, Commercial, Delivery (Master Context §4). |
| One-way valve | The rule that neutral knowledge flows into all lenses while commercial and delivery context never flows back into Analyst outputs. |
| Verification state | Whether an item is approved governed Knowledge, verified authoritative Memory, verified operational Memory, or unverified. |
| Evidence tier (T1–T5) | The precedence order applied in reasoning: T1 approved governed Knowledge; T2 verified authoritative Memory; T3 verified operational Memory; T4 unverified Memory / learning signals; T5 model inference. |
| Unverified learning state | Memory written by the Learning loop, explicitly marked as unverified and never carrying authoritative weight. |
| Agent | A runtime actor that performs Execution work inside one active lens, inheriting that lens's permissions, posture, approval rules and audit context. |
| Review gate | The mandatory human-review step through which Learning may propose, but never directly make, changes to approved Knowledge. |

---

*This document implements `00_RRAI_Master_Context_v2_0.md`. Where the two conflict, the Master Context prevails.*