import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { textToHtml } from "@/lib/utils/text-to-html";

const AGENT_TITLE_MAP: Record<string, string> = {
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

const AGENT_DOC_TYPE_MAP: Record<string, string> = {
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

const AGENT_ORDER = [
  "intelligence","qualification","compliance","technical","commercial",
  "manpower","ppm","risk","hse","sla","presentation","executive_review",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenderId = searchParams.get("tender_id");

  const supabase = db();

  // Fetch formal documents
  let query = supabase
    .from("documents")
    .select("*, document_versions(*)")
    .order("created_at", { ascending: true });
  if (tenderId) query = query.eq("tender_id", tenderId);
  const { data: docs } = await query;
  const formalDocs = docs ?? [];

  // Fetch agent_runs to build virtual docs for runs without a formal doc
  type AgentRun = { agent_type: string; status: string; output_content: string | null; output_doc_id: string | null; updated_at: string | null; completed_at: string | null };
  let agentRuns: AgentRun[] = [];
  if (tenderId) {
    const { data: runs } = await supabase
      .from("agent_runs")
      .select("agent_type,status,output_content,output_doc_id,updated_at,completed_at")
      .eq("tender_id", tenderId)
      .eq("status", "completed");
    agentRuns = (runs ?? []).filter((r: AgentRun) => r.output_content && r.output_content.length > 50);
  }

  // Determine which agent types are already covered by a formal doc
  // We use output_doc_id on agent_runs as the authoritative link
  const coveredAgentTypes = new Set<string>(
    agentRuns.filter((r) => r.output_doc_id).map((r) => r.agent_type),
  );

  // Virtual docs = runs with content but no formal doc yet
  const virtualDocs = agentRuns
    .filter((r) => !coveredAgentTypes.has(r.agent_type))
    .map((r) => ({
      id: `agent:${r.agent_type}`,
      tender_id: tenderId,
      title: AGENT_TITLE_MAP[r.agent_type] ?? r.agent_type,
      type: AGENT_DOC_TYPE_MAP[r.agent_type] ?? "other",
      review_status: "ai_generated",
      current_version_id: null,
      agent_type: r.agent_type,
      is_virtual: true,
      created_at: r.completed_at ?? r.updated_at,
      document_versions: [
        {
          id: `vv:${r.agent_type}`,
          version_no: 1,
          content_html: textToHtml(r.output_content ?? ""),
          content_json: { text: r.output_content ?? "" },
        },
      ],
    }));

  const all = [...formalDocs, ...virtualDocs];

  // Sort by agent order
  all.sort((a, b) => {
    const ai = AGENT_ORDER.indexOf((a as { agent_type?: string }).agent_type ?? "");
    const bi = AGENT_ORDER.indexOf((b as { agent_type?: string }).agent_type ?? "");
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return NextResponse.json(all);
}

// POST: materialize a virtual document (create formal record from agent_runs)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { tender_id, agent_type } = body as { tender_id?: string; agent_type?: string };

  if (!tender_id || !agent_type) {
    return NextResponse.json({ error: "tender_id and agent_type required" }, { status: 400 });
  }

  const supabase = db();

  // Check if a formal doc already exists via output_doc_id
  const { data: run } = await supabase
    .from("agent_runs")
    .select("output_content,output_doc_id")
    .eq("tender_id", tender_id)
    .eq("agent_type", agent_type)
    .single();

  if (run?.output_doc_id) {
    // Formal doc already exists — return it
    const { data: existing } = await supabase
      .from("documents")
      .select("*, document_versions(*)")
      .eq("id", run.output_doc_id)
      .single();
    if (existing) return NextResponse.json(existing);
  }

  if (!run?.output_content) {
    return NextResponse.json({ error: "Agent has not generated content yet" }, { status: 404 });
  }

  const html  = textToHtml(run.output_content);
  const title = AGENT_TITLE_MAP[agent_type] ?? agent_type;
  const type  = AGENT_DOC_TYPE_MAP[agent_type] ?? "other";

  // Create formal document (agent_type column requires the migration to have run)
  const insertPayload: Record<string, unknown> = {
    tender_id,
    type,
    title,
    review_status: "ai_generated",
  };
  // Include agent_type if the column exists (migration may not have run yet on all envs)
  try {
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({ ...insertPayload, agent_type })
      .select()
      .single();

    if (docErr) throw docErr;

    const { data: version } = await supabase
      .from("document_versions")
      .insert({
        document_id: doc.id,
        version_no: 1,
        content_html: html,
        content_json: { text: run.output_content },
        note: "AI Generated",
      })
      .select()
      .single();

    if (version) {
      await supabase.from("documents").update({ current_version_id: version.id }).eq("id", doc.id);
      await supabase.from("agent_runs")
        .update({ output_doc_id: doc.id })
        .eq("tender_id", tender_id)
        .eq("agent_type", agent_type);

      return NextResponse.json({ ...doc, current_version_id: version.id, document_versions: [version] });
    }
    return NextResponse.json(doc);
  } catch {
    // agent_type column might not exist yet — try without it
    const { data: doc, error: docErr2 } = await supabase
      .from("documents")
      .insert(insertPayload)
      .select()
      .single();

    if (docErr2 || !doc) {
      return NextResponse.json({ error: docErr2?.message ?? "Failed to create document" }, { status: 500 });
    }

    const { data: version } = await supabase
      .from("document_versions")
      .insert({
        document_id: doc.id,
        version_no: 1,
        content_html: html,
        content_json: { text: run.output_content },
        note: "AI Generated",
      })
      .select()
      .single();

    if (version) {
      await supabase.from("documents").update({ current_version_id: version.id }).eq("id", doc.id);
      await supabase.from("agent_runs")
        .update({ output_doc_id: doc.id })
        .eq("tender_id", tender_id)
        .eq("agent_type", agent_type);
      return NextResponse.json({ ...doc, current_version_id: version.id, document_versions: [version] });
    }
    return NextResponse.json(doc);
  }
}
