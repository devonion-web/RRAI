# RRAI Constitution

Version: 1.0
Status: Governing Document
Authority: Absolute

---

# Purpose

This document defines how RRAI is designed, built, evolved and maintained.

It is the governing document for the entire repository.

Every architectural decision, product decision and engineering decision should align with this constitution.

The purpose of this document is not to describe features.

Its purpose is to define the philosophy and hierarchy that every future contribution must respect.

---

# Vision

RRAI is an Executive AI Operating System.

It is not:

• A chatbot

• A collection of prompts

• A document generator

• A workflow application

• A dashboard

It is an operating environment that helps executives think, remember, learn, decide and execute.

Everything within the repository exists to support this vision.

---

# The Hierarchy

Every part of the repository follows the same hierarchy.

```
Vision

↓

Architecture

↓

Product

↓

Capabilities

↓

Engines

↓

Engineering

↓

Implementation

↓

Code
```

Lower layers must never redefine higher layers.

---

# Repository Structure

The repository consists of the following areas.

```
architecture/

product/

capabilities/

engines/

engineering/

implementation/

knowledge/

prompts/

templates/
```

Each area has a single responsibility.

---

# Architecture

Architecture defines:

Why the platform exists.

How it operates.

How information flows.

How intelligence is created.

Architecture should rarely change.

Architecture governs everything below it.

---

# Product

Product defines:

Executive experiences.

Executive workflows.

User journeys.

Behaviour.

Interactions.

Screens.

States.

The Product layer explains what executives can accomplish.

---

# Capabilities

Capabilities are reusable business-level AI skills.

Examples:

Research

Writing

Decision Support

Relationship Intelligence

Marketing

Sales Intelligence

Capabilities are orchestrated by the Product layer.

Capabilities are composed of one or more Engines.

---

# Engines

Engines are reusable technical intelligence services.

Examples:

Reasoning

Memory

Learning

Retrieval

Search

Context Assembly

Document Analysis

Output Generation

Engines should never be exposed directly to users.

They provide reusable intelligence services.

---

# Engineering

Engineering defines:

Coding standards.

Testing.

Repository standards.

Performance.

Deployment.

Observability.

Engineering explains how software should be written.

---

# Implementation

Implementation defines:

Database schema.

API specifications.

Workers.

Pipelines.

Integrations.

Caching.

Persistence.

Implementation explains how architecture becomes software.

---

# Knowledge

Knowledge contains business information.

Examples:

Risk Rising

LogicGate

Regulations

Industries

Frameworks

Methodologies

Knowledge informs reasoning.

Knowledge is not architecture.

---

# Prompts

Prompts define interaction with AI models.

Prompts are implementation details.

Prompt quality should improve without affecting architecture.

The platform owns reasoning.

The AI model executes it.

---

# Templates

Templates define reusable outputs.

Examples:

Reports

Presentations

Emails

Briefings

Assessments

Business Cases

Templates separate content from presentation.

---

# Design Philosophy

Every decision should answer:

Does this make the executive's work easier?

If not, reconsider the decision.

---

# Development Philosophy

Development always proceeds in this order.

```
Architecture

↓

Product

↓

Capability

↓

Engine

↓

Engineering

↓

Implementation

↓

Code
```

No code should be written before the corresponding documentation exists.

---

# Golden Rules

Always preserve:

Executive experience.

Architectural consistency.

Reusable capabilities.

Reusable engines.

Persistent memory.

Continuous learning.

Evidence-based reasoning.

Technology independence.

---

# Change Control

Architecture changes should be rare.

Product changes should be deliberate.

Capability improvements should be continuous.

Engine improvements should be measurable.

Engineering improvements should be incremental.

Implementation should remain replaceable.

---

# Long-Term Vision

The repository should eventually become the complete specification of RRAI.

An experienced engineering team should be capable of building the platform entirely from these documents.

The repository should become the single source of truth.

---

# Success

RRAI succeeds when:

Executives rely upon it daily.

Knowledge compounds.

Memory grows.

Learning improves outcomes.

Capabilities become increasingly reusable.

New organisations can be onboarded through configuration rather than redevelopment.

The platform becomes progressively more valuable with every interaction.

---

# Version History

| Version | Date | Description |
|----------|------|-------------|
| 1.0 | July 2026 | Initial RRAI Constitution established. |