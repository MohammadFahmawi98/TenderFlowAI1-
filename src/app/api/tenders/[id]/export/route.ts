import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;

  // Fetch tender + all documents with their latest version
  const [{ data: tender }, { data: documents }] = await Promise.all([
    db().from("tenders").select("*").eq("id", tenderId).single(),
    db()
      .from("documents")
      .select("*, document_versions(*)")
      .eq("tender_id", tenderId)
      .order("created_at"),
  ]);

  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  // Build a single DOCX with all documents concatenated
  const sections: Array<Paragraph> = [
    new Paragraph({
      text: tender.name ?? "Tender Submission Package",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Client: ${tender.client ?? "—"}`, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Deadline: ${tender.submission_deadline ?? "—"}` })],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const doc of (documents ?? [])) {
    // Find the current version
    const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
    const current = versions.find((v: { id: string }) => v.id === doc.current_version_id)
      ?? versions[versions.length - 1];

    if (!current) continue;

    // Section header
    sections.push(
      new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }),
    );

    // Strip HTML and split into paragraphs
    const rawText: string = current.content_json?.text ?? "";
    const plainText = rawText
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    for (const line of plainText.split("\n")) {
      sections.push(new Paragraph({ children: [new TextRun(line.trim())] }));
    }

    sections.push(new Paragraph({ text: "" }));
  }

  const docx = new Document({
    sections: [{ properties: {}, children: sections }],
  });

  const buffer = await Packer.toBuffer(docx);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${(tender.name ?? "submission").replace(/[^a-z0-9]/gi, "_")}_package.docx"`,
    },
  });
}
