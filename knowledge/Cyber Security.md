# Cyber Security Risk Management

**Status:** Governed domain knowledge
**Authority:** Subordinate to the RRAI Master Context and Knowledge Architecture
**Verification state:** Draft — current best understanding; review before citing as authoritative
**Sensitivity:** Public
**Partition:** neutral
**Owner:** Risk Rising
**Last reviewed:** 2026-07-15
**Evidence tier:** current

---

## Cyber Security as a GRC Domain

Cyber security risk management is the application of GRC principles to the identification, assessment, and treatment of information and technology security risks. It is one of the fastest-growing areas of enterprise risk management and, for most organisations, represents a material and growing risk exposure.

Cyber security is not purely a technology problem — it requires governance, policy, process, people, and technology working together. GRC platforms play an increasingly important role in integrating cyber risk into the broader enterprise risk framework.

---

## Key Cyber Security Frameworks

### ISO/IEC 27001 — Information Security Management Systems

ISO 27001 is the most widely adopted international standard for information security. It requires organisations to establish, implement, maintain, and continually improve an Information Security Management System (ISMS). Central to ISO 27001 is a risk-based approach: identify information assets, assess threats and vulnerabilities, treat identified risks, and monitor effectiveness.

Annex A provides 93 controls grouped into four themes:
- Organisational controls (governance, policies, roles)
- People controls (screening, training, disciplinary processes)
- Physical controls (entry controls, equipment security)
- Technological controls (access management, encryption, backups, monitoring)

### NIST Cybersecurity Framework (CSF)

The NIST CSF (v2.0, 2024) organises cyber security activities into six core functions:
- **Govern** — Establish and monitor cyber security risk management strategy and policy.
- **Identify** — Understand assets, business environment, and cyber risk exposure.
- **Protect** — Implement safeguards for critical services.
- **Detect** — Identify cybersecurity events.
- **Respond** — Take action regarding detected incidents.
- **Recover** — Restore capabilities impaired by a cybersecurity incident.

CSF 2.0 adds the Govern function, reinforcing board-level accountability for cyber risk.

### SOC 2 (System and Organisation Controls 2)

SOC 2 is a US auditing framework developed by the AICPA covering service organisation controls. Reports (Type I — design; Type II — operating effectiveness) are commonly used in B2B due diligence. Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, Privacy.

### CIS Controls

The Center for Internet Security's 18 critical security controls provide a prioritised set of actions organisations should take to improve their cyber security posture. Organised into basic, foundational, and organisational controls.

### UK Cyber Essentials

A UK government-backed scheme setting baseline security controls: firewalls, secure configuration, access control, malware protection, and patch management. Required for UK government contract suppliers. Two levels: Cyber Essentials (self-assessment) and Cyber Essentials Plus (independently verified).

---

## Cyber Risk Categories

### External Threat Actors

- **Cyber crime** — Ransomware, business email compromise (BEC), data theft for financial gain.
- **Nation-state actors** — Targeted attacks on critical infrastructure, intellectual property theft, espionage.
- **Hacktivists** — Ideologically motivated attacks: defacement, DDoS, data leaks.

### Internal Threats

- **Malicious insiders** — Employees deliberately exfiltrating data or disrupting systems.
- **Negligent insiders** — Accidental data loss, misconfiguration, falling for phishing.
- **Compromised credentials** — Valid credentials used by attackers after phishing or credential stuffing.

### Technology Risks

- **Unpatched vulnerabilities** — Known exploits not remediated in time.
- **Misconfiguration** — Cloud services, network devices, or applications left with insecure default settings.
- **Third-party and supply chain attacks** — Compromise of software or service providers to attack their customers.
- **AI-related risks** — Data poisoning, model manipulation, abuse of AI-generated content.

---

## Cyber Risk Assessment

Cyber risk assessments identify information assets (data, systems, processes), assess threats and vulnerabilities, and determine risk exposure. Methods include:

- **Qualitative risk assessment** — Likelihood × impact matrices aligned to the enterprise risk framework.
- **Threat modelling** — Structured analysis of attack vectors for specific systems or processes.
- **Vulnerability scanning and penetration testing** — Technical identification of weaknesses.
- **Red team exercises** — Simulated attacks to test detection and response capabilities.

---

## Cyber Incident Response

### Incident Response Lifecycle

1. **Preparation** — Policies, plans, playbooks, team roles, tools.
2. **Detection and Analysis** — Monitoring, alert triage, incident classification.
3. **Containment** — Isolating affected systems to prevent further spread.
4. **Eradication** — Removing malware, revoking compromised credentials, patching vulnerabilities.
5. **Recovery** — Restoring systems from clean backups, validating integrity.
6. **Lessons Learned** — Post-incident review, root cause analysis, control improvements.

### Regulatory Notification Obligations

Many regulations require timely notification of significant cyber incidents:
- **UK GDPR / ICO** — Personal data breaches reported within 72 hours where rights/freedoms risk.
- **NIS2 (EU)** — Significant incidents within 24 hours (initial warning) and 72 hours (detailed report).
- **DORA** — Major ICT incidents reported to the competent authority within defined timescales.
- **FCA** — Material operational incidents affecting the integrity of the firm's services.

---

## Cyber Security in GRC Programmes

Integrating cyber risk into the enterprise GRC framework:

- Cyber risks appear on the enterprise risk register alongside operational, financial, and strategic risks.
- Information security policies are managed through the policy management system.
- Third-party cyber risk is assessed through the TPRM programme.
- Internal audit includes technology and cyber audits in the annual plan.
- The CISO/security function works with the second-line risk function to agree risk appetite and KRIs.

LogicGate Risk Cloud supports cyber risk management through: risk registers with cyber risk taxonomy, ISMS management, vulnerability tracking, incident management, and TPRM modules.

---

## Common Cyber Security GRC Challenges

- Cyber risk treated as IT's problem — not integrated with enterprise risk management.
- Risk assessments completed once and not updated as the threat landscape evolves.
- Patching processes not linked to risk management — critical patches deprioritised.
- Incident response plans tested in theory but not in practice.
- TPRM not assessing third-party cyber risk adequately.
- Audit findings on security not linked to the risk register.
- Board-level cyber risk reporting too technical or too vague.
