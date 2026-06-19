import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await db()
    .from("documents")
    .select("*, document_versions(*)")
    .eq("id", id)
    .single();
  return NextResponse.json(data ?? null);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  // If content is being updated, create a new version
  if (body.content_html || body.content_json) {
    const { data: current } = await db()
      .from("documents")
      .select("current_version_id, document_versions(version_no)")
      .eq("id", id)
      .single();

    const maxVersion = Array.isArray(current?.document_versions)
      ? Math.max(...current.document_versions.map((v: { version_no: number }) => v.version_no), 0)
      : 0;

    const { data: newVersion } = await db()
      .from("document_versions")
      .insert({
        document_id: id,
        version_no: maxVersion + 1,
        content_html: body.content_html,
        content_json: body.content_json,
        note: body.note ?? "Manual edit",
      })
      .select()
      .single();

    if (newVersion) {
      await db()
        .from("documents")
        .update({ current_version_id: newVersion.id, review_status: body.review_status ?? "in_review", updated_at: new Date().toISOString() })
        .eq("id", id);
    }
    return NextResponse.json({ success: true, version: newVersion });
  }

  // Otherwise just update metadata
  const { data, error } = await db().from("documents").update(body).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
