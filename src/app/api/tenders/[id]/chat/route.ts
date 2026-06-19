import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { complete } from "@/lib/ai/provider";

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
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  const supabase = db();

  // Load extraction as knowledge base
  const { data: extraction } = await supabase
    .from("tender_extractions")
    .select("*")
    .eq("tender_id", tenderId)
    .single();

  const { data: tender } = await supabase
    .from("tenders")
    .select("name,client,submission_deadline,executive_summary")
    .eq("id", tenderId)
    .single();

  // Build context from extraction + any completed agent documents
  const { data: docs } = await supabase
    .from("documents")
    .select("title, document_versions(content_html)")
    .eq("tender_id", tenderId);

  const docSummaries = (docs ?? [])
    .map((d: { title: string; document_versions?: Array<{ content_html?: string }> }) => {
      const html = d.document_versions?.[0]?.content_html ?? "";
      const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
      return text ? `[${d.title}]: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  const knowledgeBase = [
    tender ? `Tender: ${tender.name}\nClient: ${tender.client ?? "Unknown"}\nDeadline: ${tender.submission_deadline ?? "Not specified"}` : "",
    extraction?.scope_of_work ? `Scope of Work: ${extraction.scope_of_work}` : "",
    extraction?.technical_requirements?.length
      ? `Technical Requirements:\n${(extraction.technical_requirements as string[]).map((r: string) => `- ${r}`).join("\n")}`
      : "",
    extraction?.commercial_requirements?.length
      ? `Commercial Requirements:\n${(extraction.commercial_requirements as string[]).map((r: string) => `- ${r}`).join("\n")}`
      : "",
    extraction?.evaluation_criteria?.length
      ? `Evaluation Criteria:\n${(extraction.evaluation_criteria as string[]).map((r: string) => `- ${r}`).join("\n")}`
      : "",
    tender?.executive_summary ? `Executive Summary: ${tender.executive_summary}` : "",
    docSummaries ? `Generated Documents:\n${docSummaries}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are an expert FM bid consultant AI assistant for Etihad International Hospitality.
You have full knowledge of this tender and answer questions about it accurately and concisely.
Only answer questions about this tender. If something is not in the tender data, say so.

TENDER KNOWLEDGE BASE:
${knowledgeBase || "No tender data available yet — documents are still being processed."}`;

  // Build messages array with history for multi-turn chat
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const resp = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1000,
      messages,
    });

    const reply = resp.choices[0]?.message?.content ?? "I could not generate a response.";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
