import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export const maxDuration = 60;

const AGENT_ORDER = [
  "intelligence", "qualification", "compliance", "technical",
  "commercial", "manpower", "ppm", "risk", "hse", "sla",
  "presentation", "executive_review",
];

const AGENT_TITLES: Record<string, string> = {
  intelligence:     "Tender Intelligence Briefing",
  qualification:    "Qualification Assessment",
  compliance:       "Compliance Matrix",
  technical:        "Technical Proposal",
  commercial:       "Commercial Proposal",
  manpower:         "Manpower Plan",
  ppm:              "PPM Schedule",
  risk:             "Risk Register",
  hse:              "HSE Plan",
  sla:              "SLA & KPI Framework",
  presentation:     "Executive Presentation",
  executive_review: "Executive Review Report",
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(h[1-6]|p|li|tr|td|th|ul|ol|div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;

  const [{ data: tender }, { data: documents }, { data: agentRuns }] = await Promise.all([
    db().from("tenders").select("*").eq("id", tenderId).single(),
    db().from("documents").select("*, document_versions(*)").eq("tender_id", tenderId).order("created_at"),
    db().from("agent_runs").select("agent_type, output_content, status").eq("tender_id", tenderId).eq("status", "completed"),
  ]);

  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const sections: Paragraph[] = [
    new Paragraph({
      text: tender.name ?? "Tender Submission Package",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({ children: [new TextRun({ text: `Client: ${tender.client ?? "—"}`, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Deadline: ${tender.submission_deadline ?? "—"}` })] }),
    new Paragraph({ text: "" }),
  ];

  // Check whether any documents have content
  const docsWithContent = (documents ?? []).filter((d: Record<string, unknown>) => {
    const versions = Array.isArray(d.document_versions) ? d.document_versions : [];
    return versions.length > 0;
  });

  if (docsWithContent.length > 0) {
    // Use documents pipeline output
    for (const doc of docsWithContent) {
      const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
      const current = versions.find((v: { id: string }) => v.id === doc.current_version_id) ?? versions[versions.length - 1];
      if (!current) continue;

      sections.push(new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }));

      const rawText: string = current.content_json?.text ?? (current.content_html ? stripHtml(current.content_html) : "");
      for (const line of rawText.split("\n")) {
        const l = line.trim();
        if (l) sections.push(new Paragraph({ children: [new TextRun(l)] }));
      }
      sections.push(new Paragraph({ text: "" }));
    }
  } else if (agentRuns && agentRuns.length > 0) {
    // Fallback: use agent_runs.output_content (ordered by AGENT_ORDER)
    const runMap = Object.fromEntries((agentRuns).map((r: { agent_type: string; output_content?: string }) => [r.agent_type, r]));

    for (const key of AGENT_ORDER) {
      const run = runMap[key];
      if (!run?.output_content) continue;

      sections.push(new Paragraph({ text: AGENT_TITLES[key] ?? key, heading: HeadingLevel.HEADING_1 }));

      for (const line of run.output_content.split("\n")) {
        const l = line.trim();
        // Skip markdown table separators
        if (/^\|[-| :]+\|$/.test(l)) continue;
        // Table rows: strip pipes, render as indented text
        if (l.startsWith("|")) {
          const cells = l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c: string) => c.trim()).filter(Boolean);
          sections.push(new Paragraph({ children: [new TextRun({ text: cells.join("  |  "), size: 20 })] }));
        } else if (l) {
          const clean = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-•*]\s+/, "• ").replace(/^#+\s+/, "");
          sections.push(new Paragraph({ children: [new TextRun(clean)] }));
        }
      }
      sections.push(new Paragraph({ text: "" }));
    }
  }

  const docx = new Document({ sections: [{ properties: {}, children: sections }] });
  const buffer = await Packer.toBuffer(docx);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${(tender.name ?? "submission").replace(/[^a-z0-9]/gi, "_")}_package.docx"`,
    },
  });
}
