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
  const { data } = await db().from("tender_extractions").select("*").eq("tender_id", id).single();
  return NextResponse.json(data ?? null);
}

/**
 * POST /api/tenders/[id]/extraction
 * Re-downloads failed files from storage and re-runs text extraction.
 * Body: { fileIds?: string[] }  — omit to retry ALL failed files.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = db();

  const body = await req.json().catch(() => ({}));
  const fileIds: string[] | undefined = body?.fileIds;

  // Load failed (or requested) files
  let query = supabase
    .from("tender_files")
    .select("id, name, storage_path, mime")
    .eq("tender_id", tenderId);

  if (fileIds?.length) {
    query = query.in("id", fileIds);
  } else {
    query = query.eq("extraction_status", "failed");
  }

  const { data: files, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!files?.length) return NextResponse.json({ retried: 0, succeeded: 0 });

  const extractedTexts: string[] = [];
  let retried = 0;
  let succeeded = 0;

  await Promise.all(
    files.map(async (file: { id: string; name: string; storage_path: string; mime: string }) => {
      retried++;

      // Download from storage
      const { data: blob, error: dlErr } = await supabase.storage
        .from("tender-files")
        .download(file.storage_path);

      if (dlErr || !blob) {
        console.warn(`Cannot download ${file.name} from storage: ${dlErr?.message}`);
        return;
      }

      const arrayBuf = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      await supabase
        .from("tender_files")
        .update({ extraction_status: "running" })
        .eq("id", file.id);

      try {
        const extracted = await extractText(buffer, file.name);
        if (extracted.text.length > 50) {
          extractedTexts.push(`--- FILE: ${file.name} ---\n${extracted.text}`);
        }
        await supabase
          .from("tender_files")
          .update({ extraction_status: "done" })
          .eq("id", file.id);
        succeeded++;
      } catch (extractErr) {
        console.warn(`Re-extract failed for ${file.name}:`, extractErr);
        await supabase
          .from("tender_files")
          .update({ extraction_status: "failed" })
          .eq("id", file.id);
      }
    }),
  );

  // If we got new text, merge into tender_extractions
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
    } catch (aiErr) {
      console.error("Re-extraction AI error:", aiErr);
    }
  }

  return NextResponse.json({ retried, succeeded });
}
