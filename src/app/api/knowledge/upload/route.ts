import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { extractText } from "@/lib/parsing/extract-text";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = db();
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const storagePath = `${Date.now()}-${file.name}`;

    // 1. Insert a record in processing state
    const { data: doc, error: insertErr } = await supabase
      .from("knowledge_documents")
      .insert({
        name: file.name,
        type: "document",
        storage_path: storagePath,
        status: "processing",
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 2. Upload to Supabase Storage (bucket: knowledge-docs)
    const { error: storageErr } = await supabase.storage
      .from("knowledge-docs")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageErr) {
      // Mark as failed but return the record
      await supabase
        .from("knowledge_documents")
        .update({ status: "failed" })
        .eq("id", doc.id);
      return NextResponse.json({ ...doc, status: "failed" }, { status: 207 });
    }

    // 3. Extract text
    let contentText = "";
    try {
      const extracted = await extractText(buffer, file.name);
      contentText = extracted.text.slice(0, 100_000); // cap at 100K chars
    } catch {
      // Non-fatal — we still index the file without text
    }

    // 4. Update record with extracted text + indexed status
    const { data: updated } = await supabase
      .from("knowledge_documents")
      .update({ content_text: contentText, status: "indexed" })
      .eq("id", doc.id)
      .select()
      .single();

    return NextResponse.json(updated ?? { ...doc, status: "indexed" }, { status: 201 });
  } catch (err) {
    console.error("Knowledge upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
