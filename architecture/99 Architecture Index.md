# 99 – Architecture Index

Version: 1.0
Status: Navigation
Authority: High
Applies To:
Entire RRAI Repository

---

# Purpose

This document provides a navigation guide to the RRAI Architecture Handbook.

Rather than reading every architectural document for every development task, engineers, AI assistants and future contributors should consult this index to identify the relevant governing documents.

This reduces unnecessary context loading while ensuring architectural compliance.

---

# Architectural Hierarchy

The RRAI architecture is organised into four layers.

```
Architecture

↓

Product

↓

Engineering

↓

Implementation
```

Changes should always be evaluated from the top down.

Architecture governs Product.

Product governs Engineering.

Engineering governs Implementation.

Implementation must never redefine Architecture.

---

# Architecture Documents

| No | Document | Purpose |
|----|----------|---------|
|00|Architecture Migration Plan|Transition from legacy architecture|
|01|Product Vision|Defines why RRAI exists|
|02|Executive Operating System|Defines the core operating model|
|03|Design Principles|Defines architectural rules|
|04|Capability Framework|Defines reusable capability architecture|
|05|Workspace Framework|Defines operational context|
|06|Organisation Framework|Defines organisational context|
|07|Memory Architecture|Defines persistent intelligence|
|08|Learning Engine|Defines continuous improvement|
|09|Prompt Architecture|Defines context assembly|
|10|Domain Model & Data Architecture|Defines business objects|
|11|Database Principles|Defines persistence philosophy|
|12|Technical Architecture & Persistence|Defines implementation layers|
|13|Security & Governance|Defines trust and governance|
|14|API & Integration Architecture|Defines communication|
|15|Product Roadmap|Defines strategic evolution|
|16|Capability Development Standard|Defines capability engineering standard|
|17|AI Reasoning & Decision Architecture|Defines reasoning lifecycle|
|99|Architecture Index|Navigation guide|

---

# If You Are...

## Adding a New Capability

Read:

01 Product Vision

02 Executive Operating System

03 Design Principles

04 Capability Framework

09 Prompt Architecture

16 Capability Development Standard

17 AI Reasoning & Decision Architecture

---

## Modifying Memory

Read:

07 Memory Architecture

08 Learning Engine

10 Domain Model

11 Database Principles

17 AI Reasoning & Decision Architecture

---

## Modifying Learning

Read:

07 Memory Architecture

08 Learning Engine

17 AI Reasoning & Decision Architecture

---

## Creating a Workspace

Read:

02 Executive Operating System

05 Workspace Framework

06 Organisation Framework

10 Domain Model

---

## Supporting a New Organisation

Read:

06 Organisation Framework

05 Workspace Framework

09 Prompt Architecture

13 Security & Governance

---

## Building Executive Dashboards

Read:

02 Executive Operating System

05 Workspace Framework

12 Technical Architecture

Product Specification

---

## Building User Interface

Read:

05 Workspace Framework

12 Technical Architecture

Product Specification

Engineering Standards

---

## Modifying Prompt Behaviour

Read:

09 Prompt Architecture

07 Memory Architecture

08 Learning Engine

17 AI Reasoning & Decision Architecture

---

## Creating Knowledge Pipelines

Read:

04 Capability Framework

07 Memory Architecture

08 Learning Engine

11 Database Principles

12 Technical Architecture

---

## Building Search

Read:

07 Memory Architecture

10 Domain Model

11 Database Principles

12 Technical Architecture

17 AI Reasoning & Decision Architecture

---

## Building APIs

Read:

12 Technical Architecture

13 Security & Governance

14 API & Integration Architecture

---

## Modifying Database

Read:

10 Domain Model

11 Database Principles

12 Technical Architecture

Never modify the schema without first reviewing the Domain Model.

---

## Working on Security

Read:

13 Security & Governance

12 Technical Architecture

14 API & Integration Architecture

---

## Adding Integrations

Read:

12 Technical Architecture

13 Security & Governance

14 API & Integration Architecture

---

## Creating AI Agents

Read:

02 Executive Operating System

04 Capability Framework

08 Learning Engine

09 Prompt Architecture

16 Capability Development Standard

17 AI Reasoning & Decision Architecture

---

## Creating Product Features

Read:

Architecture Handbook

↓

Relevant Product Specification

↓

Engineering Standards

↓

Implementation Documents

Architecture should never be bypassed.

---

# Repository Structure

```
architecture/

product/              ← 00_RRAI_Product_Philosophy (highest product authority)
                         01_RRAI_Product_Principles
                         02_RRAI_Executive_Workbench
                         remaining product documents (conform to all three above)

capabilities/

knowledge/

engineering/

implementation/

templates/

prompts/

```

Each directory has a specific responsibility.

---

# Development Workflow

Every feature follows the same process.

```
Architecture

↓

Product Specification

↓

Engineering Design

↓

Implementation

↓

Testing

↓

Validation

↓

Release
```

Development should never begin from implementation.

---

# Golden Rules

Before making any change ask:

Does this align with the Product Vision?

Does it preserve the Executive Operating System?

Does it follow the Design Principles?

Does it fit the Capability Framework?

Does it improve Memory?

Does it improve Learning?

Is it secure?

Is it reusable?

Is it measurable?

If the answer is "No", stop and redesign.

---

# Architecture Status

Current Version

Architecture Handbook v1.0

Status

Approved

Frozen

Architecture changes should be rare.

Future development should primarily occur within:

Product Specifications

Capability Specifications

Engineering Standards

Implementation

The architecture provides the stable foundation upon which the platform evolves.

---

# Version History

| Version | Date | Description |
|----------|------|-------------|
|1.0|June 2026|Initial Architecture Index created.|