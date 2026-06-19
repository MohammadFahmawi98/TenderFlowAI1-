import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { extractText } from "@/lib/parsing/extract-text";
import { extractTender } from "@/lib/ai/extract-tender";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const supabase = db();

    // 1. Create the tender record (placeholder while we extract)
    const firstName = files[0].name.replace(/\.[^.]+$/, "");
    const { data: tender, error: tenderErr } = await supabase
      .from("tenders")
      .insert({ name: firstName, status: "analyzing" })
      .select()
      .single();

    if (tenderErr) throw new Error(`Create tender: ${tenderErr.message}`);

    const tenderId = tender.id as string;

    // 2. Upload files to Supabase Storage + extract text in parallel
    const extractedTexts: string[] = [];

    await Promise.all(
      files.map(async (file) => {
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const storagePath = `${tenderId}/${Date.now()}-${file.name}`;

        const { error: storageErr } = await supabase.storage
          .from("tender-files")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        const extractionStatus = storageErr ? "failed" : "running";

        await supabase.from("tender_files").insert({
          tender_id: tenderId,
          name: file.name,
          original_name: file.name,
          storage_path: storagePath,
          mime: file.type,
          size_bytes: file.size,
          extraction_status: extractionStatus,
        });

        if (!storageErr) {
          try {
            const extracted = await extractText(buffer, file.name);
            if (extracted.text.length > 50) {
              extractedTexts.push(
                `--- FILE: ${file.name} ---\n${extracted.text}`,
              );
            }
            await supabase
              .from("tender_files")
              .update({ extraction_status: "done" })
              .eq("tender_id", tenderId)
              .eq("name", file.name);
          } catch {
            await supabase
              .from("tender_files")
              .update({ extraction_status: "failed" })
              .eq("tender_id", tenderId)
              .eq("name", file.name);
          }
        }
      }),
    );

    // 3. Run AI extraction
    const combinedText = extractedTexts.join("\n\n");
    let extraction = null;

    if (combinedText.length > 100) {
      try {
        extraction = await extractTender(combinedText);

        // Persist extraction
        await supabase.from("tender_extractions").upsert({
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
        });

        // Update tender with extracted info + seed agent_runs
        await supabase
          .from("tenders")
          .update({
            name: extraction.tender_name || firstName,
            client: extraction.client_name,
            submission_deadline: extraction.deadline,
            contract_duration: extraction.contract_duration,
            executive_summary: extraction.executive_summary,
            status: "in_progress",
          })
          .eq("id", tenderId);

          } catch (aiErr) {
        console.error("AI extraction error:", aiErr);
        await supabase
          .from("tenders")
          .update({ status: "in_progress" })
          .eq("id", tenderId);
      }
    } else {
      await supabase
        .from("tenders")
        .update({ status: "in_progress" })
        .eq("id", tenderId);
    }

    // Always seed agent run rows (idempotent — ignore conflicts)
    const agentTypes = [
      "intelligence","qualification","compliance","technical","commercial",
      "manpower","ppm","risk","hse","sla","presentation","executive_review",
    ];
    await supabase.from("agent_runs").upsert(
      agentTypes.map((t) => ({ tender_id: tenderId, agent_type: t })),
      { onConflict: "tender_id,agent_type", ignoreDuplicates: true },
    );

    return NextResponse.json({ tenderId, tender, extraction }, { status: 201 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const supabase = db();
  const { data, error } = await supabase
    .from("tenders")
    .select("*, tender_files(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
