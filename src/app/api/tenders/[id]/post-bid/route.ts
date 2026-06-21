import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { complete } from "@/lib/ai/provider";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = db();

  const [{ data: tender }, { data: runs }] = await Promise.all([
    supabase
      .from("tenders")
      .select("name,client,status,win_probability,readiness_score,outcome_reason,competitor_name,competitor_price,post_bid_notes,contract_value")
      .eq("id", tenderId)
      .single(),
    supabase
      .from("agent_runs")
      .select("agent_type,output_content,status")
      .eq("tender_id", tenderId)
      .eq("status", "completed"),
  ]);

  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const outcome = body.outcome ?? tender.status; // "won" | "lost" | "submitted"
  const reason = body.outcome_reason ?? tender.outcome_reason ?? "";
  const competitor = body.competitor_name ?? tender.competitor_name ?? "";
  const compPrice = body.competitor_price ?? tender.competitor_price ?? null;
  const notes = body.post_bid_notes ?? tender.post_bid_notes ?? "";

  type RunRow = { agent_type: string; output_content: string | null };
  const agentSummary = (runs as RunRow[] ?? [])
    .map((r) => `${r.agent_type.toUpperCase()}: ${(r.output_content ?? "").slice(0, 200)}`)
    .join("\n\n");

  const analysis = await complete({
    system: `You are a senior FM bid strategist at Etihad International Hospitality conducting a post-bid debrief.
Be specific, honest, and constructive. Focus on actionable improvements for future bids.`,
    user: `Conduct a post-bid debrief for this tender.

TENDER: ${tender.name}
CLIENT: ${tender.client ?? "Unknown"}
OUTCOME: ${outcome.toUpperCase()}
CONTRACT VALUE: AED ${tender.contract_value?.toLocaleString() ?? "TBD"}
OUR WIN PROBABILITY (AI): ${tender.win_probability ?? "N/A"}%
OUR BID READINESS (AI): ${tender.readiness_score ?? "N/A"}%
OUTCOME REASON: ${reason || "Not specified"}
COMPETITOR: ${competitor || "Unknown"}
COMPETITOR PRICE: ${compPrice ? `AED ${Number(compPrice).toLocaleString()}` : "Unknown"}
NOTES: ${notes || "None"}

AGENT OUTPUTS SUMMARY:
${agentSummary || "No agent outputs available"}

Produce a structured post-bid debrief with:

POST-BID DEBRIEF — ${tender.name}

OUTCOME SUMMARY
Brief 2-sentence summary of what happened and why.

WHAT WE DID RIGHT
| Strength | Evidence | Impact |
|----------|----------|--------|
(3-5 rows)

WHAT WE SHOULD IMPROVE
| Gap | Root Cause | Action for Next Bid |
|-----|-----------|-------------------|
(3-5 rows)

${outcome === "lost" ? `COMPETITIVE ANALYSIS
How did our bid compare to ${competitor || "the winner"}? Price, technical, commercial positioning.

` : ""}LESSONS LEARNED
Top 3 specific, actionable lessons for future similar bids.

KNOWLEDGE BASE UPDATES
What should be added to our Knowledge Hub from this bid experience?`,
    maxTokens: 1500,
  });

  // Save the analysis back to the tender
  await supabase
    .from("tenders")
    .update({ post_bid_analysis: analysis })
    .eq("id", tenderId);

  return NextResponse.json({ analysis });
}
