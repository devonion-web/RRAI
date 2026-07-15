# RRAI Presentation Engine

| | |
|---|---|
| **Document** | `engines/presentation-engine/00_Presentation_Engine.md` |
| **Repository area** | Engines — master architecture and orchestration for the Presentation Engine |
| **Serves** | The `capabilities/06 Presentation Generation` business capability |
| **Sits directly beneath** | `architecture/01_RRAI_Platform_Architecture_v1_0.md`, which sits directly beneath `architecture/00_RRAI_Master_Context_v2_0.md` |
| **Status** | **Version 1.0 — approved engine architecture.** Defines the engine and its orchestration only. Contains no deck templates, no detailed brand specifications and no slide library, by design. |
| **Authority** | Subordinate to the Master Context and the Platform Architecture. Where this document conflicts with either, the higher document prevails. |
| **Spelling** | UK English throughout. |

---

## 1. Purpose

This document is the master architecture for the **RRAI Presentation Engine**: the governed orchestration through which every presentation produced across the RRAI platform is created. It is the authoritative reference for *how* a presentation comes into being — the responsibilities the engine holds, the inputs it consumes, the outputs it is accountable for, the workflow it runs, the decisions it takes at each junction, and the controls that bind it at every stage.

It exists because presentations are a distinct and high-exposure class of output. A slide is often the most visible artefact Risk Rising produces: it is shown in a room, forwarded after a meeting, and remembered longer than the words that accompanied it. A presentation compresses evidence into a small number of assertive statements, carries a brand identity prominently, and frequently sits close to a lens boundary — a deck built to support a bid is not, and must never become, a deck that carries the independent analyst's authority (Master Context §4–§6). The risks of inconsistency, off-brand output, evidence drift and lens contamination are therefore concentrated in this format. A single, governed engine is how those risks are controlled and how repeatability is guaranteed.

The engine's purpose, in one line, is to **turn a governed presentation request into a correct, on-brand, lens-honest, evidence-led presentation, repeatably and accountably — without ever deciding or committing on Risk Rising's behalf.**

This document defines the engine and its orchestration. It deliberately holds **no deck templates, no detailed brand specifications and no slide library**. Those are governed elsewhere (Sections 2, 10 and 16). This document describes the machine that selects and applies them — not the assets it fills in.

## 2. Scope

**In scope.** The architecture of the Presentation Engine as an orchestration service of the RRAI platform: its design and architectural principles; its responsibilities and boundaries; the brand contexts it must support; the classes of input it admits and the outputs it is accountable for; the end-to-end production workflow from request to approval-ready output; the decision logic that routes a request through that workflow; failure and exception handling; audit and traceability expectations; the dependencies the engine draws on, including the later Presentation Engine files that will own detailed rules; and the governance and human-approval controls that bind it.

**Out of scope — deliberately excluded and owned elsewhere.**

- **Deck templates and slide layouts.** These are governed assets in the Templates area (Master Context §7, layer 05; `templates/04 Presentation Template.md`, governed by `templates/00 Template Governance.md`). The engine consumes them; it does not define them here.
- **Detailed brand specifications.** The visual identities, palettes, typography, logo usage, voice and permissible co-branding for Risk Rising, LogicGate and joint presentations are owned by a later Presentation Engine file (Section 16) and any governed brand assets it references. The engine *applies* those definitions; it does not restate, reinterpret or invent them here.
- **A complete slide-pattern library.** The reusable slide-level structural patterns are owned by a later Presentation Engine file (Section 16). This document defines *how* a pattern is selected, not the patterns themselves.
- **Domain content.** What a presentation says about a subject is drawn from the governed Knowledge and Vendor Knowledge (Master Context §7, layers 03–04). The engine holds no subject-matter content.
- **Implementation detail.** Rendering technology, file formats, APIs, data schemas and build specifications belong to the engineering and implementation areas (Platform Architecture §16). This document names where they live but does not state them.
- **Product claims.** This document does not assert that any particular automated presentation capability exists today (Section 4).

## 3. Authority and Relationship to the Master Context and Platform Architecture

The engine is a governed file in the **engines** functional area. Authority flows downward from the constitution, and this document is bound by everything above it (Master Context §7).

- It **implements** the Master Context for the presentation format: its lenses, its four cross-lens commitments, its one-way valve and its seven core operating principles (Master Context §4, §5, §6, §8). It adds no principle the constitution does not contain.
- It **conforms to** the Platform Architecture. It relies on the runtime substrate, the retrieval and enforcement membrane, classification, lens routing, access control, the human accountability controls and the audit trail defined there (Platform Architecture §5–§16). It adds no capability the platform does not permit.
- It **serves** the `capabilities/06 Presentation Generation` capability. In the repository model, an engine is a reusable lower-level service used by capabilities; the Presentation Generation capability is the business-level capability that invokes this engine. The engine owns *how a presentation is produced*; the capability owns *when and why the business asks for one*.
- Where this document **conflicts** with the Master Context or the Platform Architecture, the higher document prevails and this document is treated as defective on the point of conflict until amended (Section 19).

## 4. Current-State and Target-State Boundaries

The RRAI platform is partly built and partly target-state (Platform Architecture §2, §5, §13). This document describes the governed path a presentation must follow; it does not assert that the path is fully automated today. The distinction is marked throughout, and summarised here.

**Current state.** Presentation production today is **human-directed**. A person frames the request, selects the brand and type by judgement, gathers evidence from the governed documents available, drafts the slides, and carries the output through review. The platform does not yet provide automated vector retrieval, a live enforcement membrane, autonomous agents or a persistent audit trail (Platform Architecture §5, §12, §13; `reports/current-state-inventory.md`). The engine's value in the current state is as the **governing specification** that human-directed production must follow, so that manual output is already lens-honest, evidence-led, on-brand and approval-gated.

**Target state.** As the platform's membrane, retrieval, audit and agent capabilities are built, progressively more of the workflow can be automated **within the same governed path** (Master Context §10; Platform Architecture §13). Any such automation must run the same stages, obey the same decision flow and pass through the same human accountability gates. Greater speed or scale never relaxes lens integrity, evidence discipline or human accountability.

**Rule.** Nothing in this document should be read as asserting that a target-state capability already exists. Where a stage depends on a platform capability that is target-state, the stage is still binding as a governed path; only its degree of automation is deferred.

## 5. Design Principles

The design principles govern *what a good presentation is* and what the engine optimises for. They are the presentation-specific expression of the constitutional principles (Master Context §8).

**One idea per slide.** The engine treats the slide, not the deck, as the unit of meaning. Each slide carries a single, defensible message. Density is a defect, not a virtue.

**Evidence before assertion.** A claim on a slide is held to the same evidence discipline as a claim in a white paper: fact, interpretation and recommendation are kept apart, confidence is honest, and an unsupported figure is never placed on a slide to make it look stronger (Master Context §8). The compression a slide demands is never allowed to become fabrication.

**Lens honesty is visible.** Every presentation is produced within exactly one lens, and the output never borrows another lens's authority (Master Context §5). An analyst-lens deck is demonstrably built from vendor-neutral knowledge only; a commercial deck is openly commercial and labelled as such.

**On-brand by construction, not by correction.** The correct brand context is selected before content is generated, so the output is on-brand because it could not have been produced any other way — not because it was corrected at the end.

**Brand is identity, not narrative.** The selected brand context controls identity and styling. It does **not** determine what the deck argues or how it is structured. Narrative structure is set by the audience-and-purpose classification and the presentation type, independently of brand (Sections 6 and 11).

**Educate before promote.** Consistent with Risk Rising's values (Master Context §1.3), a presentation earns attention through insight. In the commercial lenses the engine still favours substance over selling; in the Analyst lens, promotion is absent.

**Clarity over decoration.** Every visual element earns its place by aiding understanding. Charts represent data honestly; graphics clarify a model or process; nothing is added merely to fill space.

**Human accountability is designed in.** The engine prepares; a person approves and owns (Master Context §5). No presentation reaches an external audience, and no external commitment is implied by one, without human approval (Section 14).

**Repeatability.** The same class of request, under the same governance, produces a comparably structured, comparably branded, comparably evidenced result every time. Consistency is a first-class outcome, not a by-product of who built the deck.

## 6. Architectural Principles

Where the design principles say what a good output is, the architectural principles say how the engine is organised so those outputs are produced reliably and safely.

**Single engine, many presentation types.** There is one Presentation Engine. It does not fork per audience, per lens, per brand or per format. Variation between presentations is expressed as *configuration* — the selected brand context, lens, presentation type, slide patterns, content and visual assets — passed through one governed pipeline, not as parallel bespoke processes. This is what makes governance enforceable and behaviour repeatable.

**Separation of concerns.** Brand context, presentation type, slide pattern, content and visual assets are **distinct, independently governed concerns** and are resolved at distinct stages. Brand does not choose structure; type does not carry content; content does not select styling; visuals do not assert unsupported facts. Each concern is owned by its own stage and, where detailed rules are required, by its own later Presentation Engine file (Section 16). Clean separation is what lets Risk Rising change a brand, add a type or refresh a chart standard without disturbing the others.

**Configuration before content.** Brand context, audience-and-purpose, presentation type and slide pattern are resolved *before* any content is generated. The engine never generates content and then decides what brand, audience or structure it belongs to. Identity and structure are constraints on generation, not labels applied afterwards.

**Governance is a spine, not a stage.** Lens enforcement, the one-way valve, the sensitivity ceiling, evidence discipline, human accountability and audit are not steps that occur once and finish. They bind every stage (Platform Architecture §3, §9–§14). Retrieval is lens-filtered, generation is lens-bound, and release is human-gated.

**Retrieval through the membrane only.** The engine never reads the governed stores directly. It consumes evidence only through the platform's retrieval and enforcement membrane, so partition, sensitivity and lens filtering are applied to a presentation exactly as to any other output (Platform Architecture §9–§12).

**Evidence and confidence travel with content.** As content moves through the pipeline, the evidence it rests on and the confidence attached to it are carried alongside it and never dropped (Platform Architecture §12, §16). A statement that reaches quality assurance can still be traced to its source and its tier.

**Fail safe, fail visible.** Where an input is missing, ambiguous or out of policy, the engine degrades safely: it defaults to the more restrictive interpretation, marks a gap rather than inventing content, and surfaces the issue rather than proceeding silently (Section 15).

**Separation of the engine from what it consumes.** The engine is stable; templates, brand contexts, slide patterns, visual assets and knowledge evolve independently beneath it. The engine depends on the *contracts* of those assets — that a template exists for a selected type, that a brand context is resolvable — not on their contents.

## 7. Engine Responsibilities and Boundaries

The engine is accountable for the following, and only the following. Naming its responsibilities precisely also fixes its boundaries.

**The engine is responsible for:**

- **Interpreting the request** — establishing what is being asked for, for whom, in which lens, and to what end (Section 11.1).
- **Selecting the brand context** — resolving the correct brand identity, styling and permitted co-branding for the asset (Section 11.2).
- **Classifying audience and purpose** — establishing who the deck is for and what it must achieve (Section 11.3).
- **Selecting the presentation type** — mapping the request to a governed presentation type and its narrative structure (Section 11.4).
- **Selecting templates and slide patterns** — choosing the governed template family and the slide-level patterns that realise the structure (Section 11.5).
- **Commissioning knowledge retrieval** — requesting the relevant, permitted evidence through the enforcement membrane (Section 11.6).
- **Generating content** — composing lens-bound, evidence-led, on-brand slide content against the selected structure (Section 11.7).
- **Applying visuals and assets** — placing governed visual and data-visualisation assets in service of the message (Section 11.8).
- **Running quality assurance** — testing the draft against brand, lens, evidence, structural and accessibility standards (Section 11.9).
- **Routing to human approval and generating the output** — assembling the approval-ready package and routing it to the correct gate (Sections 11.10–11.11, 14).
- **Preserving traceability** — recording each stage's decisions, the operative lens, the evidence relied upon and the approvals given (Section 13).

**The engine is not responsible for, and must not:**

- **Define brands, templates, slide patterns or domain knowledge.** It consumes governed definitions; it does not author them.
- **Make or imply decisions or commitments** on Risk Rising's behalf (Master Context §5).
- **Publish or send.** External release is a human-gated action outside the engine's authority (Section 14).
- **Cross a lens within one production run.** A presentation is produced in a single lens; work spanning lenses is run as separate, lens-bound productions (Platform Architecture §10, §13).
- **Invent unsupported facts.** It must not invent customer facts, product or vendor claims, commercial terms or branding rules. Missing evidence is flagged, never fabricated (Section 15).
- **Resolve evidence conflicts silently** (Platform Architecture §12).
- **Alter governed knowledge.** Anything learned is proposed through the governed learning path, never written back directly (Platform Architecture §15).

## 8. Presentation Request Inputs

The engine admits a bounded set of inputs. Every production run is a function of these and nothing else. Inputs are contracts: the engine depends on their presence and shape, not on privileged access to their internals.

| Input | What it is | Source | Notes |
|---|---|---|---|
| **Presentation request** | The instruction to produce a presentation: intent, audience, occasion, desired scope and any stated constraints. | A human user or an upstream governed workflow / the Presentation Generation capability. | Interpreted, not obeyed literally where it conflicts with governance; ambiguity is resolved conservatively (Section 11.1). |
| **Operative lens** | The single lens the presentation is produced in: Analyst, Intelligence, Commercial or Delivery. | Stated in the request, or inferred and confirmed under the platform's hybrid lens-selection rules (Platform Architecture §10). | Exactly one lens per run. Sets permitted knowledge, posture and approval rules. |
| **Brand context** | The governing brand identity to apply — Risk Rising, LogicGate or joint — and any permitted co-branding. | Resolved against the governed brand context specification (Section 16). | Selected before content is generated; lens-constrained (Section 10). |
| **Audience and purpose** | Who the presentation is for and what it must achieve. | Stated in the request or classified by the engine (Section 11.3). | Drives narrative structure, independently of brand. |
| **Presentation type** | The governed classification carrying the narrative structure and default posture. | Resolved against the presentation type catalogue (Section 16). | Determines structure and the template family drawn on. |
| **Retrieved evidence** | The relevant, permitted knowledge and, where applicable, verified operational memory for the task. | The retrieval and enforcement membrane (Platform Architecture §9–§12). | Lens- and sensitivity-filtered before it reaches the engine; carries source, confidence and verification state (evidence tiers T1–T5). |
| **Templates, slide patterns and visual assets** | The reusable structural, layout and visual assets for the selected type and brand. | Templates area (layer 05) and the later Presentation Engine files (Section 16). | Consumed, never redefined. |
| **Applicable standards** | The brand, quality, accessibility and governance rules the output must meet. | This document; the Operating Standards; the later Presentation Engine QA file (Section 16). | Bind every stage; enforced at quality assurance. |

Inputs the engine will **not** accept as a basis for output: unsourced assertions presented as fact; content that fails the sensitivity ceiling for the operative lens (Platform Architecture §11); or a request to produce a single presentation that spans more than one lens. Each is refused, flagged or split rather than absorbed.

## 9. Engine Outputs

The engine is accountable for a small, well-defined set of outputs. Each is labelled with the context needed to use it responsibly (Platform Architecture §13).

| Output | What it is | Carries |
|---|---|---|
| **Presentation draft** | The assembled, on-brand, lens-bound slide content for the request, structured to the selected type. | Operative lens; brand context; presentation type; per-claim evidence tier and confidence; any unverified-state or gap flags. |
| **Evidence and confidence record** | The traceable link between content and the evidence it rests on. | Source references and confidence for material claims; explicit flags where evidence is inferred, assumed or missing. |
| **Gap and conflict report** | The points where evidence was missing, weak or conflicting, surfaced for human resolution. | Location in the deck; nature of the gap or conflict; what a human must supply or decide. |
| **Production record** | The audit trail of the run (Section 13). | Request interpretation; brand, audience, type, pattern decisions; operative lens; retrieval scope; QA result; approval status. |
| **Approval-ready package** | The finished presentation routed to the correct human gate before any release. | Its output posture — internal-labelled or approval-required (Section 14). |

**Output posture.** Every presentation output is one of two things and is labelled as such: **internal working material**, which may be produced and circulated internally with appropriate labelling but carries no external authority; or **approval-required material**, which cannot be shown externally, sent, or treated as a commitment until a human approves it (Platform Architecture §13, §14). The engine never emits an output that is externally released by default.

## 10. Brand Contexts Supported

The engine must support three brand contexts. This document names them and states the lens rules that bind them; the detailed identities, palettes, typography, logo usage, voice and co-branding mechanics are owned by the later brand context specification (Section 16) and must not be invented here.

| Brand context | When it applies | Lens constraint |
|---|---|---|
| **Risk Rising** | Presentations carrying Risk Rising's own identity, in any lens the request legitimately calls for. | The only brand context permitted in the **Analyst** lens, and then only with vendor-neutral content and no partner co-branding (Master Context §4.1, §6). |
| **LogicGate** | Presentations that carry LogicGate identity, produced as partner-aligned work. | Permitted only in the **Commercial** and **Delivery** lenses, where partner-aligned advocacy is legitimate and labelled (Master Context §4.2). Never in the Analyst lens. |
| **Joint Risk Rising + LogicGate** | Co-branded presentations for bids, joint propositions or delivery, presenting both identities together. | Permitted only in the **Commercial** and **Delivery** lenses. Co-branding is a Commercial/Delivery act and must never appear on independent analyst-lens work (Master Context §6). |

**Rules that bind all three.**

- **Brand controls identity and styling only.** It never determines the narrative structure, which comes from audience-and-purpose and presentation type (Sections 5, 11.3–11.4).
- **The one-way valve is absolute.** LogicGate and joint branding, and any partner-aligned framing, are commercial/delivery context. They never flow into Analyst-lens outputs (Master Context §6; Platform Architecture §9).
- **No invented branding rules.** Where a branding rule is not defined in the governed brand context specification, the engine does not improvise one; it flags the gap for human direction (Section 15).

## 11. Presentation Production Workflow

The workflow is the ordered path a request travels from arrival to approval-ready output. Each stage has one responsibility, defined inputs and a defined output; the governance spine binds every stage. Configuration stages (11.1–11.5) precede content stages (11.6–11.8), which precede assurance, approval and output (11.9–11.11) — the *configuration-before-content* principle in architectural form.

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │  GOVERNANCE SPINE (binds every stage)                                    │
  │  lens enforcement · one-way valve · sensitivity ceiling ·                │
  │  evidence & confidence discipline · human accountability · audit trail   │
  └────────────────────────────────────────────────────────────────────────┘
     │      │      │      │      │      │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
   11.1   11.2   11.3   11.4   11.5   11.6   11.7   11.8   11.9  11.10  11.11
  Request Brand  Aud. & Type   Tmpl.& Know-  Content Visual  QA    Human  Output
  intake  ctx    purpose sel.  slide  ledge   gen.   & asset       appr.  gen.
  + lens  sel.   class.        pattern retr.         apply
                                                                   │
                                            ┌──────────────────────┴────────┐
                                            │ approval / gap loop:           │
                                            │ return to the earliest stage   │
                                            │ that can resolve the issue     │
                                            └────────────────────────────────┘
```

### 11.1 Request intake and framing

Establish what is genuinely being asked for and under what governance, before anything is built. The engine interprets the request into a structured intent — purpose, audience, occasion, scope and explicit constraints — and establishes the **operative lens**. Where the request names the lens, that lens is used; where it is inferred, the inference is made explicit and confirmed where the ambiguity materially affects the output (Platform Architecture §10). Where the lens is unclear, the engine defaults to the most restrictive reasonable lens and does not draw commercial or delivery context until the position is resolved. If the request would require a single deck to span lenses, the engine separates it into distinct, lens-bound productions rather than proceeding. **Output:** a framed request with a single confirmed lens.

### 11.2 Brand-context selection

Resolve the governing brand context — Risk Rising, LogicGate or joint — before content exists, against the governed brand context specification (Section 16) and constrained by the operative lens (Section 10). The engine applies the brand definitions as governed; it does not reinterpret or invent them. **Output:** a resolved brand context that constrains styling for every later stage but does not set narrative structure.

### 11.3 Audience and purpose classification

Establish, independently of brand, **who** the presentation is for and **what** it must achieve — for example an executive decision, a bid evaluation panel, a delivery kick-off, or a thought-leadership audience. This classification drives the narrative and is the primary determinant of structure. It is kept separate from brand so that the same brand can serve different audiences and the same audience can be served under different brands. **Output:** an audience-and-purpose classification.

### 11.4 Presentation-type selection

Map the framed request, its audience-and-purpose and its lens to an entry in the governed presentation type catalogue (Section 16). A presentation type is the governed pairing of an audience-and-purpose with a **narrative structure** and a default posture, aligned to a lens. The type determines structure, not content, and is constrained by the operative lens: a type carrying independent authority cannot be selected for a commercial run, and vice versa. Where more than one type fits, the engine selects the most appropriate and records the basis; where none fits, it escalates for human direction (Section 15). **Output:** a selected presentation type with its narrative structure.

### 11.5 Template and slide-pattern selection

Select the governed **template family** for the type (Templates area, layer 05; `templates/04 Presentation Template.md`) and the **slide-level patterns** that realise its structure (the later slide-pattern library, Section 16). Template and pattern selection is a structural concern only: it chooses the shapes the content will occupy. It carries no brand styling decisions (owned by 11.2) and no content (owned by 11.7). **Output:** a selected template family and an ordered set of slide patterns.

### 11.6 Governed knowledge retrieval

Obtain the relevant, permitted evidence — and only the permitted evidence — by commissioning retrieval through the enforcement membrane (Platform Architecture §9–§12). The engine never reads the stores directly. Retrieval is filtered by the operative lens, partition and sensitivity ceiling before any content reaches the engine. For an Analyst-lens deck, only vendor-neutral knowledge is admitted; commercial and delivery context is structurally withheld (Master Context §6). Evidence arrives carrying its source, confidence, verification state and evidence tier (T1–T5). **Output:** a scoped, permitted evidence set, with gaps already visible where support is absent.

### 11.7 Content generation

Compose slide content — lens-bound, evidence-led, on-brand in voice, and structured to the selected type and patterns. Slides are generated **only** from governed knowledge (T1), verified authoritative and operational memory (T2–T3), and **explicitly labelled assumptions** where higher-tier evidence is absent; unverified or inferred material (T4–T5) is labelled and never the sole basis for a consequential claim (Platform Architecture §12). One idea per slide; fact, interpretation and recommendation kept apart; confidence stated honestly. Where evidence is missing or weak, the engine inserts a clearly marked gap and records it — it does not invent customer facts, product claims, commercial terms or branding rules (Section 15). Where evidence conflicts, the conflict is surfaced, not resolved silently. **Output:** a structured draft with evidence, confidence and gaps attached.

### 11.8 Visual and asset application

Apply governed visual and data-visualisation assets — charts, diagrams, iconography and imagery — in service of the message, to the standards owned by the later visual and asset specification (Section 16) and within the resolved brand styling. Charts represent data honestly and carry their source; visuals clarify rather than decorate; accessibility (contrast, labelling, readability) is respected. Visuals never assert a fact the evidence does not support; a chart with no permitted data behind it becomes a flagged gap, not an illustrative invention. **Output:** the draft with governed visuals applied.

### 11.9 Quality assurance

Test the draft against every standard before it is assembled and gated, as an explicit set of checks owned by the later QA file (Section 16): brand conformance; lens integrity; evidence and confidence; structural conformance to the selected type and patterns; accessibility and clarity; and correct accountability posture. A failed check does not silently mutate the output — it returns the run to the earliest stage that can resolve it (a brand failure to 11.2, a structural failure to 11.4–11.5, an evidence failure to 11.6–11.7) and the loop repeats until the draft passes or the outstanding items are explicitly escalated. **Output:** a quality-assured draft plus a resolved or escalated gap-and-conflict report.

### 11.10 Human approval

Route the quality-assured package to the correct human gate. Any presentation that will be published externally, sent, shown to a customer, or that carries pricing, commercial terms or legal/regulatory assertions requires human approval before release (Section 14; Platform Architecture §14). Internal working material may proceed without approval but is labelled as internal. The engine prepares and routes; it never approves on a human's behalf. **Output:** an approval decision recorded against the run, or an internal-labelled release.

### 11.11 Output generation

Assemble the approved (or internal-labelled) content into the finished presentation using the selected template family and brand styling, apply the correct output posture, and write the production record to the audit trail (Section 13). The engine does not itself publish or send; those remain human-gated actions (Section 14). **Output:** an approval-ready or internally-released presentation package with a complete production record — repeatable, traceable and accountable.

## 12. Decision Flow

The decision flow is the routing logic that carries a request through the workflow and determines, at each junction, whether to proceed, resolve conservatively, loop back or escalate.

```
  request → lens clear? ──no──► default to most restrictive lens; confirm if it changes the result
              │yes
              ▼
          single lens? ──no──► split into separate lens-bound runs
              │yes
              ▼
      resolve brand context ──(brand rule undefined?)──► flag; escalate for human direction
              │
              ▼
   classify audience & purpose
              │
              ▼
       type resolvable? ──no──► escalate to human for direction
              │yes
              ▼
   select template & slide patterns
              │
              ▼
   retrieve permitted evidence (membrane)
              │
              ▼
   evidence sufficient? ──no──► flag gap; insert human placeholder; continue (never invent)
              │yes
              ▼
   generate content · apply visuals
              │
              ▼
     passes all QA checks? ──no──► loop to earliest stage that fixes it
              │yes
              ▼
   external / commercial exposure? ──yes──► hold for human approval ──► approved ──► release
              │no
              ▼
      internal-labelled release
```

The flow encodes three constant behaviours. **Ambiguity resolves conservatively:** an unclear lens defaults to the most restrictive option, and a cross-lens request is split, not merged. **Missing evidence never becomes invented evidence:** an insufficiency flags a gap and inserts a human placeholder, and the run continues honestly. **Nothing with external or commercial exposure leaves without a human:** the final junction always routes such outputs to an approval gate (Section 14).

## 13. Audit and Traceability

Every run is traceable after the fact. This depends on the platform audit trail (Platform Architecture §5, §14, §16), which is target-state in its automated form; in the current human-directed state the same record is kept by the producing human.

The **production record** for each run captures: the interpreted request and confirmed operative lens; the brand context, audience-and-purpose, presentation type and slide patterns selected, with the basis for each; the retrieval scope and the evidence tiers relied upon; the QA result and any looped resolutions; the gap-and-conflict report and its disposition; and the approval status and approver for any gated release. Per-claim material content carries its source and confidence so that any assertion on any slide can be traced to the evidence beneath it (Platform Architecture §12, §16). The active lens is recorded for the run, upholding lens visibility (Platform Architecture §10, §16). A presentation's provenance — what it claimed, on what evidence, in which lens, approved by whom — can therefore be reconstructed.

## 14. Governance and Human Approval Requirements

Governance is enforced across the pipeline, not bolted on at the end.

**Lens honesty and the one-way valve.** Every presentation is produced in exactly one declared, visible lens. Analyst-lens presentations are built from vendor-neutral knowledge only and carry no partner co-branding; commercial and delivery context is structurally withheld from them and never flows back into independent work (Master Context §5–§6; Platform Architecture §9). Work spanning lenses is produced as separate, lens-bound runs.

**Human approval is mandatory** before any presentation, or any action taken with one, that involves the eight controlled action classes (Platform Architecture §14):

1. external publication;
2. customer commitments;
3. pricing or commercial terms;
4. legal or regulatory assertions;
5. changes to approved Knowledge;
6. sending communications;
7. changes to opportunity or project status;
8. external-system actions.

In practice this means **every external or customer-facing presentation** — which by definition involves external publication or a customer communication, and often commercial terms — is approval-required and cannot be released by the engine. Internal working material may be produced without approval but must be labelled as internal and carries no external authority (Platform Architecture §13, §14). The engine prepares and routes; people decide, commit and own.

**Evidence discipline.** Fact, interpretation and recommendation are kept apart on every slide. Claims carry source and confidence; conflicts are surfaced, not resolved silently; gaps are flagged for human input, never invented. The engine must not invent customer facts, product or vendor claims, commercial terms or branding rules (Master Context §8; Platform Architecture §12).

**Learning is governed.** Anything the engine's operation reveals about how presentations should improve is proposed through the governed learning path and, where it would change governed knowledge, templates or brand rules, through the human review gate. The engine never writes back to governed knowledge, templates or brand specifications directly (Platform Architecture §15).

## 15. Failure and Exception Handling

The engine degrades safely and visibly. Each failure mode has a defined, conservative response; none is resolved by invention or silent assumption.

| Condition | Response |
|---|---|
| **Lens unclear or ambiguous** | Default to the most restrictive reasonable lens; do not draw commercial or delivery context; confirm with a human where the ambiguity materially affects the result (Platform Architecture §10). |
| **Request spans lenses** | Split into separate, lens-bound runs; never merge (Master Context §5; Platform Architecture §13). |
| **Brand context unresolvable or rule undefined** | Flag and escalate for human direction; never improvise a branding rule (Section 10). |
| **Presentation type does not fit** | Select the closest fit and record the basis, or escalate where none fits cleanly; never force a poor match silently (Section 11.4). |
| **Evidence missing or weak** | Insert a clearly marked gap and a human placeholder; record it in the gap report; continue honestly; never fabricate a fact, figure, product claim or commercial term (Section 11.7). |
| **Evidence conflicts** | Surface the conflict for human resolution; never resolve it silently (Platform Architecture §12). |
| **Sensitivity ceiling would be breached** | Withhold the content; it never enters the draft (Platform Architecture §11). |
| **QA check fails** | Loop to the earliest stage that can resolve the issue; do not silently mutate the output; escalate unresolved items (Section 11.9). |
| **Approval withheld or absent for a gated output** | Hold the output; do not release, publish or send; return it for revision or human decision (Section 14). |
| **A depended-upon governed asset is absent** (e.g. a later Presentation Engine file not yet authored) | Treat its rules as undefined; flag the dependency; do not invent its content (Section 16). |

The governing rule is **fail safe, fail visible**: on any doubt the engine takes the more restrictive path, marks the issue, and surfaces it to a human, rather than proceeding on an assumption.

## 16. Dependencies

The engine depends on the *contracts* of a defined set of governed capabilities and assets — that they exist, are resolvable and behave as governed — not on privileged access to their internals. This separation lets each dependency evolve without changing the engine (Section 18).

**Upstream and platform dependencies (existing governed files).**

| Dependency | Relied on for | Governed by |
|---|---|---|
| **Master Context** | The constitution: lenses, the four cross-lens commitments, the one-way valve, the seven principles. | `architecture/00_RRAI_Master_Context_v2_0.md` |
| **Platform Architecture** | The runtime substrate, the retrieval and enforcement membrane, classification, lens routing, access control, human accountability controls and audit. | `architecture/01_RRAI_Platform_Architecture_v1_0.md` |
| **Presentation Generation capability** | The business-level capability this engine serves. | `capabilities/06 Presentation Generation.md` *(placeholder — to be completed)* |
| **Templates area** | The deck template families and layouts the engine consumes (layer 05). | `templates/04 Presentation Template.md`, `templates/00 Template Governance.md` *(placeholders — to be completed)* |
| **Governed Knowledge and Vendor Knowledge** | The subject-matter and vendor evidence the content rests on (layers 03–04). | `knowledge/` and `knowledge/Knowledge Governance.md` *(governance placeholder — to be completed)* |
| **Operating Standards** | The quality, clarity and neutrality bar the output must clear. | RRAI Operating Standards (Operating Model layer) |

**Dependencies on later Presentation Engine files.** This master document defines the engine and its orchestration only. The detailed rules for each separated concern are owned by later files in this folder, which this document governs and which must not duplicate its orchestration. The set below is **anticipated and indicative**; the exact list and numbering are to be ratified as the engine is built. Until a file exists, its rules are treated as undefined and the engine flags the dependency rather than inventing content (Section 15).

| Anticipated file | Will own |
|---|---|
| `01_Presentation_Type_Catalogue.md` | The governed presentation types: each mapping an audience-and-purpose to a narrative structure, a default posture and a permitted lens. |
| `02_Brand_Context_Specification.md` | The detailed brand contexts — Risk Rising, LogicGate, joint — their visual identities, palettes, typography, logo usage, voice and co-branding rules per lens. |
| `03_Slide_Pattern_Library.md` | The reusable slide-level structural patterns and the rules for selecting among them. |
| `04_Visual_and_Asset_Specification.md` | The data-visualisation, chart, iconography and imagery standards and the asset-library contract. |
| `05_Presentation_Quality_Assurance_Checklist.md` | The explicit, testable QA checks the engine runs at stage 11.9. |

A change to any dependency triggers a review of the engine's conformance to it, but does not by itself change the engine (Section 19).

## 17. Relationship to Other RRAI Files

The engine sits within a governed repository and must be read in relation to the documents above, beside and beneath it.

**Above the engine — authority it inherits.** The **Master Context** is the constitution; the engine implements its lenses, one-way valve and principles for the presentation format, and where the two conflict the Master Context prevails. The **Platform Architecture** defines the runtime the engine runs on — the membrane it retrieves through, the lens routing it obeys, the accountability controls that gate its output; the engine adds no capability the platform does not permit, and where the two conflict the Platform Architecture prevails.

**Beside the engine — capabilities and services it composes with.** The **Presentation Generation capability** (`capabilities/06`) is the business-level capability that invokes this engine. The other **engines** (retrieval, reasoning, context assembly, output generation and the rest) are peer services the platform may compose with this one. The content and production frameworks for other formats — white papers, executive briefings, campaigns, research — own the substance of those formats; where their outputs become presentations, they do so *through* this engine rather than around it.

**Beneath the engine — assets it consumes.** The **Templates** supply structure; the **later Presentation Engine files** supply the type catalogue, brand contexts, slide patterns, visual standards and QA checklist; the **Knowledge and Vendor Knowledge** supply evidence. The engine consumes all of these as governed contracts and holds none of their content itself.

**What the engine does not do to its neighbours.** It does not restate, reinterpret or weaken any of them. It adds no principle to the Master Context, no capability beyond the Platform Architecture, no template beyond the Templates area, and no brand rule beyond the brand context specification. Where this document appears to conflict with a higher one, the higher one governs and this document is treated as defective on that point until amended.

## 18. Extensibility

The engine is built to extend without losing its guarantees. Extensibility is deliberately confined to configuration and governed assets, so the pipeline and its controls remain stable as the platform grows.

**Extend by adding governed assets, not by forking the pipeline.** New presentation types, new templates, new slide patterns, refreshed brand contexts, new visual standards and new domain knowledge are added as governed assets the single engine consumes. The workflow, the decision flow and the governance spine are unchanged by such additions — the architectural payoff of *single engine, many types* and *separation of concerns*.

**New brand contexts and co-branding.** Additional brand identities or partner co-branding arrangements are added to the brand context specification and become selectable at stage 11.2 without engine change, provided each carries the lens rules that govern where it may appear (Section 10).

**New lenses.** Should the platform's lens set be extended under the Master Context, the engine inherits the change through lens routing; its per-stage lens enforcement applies to any new lens on the same terms once that lens's permitted knowledge and posture are defined (Platform Architecture §10).

**Progressive automation.** The workflow's stages are defined so that today's human-directed production can be progressively automated within the same governed path (Section 4; Master Context §10). Any automation must run the same stages, obey the same decision flow and pass through the same human accountability gates. Greater speed or scale never relaxes lens integrity, evidence discipline or human accountability.

**Boundaries that do not move.** Extensibility never extends to the constitutional guarantees. New types, brands, patterns, lenses or automation change *what* the engine can produce and *how fast*, never *whether* it must be lens-honest, evidence-led, on-brand and human-accountable.

## 19. Conformance and Change Control

**Position.** This document is a governed file in the engines area, subordinate to the Master Context and the Platform Architecture. Authority flows downward; where documents conflict, the higher layer prevails (Master Context §7).

**Conformance.** The engine, however implemented, must not exceed what this document permits, and this document must not exceed what the Master Context and Platform Architecture permit. Where running behaviour and this document diverge, this document prevails until amended, and the divergence is treated as a defect to be corrected or a change to be proposed.

**Change control.** A change to this document is proposed, reviewed and versioned. A change to the Master Context or the Platform Architecture cascades into this document, which must be reviewed for conformance. A change to this document cascades into the later Presentation Engine files, templates and production practice beneath it, which must be reviewed in turn. No change may weaken, reinterpret or override a Master Context or Platform Architecture commitment; any change that would do so is out of order and resolved in favour of the higher document.

## 20. Glossary

| Term | Definition |
|---|---|
| **Presentation Engine** | The single governed orchestration through which every RRAI presentation is produced, from request to approval-ready output. |
| **Presentation request** | The instruction to produce a presentation — intent, audience, occasion, scope, constraints — interpreted by the engine, not obeyed literally where it conflicts with governance. |
| **Operative lens** | The single lens a presentation is produced in — Analyst, Intelligence, Commercial or Delivery — setting permitted knowledge, posture and approval rules (Master Context §4). |
| **Brand context** | The resolved brand identity for an asset — Risk Rising, LogicGate or joint — governing identity and styling only, selected before content and never determining narrative structure. |
| **Audience and purpose** | Who a presentation is for and what it must achieve; the primary determinant of narrative structure, resolved independently of brand. |
| **Presentation type** | The governed pairing of an audience-and-purpose with a narrative structure and default posture, aligned to a lens; determines structure, not content. |
| **Slide pattern** | A reusable slide-level structural shape selected to realise a presentation type's structure; carries no brand styling or content. |
| **Retrieval and enforcement membrane** | The platform mechanism through which the engine obtains lens-, partition- and sensitivity-filtered evidence; the engine never reads the stores directly (Platform Architecture §9–§12). |
| **One-way valve** | The rule that neutral knowledge flows into every lens while commercial and delivery context never flows into independent Analyst-lens work (Master Context §6). |
| **Evidence tier (T1–T5)** | The precedence order applied in reasoning: T1 approved Knowledge; T2 verified authoritative Memory; T3 verified operational Memory; T4 unverified Memory / learning signals; T5 model inference (Platform Architecture §12). |
| **Output posture** | Whether an output is internal working material (labelled, no external authority) or approval-required material (held for a human gate before any release). |
| **Gap flag** | An explicit marker where evidence to support an intended message is missing; a placeholder for human input, never filled by invention. |
| **Production record** | The per-run audit trail of request interpretation, brand/audience/type/pattern decisions, lens, retrieval scope, QA result and approval status. |
| **Human accountability gate** | The mandatory human approval step through which any externally or commercially exposing output must pass before release (Platform Architecture §14). |

---

*This document defines the RRAI Presentation Engine and its orchestration, and implements `architecture/00_RRAI_Master_Context_v2_0.md` and `architecture/01_RRAI_Platform_Architecture_v1_0.md`. Where this document conflicts with either, the higher document prevails. It contains no deck templates, no detailed brand specifications and no slide library by design; those are owned by the Templates area and by the later Presentation Engine files named in Section 16.*
