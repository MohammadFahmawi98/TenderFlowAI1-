import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { complete } from "@/lib/ai/provider";

export const maxDuration = 60;

export async function POST() {
  const supabase = db();

  // Load all tenders with their agent run stats
  const { data: tenders } = await supabase
    .from("tenders")
    .select("id,name,client,status,contract_value,win_probability,readiness_score,submission_deadline,executive_summary")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!tenders?.length) {
    return NextResponse.json({
      summary: "No tenders found in the system. Upload RFP documents to get started.",
    });
  }

  type TRow = typeof tenders[number];
  const tenderList = tenders.map((t: TRow) =>
    `- ${t.name} (Client: ${t.client ?? "Unknown"}, Status: ${t.status}, Win Prob: ${t.win_probability ?? "N/A"}%, Value: AED ${t.contract_value?.toLocaleString() ?? "TBD"}, Readiness: ${t.readiness_score ?? 0}%)`
  ).join("\n");

  type TenderRow = { contract_value?: number | null; win_probability?: number | null };
  const totalValue = tenders.reduce((sum: number, t: TenderRow) => sum + (t.contract_value ?? 0), 0);
  const withProb = tenders.filter((t: TenderRow) => t.win_probability != null);
  const avgWinProb = withProb.length
    ? withProb.reduce((sum: number, t: TenderRow) => sum + (t.win_probability ?? 0), 0) / withProb.length
    : 0;

  const summary = await complete({
    system: `You are a senior FM bid strategist at Etihad International Hospitality.
Write concise, executive-level intelligence reports. Be specific and actionable.`,
    user: `Generate an Executive Pipeline Summary Report for our tender portfolio.

PIPELINE DATA:
Total Tenders: ${tenders.length}
Total Pipeline Value: AED ${totalValue.toLocaleString()}
Average Win Probability: ${Math.round(avgWinProb)}%

Tender List:
${tenderList}

Write a 3-paragraph executive summary covering:
1. Portfolio health and key opportunities
2. Risk areas and tenders needing attention
3. Strategic recommendations for the next 30 days

Be direct, specific, and actionable.`,
    maxTokens: 600,
  });

  return NextResponse.json({ summary });
}
