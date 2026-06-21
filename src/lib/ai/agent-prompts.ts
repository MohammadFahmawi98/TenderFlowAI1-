import { complete } from "./provider";

const FM_SYSTEM = `You are a senior FM (Facility Management) bid director at Etihad International Hospitality (EIH), a leading UAE hospitality FM company.
You produce professional, submission-ready bid content for FM tenders in the UAE/GCC market.

FORMATTING RULES — follow these exactly:
- Use ALL-CAPS lines for section headings (e.g. “COMPLIANCE MATRIX”, “STAFFING PLAN”)
- Use proper markdown tables for all tabular data: | Column | Column | Column |
  Always include a separator row: |--------|--------|--------|
  Every table row must start and end with |
- Use **bold** for emphasis within text
- Use bullet lists with - for items
- Be specific and quantified — include AED amounts, headcounts, percentages, timelines
- Do NOT include meta-commentary, preambles, or “Here is the...” phrases
- Write as if this is the final submission document`;

export interface ExtractionContext {
  tender_name: string;
  client_name: string;
  scope_of_work: string;
  technical_requirements: string[];
  commercial_requirements: string[];
  evaluation_criteria: string[];
  staffing_requirements: string[];
  asset_information: string[];
  deadline?: string;
  contract_duration?: string;
  boq_summary?: string;
}

// â”€â”€ Intelligence Briefing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateIntelligence(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Tender Intelligence Briefing for this FM opportunity.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Technical Requirements: ${ctx.technical_requirements.join("; ")}
Evaluation Criteria: ${ctx.evaluation_criteria.join("; ")}
Contract Duration: ${ctx.contract_duration ?? "As per tender"}

Produce a strategic intelligence brief with:
1. TENDER OVERVIEW â€” contract type, value estimate, strategic importance
2. CLIENT INTELLIGENCE â€” client profile, procurement history, key decision-makers, known preferences
3. COMPETITIVE LANDSCAPE â€” likely competitors, their strengths/weaknesses, our positioning
4. MARKET CONTEXT â€” current UAE FM market conditions, pricing trends, labour costs
5. STRATEGIC OPPORTUNITY ASSESSMENT â€” why we should/should not bid, our differentiators
6. KEY SUCCESS FACTORS â€” top 5 factors that will win this tender
7. INTELLIGENCE GAPS â€” information we still need before submitting
8. RECOMMENDED BID STRATEGY

Be specific to UAE/GCC FM market dynamics and Etihad International Hospitality's positioning.`,
    maxTokens: 3000,
  });
}

// â”€â”€ Qualification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateQualification(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Go/No-Go Qualification Assessment for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Technical Requirements: ${ctx.technical_requirements.join("; ")}
Evaluation Criteria: ${ctx.evaluation_criteria.join("; ")}

Produce a professional qualification assessment with these sections:
1. EXECUTIVE RECOMMENDATION (Go / No-Go / Conditional Go)
2. ELIGIBILITY ASSESSMENT (legal, financial, technical)
3. QUALIFICATION MATRIX (table of requirements vs. our capability)
4. KEY RISKS & MITIGATIONS
5. RECOMMENDED STRATEGY

Format as professional business document text.`,
    maxTokens: 3000,
  });
}

// â”€â”€ Compliance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateCompliance(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Compliance Matrix and Submission Checklist for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Technical Requirements: ${ctx.technical_requirements.join("; ")}
Commercial Requirements: ${ctx.commercial_requirements.join("; ")}
Evaluation Criteria: ${ctx.evaluation_criteria.join("; ")}

Produce:

COMPLIANCE MATRIX

| Requirement | Our Response | Status | Reference Document |
|-------------|--------------|--------|-------------------|
(list all technical and commercial requirements from the tender)

SUBMISSION CHECKLIST

| Document | Status | Notes |
|----------|--------|-------|
(list all required submission documents)

MISSING DOCUMENTS REPORT

List any documents that still need to be prepared, with owner and due date.`,
    maxTokens: 3000,
  });
}

// â”€â”€ Technical Proposal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateTechnicalProposal(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a comprehensive Technical Proposal for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Technical Requirements: ${ctx.technical_requirements.join("; ")}
Asset Information: ${ctx.asset_information.join("; ")}
Staffing Requirements: ${ctx.staffing_requirements.join("; ")}
Contract Duration: ${ctx.contract_duration ?? "As per tender"}

Write a full Technical Proposal with these sections:
1. EXECUTIVE SUMMARY
2. UNDERSTANDING OF SCOPE
3. TECHNICAL APPROACH & METHODOLOGY
4. SERVICE DELIVERY MODEL
5. OPERATIONAL STRATEGY
6. METHOD STATEMENTS (for key service lines)
7. QUALITY MANAGEMENT APPROACH
8. TECHNOLOGY & INNOVATION
9. TRANSITION & MOBILIZATION PLAN
10. KEY PERFORMANCE INDICATORS

This must be submission-ready, specific to FM, and tailored to the client's requirements.`,
    maxTokens: 4000,
  });
}

// â”€â”€ Commercial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateCommercial(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Commercial Proposal framework for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Commercial Requirements: ${ctx.commercial_requirements.join("; ")}
Contract Duration: ${ctx.contract_duration ?? "As per tender"}
Staffing Requirements: ${ctx.staffing_requirements.join("; ")}
${ctx.boq_summary ? `\n${ctx.boq_summary}\n` : ""}
Produce:
1. PRICING STRATEGY & APPROACH
2. COST STRUCTURE BREAKDOWN (Labour / Materials / Overhead / Profit)
3. BOQ ANALYSIS SUMMARY (line items with indicative costs in AED — use the BOQ SUMMARY above if provided)
4. COMMERCIAL ASSUMPTIONS & QUALIFICATIONS
5. PAYMENT TERMS RECOMMENDATION
6. VALUE ENGINEERING OPPORTUNITIES

Be specific with AED cost ranges based on UAE FM market rates.`,
    maxTokens: 3500,
  });
}

// â”€â”€ Manpower â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateManpower(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Manpower Plan for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Staffing Requirements: ${ctx.staffing_requirements.join("; ")}
Contract Duration: ${ctx.contract_duration ?? "As per tender"}

Produce:

ORGANIZATIONAL STRUCTURE

Describe the reporting hierarchy (FM Manager → Supervisors → Technicians → Support).

STAFFING PLAN

| Role | Headcount | Qualifications Required | Monthly Cost (AED) | Responsibilities |
|------|-----------|------------------------|-------------------|-----------------|
(include all roles with realistic UAE FM market salaries)

KEY PERSONNEL PROFILES

For FM Manager, Lead Supervisor, and Senior Technician: name the profile, experience level, certifications (e.g. BIFM, ISO 45001), responsibilities.

SHIFT MATRIX

| Shift | Hours | Days | Roles Covered | Headcount |
|-------|-------|------|---------------|-----------|
(day/night/weekend/public holiday coverage)

MOBILIZATION TIMELINE

| Phase | Week | Activity | Deliverable |
|-------|------|----------|-------------|
(weeks 1–12)

TRAINING & DEVELOPMENT PLAN

List mandatory training by role with frequency and certification body.

STAFF RETENTION STRATEGY

Key initiatives for staff retention in UAE FM market.`,
    maxTokens: 3000,
  });
}

// â”€â”€ PPM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generatePPM(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Planned Preventive Maintenance (PPM) Schedule for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Asset Information: ${ctx.asset_information.join("; ")}

Produce:

PPM PHILOSOPHY & APPROACH

Brief paragraph on EIH's PPM methodology (condition-based, CMMS-driven, OEM-aligned).

ASSET REGISTER SUMMARY

| Asset Category | Asset Type | Quantity (Est.) | Criticality | Applicable Standard |
|----------------|-----------|----------------|-------------|-------------------|

MAINTENANCE FREQUENCY MATRIX

| Asset Type | Frequency | Man-Hours/Visit | Annual Man-Hours | Standard/Code |
|-----------|-----------|----------------|-----------------|--------------|
(cover HVAC, electrical, plumbing, fire safety, civil, landscaping, MEP)

ANNUAL PPM SCHEDULE

| Month | Services to be Performed |
|-------|--------------------------|
(all 12 months)

REACTIVE MAINTENANCE RESPONSE TIMES

| Priority | Response Time | Resolution Time | Example |
|----------|--------------|----------------|---------|

SPARE PARTS & MATERIALS STRATEGY

Key principles for spares management, critical stock levels, procurement.

ASSET LIFECYCLE MANAGEMENT

How EIH tracks asset age, plans replacements, and advises clients on CapEx.`,
    maxTokens: 3000,
  });
}

// â”€â”€ Risk â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateRisk(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Risk Register for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}

Produce:

RISK MANAGEMENT APPROACH

Brief paragraph on EIH's risk management philosophy.

RISK REGISTER

| # | Risk Description | Category | Likelihood (1-5) | Impact (1-5) | Score | Owner | Mitigation Action | Residual Risk |
|---|-----------------|----------|-----------------|-------------|-------|-------|------------------|---------------|
(include at least 15 specific FM risks: operational, commercial, HSE, regulatory, staffing, technical, financial)

TOP 5 CRITICAL RISKS

For the 5 highest-scored risks, provide detailed mitigation plans with specific actions, timeline, and responsible party.

OPPORTUNITY REGISTER

| Opportunity | Potential Value | Probability | Action Required |
|-------------|----------------|-------------|----------------|

RISK MONITORING PLAN

How risks will be tracked, reported, and escalated during contract delivery.`,
    maxTokens: 3000,
  });
}

// â”€â”€ HSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateHSE(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate an HSE Plan for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}

Produce:
1. HSE POLICY STATEMENT
2. HSE MANAGEMENT SYSTEM (ISO 45001 aligned)
3. HAZARD IDENTIFICATION & RISK ASSESSMENT APPROACH
4. EMERGENCY RESPONSE PROCEDURES
5. PERMIT TO WORK SYSTEM
6. PPE REQUIREMENTS BY TASK
7. TRAINING MATRIX (by role)
8. HSE KPIs & REPORTING
9. INCIDENT INVESTIGATION PROCEDURE
10. REGULATORY COMPLIANCE (UAE/AD/Dubai authorities)

Reference UAE Labour Law, OSHAD-SF, and relevant authority requirements.`,
    maxTokens: 3000,
  });
}

// â”€â”€ Presentation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generatePresentation(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a PowerPoint Executive Presentation script for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}

Write slide-by-slide content for a 15-slide executive presentation:
SLIDE 1: Cover â€” Tender title, client, our company, date
SLIDE 2: Executive Summary â€” Our value proposition in 3 bullet points
SLIDE 3: Understanding the Client's Vision
SLIDE 4: Our FM Service Approach
SLIDE 5: Technical Solution Overview
SLIDE 6: Our Team & Key Personnel
SLIDE 7: Technology & Innovation
SLIDE 8: Quality & Compliance
SLIDE 9: HSE Excellence
SLIDE 10: Financial Strength & Pricing Approach
SLIDE 11: Past Projects & References (UAE FM experience)
SLIDE 12: Mobilization Timeline
SLIDE 13: Risk Management
SLIDE 14: Why Choose Us â€” Key Differentiators
SLIDE 15: Call to Action & Next Steps

For each slide: TITLE | KEY MESSAGES (3-4 bullets) | SPEAKER NOTES`,
    maxTokens: 3000,
  });
}

// â”€â”€ SLA & KPI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateSLA(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a comprehensive SLA & KPI framework for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Technical Requirements: ${ctx.technical_requirements.join("; ")}
Contract Duration: ${ctx.contract_duration ?? "As per tender"}

Produce:

SERVICE LEVEL AGREEMENT FRAMEWORK

| Priority | Category | Response Time | Resolution Time | Measurement | Penalty for Breach |
|----------|----------|--------------|----------------|-------------|-------------------|
| P1 — Critical | Life safety, total loss of service | 30 min | 4 hours | CMMS timestamp | 2% monthly fee |
| P2 — Urgent | Major impact on operations | 2 hours | 8 hours | CMMS timestamp | 1% monthly fee |
| P3 — Routine | Minor impact | 8 hours | 3 working days | CMMS timestamp | Formal warning |
| P4 — Planned | Scheduled works | As agreed | As agreed | PPM completion rate | Deduction |

KEY PERFORMANCE INDICATORS

| KPI | Target | Measurement Method | Frequency | Consequence of Failure |
|-----|--------|-------------------|-----------|----------------------|
(include at least 12 KPIs covering: PPM completion rate, reactive response, customer satisfaction, energy performance, HSE, staff availability, helpdesk resolution, asset uptime)

PENALTY & INCENTIVE REGIME

Detail the financial penalty structure and any bonus/incentive provisions.

PERFORMANCE REVIEW PROCESS

Monthly, quarterly, and annual review cadence, attendees, agenda, and escalation path.

REPORTING REQUIREMENTS

| Report | Frequency | Format | Recipient | Deadline |
|--------|-----------|--------|-----------|----------|`,
    maxTokens: 3000,
  });
}

// â”€â”€ Executive Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateExecutiveReview(
  ctx: ExtractionContext,
  allOutputs: Record<string, string>,
): Promise<string> {
  const summary = Object.entries(allOutputs)
    .map(([k, v]) => `${k.toUpperCase()}: ${v.slice(0, 300)}...`)
    .join("\n\n");

  return complete({
    system: FM_SYSTEM,
    user: `Generate a Final Executive Review for this FM tender submission.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Deadline: ${ctx.deadline ?? "As specified"}

Agent outputs summary:
${summary}

Produce:
1. SUBMISSION READINESS SCORE (0-100) with justification
2. WIN PROBABILITY ASSESSMENT (0-100%) with reasoning
3. FINAL EXECUTIVE SUMMARY (3 paragraphs)
4. STRENGTHS OF OUR BID (top 5)
5. AREAS NEEDING ATTENTION (top 3 gaps)
6. FINAL GO/NO-GO RECOMMENDATION
7. LAST-MINUTE ACTION ITEMS before submission

Return as JSON:
{
  "readiness_score": number,
  "win_probability": number,
  "executive_summary": "string",
  "strengths": ["array"],
  "gaps": ["array"],
  "recommendation": "go|no-go|conditional",
  "action_items": ["array"],
  "full_report": "string"
}`,
    maxTokens: 3000,
    responseFormat: "json",
  });
}
