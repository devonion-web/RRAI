**RISK RISING   •   PRODUCT   •   GOVERNED DOCUMENT**

# RRAI Product Principles

*The binding principles by which every proposed feature, capability, workspace, workflow and product investment is judged — and the rules that keep RRAI from drifting into a system it is not*

The principles document of the Product working area. It converts the intent of the Product Philosophy into a set of binding, testable principles, and an admission test, that every product proposal must pass before it is built. Its purpose is to keep RRAI what the Philosophy says it is — a platform that helps leaders complete defined, high-value work to an exceptional standard — and to prevent the specific product drift that has recurred when RRAI was proposed as something broader. Read it before proposing, assessing or approving any feature, capability, workspace, workflow or investment.

| | |
|---|---|
| **Document** | `product/01_RRAI_Product_Principles.md` |
| **Repository position** | Principles document of the Product working area. It states the binding tests product decisions must pass. |
| **Sits directly beneath** | `product/00_RRAI_Product_Philosophy.md` |
| **Complementary to** | `product/02_RRAI_Executive_Workbench.md` (the user environment); `01_RRAI_Platform_Architecture_v1_0.md` (the runtime); `engineering/00_RRAI_Development_Operating_Model.md` (how change is governed) |
| **Status** | **Version 1.0 — approved.** |
| **Authority** | Subordinate to the Master Context and the Product Philosophy. Where this document conflicts with either, the higher document prevails. Within the Product working area it is authoritative on *the principles and admission test product decisions must satisfy* — and on nothing else. |

---

## 1. Purpose and Authority

### 1.1 Purpose

This document defines the **binding product principles** used to assess every proposed feature, capability, workspace, workflow and product investment, and the **admission test** (§9) that puts those principles to work on a specific proposal. It answers one question: *by what fixed principles is a product decision judged, and how is a proposal admitted, revised, rejected or escalated?*

It exists to serve a second, protective purpose. It must **prevent the product drift** that occurred when RRAI was proposed as any of the following:

- a system for running Risk Rising (or the organisation it serves);
- a personal or executive assistant;
- a CRM;
- a project or task-management tool;
- a meeting or calendar organiser;
- a general organisational monitoring system;
- a generic chatbot or productivity suite.

Each of these is a departure from the product the Philosophy defines. This document names them, tests against them, and gives a decision consequence when a proposal moves toward them (§8, §9).

### 1.2 The core product position it enforces

This document does not restate the Product Philosophy; it enforces it. The position it holds every decision to is:

> **RRAI helps leaders complete defined, high-value strategic, commercial, governance and delivery work to an exceptional standard.** It combines structured reasoning, governed knowledge, evidence-led intelligence, reusable learning, and human judgement and approval. **It does not organise a leader's general working day or run organisational operations.**

### 1.3 What this document is not

It is deliberately none of the following, and must not drift into any of them:

- **Not a redefinition of the Product Philosophy, Master Context or Platform Architecture.** It references them and depends on them; it restates none of them and may not alter, extend or soften any of them.
- **Not a capability, deliverable or workspace specification.** It defines the *tests* a capability must pass, never the capabilities, deliverables or workspaces themselves.
- **Not an implementation.** It defines no design, schema, API, data model or UI. Those belong to the architecture, engineering and implementation areas.
- **Not a roadmap.** It sets the principles by which a roadmap is judged; it does not set the roadmap.

### 1.4 Authority ordering

```
00  Master Context               (constitution — the organisation, field, mission and lens model)
──  Product Philosophy            (why the product exists; product intent)
    ──  Product Principles         (this document — the binding tests product decisions must pass)
        ↓  the Executive Workbench, deliverables catalogues, product frameworks, roadmaps, features
```

This document sits within the Product working area directly beneath the Product Philosophy. Where it conflicts with the Master Context or the Product Philosophy, the higher document prevails and this one is defective on that point until amended. Nothing beneath it — no framework, roadmap or feature — may weaken, reinterpret or override a principle it sets.

---

## 2. Relationship to the Product Philosophy

The Product Philosophy (00) defines *why* RRAI exists and *what value* it must create. This document defines *how a product decision is judged* against that intent. The Philosophy is the source; these principles are its operative tests.

The relationship is strict and one-directional. Every principle here traces to the Philosophy and adds nothing above it: the mission (Philosophy §2), the definition of intelligence (Philosophy §2.4), the deliverable-led scope (Philosophy §4), the non-goals and category exclusions (Philosophy §5), and the product tenets (Philosophy §8) are the material this document turns into binding tests. Where a principle here could be read as extending or relaxing the Philosophy, the Philosophy governs and the principle is defective until corrected.

This document therefore adds one thing only: **enforceability** — a fixed set of principles and a repeatable admission test, so that the Philosophy's intent is applied consistently to real proposals rather than re-argued each time.

---

## 3. Definition of a Product Principle

A **product principle** is a binding, durable rule that every product decision must satisfy. It is not a preference, a guideline or a design opinion. Three things distinguish a principle in this document:

- **It is binding.** A proposal that violates a principle is not admitted as-is. The principle is not traded away for convenience, speed or technical interest.
- **It is testable.** Each principle states what compliance looks like and what violation looks like, so that a proposal can be judged against it rather than debated in the abstract.
- **It carries a consequence.** Each principle states the decision result when it is violated — the proposal is revised, rejected, or escalated (§9) — so that the principle changes outcomes, not just intentions.

Every principle in §4 is specified against the same five attributes: **the rule**; **why it exists**; **what compliance looks like**; **what violation looks like**; and **the decision consequence when violated.** Where a principle appears to relax a commitment of the Master Context, the Platform Architecture or the Product Philosophy, the principle is defective and the higher document prevails.

---

## 4. Binding Product Principles

The following fourteen principles are binding on every product decision. They are not ranked; where two pull in different directions on a specific proposal, the conflict is resolved under §11, not by silently preferring one.

### 4.1 Defined Work First

- **Rule.** No capability is proposed, built or kept unless it traces to a defined, high-value leadership job. The defined work is identified *before* the feature.
- **Why it exists.** RRAI is deliverable-led (Philosophy §2, §4). A capability with no defined work behind it is the first step of drift toward a general platform.
- **Compliance looks like.** The proposal names the specific leadership job it supports before it describes the feature.
- **Violation looks like.** A capability justified by general usefulness, technical interest or "leaders will want this", with no defined job named.
- **Decision consequence.** Reject or Revise: the proposal is returned until a defined job is named; a capability that cannot name one is refused.

### 4.2 Deliverable First

- **Rule.** The unit of product value is a finished, human-owned deliverable. Every capability must improve the creation, review or quality of at least one deliverable.
- **Why it exists.** Intelligence and reasoning create value only when they reach a deliverable a leader can use (Philosophy §2.5).
- **Compliance looks like.** The proposal states which deliverable it improves and how.
- **Violation looks like.** A feature that produces activity, dashboards or ambient output but no improvement to a deliverable.
- **Decision consequence.** Reject or Revise: no deliverable improved, no admission.

### 4.3 Evidence Before Opinion

- **Rule.** Every claim RRAI makes is sourced and separated into fact, interpretation and recommendation. Opinion is never presented as fact.
- **Why it exists.** This is a constitutional commitment (Master Context §8; Philosophy §8) and the meaning of *intelligence* (Philosophy §2.4).
- **Compliance looks like.** A capability's outputs carry sources, separate fact from interpretation from recommendation, and surface conflicts rather than resolving them silently (Platform Architecture §12).
- **Violation looks like.** A capability that asserts conclusions without evidence, blends opinion into fact, or hides uncertainty to appear confident.
- **Decision consequence.** Reject: a capability that weakens the evidence standard is refused, in any lens.

### 4.4 Reasoning Before Generation

- **Rule.** RRAI structures the reasoning for a piece of work before it generates the output. Generation is the product of reasoning, never a substitute for it.
- **Why it exists.** The product's value is rigour, not fluent text (Philosophy §2, §8). Generation without reasoning produces plausible, unreliable work.
- **Compliance looks like.** A capability establishes the problem, evidence and reasoning structure before producing a deliverable, and its output reflects that structure.
- **Violation looks like.** A capability that generates a polished output directly from a prompt with no evidenced reasoning behind it.
- **Decision consequence.** Revise or Reject: the capability is reworked to reason before it generates, or refused.

### 4.5 Human Judgement and Accountability

- **Rule.** RRAI recommends and prepares; a human decides, approves, commits and owns. RRAI never makes a binding commitment on the organisation's behalf.
- **Why it exists.** Human accountability is constant across every lens (Master Context §5, §8) and enforced at runtime through mandatory approval gates (Platform Architecture §14).
- **Compliance looks like.** The proposal names the human decision or approval that remains, and respects the eight mandatory approval classes where they apply.
- **Violation looks like.** A capability that decides, commits, publishes or acts externally without a human gate, or that treats an AI recommendation as approval.
- **Decision consequence.** Reject: removal of the human from a consequential step is refused; Escalate if the boundary is genuinely unclear.

### 4.6 Depth Over Breadth

- **Rule.** RRAI grows by doing defined leadership work better, not by widening into new operational territory. Depth on defined work is preferred to breadth of surface.
- **Why it exists.** The product's long-term direction is depth of work, not breadth of operational reach (Philosophy §9).
- **Compliance looks like.** A proposal deepens reasoning, evidence, quality or completion on work RRAI already owns.
- **Violation looks like.** A proposal that adds a new operational surface, module or "also does X" capability unconnected to deepening defined work.
- **Decision consequence.** Revise, Reject or Escalate: breadth that does not deepen defined work is refused or referred.

### 4.7 Quality Over Volume

- **Rule.** The product is judged by the quality of the work it improves, never by how much it produces. Produce less, better.
- **Why it exists.** Volume is a means; better work is the mission (Philosophy §2.2, §8).
- **Compliance looks like.** A proposal raises the standard, reliability or defensibility of a deliverable.
- **Violation looks like.** A proposal justified by throughput, output count or "more content faster" at the expense of standard.
- **Decision consequence.** Revise or Reject: volume gained at the cost of quality is refused.

### 4.8 Reusable Knowledge

- **Rule.** Completed work leaves behind governed, reusable knowledge, so that effort spent once returns value again and the next piece of work starts further ahead.
- **Why it exists.** Compounding knowledge is core to the product's value and vision (Philosophy §3, §8), and is governed by the Learning paths of the Platform Architecture (§15).
- **Compliance looks like.** A capability captures reusable, classified knowledge from finished work, respecting the Knowledge/Memory separation and the human review gate for promotion to governed Knowledge.
- **Violation looks like.** A capability that produces throwaway output, fragments knowledge, or writes to authoritative Knowledge without human review.
- **Decision consequence.** Revise: the capability is reworked to capture reusable knowledge through governed paths; Reject if it corrupts the stores.

### 4.9 One Platform, Four Governed Lenses

- **Rule.** RRAI is one platform operating through exactly four governed lenses — Analyst, Intelligence, Commercial and Delivery. Every piece of work runs in one named lens; no reasoning pass spans lenses; the one-way valve holds.
- **Why it exists.** The four-lens model and the one-way valve are established by the Master Context (§4–§6) and enforced at runtime (Platform Architecture §9–§13). The number and nature of lenses are not a product variable.
- **Compliance looks like.** A capability declares which lens owns its work, runs in one lens per pass, and never lets commercial or delivery context flow into Analyst outputs.
- **Violation looks like.** A capability that invents a new lens, blends lenses in one pass, or breaches the one-way valve.
- **Decision consequence.** Reject: lens violations are refused; Escalate any genuine need for a new lens to the Product Owner (it is a Master Context change, not a product decision).

### 4.10 Transparent Confidence and Uncertainty

- **Rule.** RRAI states how far its work can be relied on. Confidence is expressed, gaps are named, and conflicting evidence is surfaced rather than resolved silently.
- **Why it exists.** Transparency of confidence is constitutional (Master Context §8) and part of the definition of intelligence (Philosophy §2.4); it is carried through the runtime evidence tiers (Platform Architecture §12).
- **Compliance looks like.** A capability's outputs carry honest confidence, flag unverified material, and expose conflicts and gaps.
- **Violation looks like.** A capability that presents uniform confidence, hides gaps, or fills them with invention.
- **Decision consequence.** Revise or Reject: a capability that obscures confidence or uncertainty is reworked or refused.

### 4.11 No Generic Productivity Features

- **Rule.** RRAI does not add generic productivity, office-suite or note/task features for their own sake. Every capability must serve defined leadership work, not general convenience.
- **Why it exists.** Generic productivity is an explicit product-category exclusion (Philosophy §5.2). It dilutes the product's focus.
- **Compliance looks like.** A proposed convenience is admitted only where it is inseparable from completing a defined deliverable.
- **Violation looks like.** Notes, generic documents, chat, to-dos or file management offered as standalone capability.
- **Decision consequence.** Reject: generic productivity features are refused by category (§8).

### 4.12 No Operational-System Drift

- **Rule.** RRAI does not become an operating system for the organisation. It does not continuously monitor the organisation for its own sake, run operational process, or organise a leader's working day.
- **Why it exists.** Operational-system and day-management scope is excluded by the Philosophy (§5.1, §5.2, §9). Continuous monitoring is permitted only when attached to a defined leadership job (Philosophy §4).
- **Compliance looks like.** Any monitoring, tracking or automation is scoped to, and ends with, a defined leadership job and its deliverable.
- **Violation looks like.** Standing dashboards, always-on organisational monitoring, operational orchestration, or day/workflow management unattached to a defined deliverable.
- **Decision consequence.** Reject or Escalate: operational-system drift is refused; genuine ambiguity is escalated to the Product Owner.

### 4.13 Reference Existing Systems Rather Than Replacing Them

- **Rule.** Where a leader's work touches CRM, project management, calendar, meetings, email or other operational systems, RRAI references or draws on them as evidence and informs work carried out in them — it does not replace them.
- **Why it exists.** Those categories are explicit exclusions (Philosophy §5.2). RRAI's role is to improve the leadership work, not to own the operational system.
- **Compliance looks like.** A proposal integrates with an existing system as a source or destination, in service of a defined deliverable, without reproducing that system's function.
- **Violation looks like.** A proposal to build CRM, project/task, calendar, meeting or email functionality inside RRAI.
- **Decision consequence.** Reject: replacement of an operational system is refused; the function is referred to the appropriate system.

### 4.14 Product Coherence Over Feature Count

- **Rule.** The coherence of the product as a whole outranks the number of features it has. A capability that fits the product's purpose and holds together with the rest is preferred to one that merely adds surface.
- **Why it exists.** Durable purpose and focus outlast passing features (Philosophy §8, §9). Feature accumulation is how a focused product becomes an incoherent one.
- **Compliance looks like.** A capability strengthens the coherent whole and is consistent with the other principles.
- **Violation looks like.** A feature admitted because it is individually attractive, despite fragmenting the product or duplicating existing capability.
- **Decision consequence.** Revise or Reject: incoherent additions are reworked to fit or refused.

---

## 5. Deliverable and Work Focus

This section makes principles 4.1, 4.2 and 4.6 operative for assessment; it does not define the deliverables themselves, which are owned by a subsequent governed deliverables catalogue.

Every user-facing capability must attach to at least one **defined leadership job** and improve at least one **deliverable**. The work RRAI serves is high-value strategic, commercial, governance and delivery work — for example, a strategic assessment, an opportunity assessment, an executive recommendation, a proposal, an RFP or RFI response, a business case, a market or competitor analysis, a solution design, an implementation approach, or a product or architecture review. These examples are **illustrative, not a governed catalogue**; the governed catalogue is established elsewhere.

A capability that cannot name its defined work and its deliverable does not enter the product. General capability that could serve "any" work is treated as serving no defined work until a specific job is named. Research, monitoring and retrieval are in focus only where they directly support the defined job in hand; none is a standing product purpose in its own right.

---

## 6. Evidence and Reasoning Standards

This section makes principles 4.3, 4.4 and 4.10 operative; it inherits, and does not restate, the runtime evidence model of the Platform Architecture.

Every capability that reasons or generates must meet the evidence standard the platform already defines. It must keep **fact, interpretation and recommendation** apart; it must respect the **evidence precedence T1–T5** (T1 approved governed Knowledge, through to T5 model inference) set out in Platform Architecture §12; it must **surface conflicts** rather than resolve them silently; and it must treat **unverified material** under the conditions Platform Architecture §12 imposes, never as the sole basis for a consequential claim.

Reasoning precedes generation. A capability must establish the problem and the evidence, and structure the reasoning, before it produces a deliverable. A capability that generates directly from a prompt without evidenced reasoning fails this standard regardless of how polished its output is. Confidence and verification state are carried through to the output and never silently dropped.

---

## 7. Human Accountability

This section makes principle 4.5 operative; it inherits the runtime accountability model of the Platform Architecture and adds no gate of its own.

RRAI recommends and prepares; a human decides, approves, commits and owns (Master Context §5). No capability may remove the human from a consequential step. The **eight mandatory approval classes** defined in Platform Architecture §14 — external publication; customer commitments; pricing or commercial terms; legal or regulatory assertions; changes to approved Knowledge; sending communications; changes to opportunity or project status; and external system actions — bind every product proposal. A capability that would perform any of these without human approval is non-conformant on its face.

Internal work may be produced without approval but must be labelled (active lens, evidence tier, unverified-state flag) as the architecture requires. No capability may treat an AI recommendation — from any model or agent — as approval. Where a proposal's human-accountability boundary is genuinely unclear, it is escalated to the Product Owner (§11), not resolved locally.

---

## 8. Product Boundaries and Anti-Drift Rules

This section makes principles 4.11, 4.12 and 4.13 operative, and is the direct defence against the drift named in §1.1.

The following are **out of scope by category.** A proposal that is, or would build toward, any of them is refused by category rather than weighed feature-by-feature:

- a **system for running the organisation** or its operations;
- a **personal or executive assistant** that manages a leader's day, inbox, schedule or tasks;
- a **CRM** or contact/account/pipeline system of record;
- a **project or task-management** tool;
- a **meeting or calendar** organiser (including agendas, minutes and action-tracking as standalone functions);
- an **email or communications-management** tool;
- a **general organisational monitoring** system (standing, always-on monitoring unattached to a defined job);
- a **generic chatbot** or **generic productivity/office suite**.

Two rules govern the boundary. First, **attachment to defined work is the test**: a capability that touches one of these areas is admissible only when it is inseparable from completing a defined deliverable, and it ends when that work ends — it does not become a standing operational surface. Second, **reference, do not replace**: where the work genuinely needs one of these systems, RRAI integrates with it as a source or destination and refers the operational function to it, rather than reproducing it.

> **The anti-drift line**
>
> RRAI does not organise a leader's general working day, and it does not run organisational operations. It helps the leader perform defined, high-value work to an exceptional standard. Any proposal that quietly moves the product across that line is drift, and drift is refused or escalated — never elaborated.

---

## 9. Feature and Capability Admission Test

Every product proposal — feature, capability, workspace, workflow or investment — must answer all ten questions below before it can be admitted. The test operationalises §4–§8; a proposal that cannot answer a question has not yet earned assessment.

1. **What defined, high-value leadership work does this support?** (4.1)
2. **What deliverable does it improve?** (4.2)
3. **How does it improve reasoning, evidence, quality or completion?** (4.3, 4.4, 4.7)
4. **Which governed lens owns the work?** (4.9)
5. **Does it violate any Product Philosophy non-goal?** (§8; Philosophy §5)
6. **Is it operational tooling better owned by another system?** (4.12, 4.13)
7. **Does it deepen RRAI or merely broaden it?** (4.6, 4.14)
8. **What human decision or approval remains?** (4.5; §7)
9. **What reusable knowledge or capability does it create?** (4.8)
10. **What evidence demonstrates that the feature is needed?** (4.3; 4.1)

**Decision result.** The assessment must record exactly one of:

- **Admit** — the proposal satisfies every principle and answers all ten questions; it may proceed to governed design and build (Development Operating Model §3).
- **Revise** — the proposal is sound in intent but fails one or more principles as framed; it returns for rework against the named principle(s).
- **Reject** — the proposal violates a principle or a category boundary that cannot be reworked away; it does not proceed.
- **Escalate to Product Owner** — the proposal raises a genuine ambiguity of product scope, lens or accountability that this document does not settle; the Product Owner decides (§11).

A recorded result and the reasons for it are part of admission. An untested proposal is not admitted by default; absence of assessment is treated as "not admitted", never as tacit approval.

---

## 10. AI Behaviour Requirements

RRAI is developed with AI participants in the roles defined by the Development Operating Model (§4 there). **ChatGPT, Claude, Replit AI and any future agent must apply this document before proposing a product change.** These requirements bind their conduct in product work; they add nothing to the architecture and grant no authority.

Every AI participant must:

- **identify the defined work and deliverable before proposing a feature** (4.1, 4.2);
- **reject or challenge drift rather than elaborating it** — when a request moves toward an excluded category (§8), name the drift and stop, rather than designing it out politely;
- **distinguish product need from technically interesting capability** — technical elegance is not a reason to build;
- **avoid repeatedly proposing broader platforms, dashboards or orchestration** unless directly necessary for a defined piece of work;
- **state uncertainty** honestly, and never present confidence it does not have;
- **escalate genuine product ambiguity to the Product Owner** rather than resolving it by assumption;
- **never treat an AI recommendation as approval** — no model's output, including its own, is a decision (4.5; §7).

Every AI participant must **not**:

- rename the Executive Workbench;
- create a new "Executive Work" document, or invent any additional product document;
- introduce calendar, meeting, CRM, project-management or general business-management functionality (§8);
- create implementation designs, schemas, APIs or UI specifications (that is the architecture, engineering and implementation areas);
- repeat long passages from the Product Philosophy, Master Context or Platform Architecture in place of referencing them.

An AI participant that finds itself elaborating an excluded capability, inventing a document, or designing implementation has left its role and must stop and return the matter to the human Product Owner.

---

## 11. Conflict and Escalation Rules

**Conflict with a higher document.** Where a principle here conflicts with the Product Philosophy, the Master Context or (on a runtime matter) the Platform Architecture, the higher document prevails and this document is defective on that point until amended. The conflict is surfaced explicitly, never settled by local exception.

**Conflict between principles.** Where two principles pull in different directions on a specific proposal, they are reconciled in this order: the constitutional commitments come first — evidence (4.3), human accountability (4.5), the lens model and valve (4.9), transparent confidence (4.10) are never traded away; the deliverable-led commitments — defined work (4.1), deliverable (4.2), the anti-drift boundaries (4.11–4.13) — come next; and the quality-of-product commitments — depth (4.6), quality (4.7), reusable knowledge (4.8), coherence (4.14) — are optimised within them. If applying this order does not resolve the conflict, the proposal is **Escalated to the Product Owner**.

**Escalation.** A proposal is escalated — not decided locally — when it would require a new lens or a change to the lens model; when its human-accountability boundary is genuinely unclear; when it sits on the line of an excluded category and the attachment-to-defined-work test does not clearly settle it; or when resolving it would require changing a higher document. Escalation goes to the Product Owner, whose decision is recorded. An AI participant may recommend a resolution but never enacts one; escalation is a human decision (§10).

---

## 12. Conformance

Conformance is the standard everything produced under this document must meet. It is stated once here so that no lower artefact restates it.

- **Every product proposal** must pass the admission test (§9) and record a decision result before it proceeds. An untested proposal is non-conformant.
- **Every admitted capability** must continue to satisfy the fourteen principles (§4) and the boundaries (§8) in operation, not only at admission. A capability that drifts out of conformance after release is a defect to be corrected or a change to be proposed.
- **Every AI participant** in product work must conform to §10 before proposing a change.
- **The product must never exceed** what the Product Philosophy permits. Where a capability and the Philosophy diverge, the Philosophy prevails until amended, and the divergence is a defect to be corrected or a change to be proposed (Development Operating Model §12).

---

## 13. Change Control

### 13.1 Position

This document is a governed document, subordinate to the Master Context and the Product Philosophy and authoritative, within the Product working area, on the product principles and the admission test. It is subject to the same authority rules the Product Philosophy sets.

### 13.2 Relationship with higher authority

A change to the Master Context or the Product Philosophy cascades into this document, which must be reviewed for conformance and amended where affected. No change here may introduce, weaken or reinterpret a principle in a way that softens a commitment of the Master Context, the Platform Architecture or the Product Philosophy; any such change is out of order and resolved in favour of the higher document.

### 13.3 How this document evolves

A principle, boundary or admission-test question is added, changed or retired only by deliberate, reviewed and approved amendment under the governance defined for the platform (Development Operating Model §3, §7): proposed, reviewed, approved by the Product Owner, versioned and recorded. It never changes by drift, by feature, or by decision taken elsewhere. A change here cascades into a mandatory review of the product frameworks, roadmaps and features assessed under it.

### 13.4 Versioning

This document is versioned. It is approved as **Version 1.0** by the Product Owner. Each subsequent approved amendment produces a new version, and the prior version is retired to read-only history. The current version is always identifiable, and the reasoning that produced it always recoverable.

---

## 14. Glossary

Terms already defined in a higher document are referenced, not redefined, so that one definition governs across the repository.

| Term | Definition |
|---|---|
| **Product principle** | A binding, testable, durable rule every product decision must satisfy, carrying a decision consequence when violated (§3). |
| **Defined leadership work / defined work** | A specific, high-value strategic, commercial, governance or delivery piece of work a leader must complete, to which a capability must attach (Product Philosophy §2, §4). |
| **Deliverable** | A finished, human-owned output through which RRAI's work reaches a decision. The governed catalogue is owned by a subsequent governed document; §5 lists illustrative examples only. |
| **Admission test** | The ten-question assessment (§9) every product proposal must pass, resulting in Admit, Revise, Reject or Escalate. |
| **Drift** | Movement of the product toward a scope the Product Philosophy excludes — operational system, assistant, CRM, project/task, calendar/meeting, email, general monitoring, generic chatbot or productivity suite (§1.1, §8). |
| **Lens** | The purpose and posture RRAI adopts for a task: Analyst, Intelligence, Commercial or Delivery. Established by Master Context §4; not redefined here. |
| **One-way valve** | The rule that neutral knowledge flows into all lenses while commercial and delivery context never flows back into Analyst outputs (Master Context §6; Platform Architecture §9). |
| **Intelligence** | Evidence-led understanding produced for a decision — sourced, confidence-rated and decision-useful. Defined by Product Philosophy §2.4; an enabling method and quality standard, not the product's primary output. |
| **Evidence tier (T1–T5)** | The runtime precedence order applied in reasoning, from T1 approved governed Knowledge to T5 model inference. Defined by Platform Architecture §12. |
| **Mandatory approval classes** | The eight consequential action classes that require human approval, defined by Platform Architecture §14. |
| **Executive Workbench** | The product's user environment, through which leaders commission, develop, review and approve defined work. Named by Product Philosophy §2.5; defined by `product/02_RRAI_Executive_Workbench.md`. Not renamed or redefined here. |
| **Product Owner** | The human holding final authority over product decisions, approval and escalation (Development Operating Model §4). |

---

*This document enforces the intent of `product/00_RRAI_Product_Philosophy.md`. It is complementary to `product/02_RRAI_Executive_Workbench.md`, `01_RRAI_Platform_Architecture_v1_0.md` and `engineering/00_RRAI_Development_Operating_Model.md`, and inherits the runtime evidence, lens and accountability models rather than restating them. Where any conflict with the Master Context or the Product Philosophy arises, the higher document prevails. It defines the principles and admission test product decisions must satisfy; it does not define capabilities, deliverables, the Executive Workbench, or any implementation.*

*Risk Rising  •  Internal  •  Product principles & governed document  •  Version 1.0 — approved*