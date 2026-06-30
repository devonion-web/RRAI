# 09 – Prompt Architecture

Version: 1.0
Status: Core Architecture
Authority: High
Depends On:
- 01 Product Vision
- 02 Executive Operating System
- 03 Design Principles
- 04 Capability Framework
- 05 Workspace Framework
- 06 Organisation Framework
- 07 Memory Architecture
- 08 Learning Engine

---

# 1. Purpose

The Prompt Architecture defines how RRAI prepares information before any Large Language Model (LLM) performs reasoning.

Prompt engineering is not considered intelligence.

Intelligence comes from assembling the correct context before reasoning begins.

The AI model performs reasoning.

The Executive Operating System provides intelligence.

This architecture ensures RRAI behaves consistently regardless of the underlying AI model.

---

# 2. Philosophy

The AI model should be replaceable.

Today:

Claude

Tomorrow:

GPT

Gemini

Open Source Models

Future Reasoning Engines

Changing the model should not require redesigning RRAI.

Prompt Architecture isolates AI providers from business architecture.

---

# 3. Prompt Assembly

Every request follows the same sequence.

```
Executive Request

↓

Identify Organisation

↓

Identify Workspace

↓

Identify Capability

↓

Retrieve Knowledge

↓

Retrieve Memory

↓

Retrieve Learning

↓

Retrieve Templates

↓

Build Context

↓

Generate Prompt

↓

Reason

↓

Validate

↓

Respond
```

No capability should bypass this process.

---

# 4. Prompt Layers

Every prompt consists of ten layers.

Layer 1

System Behaviour

↓

Layer 2

Architecture Rules

↓

Layer 3

Organisation Context

↓

Layer 4

Workspace Context

↓

Layer 5

Capability Context

↓

Layer 6

Knowledge

↓

Layer 7

Memory

↓

Layer 8

Learning

↓

Layer 9

Conversation

↓

Layer 10

Executive Request

Each layer has a distinct responsibility.

---

# 5. Layer One
System Behaviour

Defines permanent behaviour.

Examples

Professional

Evidence Based

Executive Assistant

Transparent

Structured

Respectful

Reasoning Focused

This layer changes rarely.

---

# 6. Layer Two
Architecture Rules

Injects architectural standards.

Examples

Design Principles

Capability Lifecycle

Memory Rules

Learning Rules

Executive Operating System

These ensure every response follows the platform architecture.

---

# 7. Layer Three
Organisation Context

Provides organisational behaviour.

Includes:

Organisation

Products

Services

Terminology

Methodology

Templates

Policies

Writing Style

Objectives

This context is supplied by the Organisation Framework.

---

# 8. Layer Four
Workspace Context

Provides operational context.

Includes:

Workspace

Projects

Objectives

Priorities

Current Activities

Relationships

Recent Decisions

Upcoming Meetings

This layer ensures recommendations remain relevant.

---

# 9. Layer Five
Capability Context

Defines the professional skill.

Each capability contributes:

Purpose

Reasoning Style

Inputs

Expected Outputs

Validation Rules

Learning Behaviour

Capabilities remain reusable.

---

# 10. Layer Six
Knowledge Retrieval

Relevant Knowledge is retrieved dynamically.

Examples

Products

Regulations

Research

Frameworks

Competitors

Customer Information

Internal Documentation

Knowledge retrieval should prioritise relevance rather than quantity.

---

# 11. Layer Seven
Memory Retrieval

Relevant Memory is retrieved.

Retrieval priority:

Current Project

↓

Workspace Memory

↓

Relationship Memory

↓

Organisation Memory

↓

Permanent Memory

↓

Learning Memory

Memory should always support reasoning.

---

# 12. Layer Eight
Learning Retrieval

Relevant Learning is injected.

Examples

Winning proposal structures.

Executive preferences.

Successful implementation methods.

Repeated customer objections.

Learning should improve future recommendations.

---

# 13. Layer Nine
Conversation Context

Conversation provides immediate context.

Includes:

Recent Messages

Clarifications

Attachments

Current Task

Conversation should complement Memory.

Not replace it.

---

# 14. Layer Ten
Executive Request

Only after every previous layer has been assembled should the user's request be processed.

The request should never be interpreted without context.

---

# 15. Context Assembly

The Context Assembly Engine is responsible for preparing information.

Inputs:

Organisation

Workspace

Capability

Knowledge

Memory

Learning

Conversation

Outputs:

Single structured prompt

The AI model should never retrieve context independently.

---

# 16. Capability Prompt Contract

Every capability contributes the same information.

Purpose

Inputs

Context

Reasoning Style

Output Structure

Validation

Learning Behaviour

This ensures consistency.

---

# 17. Prompt Validation

Before submitting to the AI model the Prompt Engine should verify:

Correct Organisation loaded.

Correct Workspace loaded.

Capability identified.

Knowledge retrieved.

Memory retrieved.

Learning retrieved.

Conversation included.

Objectives included.

If validation fails the prompt should be rebuilt.

---

# 18. Response Validation

After reasoning the platform should evaluate:

Was the request answered?

Were objectives considered?

Was Memory used?

Was Learning applied?

Are recommendations actionable?

Is confidence appropriate?

Should new Memory be created?

Should Learning be proposed?

Outputs should satisfy architectural standards before being shown.

---

# 19. Confidence Model

Every response should have an internal confidence score.

Confidence considers:

Knowledge Quality

Memory Quality

Learning Confidence

Context Completeness

Capability Confidence

Evidence Available

Confidence should influence recommendations.

---

# 20. Prompt Versioning

Every prompt definition should include:

Prompt Version

Architecture Version

Capability Version

Compatible AI Models

Organisation Compatibility

Workspace Compatibility

Last Updated

Prompt behaviour should be version controlled.

---

# 21. AI Provider Layer

Prompt Architecture should support multiple AI providers.

Current:

Claude

Future:

GPT

Gemini

Open Source Models

Reasoning Models

Only the provider adapter changes.

The Prompt Architecture remains constant.

---

# 22. Future Direction

Future versions should support:

Dynamic Prompt Optimisation

Automatic Context Selection

Prompt Performance Metrics

Model Selection

Capability Chaining

Multi-Agent Prompt Coordination

Prompt self-improvement through validated Learning.

---

# 23. Relationship to Other Documents

Product Vision explains why RRAI exists.

Executive Operating System defines platform architecture.

Capability Framework defines reasoning responsibilities.

Memory Architecture supplies experience.

Learning Engine supplies improvement.

Prompt Architecture assembles everything required for high-quality reasoning.

---

# Version History

| Version | Date | Description |
|----------|------|-------------|
| 1.0 | June 2026 | Initial Prompt Architecture established. |