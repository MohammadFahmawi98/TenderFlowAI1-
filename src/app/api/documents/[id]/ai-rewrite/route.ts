import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/ai/provider";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params; // id available if needed for context
  const { text, action } = await req.json() as { text: string; action: string };

  const actionMap: Record<string, string> = {
    rewrite:         "Rewrite this text to be clearer and more professional while preserving the meaning.",
    expand:          "Expand this text with more detail, specific examples, and supporting information.",
    shorten:         "Shorten this text to be more concise while preserving all key information.",
    professional:    "Rewrite this text to be more professional and executive-appropriate.",
    technical:       "Rewrite this text to be more technically detailed and precise.",
    translate_ar:    "Translate this text to Arabic (formal business Arabic).",
  };

  const instruction = actionMap[action] ?? actionMap.rewrite;

  const result = await complete({
    system: "You are an expert FM bid writer for Etihad International Hospitality. Return ONLY the rewritten text — no commentary, no quotation marks.",
    user: `${instruction}\n\nText to process:\n${text}`,
    temperature: 0.3,
    maxTokens: 1500,
  });

  return NextResponse.json({ result });
}
