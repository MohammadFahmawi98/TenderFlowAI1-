import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import {
  generateIntelligence,
  generateQualification,
  generateCompliance,
  generateTechnicalProposal,
  generateCommercial,
  generateManpower,
  generatePPM,
  generateRisk,
  generateHSE,
  generateSLA,
  generatePresentation,
  generateExecutiveReview,
  type ExtractionContext,
} from "@/lib/ai/agent-prompts";
import { textToHtml } from "@/lib/utils/text-to-html";

export const maxDuration = 60;

type AgentType =
  | "intelligence" | "qualification" | "compliance" | "technical" | "commercial"
  | "manpower" | "ppm" | "risk" | "hse" | "sla" | "presentation" | "executive_review";

const DOC_TYPE_MAP: Record<AgentType, string> = {
  intelligence:     "other",
  qualification:    "other",
  compliance:       "compliance_matrix",
  technical:        "technical_proposal",
  commercial:       "commercial_proposal",
  manpower:         "manpower_plan",
  ppm:              "ppm_schedule",
  risk:             "risk_register",
  hse:              "hse_plan",
  sla:              "other",
  presentation:     "presentation",
  executive_review: "executive_summary",
};

const DOC_TITLE_MAP: Record<AgentType, string> = {
  intelligence:     "Tender Intelligence Briefing",
  qualification:    "Qualification Assessment",
  compliance:       "Compliance Matrix",
  technical:        "Technical Proposal",
  commercial:       "Commercial Proposal",
  manpower:         "Manpower Plan",
  ppm:              "PPM Schedule",
  risk:             "Risk Register",
  hse:              "HSE Plan",
  sla:              "SLA & KPI Framework",
  presentation:     "Executive Presentation",
  executive_review: "Executive Review Report",
};

async function setAgent(tenderId: string, agentType: string, update: Record<string, unknown>) {
  await db().from("agent_runs").update(update).eq("tender_id", tenderId).eq("agent_type", agentType);
}

async function saveDocument(tenderId: string, agentType: AgentType, content: string) {
  const supabase = db();
  const html = textToHtml(content);

  // Always save content directly to agent_runs so tab pages can render it
  // even if the documents table pipeline fails
  const { error: contentErr } = await supabase
    .from("agent_runs")
    .update({ output_content: content })
    .eq("tender_id", tenderId)
    .eq("agent_type", agentType);
  if (contentErr) console.error(`[saveDocument] output_content update failed for ${agentType}:`, contentErr.message);

  // Also persist as a formal document (best-effort)
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      tender_id: tenderId,
      type: DOC_TYPE_MAP[agentType],
      title: DOC_TITLE_MAP[agentType],
      review_status: "ai_generated",
    })
    .select()
    .single();

  if (docErr) {
    console.error(`[saveDocument] documents insert failed for ${agentType}:`, docErr.message);
    return null;
  }
  if (!doc) return null;

  const { data: version, error: vErr } = await supabase
    .from("document_versions")
    .insert({
      document_id: doc.id,
      version_no: 1,
      content_html: html,
      content_json: { text: content },
      note: "AI Generated",
    })
    .select()
    .single();

  if (vErr) console.error(`[saveDocument] document_versions insert failed for ${agentType}:`, vErr.message);

  if (version) {
    await supabase.from("documents").update({ current_version_id: version.id }).eq("id", doc.id);
    await supabase.from("agent_runs").update({ output_doc_id: doc.id }).eq("tender_id", tenderId).eq("agent_type", agentType);
  }

  return doc;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = db();

  // Load tender + extraction context (extraction may not exist if PDF parse failed)
  const [{ data: tenderRow }, { data: extraction }] = await Promise.all([
    supabase.from("tenders").select("name,client,submission_deadline,contract_duration").eq("id", tenderId).single(),
    supabase.from("tender_extractions").select("*").eq("tender_id", tenderId).maybeSingle(),
  ]);

  // Build BOQ summary string for agent context
  let boqSummary: string | undefined;
  const boqData = extraction?.boq_data as { sections?: Array<{ label: string; items: Array<{ description: string; qty: number; monthly_rate: number }> }>; staff?: Array<{ job_name: string; count: number; monthly_rate: number }>; vat_pct?: number } | null;
  if (boqData?.sections?.length) {
    const lines: string[] = ["BOQ SUMMARY (saved in Estimation tab):"];
    for (const sec of boqData.sections) {
      const secTotal = sec.items.reduce((s, it) => s + it.monthly_rate * it.qty, 0);
      if (secTotal > 0) lines.push(`  ${sec.label}: AED ${secTotal.toLocaleString()}/yr`);
    }
    if (boqData.staff?.length) {
      const staffLines = boqData.staff
        .filter((r) => r.monthly_rate > 0)
        .map((r) => `    ${r.job_name} ×${r.count}: AED ${(r.monthly_rate * r.count * 12).toLocaleString()}/yr`);
      if (staffLines.length) { lines.push("  STAFF RATES:"); lines.push(...staffLines); }
    }
    if (lines.length > 1) boqSummary = lines.join("\n");
  }

  const ctx: ExtractionContext = {
    tender_name:             extraction?.tender_name ?? tenderRow?.name ?? "Untitled Tender",
    client_name:             extraction?.client_name ?? tenderRow?.client ?? "Client",
    scope_of_work:           extraction?.scope_of_work ?? "Facility Management services as per tender documents.",
    technical_requirements:  Array.isArray(extraction?.technical_requirements) ? extraction.technical_requirements : [],
    commercial_requirements: Array.isArray(extraction?.commercial_requirements) ? extraction.commercial_requirements : [],
    evaluation_criteria:     Array.isArray(extraction?.evaluation_criteria) ? extraction.evaluation_criteria : [],
    staffing_requirements:   Array.isArray(extraction?.staffing_requirements) ? extraction.staffing_requirements : [],
    asset_information:       Array.isArray(extraction?.asset_information) ? extraction.asset_information : [],
    deadline:                extraction?.deadline ?? tenderRow?.submission_deadline,
    contract_duration:       extraction?.contract_duration ?? tenderRow?.contract_duration,
    boq_summary:             boqSummary,
  };

  // Ensure agent_runs rows exist
  const agentTypes: AgentType[] = [
    "intelligence","qualification","compliance","technical","commercial",
    "manpower","ppm","risk","hse","sla","presentation","executive_review",
  ];
  for (const t of agentTypes) {
    await supabase.from("agent_runs").upsert(
      { tender_id: tenderId, agent_type: t, status: "waiting", progress: 0 },
      { onConflict: "tender_id,agent_type" },
    );
  }

  // Mark tender in_progress
  await supabase.from("tenders").update({ status: "in_progress" }).eq("id", tenderId);

  // Run agents sequentially (with parallelism where possible)
  const outputs: Record<string, string> = {};

  async function runAgent(agentType: AgentType, generator: () => Promise<string>) {
    try {
      await setAgent(tenderId, agentType, { status: "running", progress: 10, started_at: new Date().toISOString(), current_task: "Analysing tender requirements…" });
      await setAgent(tenderId, agentType, { progress: 40, current_task: "Generating content…" });
      const content = await generator();
      outputs[agentType] = content;
      await saveDocument(tenderId, agentType, content);
      await setAgent(tenderId, agentType, { status: "completed", progress: 100, current_task: "Complete", completed_at: new Date().toISOString() });
    } catch (err) {
      await setAgent(tenderId, agentType, { status: "failed", error: String(err) });
    }
  }

  const startedAt = Date.now();
  const BUDGET_MS = 50_000; // leave 10s buffer before the 60s Vercel limit

  // Stage 1: run all core agents in parallel
  await Promise.all([
    runAgent("intelligence",  () => generateIntelligence(ctx)),
    runAgent("qualification", () => generateQualification(ctx)),
    runAgent("compliance",    () => generateCompliance(ctx)),
    runAgent("technical",     () => generateTechnicalProposal(ctx)),
    runAgent("commercial",    () => generateCommercial(ctx)),
    runAgent("manpower",      () => generateManpower(ctx)),
    runAgent("ppm",           () => generatePPM(ctx)),
    runAgent("risk",          () => generateRisk(ctx)),
    runAgent("hse",           () => generateHSE(ctx)),
    runAgent("sla",           () => generateSLA(ctx)),
  ]);

  const elapsed = Date.now() - startedAt;
  if (elapsed > BUDGET_MS) {
    // Out of time — mark remaining as failed, return partial success
    await setAgent(tenderId, "presentation",     { status: "failed", error: "Skipped: time budget exceeded" });
    await setAgent(tenderId, "executive_review", { status: "failed", error: "Skipped: time budget exceeded" });
    return NextResponse.json({ success: true, partial: true });
  }

  // Stage 2: presentation
  await runAgent("presentation", () => generatePresentation(ctx));

  if (Date.now() - startedAt > BUDGET_MS) {
    await setAgent(tenderId, "executive_review", { status: "failed", error: "Skipped: time budget exceeded" });
    return NextResponse.json({ success: true, partial: true });
  }

  // Stage 3: executive review
  const reviewRaw = await (async () => {
    await setAgent(tenderId, "executive_review", { status: "running", progress: 20, current_task: "Reviewing all agent outputs…", started_at: new Date().toISOString() });
    try {
      const raw = await generateExecutiveReview(ctx, outputs);
      const parsed = JSON.parse(raw);
      await supabase.from("tenders").update({
        readiness_score: parsed.readiness_score,
        win_probability: parsed.win_probability,
        executive_summary: parsed.executive_summary,
        status: "in_review",
      }).eq("id", tenderId);
      await saveDocument(tenderId, "executive_review", parsed.full_report ?? raw);
      await setAgent(tenderId, "executive_review", { status: "completed", progress: 100, current_task: "Complete", completed_at: new Date().toISOString() });
      return parsed;
    } catch (err) {
      await setAgent(tenderId, "executive_review", { status: "failed", error: String(err) });
      return null;
    }
  })();

  return NextResponse.json({ success: true, review: reviewRaw });
}
