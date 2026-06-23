import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { complete } from "@/lib/ai/provider";

export const maxDuration = 90;


const SECTION_META: Record<string, { title: string; icon: string }> = {
  experiences: { title: "Relevant Project Experiences", icon: "work_history" },
  scope:       { title: "Scope of Services & Company Profile", icon: "domain" },
  qhse:        { title: "QHSE Plan", icon: "health_and_safety" },
  technical:   { title: "Technical Proposal", icon: "engineering" },
  tools:       { title: "Tools, Equipment & Technology", icon: "construction" },
  quality:     { title: "Quality Assurance Policies", icon: "verified" },
  references:  { title: "References & Testimonials", icon: "star" },
};

function buildDocPrompt(
  sectionType: string,
  tender: Record<string, unknown>,
  extraction: Record<string, unknown> | null,
  companyCtx: Record<string, string>,
): string {
  const co = companyCtx;
  const companyBlock = Object.keys(co).length
    ? `OUR COMPANY (Etihad International Hospitality — EIH):
Name: ${co.company_name ?? "Etihad International Hospitality (EIH)"}
Founded: ${co.year_founded ?? ""}
Locations: ${co.locations ?? "UAE"}
Headcount: ${co.headcount ?? ""}
Certifications: ${co.certifications ?? ""}
Key Clients: ${co.key_clients ?? ""}
Experience: ${co.experience_summary ?? ""}
Specialisms: ${co.specialisms ?? ""}
Awards: ${co.awards ?? ""}`
    : `OUR COMPANY: Etihad International Hospitality (EIH), a leading UAE-based Integrated Facilities Management company.`;

  const tenderBlock = `TENDER: ${tender.name ?? ""}
CLIENT: ${tender.client ?? ""}
DEADLINE: ${tender.submission_deadline ?? ""}
CONTRACT VALUE: AED ${tender.contract_value?.toLocaleString() ?? "TBD"}
SCOPE: ${extraction?.scope_of_work ?? "Integrated Facilities Management"}
TECHNICAL REQUIREMENTS: ${(extraction?.technical_requirements as string[] | null)?.join("; ") ?? ""}
KEYWORDS: ${extraction?.keywords ?? ""}`;

  const style = `
OUTPUT FORMAT: Produce the section as clean HTML. Use inline CSS only (no external CSS).
EIH brand colours: Maroon #8B3520 (headings, borders), Gold #C8A24A (sub-headings, accents), Body text #333.
Structure: Use <h2> for section title, <h3> for sub-headings, <p> for paragraphs, <table> for tables, <ul>/<li> for lists.
Style headings: style="color:#8B3520; border-bottom:2px solid #C8A24A; padding-bottom:6px; margin-top:24px;"
Style sub-headings: style="color:#C8A24A; margin-top:16px; font-size:15px;"
Style tables: class="proposal-table" with border-collapse:collapse, full width, alternating row shading #f9f5f0
Be professional, specific to the tender, and write at least 400 words per section.
DO NOT include <html>, <head>, or <body> tags — just the inner content.`;

  const prompts: Record<string, string> = {
    experiences: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the "Relevant Project Experiences" section of a technical proposal for this FM tender.
Include 4–6 past EIH projects that are directly relevant to this tender's scope. For each project include:
- Project name, Client, Location, Duration, Contract Value, Scope summary, Staff deployed, Key achievements
Format them as a table followed by a short narrative paragraph.
Conclude with a paragraph tying our experience directly to this tender's requirements.`,

    scope: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the "Scope of Services Offered & Company Profile" section.
Structure:
1. Company Overview — who EIH is, history, UAE presence
2. Our FM Service Lines — Hard Services, Soft Services, Value-Added Services
3. Understanding of This Tender's Scope — specifically address ${extraction?.scope_of_work ?? "the FM requirements"}
4. Our Service Delivery Model — CAFM, help desk, SLA regime
5. Why EIH — 5 key differentiators
Make it client-facing and persuasive.`,

    qhse: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite a comprehensive "QHSE Plan" (Quality, Health, Safety & Environment) section.
Structure:
1. QHSE Policy Statement
2. Legal & Regulatory Compliance (UAE Labour Law, OSHAD, Dubai/Ajman municipality requirements)
3. Health & Safety Management System (risk assessments, toolbox talks, PPE, permit-to-work)
4. Environmental Management (waste management, energy efficiency, sustainability commitments)
5. Emergency Response & Incident Reporting procedure
6. QHSE KPIs and Monitoring (monthly safety audits, LTI rate target, near-miss reporting)
7. Training & Competency (induction, periodic QHSE training schedule)
Be specific and include measurable targets.`,

    technical: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the main "Technical Proposal" narrative section.
Structure:
1. Executive Summary (3 paragraphs: our understanding, our approach, our commitment)
2. Understanding of the Project — demonstrate we have read the RFP; address ${extraction?.scope_of_work ?? "the scope"} specifically
3. Technical Approach & Methodology — how we will deliver Hard Services, Soft Services, and any specialised scope; CAFM system; PPM programme
4. Service Transition & Mobilisation Plan — 30/60/90 day plan, key milestones
5. Technology & Innovation — CAFM, IoT sensors, energy monitoring, CMMS
6. Added Value — what extras EIH brings beyond the basic requirement
7. Conclusion
Write ~600 words minimum.`,

    tools: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the "Tools, Equipment & Technology" section.
Structure:
1. CAFM / CMMS Platform (helpdesk, work order management, asset tracking)
2. Specialist Hard Services Equipment — (list relevant tools for HVAC, electrical, plumbing, civil based on the scope: ${extraction?.scope_of_work ?? ""})
3. Soft Services Equipment — (cleaning machinery: ride-on scrubbers, pressure washers, HEPA vacuums, etc.)
4. Safety Equipment & PPE — standard issue per trade
5. Technology Stack — mobile apps, IoT, energy monitoring, visitor/access management
6. Consumables Procurement — supply chain, approved vendors, quality control
Present as a formatted table where appropriate, with specifications.`,

    quality: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the "Quality Assurance Policies" section.
Structure:
1. Quality Management Framework (ISO 9001:2015 alignment, ISO 41001 FM standard)
2. Quality Policy Statement (signed by senior management)
3. Quality Control Procedures — inspections, audits, checklists (daily/weekly/monthly)
4. Customer Satisfaction Monitoring — NPS, surveys, KPI dashboards
5. Non-Conformance & Corrective Action procedure
6. Continuous Improvement — kaizen, lessons learned, root cause analysis
7. Document Control & Record Keeping
Be formal and policy-like in tone.`,

    references: `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the "References & Testimonials" section.
Structure:
1. Introduction — summarise EIH's track record (use real specifics from company profile above)
2. Client References Table — at least 4 reference clients with: Organisation, Contact Title, Location, Contract Scope, Contract Value, Duration, Contact details (placeholder)
3. Testimonials — 2–3 short client quotes (clearly mark as illustrative if not real)
4. Awards & Recognitions
5. Closing statement inviting the client to contact references
Make it credible and professional.`,
  };

  return prompts[sectionType] ?? `${companyBlock}\n\n${tenderBlock}\n\n${style}\n\nWrite the ${SECTION_META[sectionType]?.title ?? sectionType} section for this FM tender technical proposal.`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { sectionType } = await req.json().catch(() => ({})) as { sectionType?: string };

  if (!sectionType || sectionType === "manpower") {
    return NextResponse.json({ error: "Invalid section type" }, { status: 400 });
  }

  const supabase = db();

  // Mark as generating
  await supabase.from("proposal_sections").upsert(
    { tender_id: id, section_type: sectionType, status: "generating" },
    { onConflict: "tender_id,section_type" },
  );

  const [{ data: tender }, { data: extraction }, { data: companyRow }] = await Promise.all([
    supabase.from("tenders").select("name,client,submission_deadline,contract_value").eq("id", id).maybeSingle(),
    supabase.from("tender_extractions").select("scope_of_work,technical_requirements,keywords").eq("tender_id", id).maybeSingle(),
    supabase.from("company_profiles").select("context").limit(1).maybeSingle(),
  ]);

  const companyCtx = (companyRow?.context as Record<string, string>) ?? {};
  const prompt = buildDocPrompt(
    sectionType,
    tender as Record<string, unknown> ?? {},
    extraction as Record<string, unknown> | null,
    companyCtx,
  );

  let html = "";
  try {
    html = await complete({
      system: "You are a senior technical proposal writer for an FM (Facilities Management) company in the UAE. You produce polished, client-ready proposal content. Output HTML only — no markdown, no code fences.",
      user: prompt,
      maxTokens: 2000,
    });
  } catch (err) {
    await supabase.from("proposal_sections").upsert(
      { tender_id: id, section_type: sectionType, status: "empty" },
      { onConflict: "tender_id,section_type" },
    );
    console.error("[generate-document]", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }

  // Save result
  await supabase.from("proposal_sections").upsert(
    {
      tender_id: id,
      section_type: sectionType,
      content_html: html,
      status: "ready",
      generated_at: new Date().toISOString(),
    },
    { onConflict: "tender_id,section_type" },
  );

  return NextResponse.json({ html, section_type: sectionType, status: "ready" });
}

