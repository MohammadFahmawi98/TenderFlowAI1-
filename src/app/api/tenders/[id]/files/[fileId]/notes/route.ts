import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: tenderId, fileId } = await params;
  const supabase = db();

  const { data, error } = await supabase
    .from("tender_files")
    .select("notes")
    .eq("id", fileId)
    .eq("tender_id", tenderId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.notes ?? []);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: tenderId, fileId } = await params;
  const body = await req.json().catch(() => ({}));
  const notes = body?.notes ?? [];
  const supabase = db();

  const { error } = await supabase
    .from("tender_files")
    .update({ notes })
    .eq("id", fileId)
    .eq("tender_id", tenderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
