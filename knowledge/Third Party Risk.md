# Third-Party Risk Management (TPRM)

**Status:** Governed domain knowledge
**Authority:** Subordinate to the RRAI Master Context and Knowledge Architecture
**Verification state:** Draft — current best understanding; review before citing as authoritative
**Sensitivity:** Public
**Partition:** neutral
**Owner:** Risk Rising
**Last reviewed:** 2026-07-15
**Evidence tier:** current

---

## What is TPRM?

Third-Party Risk Management (TPRM), also known as Vendor Risk Management (VRM) or Supplier Risk Management, is the discipline of identifying, assessing, monitoring, and mitigating risks introduced to an organisation through its relationships with external parties — including vendors, suppliers, contractors, subcontractors, and other business partners.

As organisations rely increasingly on third parties for critical services — including cloud infrastructure, software, data processing, and professional services — TPRM has become a core enterprise risk discipline and a regulatory expectation across most regulated industries.

---

## Why TPRM Matters

- **Regulatory mandates** — DORA (EU), NIS2 (EU), FCA outsourcing rules (UK), and sector-specific requirements mandate formal third-party risk programmes.
- **Data exposure** — Third parties frequently process or have access to sensitive organisational data, creating privacy and security risk.
- **Operational dependency** — Critical service failures at a third party can directly impact the organisation's own operations and customers.
- **Reputational risk** — Third-party misconduct (ethical, financial, environmental) can reflect on the contracting organisation.
- **Concentration risk** — Over-reliance on a single vendor or a small group creates systemic vulnerability.

---

## TPRM Programme Components

### Vendor Inventory and Classification

The first step in any TPRM programme is maintaining a complete, current inventory of all third-party relationships, classified by:

- **Criticality** — Impact on operations if the vendor fails or is compromised.
- **Risk tier** — Based on data access, regulatory scope, financial exposure, and operational dependency. Common tiers: Critical (Tier 1), Important (Tier 2), Standard (Tier 3), Low (Tier 4).
- **Category** — IT/software, data processing, professional services, facilities, logistics, etc.

Classification drives the depth of due diligence and the frequency of ongoing monitoring.

### Due Diligence (Onboarding Assessment)

Due diligence is conducted before a new third-party relationship is established, scaled to the risk tier:

- **Security posture** — Penetration testing, vulnerability management, access controls, encryption, incident response.
- **Financial stability** — Credit checks, financial statements, insurance coverage.
- **Regulatory compliance** — Certifications held (ISO 27001, SOC 2, PCI DSS), regulatory licences.
- **Business continuity** — BCP/DR plans, RTO/RPO commitments, geographic concentration.
- **Sub-processor management** — Fourth-party exposure (does the vendor itself rely on critical third parties?).
- **Data protection** — GDPR compliance, data handling agreements, data residency.
- **Ethical and ESG** — Labour practices, environmental policies, sanctions and PEP screening.

### Contractual Protections

Contracts with third parties should include:
- Right to audit clauses.
- Security and data protection obligations.
- Incident notification requirements (timing and scope).
- Business continuity and disaster recovery obligations.
- Sub-contracting restrictions or notification requirements.
- Termination rights in the event of breach or regulatory non-compliance.

### Ongoing Monitoring

Due diligence at onboarding becomes stale quickly. Ongoing monitoring includes:
- Periodic reassessment aligned to risk tier (Critical: annual or more frequent; Standard: every 2–3 years).
- Continuous monitoring tools — threat intelligence feeds, dark web monitoring, news and adverse media.
- Financial health monitoring for critical vendors.
- Review of audit reports (SOC 2 Type II, ISO 27001 surveillance audits).
- Tracking of reported incidents and remediation.

### Offboarding

When a third-party relationship ends, risk does not automatically end. Offboarding includes:
- Data return or destruction confirmation.
- Access revocation across all systems.
- Post-termination obligations review.
- Lessons-learned capture for future assessments.

---

## Key Risk Domains in TPRM

### Cyber and Information Security Risk

The most frequently cited TPRM risk. Covers: data breaches caused by vendor access; supply chain attacks (malicious software components); failure to patch or maintain vendor systems; vendor employee behaviour.

### Operational Risk

Vendor failure, service outage, or quality failure that disrupts organisational operations. Most critical for vendors providing infrastructure, SaaS platforms, or BPO services.

### Concentration Risk

Over-reliance on a single vendor, technology platform, geographic region, or data centre creates systemic risk. Regulators increasingly scrutinise concentration risk, particularly in financial services (FCA, PRA, DORA).

### Compliance and Regulatory Risk

Third parties may fail to meet regulatory requirements on the organisation's behalf. Data processing agreements under GDPR must specify responsibilities. Outsourced regulated activities require appropriate oversight.

### Financial and Counterparty Risk

Vendor financial instability can result in service disruption, data loss (if the vendor holds data), or stranded contracts. Critical for long-term or deeply embedded suppliers.

### Reputational and ESG Risk

Third-party involvement in ethical failures (labour violations, environmental harm, fraud) can damage the contracting organisation's reputation. ESG screening is increasingly a TPRM requirement.

---

## TPRM in Regulated Industries

### Financial Services (UK — FCA/PRA)

The FCA and PRA require firms to maintain oversight of material outsourcing arrangements, including cloud services. Key requirements: due diligence, contractual protections, exit strategies, concentration risk management. DORA (EU) extends these obligations across the EU financial sector.

### DORA — Digital Operational Resilience Act (EU)

Effective January 2025, DORA applies to EU financial entities. It requires: ICT third-party risk management policies; contractual requirements; register of ICT third-party arrangements; concentration risk monitoring; oversight of critical ICT third parties. UK firms with EU operations or clients are affected.

### NIS2 Directive (EU)

NIS2 extends cybersecurity obligations to a broader set of entities and their supply chains. Organisations subject to NIS2 must manage supply chain security risks and ensure third parties meet appropriate security standards.

---

## TPRM Tools and Technology

TPRM platforms automate the lifecycle from onboarding questionnaire to ongoing monitoring:

- Vendor questionnaire distribution and response management.
- Risk scoring and tier classification.
- Evidence collection (certificates, reports).
- Remediation tracking.
- Audit trail and reporting.
- Integration with contract management.

LogicGate Risk Cloud's TPRM module (Third Party Risk Management app) supports vendor inventory, tiering, due diligence workflows, ongoing monitoring schedules, and management reporting. Panorays is a specialist third-party cyber risk platform with automated continuous monitoring capabilities — Risk Rising is also a Panorays implementation partner.

---

## Common TPRM Challenges

- No single, complete inventory of all third parties.
- Assessment questionnaires not maintained or reviewed.
- Due diligence completed at onboarding but not refreshed.
- No continuous monitoring between periodic assessments.
- Inconsistent risk tiering — too many Tier 1 designations, or critical vendors misclassified as low risk.
- Fourth-party risk (vendors of vendors) not assessed.
- Contractual protections not consistently enforced.
- TPRM siloed from procurement — risk assessments happen after commercial commitment.
