import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export const dynamic = "force-dynamic";

const SECTION_TYPES = ["experiences","scope","manpower","qhse","technical","tools","quality","references"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  const { data } = await supabase
    .from("proposal_sections")
    .select("*")
    .eq("tender_id", id)
    .order("created_at");

  // Return a full map — include empties for sections not yet generated
  const map: Record<string, unknown> = {};
  for (const t of SECTION_TYPES) {
    const found = (data ?? []).find((r: { section_type: string }) => r.section_type === t);
    map[t] = found ?? { section_type: t, status: "empty", content_html: null, section_data: {} };
  }

  return NextResponse.json(map);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { section_type, content_html, section_data, status } = body as {
    section_type: string;
    content_html?: string;
    section_data?: Record<string, unknown>;
    status?: string;
  };

  if (!section_type) {
    return NextResponse.json({ error: "section_type required" }, { status: 400 });
  }

  const supabase = db();
  const patch: Record<string, unknown> = { tender_id: id, section_type };
  if (content_html !== undefined) patch.content_html = content_html;
  if (section_data !== undefined) patch.section_data = section_data;
  if (status !== undefined) {
    patch.status = status;
    if (status === "ready") patch.generated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("proposal_sections")
    .upsert(patch, { onConflict: "tender_id,section_type" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
