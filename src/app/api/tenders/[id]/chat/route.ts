import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import OpenAI from "openai";

export const maxDuration = 60;

function cleanKey(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cap(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + "\n[…truncated]";
}

const AGENT_TITLES: Record<string, string> = {
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;

  let message: string;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  try {
    const body = await req.json();
    message = body.message ?? "";
    history = body.history ?? [];
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  const supabase = db();

  // ── Fetch everything in parallel ─────────────────────────────────────────
  const [
    { data: tender },
    { data: extraction },
    { data: tenderFiles },
    { data: agentRuns },
    { data: knowledgeDocs },
  ] = await Promise.all([
    supabase
      .from("tenders")
      .select("name,client,submission_deadline,contract_duration,executive_summary,scope_of_work")
      .eq("id", tenderId)
      .maybeSingle(),

    supabase
      .from("tender_extractions")
      .select("*")
      .eq("tender_id", tenderId)
      .maybeSingle(),

    // Full extracted text from each uploaded RFP/BOQ/drawings file
    supabase
      .from("tender_files")
      .select("name,original_name,extraction_status,extracted_text")
      .eq("tender_id", tenderId)
      .eq("extraction_status", "done"),

    // AI-generated bid sections (completed agent runs)
    supabase
      .from("agent_runs")
      .select("agent_type,output_content")
      .eq("tender_id", tenderId)
      .eq("status", "completed"),

    // Company knowledge library (ISO certs, past projects, SOPs, etc.)
    supabase
      .from("knowledge_documents")
      .select("name,content_text,doc_category")
      .eq("status", "indexed")
      .not("content_text", "is", null)
      .limit(12),
  ]);

  // ── 1. Tender header ──────────────────────────────────────────────────────
  const tenderHeader = [
    `TENDER: ${tender?.name ?? extraction?.tender_name ?? "Unknown"}`,
    `CLIENT: ${tender?.client ?? extraction?.client_name ?? "Unknown"}`,
    `SUBMISSION DEADLINE: ${tender?.submission_deadline ?? extraction?.deadline ?? "Not specified"}`,
    `CONTRACT DURATION: ${tender?.contract_duration ?? extraction?.contract_duration ?? "Not specified"}`,
  ].join("\n");

  // ── 2. Raw text from uploaded source files ────────────────────────────────
  type TenderFile = { name: string; original_name: string | null; extraction_status: string; extracted_text: string | null };
  const filesWithText = (tenderFiles ?? []).filter(
    (f: TenderFile) => f.extracted_text && f.extracted_text.length > 100,
  );
  const perFileCap = filesWithText.length > 0
    ? Math.max(8000, Math.floor(70000 / filesWithText.length))
    : 70000;

  const fileTexts = filesWithText
    .map((f: TenderFile) => {
      const label = f.original_name ?? f.name;
      return `═══ SOURCE FILE: ${label} ═══\n${cap(f.extracted_text!, perFileCap)}`;
    })
    .join("\n\n");

  // ── 3. Structured AI extraction (supplement when file text is thin) ───────
  const extractionParts: string[] = [];
  if (extraction?.scope_of_work)
    extractionParts.push(`SCOPE OF WORK:\n${extraction.scope_of_work}`);
  if ((extraction?.technical_requirements as string[] | null)?.length)
    extractionParts.push(`TECHNICAL REQUIREMENTS:\n${(extraction!.technical_requirements as string[]).map((r) => `• ${r}`).join("\n")}`);
  if ((extraction?.commercial_requirements as string[] | null)?.length)
    extractionParts.push(`COMMERCIAL REQUIREMENTS:\n${(extraction!.commercial_requirements as string[]).map((r) => `• ${r}`).join("\n")}`);
  if ((extraction?.evaluation_criteria as string[] | null)?.length)
    extractionParts.push(`EVALUATION CRITERIA:\n${(extraction!.evaluation_criteria as string[]).map((r) => `• ${r}`).join("\n")}`);
  if ((extraction?.staffing_requirements as string[] | null)?.length)
    extractionParts.push(`STAFFING REQUIREMENTS:\n${(extraction!.staffing_requirements as string[]).map((r) => `• ${r}`).join("\n")}`);
  if ((extraction?.asset_information as string[] | null)?.length)
    extractionParts.push(`ASSET INFORMATION:\n${(extraction!.asset_information as string[]).map((r) => `• ${r}`).join("\n")}`);
  if (tender?.executive_summary)
    extractionParts.push(`EXECUTIVE SUMMARY:\n${tender.executive_summary}`);

  // BOQ summary
  type BoqItem = { description: string; qty: number; monthly_rate: number };
  type BoqSection = { label: string; items: BoqItem[] };
  type BoqStaff = { job_name: string; count: number; monthly_rate: number };
  const boqData = extraction?.boq_data as { sections?: BoqSection[]; staff?: BoqStaff[]; vat_pct?: number } | null;
  if (boqData?.sections?.length) {
    const lines = ["BOQ SUMMARY:"];
    let grand = 0;
    for (const sec of boqData.sections) {
      const st = sec.items.reduce((s, it) => s + (it.monthly_rate ?? 0) * (it.qty ?? 0), 0);
      if (st > 0) { lines.push(`  ${sec.label}: AED ${st.toLocaleString()}/yr`); grand += st; }
    }
    if (grand > 0) {
      const vat = boqData.vat_pct ?? 5;
      lines.push(`  Grand Total (incl. ${vat}% VAT): AED ${(grand * (1 + vat / 100)).toLocaleString()}`);
    }
    if (boqData.staff?.length) {
      const sr = boqData.staff.filter((r) => r.monthly_rate > 0)
        .map((r) => `    ${r.job_name} ×${r.count}: AED ${(r.monthly_rate * r.count * 12).toLocaleString()}/yr`);
      if (sr.length) { lines.push("  Staff Rates:"); lines.push(...sr); }
    }
    if (lines.length > 1) extractionParts.push(lines.join("\n"));
  }

  const structuredExtraction = extractionParts.join("\n\n");

  // ── 4. AI-generated bid sections ──────────────────────────────────────────
  const agentContext = (agentRuns ?? [])
    .filter((r: { agent_type: string; output_content: string | null }) =>
      r.output_content && r.output_content.length > 100)
    .map((r: { agent_type: string; output_content: string | null }) => {
      const title = AGENT_TITLES[r.agent_type] ?? r.agent_type;
      return `── ${title} ──\n${cap(stripHtml(r.output_content ?? ""), 3000)}`;
    })
    .join("\n\n");

  // ── 5. EIH company knowledge library ─────────────────────────────────────
  const knowledgeContext = (knowledgeDocs ?? [])
    .filter((d: { content_text: string | null }) => d.content_text && d.content_text.length > 100)
    .map((d: { name: string; doc_category: string | null; content_text: string | null }) => {
      const label = d.name + (d.doc_category ? ` [${d.doc_category}]` : "");
      return `── COMPANY KNOWLEDGE: ${label} ──\n${cap(d.content_text!, 2000)}`;
    })
    .join("\n\n");

  // ── Assemble full context ─────────────────────────────────────────────────
  const hr = "─".repeat(60);
  const sections: string[] = [tenderHeader];
  if (fileTexts)
    sections.push(`\n${hr}\nFULL DOCUMENT TEXT (from uploaded files):\n${hr}\n${fileTexts}`);
  if (structuredExtraction)
    sections.push(`\n${hr}\nAI-EXTRACTED STRUCTURED DATA:\n${hr}\n${structuredExtraction}`);
  if (agentContext)
    sections.push(`\n${hr}\nAI-GENERATED BID SECTIONS:\n${hr}\n${agentContext}`);
  if (knowledgeContext)
    sections.push(`\n${hr}\nEIH COMPANY KNOWLEDGE LIBRARY:\n${hr}\n${knowledgeContext}`);

  const knowledgeBase = sections.join("\n\n");
  const hasRealContent = fileTexts.length > 0 || structuredExtraction.length > 0;

  // ── System prompt ─────────────────────────────────────────────────────────
  const systemPrompt = `You are TenderFlow AI — an expert FM bid consultant embedded inside EIH's (Etihad International Hospitality) bid management platform.

You have FULL access to this tender's uploaded source documents, AI-extracted data, AI-generated bid sections, and EIH's company knowledge library. Answer all questions using the real content provided below.

CAPABILITIES:
• Answer any question about the tender: SLA KPIs, technical specs, staffing, BOQ figures, compliance requirements, evaluation criteria, deadlines, contractual terms
• Compare tender requirements against EIH's company capabilities and past projects
• Summarise sections, extract tables, list all requirements from a specific area
• Help draft or improve specific bid sections (technical proposal, manpower plan, HSE plan, etc.)
• Analyse risks, gaps, and opportunities
• Prepare document outlines, submission checklists, or executive summaries on request

RULES:
• Always cite which source your answer comes from (e.g. "From the RFP:", "From the SLA Framework section:", "From EIH's ISO certificate:")
• Give specific numbers, percentages, names, and dates exactly as they appear in the documents
• If a specific detail is genuinely not in the provided context, say "This specific detail was not found in the uploaded documents" — never say you have no access to documents
• Use markdown for structure: **bold**, bullet lists, tables where helpful
• Be direct and professional — this is a B2B bid environment
• When asked to prepare a document or draft, produce a full working draft using the tender requirements and EIH's company data
${!hasRealContent ? "\n⚠️  NOTE: No text has been extracted from the uploaded files yet. Ask the user to re-upload their RFP/tender files in the Documents tab so text extraction can run." : ""}

${"═".repeat(60)}
TENDER CONTEXT & FULL DOCUMENT CONTENT:
${"═".repeat(60)}
${knowledgeBase}`;

  // ── Call OpenAI ───────────────────────────────────────────────────────────
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.slice(-12).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  const client = new OpenAI({ apiKey: cleanKey(process.env.OPENAI_API_KEY) });

  try {
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 2000,
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
        } catch (streamErr) {
          console.error("[chat] stream error:", streamErr);
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
  } catch (err) {
    console.error("[chat] OpenAI error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI error" },
      { status: 500 },
    );
  }
}
