import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = db();

  const patch: Record<string, unknown> = {};
  if (body.expires_at !== undefined) patch.expires_at = body.expires_at;
  if (body.doc_category !== undefined) patch.doc_category = body.doc_category;
  if (body.expiry_notified !== undefined) patch.expiry_notified = body.expiry_notified;

  const { data, error } = await supabase
    .from("knowledge_documents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
