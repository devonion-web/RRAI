# 00 – Architecture Migration Plan

Version: 1.0
Status: Foundational
Authority: Highest
Audience: Product Owner, Architects, Engineers
Last Updated: June 2026

---

# Purpose

This document explains why the RRAI Architecture Handbook has been created and how the platform should transition from its existing state into the new architecture.

It is intended to guide every future development decision.

Unlike the other architecture documents, this document is transitional.

Once the migration has been completed, this document becomes historical reference.

---

# Background

RRAI began as a collection of AI prompts, Claude Projects, knowledge files and experiments intended to support executive work within Risk Rising.

As the platform evolved, additional capabilities were added, including:

- Executive support
- Opportunity intelligence
- Marketing assistance
- Proposal generation
- Research
- Knowledge management
- Meeting intelligence
- AI orchestration

These capabilities proved valuable but were developed organically.

Over time the architecture became increasingly fragmented.

Knowledge was duplicated.

Prompts became inconsistent.

Capabilities became tightly coupled.

Context became difficult to manage.

Future scalability became uncertain.

Rather than continuing to extend the original design, a new architectural foundation has been created.

---

# Why Change?

The previous approach was successful for experimentation.

It is not suitable for building an enterprise software platform.

The objectives of the migration are to:

• Create a permanent product architecture.

• Separate business architecture from implementation.

• Standardise capabilities.

• Introduce structured Memory.

• Introduce continuous Learning.

• Enable multiple Organisations.

• Enable multiple Executive roles.

• Support multiple AI providers.

• Allow future growth without redesign.

---

# Product Vision

The migration changes RRAI from:

An AI assistant

into

An Executive AI Operating System.

The platform becomes responsible for:

Thinking

Remembering

Learning

Coordinating

Executing

Improving

rather than simply responding to prompts.

---

# Migration Principles

The migration should follow five principles.

## Preserve Existing Intellectual Property

Existing knowledge should not be rewritten unnecessarily.

Instead it should be classified and reorganised.

Examples include:

Claude Project files

Knowledge documents

Prompt libraries

Templates

Research

Methodologies

Delivery documentation

Everything should find a permanent architectural home.

---

## Architecture Before Development

No new capability should be developed before its architectural location is understood.

Every feature must belong to:

Organisation

Workspace

Capability

Knowledge

Memory

Learning

If this cannot be determined, development should pause until the architecture is clarified.

---

## Separate Product From Technology

The Product Architecture should remain independent from:

Programming languages

Frameworks

Databases

AI providers

Cloud platforms

Technology may change.

The product should not.

---

## Configuration Before Customisation

Future organisations should be supported through configuration.

Examples:

Risk Rising

LogicGate

Customer Organisations

Future Ventures

Configuration replaces bespoke development.

---

## Continuous Evolution

The migration is not a one-time project.

Architecture will evolve.

Capabilities will evolve.

Knowledge will evolve.

Memory will grow.

Learning will compound.

The Executive Operating System should remain stable throughout.

---

# Migration Strategy

Migration occurs in five phases.

---

## Phase One

Architecture

Create the Architecture Handbook.

Deliverables include:

Product Vision

Executive Operating System

Design Principles

Capability Framework

Workspace Framework

Organisation Framework

Memory Architecture

Learning Engine

Prompt Architecture

Domain Model

Database Principles

Technical Architecture

Security

Integration Architecture

Roadmap

Outcome:

A stable architectural foundation.

---

## Phase Two

Knowledge Migration

Review every existing Claude Project.

Review every knowledge file.

Review every prompt.

Review every template.

Classify each asset.

Assign every asset to:

Knowledge

Capability

Template

Organisation

Workspace

Prompt

Archive

No content should remain unclassified.

---

## Phase Three

Platform Refactoring

Refactor the software to align with the architecture.

Objectives:

Introduce Workspaces.

Introduce Organisation Packs.

Introduce Capability Registry.

Introduce Memory.

Introduce Learning.

Introduce Knowledge Repository.

Replace hard-coded logic.

Outcome:

Architecture-driven platform.

---

## Phase Four

Capability Migration

Move existing capabilities into the new framework.

Examples:

Research

Proposal Generation

Marketing

Meeting Intelligence

Sales Intelligence

Decision Support

Presentation Generation

Relationship Intelligence

Every capability should follow the Capability Framework.

---

## Phase Five

Continuous Improvement

After migration:

Every improvement should follow the architecture.

Every capability contributes Learning.

Every Workspace accumulates Memory.

Every Organisation develops intelligence.

The architecture becomes self-improving.

---

# Repository Structure

The repository should eventually contain:

```
architecture/
product/
engineering/
capabilities/
knowledge/
templates/
prompts/
implementation/
```

Each folder has a distinct purpose.

---

# Success Criteria

The migration is complete when:

The platform follows the Executive Operating System.

Every capability follows the Capability Framework.

Every Organisation is configurable.

Every Workspace operates independently.

Memory persists across conversations.

Learning improves future behaviour.

Prompt architecture is standardised.

Technology is replaceable.

Development follows architecture.

---

# Governance

Any future architectural change should answer:

Does this align with the Product Vision?

Does it preserve the Executive Operating System?

Does it comply with the Design Principles?

Does it strengthen Memory?

Does it improve Learning?

Does it remain reusable?

If not, the change should be reconsidered.

---

# Relationship to Other Documents

This document explains how RRAI transitions to the new architecture.

The remaining documents define the architecture itself.

Once migration is complete, this document becomes the historical record of that transition.

---

# Version History

| Version | Date | Description |
|----------|------|-------------|
| 1.0 | June 2026 | Initial Architecture Migration Plan created. |