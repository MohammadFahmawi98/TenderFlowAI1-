import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const body = await req.json();
  const supabase = db();
  const { data, error } = await supabase
    .from("team_members")
    .update(body)
    .eq("id", memberId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const supabase = db();
  const { error } = await supabase.from("team_members").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
