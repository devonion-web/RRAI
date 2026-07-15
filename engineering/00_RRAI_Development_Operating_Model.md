**RISK RISING   •   ENGINEERING   •   GOVERNED DOCUMENT**

# RRAI Development Operating Model

*The operating contract for how RRAI is designed, implemented, reviewed, tested, governed and released*

The governing document for the engineering working area. It defines how the RRAI development ecosystem operates — how architectural intent becomes governed, approved change to the platform — independently of any particular technology, tool or language.

| | |
|---|---|
| **Document** | `engineering/00_RRAI_Development_Operating_Model.md` |
| **Repository position** | Governing document of the engineering working area. Layer 03 (Engineering) in the §7 authority model. |
| **Sits directly beneath** | `00_RRAI_Master_Context_v2_0.md`, Strategy layer (`strategy/`), and `01_RRAI_Platform_Architecture_v1_0.md` |
| **Status** | **Version 1.0 — approved development operating contract.** |
| **Authority** | Subordinate to the Master Context, the Strategy layer, and the Platform Architecture. Where this document conflicts with any of these, the higher document prevails. It is the highest authority *within* the engineering working area. |

---

## 1. Purpose and Authority

### 1.1 Purpose

This document defines how the RRAI platform is **evolved**: how an idea becomes architecture, how architecture becomes approved intent, how intent becomes implemented and tested change, and how that change is governed, recorded and released. It is the operating contract that binds every participant in that process — human and machine — to a single, disciplined way of working.

It answers one question: *by what governed process does RRAI change, and where does authority sit at each step?*

### 1.2 What this document is not

It is deliberately none of the following, and must not drift into any of them:

- **Not an engineering handbook.** It does not teach how to build things.
- **Not a coding standard.** It defines no conventions of style, structure or language.
- **Not a version-control guide.** It governs the *meaning* of branches, reviews and releases, not the commands that operate them.

Those artefacts, where they exist, live beneath this document and conform to it. This document governs; it does not instruct.

### 1.3 Relationship to the Master Context

The Master Context (00) is the constitution. This document **implements its commitments in the way RRAI is built**. In particular, the constitutional commitment to *human accountability* (Master Context §5, §8) becomes, here, a set of mandatory approval gates on consequential change. This document adds no principle to the constitution, relaxes none, and narrows no protection. Where it and the Master Context conflict, the Master Context prevails and this document is treated as defective on that point until amended.

### 1.4 Relationship to the Platform Architecture

The Platform Architecture (02) defines **what the runtime is** — its elements, dependencies and where its guarantees are enforced. This document defines **how that architecture is changed over time**. The two are complementary and must not be confused: the Platform Architecture governs the running system; this document governs the process that produces it. Any change to the running system's *design* is an architectural change governed by §7; this document governs how such a change is proposed, approved, implemented and released, never what the architecture should say.

### 1.5 Scope

In scope: the full development lifecycle of the platform (§3); the roles and where authority resides (§4); the repository as the source of truth (§5); the pull request as the unit of change (§6); the governance of architecture (§7), knowledge (§8) and implementation (§9); the release model (§10); continuous improvement (§11); and the conformance (§12) and change-control (§13) rules that bind everything beneath this document.

### 1.6 Non-goals

Out of scope: the content of the architecture itself; the content of governed knowledge; tool-specific procedure; and any technology, language or platform decision. This document must remain valid if RRAI were re-implemented on entirely different technology. It names current tools only as the present holders of durable roles (§4), never as dependencies.

### 1.7 Authority ordering

Authority flows downward and is absolute in that direction:

```
00  Master Context               (constitution — why and what, in principle)
01  Strategy                     (product philosophy — what RRAI is for and by what principles)
02  Platform Architecture        (what the runtime is)
──  Development Operating Model   (this document — how the platform is changed)
    ↓  engineering procedure, standards, guides, and all implemented change
```

Where any document, decision or implementation conflicts with a higher authority, the higher authority prevails. No lower artefact, and no participant, may weaken, reinterpret or override an authority above it.

---

## 2. Development Philosophy

These tenets are constitutional *for development*. They hold regardless of the task, the tool or the pressure. Where a proposed way of working conflicts with them, the tenet wins.

- **Architecture before implementation.** Nothing is built until the change it embodies is expressed as architecture and approved. Code is the consequence of a decision, never the decision itself.
- **Repository before application.** The governed repository is the source of truth; the running application is only its current expression. If the two disagree, the repository is right and the application is defective (§5).
- **Knowledge before behaviour.** What RRAI knows is governed before what RRAI does. Behaviour is downstream of governed knowledge and governed architecture, never ahead of them.
- **Governance before automation.** A step may be automated only once it is governed. Automation accelerates a controlled process; it never substitutes for control (Master Context §10).
- **Human approval before consequential change.** No consequential change to architecture, knowledge or the running platform occurs without a human approving it. This is the constitution's human-accountability commitment expressed as process.
- **Reusable capability before feature-specific logic.** Build the general, governed capability first; specific features are compositions of it. Convenience that creates duplication or bypasses capability is a cost, not a saving.
- **One platform, many lenses.** Development serves the whole multi-lens platform, not any single lens. No change may privilege one lens in a way that erodes another or breaches the one-way valve (Master Context §6).
- **Long-term maintainability over short-term convenience.** Every change is judged by what it costs the platform over years, not by what it saves today.

---

## 3. Platform Development Lifecycle

Every change to RRAI travels the same path, from idea to production. This section owns the **sequence and the gates**; the mechanics referenced at each stage are defined in their own sections (repository §5, pull request §6, release §10). No stage may be skipped, and each gate names who must approve before the change advances.

| # | Stage | Who leads | Gate to advance | Produced |
|---|---|---|---|---|
| 1 | **Idea** | Product Owner (any participant may propose) | Idea is captured and judged worth shaping. | A stated problem or opportunity. |
| 2 | **Architecture** | Architectural role | Intent expressed as governed architectural change (§7). | A proposed architectural change. |
| 3 | **Review** | Architectural role (independent of the author) | Architecture is sound, conformant and complete. | A reviewed architectural proposal. |
| 4 | **Approval** | **Product Owner (human)** | **Explicit human approval to build.** | Approved intent — the mandate to implement. |
| 5 | **Implementation** | Implementation role | Work realises the approved intent and nothing beyond it (§9). | A candidate change on an isolated branch (§5). |
| 6 | **Pull Request** | Implementation role | A conformant pull request is opened (§6). | A proposed, reviewable change. |
| 7 | **Review** | Architectural + implementation review | Architecture and implementation review pass (§6). | A change cleared to merge. |
| 8 | **Merge into `develop`** | Implementation role | Merge criteria met (§6); change enters integration truth (§5). | Integrated change. |
| 9 | **Testing** | Validation environment | Validation against the integrated whole passes (§9). | Verified integration. |
| 10 | **Release to `main`** | **Product Owner (human)** | **Explicit human approval to release** (§10). | A released, tagged version. |
| 11 | **Production** | Runtime platform | Released state governs behaviour; consequential runtime actions remain human-gated (Platform Architecture §14). | Live platform behaviour. |

Two gates are absolute and human-held: **Approval to build** (stage 4) and **Approval to release** (stage 10). Everything between them is disciplined process; nothing crosses those two lines without a human.

---

## 4. Roles and Responsibilities

Development is a collaboration between durable **roles**. Each role is defined by its responsibility and its authority, not by the tool that currently performs it. The current holders are named so the model is concrete today; the roles remain valid if a holder is replaced.

| Role | Current holder | Responsibility | Authority held |
|---|---|---|---|
| **Product Owner** | Human | Sets direction; approves architecture, builds and releases; owns every decision and commitment. | **Final authority** over architecture, approval and release. Accountability, always. |
| **Architectural role** | ChatGPT, with the Product Owner | Shapes and reviews architectural intent; guards conformance to 00 and 01. | Architectural *reasoning and review* authority, exercised under the Product Owner. |
| **Implementation role** | Claude | Realises approved architecture as change; opens changes for review. | Implementation authority — *only* within approved intent. None over architecture or approval. |
| **Validation environment** | Replit | Executes and validates candidate change against the integrated whole. | Authority to *evidence* whether change behaves as intended. None to approve it. |
| **System of record** | GitHub | Records every change, review, approval and release immutably. | Authority as the *record of truth* of what changed, when, by whom and under whose approval. |
| **Runtime platform** | The deployed RRAI | Enforces, at runtime, what the architecture defines. | No autonomous authority; defers all consequential action to human approval (Platform Architecture §14). |

**Where authority resides — without overlap:**

- **Architectural authority** resides with the Product Owner, exercised through the architectural role. Architecture is authoritative only when expressed in governed documents (00, 01, this document and what sits beneath them) and approved.
- **Implementation authority** resides with the implementation role, and is strictly bounded: it may realise only what approved architecture permits. It may never alter architecture, approve its own work, or release.
- **Runtime authority** resides nowhere autonomous. The running platform holds no authority to decide or commit; it executes governed behaviour and escalates consequential action to a human.

No role approves its own work. No role holds two of the three authorities above. Where a participant would span roles, the roles remain distinct and the participant satisfies each in turn.

---

## 5. Repository Operating Model

### 5.1 The repository is the single source of truth

The governed repository — not the running application, not any conversation, not any tool's internal state — is the authoritative record of what RRAI *is* and *knows*. The running platform is the current expression of the repository. Where they disagree, the repository prevails and the divergence is a defect to be corrected (Philosophy §2).

### 5.2 Structure and governed documentation

The repository holds governed documents (architecture, operating models, frameworks, knowledge and templates) and the implemented platform, organised so that each concern has one home. Governed documents carry authority; everything beneath them conforms. This document is the governing document of the engineering area within that structure.

### 5.3 Authority cascade

Authority within the repository follows the §7 model of the Master Context: it flows downward from the constitution, and where documents conflict the higher layer prevails. A change at any level triggers review of everything beneath it (§7, §13). One fact lives in exactly one authoritative place and is referenced elsewhere, never copied (§8).

### 5.4 The branch model — meaning, not mechanics

The repository expresses the state of change through three kinds of branch. This section defines what each **means**; how change is promoted between them is the Release Model (§10), and how a single change is reviewed is the Pull Request model (§6).

- **`feature/*` — proposed truth.** An isolated line of change realising one approved intent. It is provisional and carries no authority until reviewed and merged. One approved intent, one feature branch.
- **`develop` — integration truth.** The single place where approved changes are integrated and validated together. It represents what RRAI *will* be at the next release. Change enters only through a passing pull request (§6).
- **`main` — released truth.** The state that has been approved for release and governs the production platform. It changes only by human-approved promotion from `develop` (§10) and is always a known, tagged version.

The direction is one-way and disciplined: proposed → integrated → released. Nothing reaches `main` that did not pass through `develop`, and nothing enters `develop` that did not pass review.

---

## 6. Pull Request Operating Model

The pull request is the **unit of change** and the place where review authority is exercised. It is the mechanism by which proposed truth becomes integration truth. This section owns the change gate; it relies on the branch meanings in §5 and the roles in §4.

### 6.1 When a change is opened

A feature branch is created when, and only when, an intent has been **approved to build** (Lifecycle stage 4). A branch without approved intent behind it has nothing to realise and must not exist.

### 6.2 What a pull request must contain

Every pull request must make its change reviewable on its own terms. At minimum it states: the approved intent it realises and the reference to it; what changed and why; how the change was validated; and any conformance considerations (§12). A change whose intent cannot be traced to an approval is not ready for review.

### 6.3 Architecture review

Architecture review asks a single question: *does this change faithfully realise the approved architecture, and nothing beyond it?* A change that exceeds, reinterprets or quietly amends the approved intent is rejected and returned to §7, not merged.

### 6.4 Implementation review

Implementation review asks whether the change is correct, coherent, maintainable and free of avoidable duplication (Philosophy §2). It reviews the realisation, having taken the architecture as given.

### 6.5 Testing expectations

A change carries the evidence that it behaves as intended, validated against the integrated whole (§9). Absence of evidence is treated as failure, not as neutral.

### 6.6 Draft versus ready for review

A change under construction is **draft** — visible, but not a request for judgement. It becomes **ready for review** only when it is complete, evidenced and conformant. Marking a change ready is an assertion that it is fit to be judged.

### 6.7 Merge criteria

A change merges into `develop` only when **all** hold: it realises an approved intent; architecture review and implementation review both pass; validation evidence is present and passing; and it is conformant (§12). If any fails, it does not merge. Merge is the exercise of review authority, never a formality.

---

## 7. Architecture Governance

### 7.1 How architecture evolves

Architecture changes only by deliberate, reviewed, approved amendment to a governed document. It never changes by implementation, by drift, or by fact. An idea becomes architecture (Lifecycle stages 2–4) before it becomes anything built.

### 7.2 How new documents are introduced

A new governed document is introduced by stating its purpose, its position in the authority order, the document it sits beneath, and its scope and non-goals — exactly as this document does in §1. It takes effect only when approved, and from that point binds everything beneath it.

### 7.3 How conflicts are resolved

Where two governed documents conflict, the higher authority prevails and the lower is defective on the point of conflict until amended (Master Context §7). Conflicts are surfaced and resolved explicitly; they are never settled silently or by local exception.

### 7.4 How superseded documents are handled

A superseded document is retired to read-only history, not deleted. Its successor references it as prior context. History is preserved so that the reasoning behind the current state remains recoverable (Master Context §7, layer 07).

### 7.5 How authority flows

Architectural authority flows downward from the constitution. A change to a higher document cascades into a mandatory review of every document and implementation beneath it (§13). Nothing beneath may amend something above it.

---

## 8. Knowledge Governance

This section governs how *governed knowledge* enters and moves through the repository. It defers to the Knowledge Governance Framework for the detail of classification and rating, and states here only the development-level rules — by reference, never by duplication.

### 8.1 Kinds of knowledge

- **Master Assets.** Authored, governed, versioned knowledge — the authoritative source of truth. Admitted only through governed authoring and review; there is no automated path into approved Master knowledge.
- **Generated Assets.** Outputs RRAI produces. They are records of work, not sources of truth, and never silently become Master knowledge.
- **Runtime Memory.** Operational state the platform accrues at runtime, explicitly marked by verification status. It never carries the authority of Master knowledge (Platform Architecture §7, §15).

### 8.2 Review gates and the promotion path

Knowledge rises in authority only through review. A candidate lesson or generated insight may be **proposed** for promotion toward Master knowledge, but crosses that boundary only through an explicit human review gate. Nothing is promoted automatically, and promotion never bypasses review (Platform Architecture §15).

### 8.3 Reference, do not duplicate

Each fact lives in exactly one authoritative place and is referenced from everywhere it is needed. Duplication creates divergent truth and is prohibited. When knowledge must be used in two places, it is referenced in both, corrected in one.

---

## 9. Implementation Governance

This section governs the **discipline** of turning approved intent into change — how the roles of §4 conduct implementation within the lifecycle of §3. It defines conduct, not sequence and not roles, which are owned elsewhere.

- **Implementation realises intent, and only intent.** The implementation role builds exactly what was approved. Discovering that the intent is wrong returns the work to architecture (§7); it never licenses building beyond the mandate.
- **Review is independent of authorship.** The architectural role reviews implementation against approved architecture; no participant is the sole judge of its own work (§4, §6).
- **Validation evidences behaviour.** The validation environment exercises candidate change against the integrated whole and produces the evidence a change must carry (§6.5). Validation informs judgement; it does not confer approval.
- **The record is immutable and complete.** The system of record captures every change, review, approval and release — what changed, when, by whom, and under whose approval — so that the history of the platform is always recoverable and attributable.
- **Production changes only by governed release.** No change reaches the running platform except through human-approved release (§10). The runtime never acquires a side channel by which change bypasses this path, and consequential runtime actions remain human-gated (Platform Architecture §14).

---

## 10. Release Model

This section owns **promotion, cadence, versioning and recovery**. It builds on the branch meanings in §5 and the human release gate in §3; it does not redefine them.

- **Promotion.** Change flows one way: `feature/*` → `develop` → `main`. Entry to `develop` is by passing pull request (§6). Promotion of `develop` to `main` is a **human-approved** act (Lifecycle stage 10) and never automatic.
- **Cadence.** Releases are deliberate, not continuous. `develop` accrues integrated, validated change; a release is cut when a coherent, approved increment is ready. Scope and timing are the Product Owner's decision.
- **Versioning.** Every released state on `main` is a distinct, identified version. Versions are ordered and meaningful, so that any point in the platform's history can be named, compared and returned to.
- **Tagging.** Each release is permanently marked at the point of release, binding a version identity to an exact state of the source of truth.
- **Hotfixes.** An urgent correction to released truth follows the same gates in compressed time — approved, reviewed, evidenced and recorded — never by unreviewed change to `main`. Speed narrows the schedule, not the governance.
- **Rollback.** Because every release is a known, tagged version, recovery is a return to a previous known-good version, not an improvised repair. The ability to roll back is a property of the release model, not a special event.

---

## 11. Continuous Improvement

The development ecosystem is itself expected to improve, under the same governance it applies to the platform. This is distinct from the runtime Learning loop (Platform Architecture §15): that improves RRAI's *behaviour*; this improves how RRAI is *built*.

- **Architecture improves** by proposing, reviewing and approving amendments to governed documents (§7) — never by erosion.
- **Implementation improves** by learning from what review and validation reveal, and by raising reusable capability so that recurring effort is solved once (Philosophy §2).
- **Knowledge improves** by candidate lessons rising through the promotion path (§8) into governed knowledge.
- **AI behaviour improves** as the roles observe where guidance was unclear or gates were strained, and refine the governed instructions the roles operate under.
- **Retrospective.** At meaningful intervals — a release, an increment, a failure — the ecosystem reflects on what worked and what did not, and turns that into governed change. Improvement that is not written into the governed record has not happened.

Improvement never relaxes a gate to move faster. Where a control feels like friction, the control is examined and amended through change control (§13), not bypassed.

---

## 12. Conformance

Conformance is the standard everything produced under this document must meet. It is stated once here so that no lower artefact restates it.

- **Every future document** must declare its purpose, its position in the authority order, the document it sits beneath, and its scope and non-goals; must add no principle above its authority; and must conform to every document above it (§1, §7).
- **Every future implementation** must realise an approved intent and nothing beyond it, carry validation evidence, avoid duplication of truth, and reach production only by governed release (§6, §9, §10).
- **Every pull request** must trace to an approved intent, pass architecture and implementation review, carry passing validation evidence, and be conformant before merge (§6.7).

The runtime and the repository must never exceed what the governing documents permit. Where they diverge, the governing document prevails until amended, and the divergence is a defect to be corrected or a change to be proposed (§13).

---

## 13. Change Control

### 13.1 Position

This document is a governed document, subordinate to the Master Context and the Platform Architecture and superior to everything in the engineering working area. It is subject to the same authority rules it enforces.

### 13.2 Relationship with higher authority

A change to the Master Context or the Platform Architecture cascades into this document, which must be reviewed for conformance and amended where affected. No change to this document may weaken, reinterpret or override a commitment of either higher document; any proposed change that would do so is out of order and resolved in favour of the higher authority.

### 13.3 How this document evolves

This document changes only by the process it defines: an amendment is proposed, reviewed, approved by the Product Owner, versioned and recorded (§3, §7). A change here cascades into a mandatory review of everything in the engineering area beneath it.

### 13.4 Versioning

This document is versioned. Each approved amendment produces a new version, and the prior version is retired to read-only history (§7.4). The current version is always identifiable, and the reasoning that produced it always recoverable.

---

*This document implements `00_RRAI_Master_Context_v2_0.md` and is governed by the Strategy layer (`strategy/`) and `01_RRAI_Platform_Architecture_v1_0.md`. Where any of these conflict, the higher document prevails. It defines how RRAI is changed; it does not define what RRAI is, nor how any particular thing is built.*

*Risk Rising  •  Internal  •  Development operating contract  •  Version 1.0*