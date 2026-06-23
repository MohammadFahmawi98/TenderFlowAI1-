import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { extractText } from "@/lib/parsing/extract-text";

export const maxDuration = 60;

// ─── Auto-detection helpers ───────────────────────────────────────────────────

function detectExpiry(filename: string): string | null {
  const lower = filename.toLowerCase();

  // Pattern: YYYY-YYYY  e.g. "2025-2026" or "(2022-2025)"
  const rangeMatch = lower.match(/[(\s]?(\d{4})-(\d{4})[)\s.]?/);
  if (rangeMatch) {
    const endYear = parseInt(rangeMatch[2]);
    if (endYear >= 2020 && endYear <= 2040) {
      return `${endYear}-12-31T23:59:59.000Z`;
    }
  }

  // Single year at end: "Certificate 2026.pdf"
  const singleMatch = lower.match(/[- _](\d{4})\.(pdf|docx|xlsx|jpg|png)$/);
  if (singleMatch) {
    const yr = parseInt(singleMatch[1]);
    if (yr >= 2020 && yr <= 2040) return `${yr}-12-31T23:59:59.000Z`;
  }

  return null;
}

function detectCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("trade license") || lower.includes("trade licence")) return "certification";
  if (lower.includes("iso") || lower.includes("certificate"))            return "certification";
  if (lower.includes("qhse") && (lower.includes("iso") || lower.includes("cert"))) return "certification";
  if (lower.includes("org chart") || lower.includes("organizational"))   return "template";
  if (lower.includes("similar project") || lower.includes("experience")) return "past_project";
  if (lower.includes("past project") || lower.includes("case study"))    return "past_project";
  if (lower.includes("sop") || lower.includes("procedure"))              return "sop";
  if (lower.includes("policy"))                                           return "sop";
  if (lower.includes("hse plan") || lower.includes("qhse plan"))         return "hse_plan";
  if (lower.includes("health") || lower.includes("safety"))              return "hse_plan";
  if (lower.includes("ppm") || lower.includes("preventive maintenance")) return "ppm_library";
  if (lower.includes("sla"))                                              return "sla_library";
  if (lower.includes("kpi"))                                              return "kpi_library";
  if (lower.includes("technical proposal") || lower.includes("method statement")) return "technical_proposal";
  if (lower.includes("risk"))                                             return "risk_register";
  if (lower.includes("reference") || lower.includes("testimonial"))      return "reference";
  if (lower.includes("mobilization") || lower.includes("mobilisation"))  return "mobilization_plan";
  if (lower.includes("qhse"))                                             return "hse_plan";
  return "document";
}

// ─── Upload handler ───────────────────────────────────────────────────────────

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

    const expiresAt   = detectExpiry(file.name);
    const docCategory = detectCategory(file.name);

    // 1. Insert a record in processing state
    const { data: doc, error: insertErr } = await supabase
      .from("knowledge_documents")
      .insert({
        name:         file.name,
        type:         "document",
        storage_path: storagePath,
        status:       "processing",
        file_size:    file.size,
        mime_type:    file.type || "application/octet-stream",
        expires_at:   expiresAt,
        doc_category: docCategory,
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
      await supabase.from("knowledge_documents").update({ status: "failed" }).eq("id", doc.id);
      return NextResponse.json({ ...doc, status: "failed" }, { status: 207 });
    }

    // 3. Extract text
    let contentText = "";
    try {
      const extracted = await extractText(buffer, file.name);
      contentText = extracted.text.slice(0, 100_000);
    } catch {
      // Non-fatal — file still indexed without text extraction
    }

    // 4. Mark indexed
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
