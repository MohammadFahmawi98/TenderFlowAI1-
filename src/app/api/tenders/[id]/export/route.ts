import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageBreak, Footer, PageNumber,
} from "docx";

export const maxDuration = 60;

/* ── Types ────────────────────────────────────────────────── */
interface BOQItem  { id: string; description: string; unit: string; qty: number; monthly_rate: number; }
interface BOQSection { id: string; label: string; items: BOQItem[]; }
interface StaffRow { id: string; job_name: string; count: number; monthly_rate: number; }
interface BOQData  {
  ref_number: string; validity_days: number; vat_pct: number;
  consumables_monthly: number; sections: BOQSection[]; staff: StaffRow[];
}

/* ── Helpers ──────────────────────────────────────────────── */
function fmtN(v: number) { return v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function secTotal(s: BOQSection) { return s.items.reduce((sum, it) => sum + it.monthly_rate * it.qty, 0); }
function boqTotal(b: BOQData)   { return b.sections.reduce((sum, s) => sum + secTotal(s), 0); }

const MAROON  = "8B3520";
const GOLD    = "C8A24A";
const MAROON_LIGHT = "F9F2F0";
const WHITE   = "FFFFFF";
const GREY_BG = "F3F4F6";

/* ── Colour helper ────────────────────────────────────────── */
function shade(fill: string): { type: typeof ShadingType.CLEAR; fill: string; color: typeof AutoColor } {
  return { type: ShadingType.CLEAR, fill, color: "auto" as typeof AutoColor };
}
const AutoColor = "auto" as const;

/* ── Cell factory ──────────────────────────────────────────── */
function cell(
  text: string,
  opts: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; sz?: number; width?: number; } = {},
): TableCell {
  const { bold = false, fill, color = "1a1a1a", align = AlignmentType.LEFT, sz = 20, width } = opts;
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size: sz, color, font: "Calibri" })],
      }),
    ],
  });
}

/* ── Section header row ────────────────────────────────────── */
function sectionHeaderRow(id: string, label: string, monthly: number, yearly: number): TableRow {
  return new TableRow({
    children: [
      cell(id,              { bold: true, fill: MAROON, color: WHITE, sz: 18 }),
      cell(label,           { bold: true, fill: MAROON, color: WHITE, sz: 18 }),
      cell("", { fill: MAROON }),
      cell("", { fill: MAROON }),
      cell(fmtN(monthly),   { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.RIGHT, sz: 18 }),
      cell(fmtN(yearly),    { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.RIGHT, sz: 18 }),
    ],
  });
}

/* ── Sub-total row ─────────────────────────────────────────── */
function subTotalRow(monthly: number, yearly: number): TableRow {
  return new TableRow({
    children: [
      cell("", { fill: GREY_BG }),
      cell("Sub Total", { bold: true, fill: GREY_BG }),
      cell("", { fill: GREY_BG }),
      cell("", { fill: GREY_BG }),
      cell(fmtN(monthly), { bold: true, fill: GREY_BG, align: AlignmentType.RIGHT }),
      cell(fmtN(yearly),  { bold: true, fill: GREY_BG, align: AlignmentType.RIGHT }),
    ],
  });
}

/* ── BOQ table header ──────────────────────────────────────── */
function boqHeader(): TableRow {
  return new TableRow({
    children: [
      cell("SN",            { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 5 }),
      cell("DESCRIPTION",   { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 35 }),
      cell("UNIT",          { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 10, align: AlignmentType.CENTER }),
      cell("QTY",           { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 10, align: AlignmentType.CENTER }),
      cell("TOTAL MONTHLY PAYMENT (AED)", { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 20, align: AlignmentType.RIGHT }),
      cell("TOTAL YEARLY PAYMENT (AED)",  { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 20, align: AlignmentType.RIGHT }),
    ],
  });
}

/* ── Item row ──────────────────────────────────────────────── */
function itemRow(sn: number, item: BOQItem, odd: boolean): TableRow {
  const fill = odd ? MAROON_LIGHT : WHITE;
  const monthly = item.monthly_rate;
  const yearly  = item.monthly_rate * item.qty;
  return new TableRow({
    children: [
      cell(String(sn),      { fill, sz: 18, align: AlignmentType.CENTER }),
      cell(item.description, { fill, sz: 18 }),
      cell(item.unit,        { fill, sz: 18, align: AlignmentType.CENTER }),
      cell(String(item.qty), { fill, sz: 18, align: AlignmentType.CENTER }),
      cell(fmtN(monthly),   { fill, sz: 18, align: AlignmentType.RIGHT }),
      cell(fmtN(yearly),    { fill, sz: 18, align: AlignmentType.RIGHT }),
    ],
  });
}

const STANDARD_EXCLUSIONS = [
  "Spare parts will be charged at cost plus 5%",
  "Any plant and sub-contractors required in addition to those included in the Agreement shall be charged as agreed",
  "Staff manpower cost based on 12 hours/shift, 6 days/week",
  "Replacement of equipment: Excluded",
  "Refurbishment: Excluded",
  "Maintenance of Furniture's, Polishing, Fabrics: Excluded",
  "All Initial Repairs: Excluded",
  "All IT Related works: Excluded",
  "Anything not mentioned expressly in this proposal is not covered",
];

const CONSUMABLES = [
  "Lubricating oils","Electrical / Electronic Fuses","Cleaning materials for MEP Works",
  "Insulation tapes","Greases","Refrigerant (Top-up only)",
  "Lamps and fluorescent tubes (Normal, energy save & LED, including chokes, etc.)",
  "Grey duct tape 2\" x10","Black PVC tape 2\" x 10","Electrical connectors","Foam tape 2\"",
  "Masking tape 1\" and 2\"","Aluminium foil tape 2\"","Polythene sheet","Coil cleaner",
  "Rivets","All kinds of nuts and bolts","Cable lugs and terminals",
  "Electrical switches and sockets – for replacement only","Emery paper",
  "Fevicol","Bisonkit","Copper and silver brazing rod","Teflon tape","Araldite",
  "Tangit Cleaner","Insulation glue","Cable tie","Foster – Anti Fungus","Canvas cloth",
  "Jute","Rubber Gloves","Wire Brush","Petroleum Jelly","Shellac","Cotton Gloves",
  "Disposable Mask","Boss white","Metal Primer – touch up only less than 2 m2",
  "Hack saw blades, drill bits etc.","Battery water","Heat resistant scotch tape 3M",
  "Scrapper","Fishers for handyman","Clamp and support","Capacitors for A/C",
  "Rubber gasket","Plastic pipe fittings PVC, PPR, UPVC upto 2 Inch","Silicone sealant",
  "Hose pipe","Thinner for 1 Sq. Mtr.","AC remote batteries","Contactors upto 20A",
  "Enamel paint touch up for MEP Equipment limited to 1 Sq. Mtr.","Paint Brushes",
  "Selector switches – Auto/Manual","Push buttons","Emergency Switches",
  "Cotton Waste","Indicator Lamps","Tangit Glue",
];

function AGENT_ORDER() {
  return ["intelligence","qualification","compliance","technical","commercial","manpower","ppm","risk","hse","sla","presentation","executive_review"];
}
const AGENT_TITLES: Record<string, string> = {
  intelligence:"Tender Intelligence Briefing", qualification:"Qualification Assessment",
  compliance:"Compliance Matrix", technical:"Technical Proposal", commercial:"Commercial Proposal",
  manpower:"Manpower Plan", ppm:"PPM Schedule", risk:"Risk Register",
  hse:"HSE Plan", sla:"SLA & KPI Framework", presentation:"Executive Presentation",
  executive_review:"Executive Review Report",
};

function stripHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi,"\n").replace(/<\/?(h[1-6]|p|li|tr|td|th|ul|ol|div)[^>]*>/gi,"\n")
    .replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&nbsp;/g," ").replace(/\n{3,}/g,"\n\n").trim();
}

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? 22, color: opts.color ?? "1a1a1a", font: "Calibri" })],
  });
}

/* ── EIH page footer ───────────────────────────────────────── */
function eihFooter(tenderName: string) {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: MAROON, space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `P.O Box: 42013, Abu Dhabi, Tel: +971 2 671 1320, Fax: +971 2 671 1325  |  Email: bd@etihadhospitality.ae  |  www.etihadhospitality.ae`, size: 16, color: "666666", font: "Calibri" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${tenderName}  ·  Page `, size: 16, color: "666666", font: "Calibri" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666", font: "Calibri" }),
        ],
      }),
    ],
  });
}

/* ════════════════════════════════════════════════════════════ */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const body = await req.json().catch(() => ({}));
  const exportType: string = body.type ?? "all";

  const supabase = db();

  const [{ data: tender }, { data: extraction }, { data: agentRuns }, { data: documents }] = await Promise.all([
    supabase.from("tenders").select("*").eq("id", tenderId).single(),
    supabase.from("tender_extractions").select("*").eq("tender_id", tenderId).maybeSingle(),
    supabase.from("agent_runs").select("agent_type, output_content, status").eq("tender_id", tenderId),
    supabase.from("documents").select("*, document_versions(*)").eq("tender_id", tenderId).order("created_at"),
  ]);

  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const tenderName = tender.name ?? "Tender Submission";
  const client     = tender.client ?? "Valued Client";
  const boqData: BOQData | null = extraction?.boq_data?.sections ? extraction.boq_data as BOQData : null;
  const runMap  = Object.fromEntries((agentRuns ?? []).map((r: { agent_type: string; output_content?: string; status: string }) => [r.agent_type, r]));

  const footer  = eihFooter(tenderName);

  /* ─── COMMERCIAL PROPOSAL ─────────────────────────────── */
  if (exportType === "commercial") {
    const children: (Paragraph | Table)[] = [];

    // Cover header
    children.push(
      p("ETIHAD INT'L HOSPITALITY", { bold: true, size: 36, color: MAROON, align: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
      p("YOUR FM SERVICE PROVIDER OF CHOICE", { size: 20, color: GOLD, align: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
      p(tenderName.toUpperCase(), { bold: true, size: 28, color: MAROON, align: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
    );

    // Proposal details box
    const issueDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const refNum = boqData?.ref_number || `EIHBIDQ/FM/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,"0")}`;
    const validity = boqData?.validity_days ?? 90;

    [
      ["Attention", "Procurement Department"],
      ["Reference", refNum],
      ["Issue Date", issueDate],
      ["Validity", `${validity} Days`],
      ["Subject", tenderName],
    ].forEach(([label, value]) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}:  `, bold: true, size: 20, font: "Calibri" }),
          new TextRun({ text: value, size: 20, font: "Calibri" }),
        ],
      }));
    });

    children.push(new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }));

    // Cover letter
    children.push(
      p("Dear Sir,", { size: 22 }),
      new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
      new Paragraph({
        children: [new TextRun({
          text: `In appreciation of your interest in our facilities management services, we are very pleased to provide you with our best and competitive proposal for your kind consideration. With a skilled workforce of over 5,000 employees, EIH delivers professional facilities management services across several sectors. We are proud to hold facilities management awards year over year. EIH is certified by the UAE authorities and by notable globally recognized organizations. We provide individualized FM services and are always keen to adapt our services towards your needs.`,
          size: 20, font: "Calibri",
        })],
      }),
      new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
      new Paragraph({
        children: [new TextRun({
          text: `With our enclosed offer, we guarantee you an excellent price-performance ratio and look forward to serving you soon. Your kind reply is expected at bd@etihadhospitality.ae and should you require any clarifications or additional information please contact us at your convenience.`,
          size: 20, font: "Calibri",
        })],
      }),
      new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
      p("Sincerely,", { size: 20 }),
      p("Radhouan Baraket", { bold: true, size: 22 }),
      p("Bid Manager", { size: 20, color: "666666" }),
      new Paragraph({ children: [new PageBreak()] }),
    );

    // Scope of work
    children.push(
      p("SCOPE OF WORK", { bold: true, size: 24, color: MAROON }),
      new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
    );
    const scope = extraction?.scope_of_work ?? "Facility Management — MEP Services & Civil Works (PPM & RM), Specialized Systems & Services";
    for (const line of scope.split("\n")) {
      if (line.trim()) children.push(p(`• ${line.trim()}`, { size: 20 }));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // BOQ table
    if (boqData) {
      children.push(
        p("BILL OF QUANTITIES (BOQ)", { bold: true, size: 24, color: MAROON }),
        new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
      );

      const boqRows: TableRow[] = [boqHeader()];
      let snCounter = 1;
      for (const section of boqData.sections) {
        const st = secTotal(section);
        boqRows.push(sectionHeaderRow(section.id, section.label, st / 12, st));
        section.items.forEach((item, idx) => {
          boqRows.push(itemRow(snCounter++, item, idx % 2 === 1));
        });
        boqRows.push(subTotalRow(st / 12, st));
      }

      const total    = boqTotal(boqData);
      const vat      = total * (boqData.vat_pct / 100);
      const grandTotal = total + vat;

      // Totals
      boqRows.push(new TableRow({
        children: [cell("", { fill: GREY_BG }), cell("TOTAL", { bold: true, fill: GREY_BG, sz: 20 }), cell("", { fill: GREY_BG }), cell("", { fill: GREY_BG }),
          cell("", { fill: GREY_BG }), cell(fmtN(total), { bold: true, fill: GREY_BG, align: AlignmentType.RIGHT, sz: 20 })],
      }));
      boqRows.push(new TableRow({
        children: [cell("", {}), cell(`VAT (${boqData.vat_pct}%)`, { sz: 20 }), cell("", {}), cell("", {}),
          cell("", {}), cell(fmtN(vat), { align: AlignmentType.RIGHT, sz: 20 })],
      }));
      boqRows.push(new TableRow({
        children: [
          cell("", { fill: MAROON }), cell("GRAND TOTAL", { bold: true, fill: MAROON, color: WHITE, sz: 22 }),
          cell("", { fill: MAROON }), cell("", { fill: MAROON }),
          cell("", { fill: MAROON }),
          cell(fmtN(grandTotal), { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.RIGHT, sz: 22 }),
        ],
      }));

      children.push(new Table({ rows: boqRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Staff rates table
    if (boqData?.staff?.length) {
      children.push(
        p("STAFF RATE SCHEDULE", { bold: true, size: 24, color: MAROON }),
        p("Based on 12 Hours Shift / 6 Days per Week", { size: 18, color: "666666" }),
        new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
      );

      const staffRows: TableRow[] = [
        new TableRow({ children: [
          cell("SN",         { bold: true, fill: GOLD, color: WHITE, sz: 18 }),
          cell("JOB NAME",   { bold: true, fill: GOLD, color: WHITE, sz: 18 }),
          cell("TOTAL NO.",  { bold: true, fill: GOLD, color: WHITE, sz: 18, align: AlignmentType.CENTER }),
          cell("UNIT RATE PER MONTH (AED)",{ bold: true, fill: GOLD, color: WHITE, sz: 18, align: AlignmentType.RIGHT }),
          cell("UNIT RATE PER YEAR (AED)", { bold: true, fill: GOLD, color: WHITE, sz: 18, align: AlignmentType.RIGHT }),
        ]}),
      ];

      boqData.staff.forEach((row, idx) => {
        const fill = idx % 2 === 1 ? MAROON_LIGHT : WHITE;
        staffRows.push(new TableRow({ children: [
          cell(String(idx + 1),              { fill, sz: 18, align: AlignmentType.CENTER }),
          cell(row.job_name,                  { fill, sz: 18 }),
          cell(String(row.count),             { fill, sz: 18, align: AlignmentType.CENTER }),
          cell(fmtN(row.monthly_rate * row.count), { fill, sz: 18, align: AlignmentType.RIGHT }),
          cell(fmtN(row.monthly_rate * row.count * 12), { fill, sz: 18, align: AlignmentType.RIGHT }),
        ]}));
      });

      const staffMonthly = boqData.staff.reduce((s, r) => s + r.monthly_rate * r.count, 0);
      const staffYearly  = boqData.staff.reduce((s, r) => s + r.monthly_rate * r.count * 12, 0);
      const staffCount   = boqData.staff.reduce((s, r) => s + r.count, 0);
      staffRows.push(new TableRow({ children: [
        cell("",            { fill: MAROON }),
        cell("TOTAL",       { bold: true, fill: MAROON, color: WHITE, sz: 20 }),
        cell(String(staffCount), { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.CENTER, sz: 20 }),
        cell(fmtN(staffMonthly), { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.RIGHT, sz: 20 }),
        cell(fmtN(staffYearly),  { bold: true, fill: MAROON, color: WHITE, align: AlignmentType.RIGHT, sz: 20 }),
      ]}));

      children.push(new Table({ rows: staffRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Consumables list
    children.push(
      p("LIST OF CONSUMABLES", { bold: true, size: 24, color: MAROON }),
      new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
    );
    CONSUMABLES.forEach((item, idx) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${String(idx + 1).padStart(2, " ")}.  ${item}`, size: 20, font: "Calibri" }),
        ],
      }));
    });
    children.push(new Paragraph({ children: [new PageBreak()] }));

    // Assumptions & Exclusions
    children.push(
      p("ASSUMPTIONS & EXCLUSIONS", { bold: true, size: 24, color: MAROON }),
      new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }),
    );
    children.push(p("Assumptions", { bold: true, size: 22, color: "444444" }));
    for (const exc of STANDARD_EXCLUSIONS.slice(0, 3)) {
      children.push(new Paragraph({ children: [new TextRun({ text: `•  ${exc}`, size: 20, font: "Calibri" })] }));
    }
    children.push(new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }));
    children.push(p("Exclusions", { bold: true, size: 22, color: "444444" }));
    for (const exc of STANDARD_EXCLUSIONS.slice(3)) {
      children.push(new Paragraph({ children: [new TextRun({ text: `•  ${exc}`, size: 20, font: "Calibri" })] }));
    }

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        headers: {},
        footers: { default: footer },
        children,
      }],
    });

    const buf = await Packer.toBuffer(doc);
    const filename = `${tenderName.replace(/[^a-z0-9]/gi, "_")}_Commercial_Proposal.docx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  /* ─── SINGLE SECTION EXPORT ───────────────────────────── */
  if (exportType !== "all") {
    const run = runMap[exportType];
    if (!run?.output_content) {
      return NextResponse.json({ error: "Section not generated yet" }, { status: 404 });
    }
    const title = AGENT_TITLES[exportType] ?? exportType;
    const sections: Paragraph[] = [
      new Paragraph({ text: tenderName, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28, color: MAROON, font: "Calibri" })] }),
      new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
    ];
    for (const line of run.output_content.split("\n")) {
      const l = line.trim();
      if (!l || /^\|[-| :]+\|$/.test(l)) continue;
      if (l.startsWith("|")) {
        const cells = l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c: string) => c.trim()).filter(Boolean);
        sections.push(new Paragraph({ children: [new TextRun({ text: cells.join("   |   "), size: 20, font: "Calibri" })] }));
      } else {
        const clean = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-•*]\s+/, "• ").replace(/^#+\s+/, "");
        sections.push(new Paragraph({ children: [new TextRun({ text: clean, size: 20, font: "Calibri" })] }));
      }
    }
    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        footers: { default: footer },
        children: sections,
      }],
    });
    const buf = await Packer.toBuffer(doc);
    const filename = `${tenderName.replace(/[^a-z0-9]/gi, "_")}_${title.replace(/[^a-z0-9]/gi, "_")}.docx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  /* ─── FULL PACKAGE (ALL) ──────────────────────────────── */
  const allSections: Paragraph[] = [
    new Paragraph({ text: tenderName, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Client: ${client}`, bold: true, size: 22, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: `Deadline: ${tender.submission_deadline ?? "—"}`, size: 22, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
  ];

  const docsWithContent = (documents ?? []).filter((d: Record<string, unknown>) => {
    const versions = Array.isArray(d.document_versions) ? d.document_versions : [];
    return versions.length > 0;
  });

  if (docsWithContent.length > 0) {
    for (const doc of docsWithContent) {
      const versions = Array.isArray(doc.document_versions) ? doc.document_versions : [];
      const current = versions.find((v: { id: string }) => v.id === doc.current_version_id) ?? versions[versions.length - 1];
      if (!current) continue;
      allSections.push(new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }));
      const rawText: string = current.content_json?.text ?? (current.content_html ? stripHtml(current.content_html) : "");
      for (const line of rawText.split("\n")) {
        const l = line.trim();
        if (l) allSections.push(new Paragraph({ children: [new TextRun({ text: l, size: 20, font: "Calibri" })] }));
      }
      allSections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  } else {
    for (const key of AGENT_ORDER()) {
      const run = runMap[key];
      if (!run?.output_content) continue;
      allSections.push(new Paragraph({ children: [new TextRun({ text: AGENT_TITLES[key] ?? key, bold: true, size: 26, color: MAROON, font: "Calibri" })] }));
      allSections.push(new Paragraph({ children: [new TextRun({ text: "", size: 10 })] }));
      for (const line of run.output_content.split("\n")) {
        const l = line.trim();
        if (!l || /^\|[-| :]+\|$/.test(l)) continue;
        if (l.startsWith("|")) {
          const cs = l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c: string) => c.trim()).filter(Boolean);
          allSections.push(new Paragraph({ children: [new TextRun({ text: cs.join("   |   "), size: 20, font: "Calibri" })] }));
        } else {
          const clean = l.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-•*]\s+/, "• ").replace(/^#+\s+/, "");
          allSections.push(new Paragraph({ children: [new TextRun({ text: clean, size: 20, font: "Calibri" })] }));
        }
      }
      allSections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const fullDoc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      footers: { default: footer },
      children: allSections,
    }],
  });
  const fullBuf = await Packer.toBuffer(fullDoc);
  return new NextResponse(new Uint8Array(fullBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${tenderName.replace(/[^a-z0-9]/gi, "_")}_Bid_Package.docx"`,
    },
  });
}
