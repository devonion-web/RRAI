# Operational Risk

**Status:** Governed domain knowledge
**Authority:** Subordinate to the RRAI Master Context and Knowledge Architecture
**Verification state:** Draft — current best understanding; review before citing as authoritative
**Sensitivity:** Public
**Partition:** neutral
**Owner:** Risk Rising
**Last reviewed:** 2026-07-15
**Evidence tier:** current

---

## What is Operational Risk?

Operational risk is the risk of loss resulting from inadequate or failed internal processes, people, and systems, or from external events. This definition originates from the Basel II/III framework and is now widely adopted across all sectors.

Operational risk is distinct from credit risk and market risk. It is inherent in every business activity: a manual process can fail, a system can be breached, a supplier can fail to deliver, a natural disaster can disrupt operations, or a member of staff can make an error or commit fraud.

---

## Operational Risk Categories

The most widely used categorisation, derived from Basel, covers seven event types:

1. **Internal Fraud** — Misappropriation of assets, tax evasion, intentional mismarking, bribery.
2. **External Fraud** — Theft, forgery, cheque kiting, computer hacking by external parties.
3. **Employment Practices and Workplace Safety** — Compensation claims, employee relations violations, workplace injury.
4. **Clients, Products, and Business Practices** — Market manipulation, unsuitable advice, fiduciary breaches, product flaws.
5. **Damage to Physical Assets** — Natural disasters, terrorism, vandalism.
6. **Business Disruption and System Failures** — Hardware, software, or utility failures that disrupt business operations.
7. **Execution, Delivery, and Process Management** — Errors in transaction processing, data management, vendor relations, regulatory reporting.

Some organisations extend this taxonomy to add technology/cyber risk as a distinct eighth category, given its growing prominence and regulatory focus.

---

## Operational Risk Management Framework

### Governance

The board approves the operational risk management framework and sets the operational risk appetite. The second-line operational risk function designs and maintains the framework; the first line owns and manages operational risk day-to-day.

### Risk and Control Self-Assessment (RCSA)

RCSAs are the cornerstone of operational risk management. Business units identify operational risks inherent in their processes, assess the quality of their controls, and determine residual risk exposure. RCSAs are typically annual, refreshed at significant change.

### Key Risk Indicators (KRIs)

Operational KRIs provide early warning of rising risk. Examples:
- IT: number of overdue patch cycles, failed change deployments, system downtime hours.
- People: staff turnover in critical roles, overdue mandatory training completions.
- Process: error rates in transaction processing, number of exceptions to standard procedures.

### Loss Event Data and Near-Miss Reporting

Recording actual operational losses and near misses builds a data set for root cause analysis and informs control improvements. Loss data contributes to quantitative risk modelling in banks and insurers under Basel/Solvency II.

### Scenario Analysis

Scenario analysis explores low-frequency, high-impact operational risks not captured by historical loss data. Scenarios are developed by risk managers with subject-matter experts and used to stress-test the control environment.

---

## Business Continuity Management (BCM)

Business Continuity Management is a subset of operational risk management focused on maintaining critical operations during and after a disruption.

### Business Impact Analysis (BIA)

A BIA identifies the organisation's critical processes and services, determines the impact of their disruption over time, and sets recovery objectives:

- **Recovery Time Objective (RTO)** — The maximum acceptable time from disruption to recovery.
- **Recovery Point Objective (RPO)** — The maximum acceptable data loss, expressed as a time period.
- **Maximum Tolerable Period of Disruption (MTPD)** — The point beyond which the organisation cannot recover to its pre-disruption state.

### Business Continuity Plans (BCPs)

BCPs document how critical processes will continue during a disruption: alternative locations, backup systems, contact trees, key dependencies, and step-by-step recovery procedures. Plans must be tested — a BCP that is never tested cannot be relied upon.

### Disaster Recovery (DR)

DR is the technology dimension of BCM — restoring IT systems and data after a failure. DR plans complement BCPs and must be aligned to the same RTO/RPO commitments.

### Crisis Management

Crisis management covers the organisational response to a major incident: decision-making authority, communication protocols (internal and external), media management, and regulatory notification.

---

## Operational Risk in GRC Technology

Operational risk management generates significant data (RCSA assessments, KRI measurements, loss events, near misses, BCP records) that benefits from a platform approach:

- Centralised risk and control library.
- Automated KRI reporting.
- Loss event capture and categorisation.
- RCSA workflow management.
- BCM plan storage and testing schedules.
- Issue and action management.

LogicGate Risk Cloud supports operational risk programmes through configurable RCSA, KRI, loss event, and incident management apps.

---

## Operational Risk in Regulated Sectors

### Financial Services — Basel Framework

Banks and financial institutions quantify operational risk capital under Basel II/III using one of three approaches: Basic Indicator Approach, Standardised Approach, or Advanced Measurement Approach (AMA). Under Basel IV (implementation underway), the Standardised Measurement Approach replaces the AMA.

### Insurance — Solvency II

EU insurers calculate operational risk capital under the Solvency II standard formula or internal models. Strong operational risk management practices can influence capital requirements.

### All Regulated Sectors

UK FCA and PRA supervised firms have operational resilience obligations requiring them to identify Important Business Services, set impact tolerances, and demonstrate they can remain within those tolerances during severe but plausible scenarios.

---

## Common Operational Risk Challenges

- RCSAs completed annually but not used for ongoing decision-making.
- KRI thresholds set without data, never adjusted.
- Loss events under-reported due to cultural barriers or fear of blame.
- BCPs documented but never tested; plans out of date after organisational change.
- Operational risk data siloed from compliance and audit — no integrated view.
- Scenario analysis treated as a compliance exercise rather than a genuine risk tool.
- No clear escalation path for KRI breaches.
