import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await db().from("agent_runs").select("*").eq("tender_id", id).order("agent_type");
  return NextResponse.json(data ?? []);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const { agent_type, output_content } = body as { agent_type?: string; output_content?: string };
  if (!agent_type || output_content === undefined) {
    return NextResponse.json({ error: "agent_type and output_content required" }, { status: 400 });
  }
  const { error } = await db()
    .from("agent_runs")
    .update({ output_content })
    .eq("tender_id", id)
    .eq("agent_type", agent_type);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
