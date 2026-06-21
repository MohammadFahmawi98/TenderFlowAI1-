import { NextRequest } from "next/server";
import { db } from "@/lib/supabase/db";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const { message, history = [] } = await req.json() as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "No message provided" }), { status: 400 });
  }

  const supabase = db();

  // Load all context in parallel
  const [{ data: extraction }, { data: tender }, { data: agentRuns }, { data: boqRow }] = await Promise.all([
    supabase.from("tender_extractions").select("*").eq("tender_id", tenderId).single(),
    supabase.from("tenders").select("name,client,submission_deadline,executive_summary").eq("id", tenderId).single(),
    supabase.from("agent_runs").select("agent_type,output_content").eq("tender_id", tenderId).eq("status", "completed"),
    supabase.from("tender_extractions").select("boq_data").eq("tender_id", tenderId).maybeSingle(),
  ]);

  const AGENT_TITLES: Record<string, string> = {
    intelligence: "Tender Intelligence", qualification: "Qualification Assessment",
    compliance: "Compliance Matrix", technical: "Technical Proposal",
    commercial: "Commercial Proposal", manpower: "Manpower Plan",
    ppm: "PPM Schedule", risk: "Risk Register", hse: "HSE Plan",
    sla: "SLA & KPI Framework", presentation: "Presentation", executive_review: "Executive Review",
  };

  const agentContext = (agentRuns ?? [])
    .filter((r: { agent_type: string; output_content: string | null }) => r.output_content)
    .map((r: { agent_type: string; output_content: string | null }) => {
      const title = AGENT_TITLES[r.agent_type] ?? r.agent_type;
      const text = (r.output_content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
      return `[${title}]:\n${text}`;
    })
    .join("\n\n");

  // BOQ summary if saved
  let boqSummary = "";
  const boqData = boqRow?.boq_data as { sections?: Array<{ label: string; items: Array<{ description: string; qty: number; monthly_rate: number }> }>; staff?: Array<{ job_name: string; count: number; monthly_rate: number }>; vat_pct?: number } | null;
  if (boqData?.sections?.length) {
    const lines: string[] = ["BOQ (from Estimation tab):"];
    let grandTotal = 0;
    for (const sec of boqData.sections) {
      const st = sec.items.reduce((s, it) => s + it.monthly_rate * it.qty, 0);
      if (st > 0) { lines.push(`  ${sec.label}: AED ${st.toLocaleString()}/yr`); grandTotal += st; }
    }
    if (grandTotal > 0) {
      const vat = grandTotal * ((boqData.vat_pct ?? 5) / 100);
      lines.push(`  Grand Total (incl. ${boqData.vat_pct ?? 5}% VAT): AED ${(grandTotal + vat).toLocaleString()}`);
    }
    if (boqData.staff?.length) {
      const sr = boqData.staff.filter((r) => r.monthly_rate > 0).map((r) => `    ${r.job_name} ×${r.count}: AED ${(r.monthly_rate * r.count * 12).toLocaleString()}/yr`);
      if (sr.length) { lines.push("  Staff Rates:"); lines.push(...sr); }
    }
    if (lines.length > 1) boqSummary = lines.join("\n");
  }

  const knowledgeBase = [
    tender ? `Tender: ${tender.name}\nClient: ${tender.client ?? "Unknown"}\nDeadline: ${tender.submission_deadline ?? "Not specified"}` : "",
    extraction?.scope_of_work ? `Scope of Work:\n${extraction.scope_of_work}` : "",
    extraction?.technical_requirements?.length
      ? `Technical Requirements:\n${(extraction.technical_requirements as string[]).map((r) => `- ${r}`).join("\n")}`
      : "",
    extraction?.commercial_requirements?.length
      ? `Commercial Requirements:\n${(extraction.commercial_requirements as string[]).map((r) => `- ${r}`).join("\n")}`
      : "",
    extraction?.evaluation_criteria?.length
      ? `Evaluation Criteria:\n${(extraction.evaluation_criteria as string[]).map((r) => `- ${r}`).join("\n")}`
      : "",
    extraction?.staffing_requirements?.length
      ? `Staffing Requirements:\n${(extraction.staffing_requirements as string[]).map((r) => `- ${r}`).join("\n")}`
      : "",
    extraction?.asset_information?.length
      ? `Asset Information:\n${(extraction.asset_information as string[]).map((r) => `- ${r}`).join("\n")}`
      : "",
    tender?.executive_summary ? `Executive Summary:\n${tender.executive_summary}` : "",
    boqSummary ? boqSummary : "",
    agentContext ? `AI-Generated Bid Sections:\n${agentContext}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are an expert FM bid consultant AI assistant for Etihad International Hospitality (EIH).
You have full knowledge of this specific tender and answer questions about it accurately and concisely.
Use markdown for structure when helpful: **bold**, bullet lists, tables. Be direct and professional.
Only answer questions about this tender. If information is not available in the knowledge base, say so clearly.

TENDER KNOWLEDGE BASE:
${knowledgeBase || "No tender data available yet — upload documents and run AI agents first."}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Stream the response
  const stream = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.25,
    max_tokens: 1200,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
