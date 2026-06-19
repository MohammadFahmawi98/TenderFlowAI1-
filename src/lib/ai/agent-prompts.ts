import { complete } from "./provider";

const FM_SYSTEM = `You are a specialist FM (Facility Management) bid consultant working for Etihad International Hospitality.
You produce professional, detailed, submission-ready content for FM tenders in the UAE/GCC market.
Write in clear business English. Be specific, quantified, and professional.
Return only the requested content — no meta-commentary.`;

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
}

// ── Qualification ────────────────────────────────────────────────────────────
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
    maxTokens: 2000,
  });
}

// ── Compliance ───────────────────────────────────────────────────────────────
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
1. COMPLIANCE MATRIX — for each requirement state: Requirement | Our Response | Compliance Status (Fully/Partially/Non-Compliant) | Reference Document
2. SUBMISSION CHECKLIST — all documents required for submission with status
3. MISSING DOCUMENTS REPORT — items that need to be prepared

Format as structured professional content.`,
    maxTokens: 2500,
  });
}

// ── Technical Proposal ───────────────────────────────────────────────────────
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

// ── Commercial ───────────────────────────────────────────────────────────────
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

Produce:
1. PRICING STRATEGY & APPROACH
2. COST STRUCTURE BREAKDOWN (Labour / Materials / Overhead / Profit)
3. BOQ ANALYSIS SUMMARY (line items with indicative costs in AED)
4. COMMERCIAL ASSUMPTIONS & QUALIFICATIONS
5. PAYMENT TERMS RECOMMENDATION
6. VALUE ENGINEERING OPPORTUNITIES

Be specific with AED cost ranges based on UAE FM market rates.`,
    maxTokens: 2500,
  });
}

// ── Manpower ─────────────────────────────────────────────────────────────────
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
1. ORGANIZATIONAL CHART (describe hierarchy in text)
2. STAFFING PLAN — role | headcount | qualifications | responsibilities
3. KEY PERSONNEL PROFILES (FM Manager, Supervisors, Technicians)
4. SHIFT MATRIX (day/night/weekend coverage)
5. MOBILIZATION TIMELINE (Month 1-3)
6. TRAINING & DEVELOPMENT PLAN
7. STAFF RETENTION STRATEGY

Tailor to UAE FM industry standards and Labour Law requirements.`,
    maxTokens: 2500,
  });
}

// ── PPM ──────────────────────────────────────────────────────────────────────
export async function generatePPM(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Planned Preventive Maintenance (PPM) Schedule for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}
Asset Information: ${ctx.asset_information.join("; ")}

Produce:
1. PPM PHILOSOPHY & APPROACH
2. ASSET REGISTER SUMMARY (by system: MEP, Civil, Landscaping, etc.)
3. MAINTENANCE FREQUENCY MATRIX — Asset | Frequency | Manhours | Standard
4. ANNUAL PPM SCHEDULE OVERVIEW (by month)
5. REACTIVE MAINTENANCE RESPONSE TIMES
6. SPARE PARTS & MATERIALS STRATEGY
7. ASSET LIFECYCLE MANAGEMENT

Reference UAE/DEWA/ADDC standards and OEM recommendations.`,
    maxTokens: 2500,
  });
}

// ── Risk ─────────────────────────────────────────────────────────────────────
export async function generateRisk(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a Risk Register for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}

Produce:
1. RISK MANAGEMENT APPROACH
2. RISK REGISTER TABLE — Risk | Category | Likelihood (1-5) | Impact (1-5) | Score | Owner | Mitigation | Residual Risk
   Include at least 15 specific FM risks covering: operational, commercial, HSE, regulatory, staffing, technical
3. TOP 5 CRITICAL RISKS (detailed mitigation plans)
4. OPPORTUNITY REGISTER
5. RISK MONITORING PLAN

Use UAE FM market context.`,
    maxTokens: 2500,
  });
}

// ── HSE ──────────────────────────────────────────────────────────────────────
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
    maxTokens: 2500,
  });
}

// ── Presentation ─────────────────────────────────────────────────────────────
export async function generatePresentation(ctx: ExtractionContext): Promise<string> {
  return complete({
    system: FM_SYSTEM,
    user: `Generate a PowerPoint Executive Presentation script for this FM tender.

Tender: ${ctx.tender_name}
Client: ${ctx.client_name}
Scope: ${ctx.scope_of_work}

Write slide-by-slide content for a 15-slide executive presentation:
SLIDE 1: Cover — Tender title, client, our company, date
SLIDE 2: Executive Summary — Our value proposition in 3 bullet points
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
SLIDE 14: Why Choose Us — Key Differentiators
SLIDE 15: Call to Action & Next Steps

For each slide: TITLE | KEY MESSAGES (3-4 bullets) | SPEAKER NOTES`,
    maxTokens: 3000,
  });
}

// ── Executive Review ─────────────────────────────────────────────────────────
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
    maxTokens: 2000,
    responseFormat: "json",
  });
}
