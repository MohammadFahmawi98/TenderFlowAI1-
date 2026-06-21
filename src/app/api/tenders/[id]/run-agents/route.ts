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
import { z } from "zod";

export const maxDuration = 60;

type AgentType =
  | "intelligence" | "qualification" | "compliance" | "technical" | "commercial"
  | "manpower" | "ppm" | "risk" | "hse" | "sla" | "presentation" | "executive_review";

const ALL_AGENT_TYPES: AgentType[] = [
  "intelligence", "qualification", "compliance", "technical", "commercial",
  "manpower", "ppm", "risk", "hse", "sla", "presentation", "executive_review",
];

const BodySchema = z.object({
  agentType: z.string().optional(),
  seed: z.boolean().optional(),
}).default({});

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

  // Always persist to agent_runs first — this is the reliable path
  const { error: contentErr } = await supabase
    .from("agent_runs")
    .update({ output_content: content })
    .eq("tender_id", tenderId)
    .eq("agent_type", agentType);
  if (contentErr) console.error(`[saveDocument] output_content failed for ${agentType}:`, contentErr.message);

  // Remove any stale document for this agent so re-runs don't accumulate rows
  await supabase
    .from("documents")
    .delete()
    .eq("tender_id", tenderId)
    .eq("agent_type", agentType);

  // Insert fresh document record
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      tender_id: tenderId,
      type: DOC_TYPE_MAP[agentType],
      title: DOC_TITLE_MAP[agentType],
      review_status: "ai_generated",
      agent_type: agentType,
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

async function buildContext(tenderId: string): Promise<ExtractionContext> {
  const supabase = db();
  const [{ data: tenderRow }, { data: extraction }] = await Promise.all([
    supabase.from("tenders").select("name,client,submission_deadline,contract_duration").eq("id", tenderId).single(),
    supabase.from("tender_extractions").select("*").eq("tender_id", tenderId).maybeSingle(),
  ]);

  let boqSummary: string | undefined;
  type BOQSection = { label: string; items: Array<{ description: string; qty: number; monthly_rate: number }> };
  type StaffEntry = { job_name: string; count: number; monthly_rate: number };
  const boqData = extraction?.boq_data as { sections?: BOQSection[]; staff?: StaffEntry[]; vat_pct?: number } | null;
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

  return {
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
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const rawBody = await req.json().catch(() => ({}));
  const body = BodySchema.parse(rawBody);
  const supabase = db();

  // ── SEED MODE: reset all agents to "waiting" and return ─────────────────
  if (body.seed || (!body.agentType && !body.seed)) {
    for (const t of ALL_AGENT_TYPES) {
      await supabase.from("agent_runs").upsert(
        { tender_id: tenderId, agent_type: t, status: "waiting", progress: 0, output_content: null, output_doc_id: null },
        { onConflict: "tender_id,agent_type" },
      );
    }
    await supabase.from("tenders").update({ status: "in_progress" }).eq("id", tenderId);
    return NextResponse.json({ seeded: true });
  }

  // ── SINGLE AGENT MODE ────────────────────────────────────────────────────
  const agentType = body.agentType as AgentType;
  if (!ALL_AGENT_TYPES.includes(agentType)) {
    return NextResponse.json({ error: `Unknown agent type: ${agentType}` }, { status: 400 });
  }

  const ctx = await buildContext(tenderId);

  // Mark running
  await setAgent(tenderId, agentType, {
    status: "running",
    progress: 20,
    started_at: new Date().toISOString(),
    current_task: "Generating content…",
  });

  try {
    let content: string;

    if (agentType === "executive_review") {
      // Fetch all other completed outputs to synthesise
      const { data: runs } = await supabase
        .from("agent_runs")
        .select("agent_type, output_content, status")
        .eq("tender_id", tenderId)
        .eq("status", "completed");

      const allOutputs: Record<string, string> = {};
      for (const r of runs ?? []) {
        if (r.agent_type !== "executive_review" && r.output_content) {
          allOutputs[r.agent_type] = r.output_content;
        }
      }

      await setAgent(tenderId, agentType, { progress: 50, current_task: "Reviewing all agent outputs…" });
      const raw = await generateExecutiveReview(ctx, allOutputs);

      // Parse JSON response
      const parsed = JSON.parse(raw);
      await supabase.from("tenders").update({
        readiness_score: parsed.readiness_score,
        win_probability: parsed.win_probability,
        executive_summary: parsed.executive_summary,
        status: "in_review",
      }).eq("id", tenderId);

      content = parsed.full_report ?? raw;
    } else {
      const GENERATORS: Record<string, () => Promise<string>> = {
        intelligence:  () => generateIntelligence(ctx),
        qualification: () => generateQualification(ctx),
        compliance:    () => generateCompliance(ctx),
        technical:     () => generateTechnicalProposal(ctx),
        commercial:    () => generateCommercial(ctx),
        manpower:      () => generateManpower(ctx),
        ppm:           () => generatePPM(ctx),
        risk:          () => generateRisk(ctx),
        hse:           () => generateHSE(ctx),
        sla:           () => generateSLA(ctx),
        presentation:  () => generatePresentation(ctx),
      };
      await setAgent(tenderId, agentType, { progress: 40 });
      content = await GENERATORS[agentType]();
    }

    await saveDocument(tenderId, agentType, content);
    await setAgent(tenderId, agentType, {
      status: "completed",
      progress: 100,
      current_task: "Complete",
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, agentType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[run-agents] ${agentType} failed:`, msg);
    await setAgent(tenderId, agentType, { status: "failed", error: msg });
    return NextResponse.json({ error: msg, agentType }, { status: 500 });
  }
}
