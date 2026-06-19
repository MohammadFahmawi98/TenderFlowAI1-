import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import {
  generateQualification,
  generateCompliance,
  generateTechnicalProposal,
  generateCommercial,
  generateManpower,
  generatePPM,
  generateRisk,
  generateHSE,
  generatePresentation,
  generateExecutiveReview,
  type ExtractionContext,
} from "@/lib/ai/agent-prompts";

export const maxDuration = 300;

type AgentType =
  | "qualification" | "compliance" | "technical" | "commercial"
  | "manpower" | "ppm" | "risk" | "hse" | "presentation" | "executive_review";

const DOC_TYPE_MAP: Record<AgentType, string> = {
  qualification:    "other",
  compliance:       "compliance_matrix",
  technical:        "technical_proposal",
  commercial:       "commercial_proposal",
  manpower:         "manpower_plan",
  ppm:              "ppm_schedule",
  risk:             "risk_register",
  hse:              "hse_plan",
  presentation:     "presentation",
  executive_review: "executive_summary",
};

const DOC_TITLE_MAP: Record<AgentType, string> = {
  qualification:    "Qualification Assessment",
  compliance:       "Compliance Matrix",
  technical:        "Technical Proposal",
  commercial:       "Commercial Proposal",
  manpower:         "Manpower Plan",
  ppm:              "PPM Schedule",
  risk:             "Risk Register",
  hse:              "HSE Plan",
  presentation:     "Executive Presentation",
  executive_review: "Executive Review Report",
};

async function setAgent(tenderId: string, agentType: string, update: Record<string, unknown>) {
  await db().from("agent_runs").update(update).eq("tender_id", tenderId).eq("agent_type", agentType);
}

async function saveDocument(tenderId: string, agentType: AgentType, content: string) {
  const supabase = db();
  const { data: doc } = await supabase
    .from("documents")
    .insert({
      tender_id: tenderId,
      type: DOC_TYPE_MAP[agentType],
      title: DOC_TITLE_MAP[agentType],
      review_status: "ai_generated",
    })
    .select()
    .single();

  if (!doc) return null;

  const { data: version } = await supabase
    .from("document_versions")
    .insert({
      document_id: doc.id,
      version_no: 1,
      content_html: `<div class="prose">${content.replace(/\n/g, "<br/>")}</div>`,
      content_json: { text: content },
      note: "AI Generated",
    })
    .select()
    .single();

  if (version) {
    await supabase
      .from("documents")
      .update({ current_version_id: version.id })
      .eq("id", doc.id);

    await supabase
      .from("agent_runs")
      .update({ output_doc_id: doc.id })
      .eq("tender_id", tenderId)
      .eq("agent_type", agentType);
  }

  return doc;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = db();

  // Load extraction context
  const { data: extraction } = await supabase
    .from("tender_extractions")
    .select("*")
    .eq("tender_id", tenderId)
    .single();

  if (!extraction) {
    return NextResponse.json({ error: "No extraction found — upload and analyse an RFP first." }, { status: 400 });
  }

  const ctx: ExtractionContext = {
    tender_name:              extraction.tender_name ?? "Untitled Tender",
    client_name:              extraction.client_name ?? "Client",
    scope_of_work:            extraction.scope_of_work ?? "",
    technical_requirements:   Array.isArray(extraction.technical_requirements) ? extraction.technical_requirements : [],
    commercial_requirements:  Array.isArray(extraction.commercial_requirements) ? extraction.commercial_requirements : [],
    evaluation_criteria:      Array.isArray(extraction.evaluation_criteria) ? extraction.evaluation_criteria : [],
    staffing_requirements:    Array.isArray(extraction.staffing_requirements) ? extraction.staffing_requirements : [],
    asset_information:        Array.isArray(extraction.asset_information) ? extraction.asset_information : [],
    deadline:                 extraction.deadline,
    contract_duration:        extraction.contract_duration,
  };

  // Ensure agent_runs rows exist
  const agentTypes: AgentType[] = [
    "qualification","compliance","technical","commercial",
    "manpower","ppm","risk","hse","presentation","executive_review",
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

  // Stage 1: parallel independent agents
  await Promise.all([
    runAgent("qualification", () => generateQualification(ctx)),
    runAgent("compliance",    () => generateCompliance(ctx)),
    runAgent("technical",     () => generateTechnicalProposal(ctx)),
    runAgent("commercial",    () => generateCommercial(ctx)),
    runAgent("manpower",      () => generateManpower(ctx)),
    runAgent("ppm",           () => generatePPM(ctx)),
    runAgent("risk",          () => generateRisk(ctx)),
    runAgent("hse",           () => generateHSE(ctx)),
  ]);

  // Stage 2: presentation (depends on technical)
  await runAgent("presentation", () => generatePresentation(ctx));

  // Stage 3: executive review (depends on all)
  const reviewRaw = await (async () => {
    await setAgent(tenderId, "executive_review", { status: "running", progress: 20, current_task: "Reviewing all agent outputs…", started_at: new Date().toISOString() });
    try {
      const raw = await generateExecutiveReview(ctx, outputs);
      const parsed = JSON.parse(raw);
      // Update tender scores
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
