import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { extractText } from "@/lib/parsing/extract-text";
import { extractTender } from "@/lib/ai/extract-tender";

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();
  const { data, error } = await supabase
    .from("tender_files")
    .select("id,name,original_name,mime,size_bytes,extraction_status,created_at,notes")
    .eq("tender_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = db();

  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const extractedTexts: string[] = [];

  await Promise.all(
    files.map(async (file, idx) => {
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      // Use index to guarantee unique path when multiple files upload simultaneously
      const storagePath = `${tenderId}/${Date.now()}-${idx}-${file.name}`;

      // Fire storage upload best-effort — do NOT gate extraction on it
      const { error: storageErr } = await supabase.storage
        .from("tender-files")
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (storageErr) {
        console.warn(`Storage upload failed for ${file.name}: ${storageErr.message}`);
      }

      await supabase.from("tender_files").insert({
        tender_id: tenderId,
        name: file.name,
        original_name: file.name,
        storage_path: storagePath,
        mime: file.type,
        size_bytes: file.size,
        extraction_status: "running",
      });

      // Extract text from buffer regardless of storage result
      try {
        const extracted = await extractText(buffer, file.name);
        if (extracted.text.length > 50) {
          extractedTexts.push(`--- FILE: ${file.name} ---\n${extracted.text}`);
        }
        await supabase
          .from("tender_files")
          .update({ extraction_status: "done" })
          .eq("tender_id", tenderId)
          .eq("name", file.name);
      } catch (extractErr) {
        console.warn(`Text extraction failed for ${file.name}:`, extractErr);
        await supabase
          .from("tender_files")
          .update({ extraction_status: "failed" })
          .eq("tender_id", tenderId)
          .eq("name", file.name);
      }
    }),
  );

  // Re-run AI extraction if we got text, merge with any existing extraction
  if (extractedTexts.length > 0) {
    try {
      const combined = extractedTexts.join("\n\n");
      const extraction = await extractTender(combined);

      await supabase.from("tender_extractions").upsert(
        {
          tender_id: tenderId,
          client_name: extraction.client_name,
          tender_name: extraction.tender_name,
          deadline: extraction.deadline,
          contract_duration: extraction.contract_duration,
          scope_of_work: extraction.scope_of_work,
          technical_requirements: extraction.technical_requirements,
          commercial_requirements: extraction.commercial_requirements,
          evaluation_criteria: extraction.evaluation_criteria,
          boq_data: extraction.boq_data,
          asset_information: extraction.asset_information,
          staffing_requirements: extraction.staffing_requirements,
          raw_json: extraction,
        },
        { onConflict: "tender_id" },
      );

      if (extraction.tender_name || extraction.client_name || extraction.deadline) {
        await supabase.from("tenders").update({
          ...(extraction.tender_name && { name: extraction.tender_name }),
          ...(extraction.client_name && { client: extraction.client_name }),
          ...(extraction.deadline && { submission_deadline: extraction.deadline }),
          ...(extraction.contract_duration && { contract_duration: extraction.contract_duration }),
        }).eq("id", tenderId);
      }
    } catch (err) {
      console.error("Re-extraction error:", err);
    }
  }

  return NextResponse.json({ ok: true, added: files.length });
}
