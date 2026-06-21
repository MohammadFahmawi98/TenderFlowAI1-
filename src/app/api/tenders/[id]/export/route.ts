import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, PageBreak, Footer, PageNumber,
  UnderlineType,
} from "docx";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export const maxDuration = 60;

/* ── Colour palette ──────────────────────────────────────────── */
const MAROON  = "8B3520";
const GOLD    = "C8A24A";
const WHITE   = "FFFFFF";
const MAROON_LIGHT = "F9F2F0";
const GREY_BG = "F3F4F6";

/* ── BOQ types ───────────────────────────────────────────────── */
interface BOQItem    { id: string; description: string; unit: string; qty: number; monthly_rate: number; }
interface BOQSection { id: string; label: string; items: BOQItem[]; }
interface StaffRow   { id: string; job_name: string; count: number; monthly_rate: number; }
interface BOQData    {
  ref_number?: string; validity_days?: number; vat_pct?: number;
  consumables_monthly?: number; sections?: BOQSection[]; staff?: StaffRow[];
}

/* ── Number format ───────────────────────────────────────────── */
function fmtN(v: number) {
  return v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── EIH footer ──────────────────────────────────────────────── */
function eihFooter(tenderName: string) {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: MAROON, space: 4 } },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "P.O Box: 42013, Abu Dhabi  |  Tel: +971 2 671 1320  |  bd@etihadhospitality.ae  |  www.etihadhospitality.ae",
          size: 16, color: "666666", font: "Calibri",
        })],
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

/* ── Inline markdown parser ──────────────────────────────────── */
function parseInline(text: string, baseSize = 20): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: baseSize, font: "Calibri", color: "1a1a1a" }));
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true, size: baseSize, font: "Calibri", color: "1a1a1a" }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), size: baseSize - 2, font: "Courier New", color: "555555" }));
    } else {
      runs.push(new TextRun({ text: part, size: baseSize, font: "Calibri", color: "1a1a1a" }));
    }
  }
  return runs.length ? runs : [new TextRun({ text, size: baseSize, font: "Calibri", color: "1a1a1a" })];
}

/* ── Markdown table → docx Table ────────────────────────────── */
function buildMarkdownTable(tableLines: string[]): Table | null {
  const rows = tableLines
    .filter((l) => !/^\|[-| :]+\|$/.test(l.trim()))
    .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
  if (rows.length === 0) return null;

  const docxRows = rows.map((cols, ri) =>
    new TableRow({
      tableHeader: ri === 0,
      children: cols.map((text) =>
        new TableCell({
          shading: ri === 0
            ? { type: ShadingType.CLEAR, fill: MAROON, color: "auto" }
            : ri % 2 === 1
            ? { type: ShadingType.CLEAR, fill: MAROON_LIGHT, color: "auto" }
            : undefined,
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            left:   { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            right:  { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
          },
          children: [new Paragraph({
            children: [new TextRun({
              text,
              bold: ri === 0,
              size: ri === 0 ? 18 : 18,
              color: ri === 0 ? WHITE : "1a1a1a",
              font: "Calibri",
            })],
          })],
        }),
      ),
    }),
  );

  return new Table({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

/* ── Full markdown → docx elements ──────────────────────────── */
function mdToDocx(md: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();
    i++;

    // blank line
    if (!trimmed.trim()) {
      out.push(new Paragraph({ children: [new TextRun({ text: "", size: 8 })] }));
      continue;
    }

    // Table block
    if (trimmed.trim().startsWith("|")) {
      const tableLines: string[] = [trimmed.trim()];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = buildMarkdownTable(tableLines);
      if (table) {
        out.push(table);
        out.push(new Paragraph({ children: [new TextRun({ text: "", size: 8 })] }));
      }
      continue;
    }

    // H1
    if (trimmed.startsWith("# ")) {
      out.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(2).trim(), bold: true, size: 32, color: MAROON, font: "Calibri" })],
        spacing: { before: 320, after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 } },
      }));
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      out.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(3).trim(), bold: true, size: 26, color: MAROON, font: "Calibri" })],
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: GOLD, space: 3 } },
      }));
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      out.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(4).trim(), bold: true, size: 22, color: MAROON, font: "Calibri" })],
        spacing: { before: 200, after: 80 },
      }));
      continue;
    }

    // ALL-CAPS heading (like "EXECUTIVE SUMMARY")
    const t = trimmed.trim();
    if (/^[A-Z][A-Z\s&/()\-:0-9]{8,}$/.test(t) && !t.startsWith("•") && t.length < 80) {
      out.push(new Paragraph({
        children: [new TextRun({ text: t, bold: true, size: 24, color: MAROON, font: "Calibri",
          underline: { type: UnderlineType.SINGLE, color: GOLD },
        })],
        spacing: { before: 240, after: 80 },
      }));
      continue;
    }

    // Bullet
    if (/^[-•*]\s+/.test(t)) {
      out.push(new Paragraph({
        children: [
          new TextRun({ text: "• ", bold: true, size: 20, color: MAROON, font: "Calibri" }),
          ...parseInline(t.replace(/^[-•*]\s+/, "")),
        ],
        indent: { left: 360, hanging: 240 },
        spacing: { after: 40 },
      }));
      continue;
    }

    // Numbered list
    const numMatch = t.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      out.push(new Paragraph({
        children: [
          new TextRun({ text: `${numMatch[1]}.  `, bold: true, size: 20, color: MAROON, font: "Calibri" }),
          ...parseInline(numMatch[2]),
        ],
        indent: { left: 360, hanging: 280 },
        spacing: { after: 40 },
      }));
      continue;
    }

    // Regular paragraph
    out.push(new Paragraph({
      children: parseInline(t),
      spacing: { after: 60 },
    }));
  }

  return out;
}

/* ── Build one section docx buffer ──────────────────────────── */
async function buildSectionDocx(
  sectionTitle: string,
  content: string,
  tenderName: string,
  clientName: string,
): Promise<Buffer> {
  const footer  = eihFooter(tenderName);
  const bodyElems = mdToDocx(content);

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 800, bottom: 800, left: 1000, right: 1000 } } },
      footers: { default: footer },
      children: [
        // EIH Header block
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "ETIHAD INT'L HOSPITALITY", bold: true, size: 36, color: MAROON, font: "Calibri" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "YOUR FM SERVICE PROVIDER OF CHOICE", size: 20, color: GOLD, font: "Calibri" })],
        }),
        new Paragraph({ children: [new TextRun({ text: "", size: 16 })] }),
        // Divider
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MAROON, space: 2 } },
          children: [new TextRun({ text: "", size: 4 })],
        }),
        new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
        // Section title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: sectionTitle.toUpperCase(), bold: true, size: 30, color: MAROON, font: "Calibri" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Prepared for: ${clientName}`, size: 20, color: "666666", font: "Calibri" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Re: ${tenderName}`, size: 20, color: "666666", font: "Calibri" })],
        }),
        new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
        new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
        // Page break before content
        new Paragraph({ children: [new PageBreak()] }),
        ...bodyElems,
      ],
    }],
  });

  return await Packer.toBuffer(doc);
}

/* ── BOQ Excel builder ───────────────────────────────────────── */
function buildBOQExcel(boqData: BOQData, tenderName: string, clientName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const sections = boqData.sections ?? [];
  const staff    = boqData.staff ?? [];
  const vatPct   = boqData.vat_pct ?? 5;

  /* ── Sheet 1: BOQ ─────────────────────────────────── */
  const boqData2: (string | number)[][] = [];
  boqData2.push([`BILL OF QUANTITIES — ${tenderName}`, "", "", "", "", ""]);
  boqData2.push([`Client: ${clientName}`, "", "", "", "", ""]);
  boqData2.push(["", "", "", "", "", ""]);
  boqData2.push(["REF", "DESCRIPTION", "UNIT", "QTY", "UNIT RATE (AED/Month)", "ANNUAL AMOUNT (AED)"]);

  let grandTotal = 0;
  for (const sec of sections) {
    const secTotal = sec.items.reduce((s, it) => s + it.monthly_rate * it.qty, 0);
    grandTotal += secTotal;
    // Section header
    boqData2.push([sec.id, sec.label.toUpperCase(), "", "", "", ""]);
    // Items
    sec.items.forEach((item, idx) => {
      boqData2.push([
        `${sec.id}.${idx + 1}`,
        item.description,
        item.unit || "Lump Sum",
        item.qty,
        item.monthly_rate,
        item.monthly_rate * item.qty,
      ]);
    });
    // Sub-total
    boqData2.push(["", `SUB-TOTAL — ${sec.label}`, "", "", "", secTotal]);
    boqData2.push(["", "", "", "", "", ""]);
  }

  const vat   = grandTotal * (vatPct / 100);
  const total = grandTotal + vat;
  boqData2.push(["", "", "", "", "TOTAL (Excluding VAT)", grandTotal]);
  boqData2.push(["", "", "", "", `VAT (${vatPct}%)`, vat]);
  boqData2.push(["", "", "", "", "GRAND TOTAL (Including VAT)", total]);

  const wsBoq = XLSX.utils.aoa_to_sheet(boqData2);
  wsBoq["!cols"] = [{ wch: 8 }, { wch: 48 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 24 }];
  // Merge title rows
  wsBoq["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsBoq, "BOQ");

  /* ── Sheet 2: Staff Rates ──────────────────────────── */
  if (staff.length > 0) {
    const staffData: (string | number)[][] = [];
    staffData.push(["STAFF RATE SCHEDULE", "", "", "", ""]);
    staffData.push(["Based on 12 Hours Shift / 6 Days per Week", "", "", "", ""]);
    staffData.push(["", "", "", "", ""]);
    staffData.push(["SN", "JOB TITLE", "COUNT", "MONTHLY RATE (AED)", "ANNUAL RATE (AED)"]);
    let staffTotal = 0;
    staff.forEach((r, idx) => {
      const annual = r.monthly_rate * r.count * 12;
      staffTotal += annual;
      staffData.push([idx + 1, r.job_name, r.count, r.monthly_rate * r.count, annual]);
    });
    const staffCount = staff.reduce((s, r) => s + r.count, 0);
    staffData.push(["", "TOTAL", staffCount, "", staffTotal]);

    const wsStaff = XLSX.utils.aoa_to_sheet(staffData);
    wsStaff["!cols"] = [{ wch: 6 }, { wch: 36 }, { wch: 10 }, { wch: 24 }, { wch: 24 }];
    wsStaff["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Rates");
  }

  /* ── Sheet 3: Summary ──────────────────────────────── */
  const summaryData: (string | number)[][] = [];
  summaryData.push(["COST SUMMARY", ""]);
  summaryData.push([`Tender: ${tenderName}`, ""]);
  summaryData.push([`Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, ""]);
  summaryData.push(["", ""]);
  summaryData.push(["ITEM", "ANNUAL AMOUNT (AED)"]);
  sections.forEach((sec) => {
    const st = sec.items.reduce((s, it) => s + it.monthly_rate * it.qty, 0);
    summaryData.push([sec.label, st]);
  });
  summaryData.push(["", ""]);
  summaryData.push(["SUBTOTAL (Excl. VAT)", grandTotal]);
  summaryData.push([`VAT @ ${vatPct}%`, vat]);
  summaryData.push(["GRAND TOTAL (Incl. VAT)", total]);
  summaryData.push(["", ""]);
  summaryData.push(["Validity (Days)", boqData.validity_days ?? 90]);
  summaryData.push(["Reference No.", boqData.ref_number ?? `EIHBIDQ/FM/${new Date().getFullYear()}`]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 40 }, { wch: 24 }];
  wsSummary["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* ── Agent order & titles ────────────────────────────────────── */
const AGENT_ORDER = [
  "intelligence","qualification","compliance","technical","commercial",
  "manpower","ppm","risk","hse","sla","presentation","executive_review",
];
const AGENT_TITLES: Record<string, string> = {
  intelligence:  "Tender Intelligence Briefing",
  qualification: "Qualification Assessment",
  compliance:    "Compliance Matrix",
  technical:     "Technical Proposal",
  commercial:    "Commercial Proposal",
  manpower:      "Manpower Plan",
  ppm:           "PPM Schedule",
  risk:          "Risk Register",
  hse:           "HSE Plan",
  sla:           "SLA & KPI Framework",
  presentation:  "Executive Presentation",
  executive_review: "Executive Review Report",
};

/* ── Commercial Proposal (existing, well-designed) ──────────── */
function cell(
  text: string,
  opts: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; sz?: number; width?: number } = {},
): TableCell {
  const { bold = false, fill, color = "1a1a1a", align = AlignmentType.LEFT, sz = 20, width } = opts;
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left:   { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right:  { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, bold, size: sz, color, font: "Calibri" })],
    })],
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

async function buildCommercialDocx(
  tenderName: string, clientName: string, scope: string,
  boqData: BOQData | null, footer: Footer,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const refNum = boqData?.ref_number || `EIHBIDQ/FM/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,"0")}`;
  const issueDate = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  const validity = boqData?.validity_days ?? 90;

  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ETIHAD INT'L HOSPITALITY", bold: true, size: 36, color: MAROON, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "YOUR FM SERVICE PROVIDER OF CHOICE", size: 20, color: GOLD, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tenderName.toUpperCase(), bold: true, size: 28, color: MAROON, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }),
  );

  for (const [label, value] of [["Attention","Procurement Department"],["Reference",refNum],["Issue Date",issueDate],["Validity",`${validity} Days`],["Subject",tenderName]]) {
    children.push(new Paragraph({ children: [new TextRun({ text: `${label}:  `, bold: true, size: 20, font: "Calibri" }), new TextRun({ text: value, size: 20, font: "Calibri" })] }));
  }
  children.push(new Paragraph({ children: [new TextRun({ text: "", size: 24 })] }));
  children.push(
    new Paragraph({ children: [new TextRun({ text: "Dear Sir,", size: 22, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
    new Paragraph({ children: [new TextRun({ text: `In appreciation of your interest in our facilities management services, we are very pleased to provide you with our best and competitive proposal for your kind consideration. With a skilled workforce of over 5,000 employees, EIH delivers professional facilities management services across several sectors. We are proud to hold facilities management awards year over year.`, size: 20, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
    new Paragraph({ children: [new TextRun({ text: `With our enclosed offer, we guarantee you an excellent price-performance ratio and look forward to serving you soon. Your kind reply is expected at bd@etihadhospitality.ae`, size: 20, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "", size: 12 })] }),
    new Paragraph({ children: [new TextRun({ text: "Sincerely,", size: 20, font: "Calibri" })] }),
    new Paragraph({ children: [new TextRun({ text: "Radhouan Baraket — Bid Manager", bold: true, size: 22, font: "Calibri" })] }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // Scope
  children.push(new Paragraph({ children: [new TextRun({ text: "SCOPE OF WORK", bold: true, size: 26, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { before: 200, after: 120 } }));
  for (const line of (scope || "FM Services").split("\n")) {
    if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: "", size: 0, color: MAROON, font: "Calibri" }), ...parseInline(`• ${line.trim()}`)], spacing: { after: 40 } }));
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // BOQ table
  if (boqData?.sections?.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "BILL OF QUANTITIES (BOQ)", bold: true, size: 26, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { after: 120 } }));

    const headerRow = new TableRow({ children: [
      cell("SN",   { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 5 }),
      cell("DESCRIPTION", { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 40 }),
      cell("UNIT", { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 10, align: AlignmentType.CENTER }),
      cell("QTY",  { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 8, align: AlignmentType.CENTER }),
      cell("MONTHLY (AED)",{ bold: true, fill: GOLD, color: WHITE, sz: 18, width: 18, align: AlignmentType.RIGHT }),
      cell("ANNUAL (AED)", { bold: true, fill: GOLD, color: WHITE, sz: 18, width: 19, align: AlignmentType.RIGHT }),
    ]});

    const boqRows: TableRow[] = [headerRow];
    let snCounter = 1;
    let grandTotal = 0;
    for (const sec of boqData.sections) {
      const st = sec.items.reduce((s, it) => s + it.monthly_rate * it.qty, 0);
      grandTotal += st;
      boqRows.push(new TableRow({ children: [cell(sec.id,{bold:true,fill:MAROON,color:WHITE,sz:18}),cell(sec.label,{bold:true,fill:MAROON,color:WHITE,sz:18}),cell("",{fill:MAROON}),cell("",{fill:MAROON}),cell(fmtN(st/12),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.RIGHT,sz:18}),cell(fmtN(st),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.RIGHT,sz:18})] }));
      sec.items.forEach((item, idx) => {
        const fill = idx % 2 === 0 ? WHITE : MAROON_LIGHT;
        boqRows.push(new TableRow({ children: [cell(String(snCounter++),{fill,sz:18,align:AlignmentType.CENTER}),cell(item.description,{fill,sz:18}),cell(item.unit||"",{fill,sz:18,align:AlignmentType.CENTER}),cell(String(item.qty),{fill,sz:18,align:AlignmentType.CENTER}),cell(fmtN(item.monthly_rate),{fill,sz:18,align:AlignmentType.RIGHT}),cell(fmtN(item.monthly_rate*item.qty),{fill,sz:18,align:AlignmentType.RIGHT})] }));
      });
      boqRows.push(new TableRow({ children: [cell("",{fill:GREY_BG}),cell("Sub Total",{bold:true,fill:GREY_BG}),cell("",{fill:GREY_BG}),cell("",{fill:GREY_BG}),cell(fmtN(st/12),{bold:true,fill:GREY_BG,align:AlignmentType.RIGHT}),cell(fmtN(st),{bold:true,fill:GREY_BG,align:AlignmentType.RIGHT})] }));
    }
    const vat = grandTotal * ((boqData.vat_pct ?? 5) / 100);
    boqRows.push(new TableRow({ children: [cell("",{fill:GREY_BG}),cell("TOTAL",{bold:true,fill:GREY_BG,sz:20}),cell("",{fill:GREY_BG}),cell("",{fill:GREY_BG}),cell("",{fill:GREY_BG}),cell(fmtN(grandTotal),{bold:true,fill:GREY_BG,align:AlignmentType.RIGHT,sz:20})] }));
    boqRows.push(new TableRow({ children: [cell(""),cell(`VAT (${boqData.vat_pct??5}%)`,{sz:20}),cell(""),cell(""),cell(""),cell(fmtN(vat),{align:AlignmentType.RIGHT,sz:20})] }));
    boqRows.push(new TableRow({ children: [cell("",{fill:MAROON}),cell("GRAND TOTAL",{bold:true,fill:MAROON,color:WHITE,sz:22}),cell("",{fill:MAROON}),cell("",{fill:MAROON}),cell("",{fill:MAROON}),cell(fmtN(grandTotal+vat),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.RIGHT,sz:22})] }));

    children.push(new Table({ rows: boqRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Staff
  if (boqData?.staff?.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "STAFF RATE SCHEDULE", bold: true, size: 26, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { after: 80 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: "Based on 12 Hours Shift / 6 Days per Week", size: 18, color: "666666", font: "Calibri" })] }));
    const staffRows: TableRow[] = [new TableRow({ children: [cell("SN",{bold:true,fill:GOLD,color:WHITE,sz:18}),cell("JOB TITLE",{bold:true,fill:GOLD,color:WHITE,sz:18}),cell("COUNT",{bold:true,fill:GOLD,color:WHITE,sz:18,align:AlignmentType.CENTER}),cell("MONTHLY RATE (AED)",{bold:true,fill:GOLD,color:WHITE,sz:18,align:AlignmentType.RIGHT}),cell("ANNUAL RATE (AED)",{bold:true,fill:GOLD,color:WHITE,sz:18,align:AlignmentType.RIGHT})] })];
    boqData.staff.forEach((r, idx) => {
      const fill = idx % 2 === 0 ? WHITE : MAROON_LIGHT;
      staffRows.push(new TableRow({ children: [cell(String(idx+1),{fill,sz:18,align:AlignmentType.CENTER}),cell(r.job_name,{fill,sz:18}),cell(String(r.count),{fill,sz:18,align:AlignmentType.CENTER}),cell(fmtN(r.monthly_rate*r.count),{fill,sz:18,align:AlignmentType.RIGHT}),cell(fmtN(r.monthly_rate*r.count*12),{fill,sz:18,align:AlignmentType.RIGHT})] }));
    });
    const sm = boqData.staff.reduce((s,r)=>s+r.monthly_rate*r.count,0);
    const sy = boqData.staff.reduce((s,r)=>s+r.monthly_rate*r.count*12,0);
    const sc = boqData.staff.reduce((s,r)=>s+r.count,0);
    staffRows.push(new TableRow({ children: [cell("",{fill:MAROON}),cell("TOTAL",{bold:true,fill:MAROON,color:WHITE,sz:20}),cell(String(sc),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.CENTER,sz:20}),cell(fmtN(sm),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.RIGHT,sz:20}),cell(fmtN(sy),{bold:true,fill:MAROON,color:WHITE,align:AlignmentType.RIGHT,sz:20})] }));
    children.push(new Table({ rows: staffRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Consumables
  children.push(new Paragraph({ children: [new TextRun({ text: "LIST OF CONSUMABLES", bold: true, size: 26, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { after: 80 } }));
  CONSUMABLES.forEach((item, idx) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${String(idx+1).padStart(2,"0")}.  ${item}`, size: 18, font: "Calibri" })], spacing: { after: 20 } }));
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Exclusions
  children.push(new Paragraph({ children: [new TextRun({ text: "ASSUMPTIONS & EXCLUSIONS", bold: true, size: 26, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { after: 80 } }));
  for (const exc of STANDARD_EXCLUSIONS) {
    children.push(new Paragraph({ children: [new TextRun({ text: "• ", bold: true, color: MAROON, size: 20, font: "Calibri" }), new TextRun({ text: exc, size: 20, font: "Calibri" })], spacing: { after: 40 } }));
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, footers: { default: footer }, children }] });
  return await Packer.toBuffer(doc);
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
  const [{ data: tender }, { data: extraction }, { data: agentRuns }] = await Promise.all([
    supabase.from("tenders").select("*").eq("id", tenderId).single(),
    supabase.from("tender_extractions").select("*").eq("tender_id", tenderId).maybeSingle(),
    supabase.from("agent_runs").select("agent_type, output_content, status").eq("tender_id", tenderId),
  ]);

  if (!tender) return NextResponse.json({ error: "Tender not found" }, { status: 404 });

  const tenderName = tender.name ?? "Tender Submission";
  const clientName = tender.client ?? extraction?.client_name ?? "Valued Client";
  const scope      = extraction?.scope_of_work ?? "Facility Management Services";
  const boqData: BOQData | null = extraction?.boq_data?.sections ? extraction.boq_data as BOQData : null;
  const runMap = Object.fromEntries((agentRuns ?? []).map((r: { agent_type: string; output_content?: string; status: string }) => [r.agent_type, r]));
  const footer = eihFooter(tenderName);
  const safeName = tenderName.replace(/[^a-z0-9]/gi, "_").slice(0, 40);

  /* ── Excel BOQ ────────────────────────────────────────────── */
  if (exportType === "excel_boq") {
    if (!boqData?.sections?.length) {
      return NextResponse.json({ error: "No BOQ data found. Please complete the Estimation tab first." }, { status: 404 });
    }
    const buf = buildBOQExcel(boqData, tenderName, clientName);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="EIH_${safeName}_BOQ_Estimation.xlsx"`,
      },
    });
  }

  /* ── Commercial Proposal ─────────────────────────────────── */
  if (exportType === "commercial") {
    const buf = await buildCommercialDocx(tenderName, clientName, scope, boqData, footer);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="EIH_${safeName}_Commercial_Proposal.docx"`,
      },
    });
  }

  /* ── Individual section ──────────────────────────────────── */
  if (exportType !== "all" && exportType !== "zip") {
    const run = runMap[exportType];
    if (!run?.output_content) return NextResponse.json({ error: "Section not generated yet" }, { status: 404 });
    const title = AGENT_TITLES[exportType] ?? exportType;
    const buf = await buildSectionDocx(title, run.output_content, tenderName, clientName);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="EIH_${safeName}_${title.replace(/[^a-z0-9]/gi,"_")}.docx"`,
      },
    });
  }

  /* ── ZIP Package (all sections as separate files) ────────── */
  if (exportType === "zip") {
    const zip = new JSZip();
    const folder = zip.folder("EIH_Bid_Package") ?? zip;
    let fileIdx = 1;

    // Commercial Proposal
    const commBuf = await buildCommercialDocx(tenderName, clientName, scope, boqData, footer);
    folder.file(`${String(fileIdx++).padStart(2,"0")}_Commercial_Proposal.docx`, new Uint8Array(commBuf));

    // Each AI agent section
    for (const agentType of AGENT_ORDER) {
      if (agentType === "commercial") continue;
      const run = runMap[agentType];
      if (!run?.output_content) continue;
      const title = AGENT_TITLES[agentType] ?? agentType;
      const buf = await buildSectionDocx(title, run.output_content, tenderName, clientName);
      folder.file(`${String(fileIdx++).padStart(2,"0")}_${title.replace(/[^a-z0-9]/gi,"_")}.docx`, new Uint8Array(buf));
    }

    // BOQ Excel
    if (boqData?.sections?.length) {
      const xlsBuf = buildBOQExcel(boqData, tenderName, clientName);
      folder.file(`${String(fileIdx++).padStart(2,"0")}_BOQ_Estimation.xlsx`, new Uint8Array(xlsBuf));
    }

    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return new NextResponse(new Uint8Array(zipBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="EIH_${safeName}_Bid_Package.zip"`,
      },
    });
  }

  /* ── Full combined DOCX (legacy "all") ──────────────────── */
  const allChildren: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ETIHAD INT'L HOSPITALITY", bold: true, size: 40, color: MAROON, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tenderName, bold: true, size: 26, color: "333333", font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Client: ${clientName}`, size: 22, color: "666666", font: "Calibri" })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  for (const key of AGENT_ORDER) {
    const run = runMap[key];
    if (!run?.output_content) continue;
    const title = AGENT_TITLES[key] ?? key;
    allChildren.push(
      new Paragraph({ children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 30, color: MAROON, font: "Calibri", underline: { type: UnderlineType.SINGLE, color: GOLD } })], spacing: { after: 160 } }),
      ...mdToDocx(run.output_content),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  const fullDoc = new Document({
    sections: [{ properties: { page: { margin: { top: 800, bottom: 800, left: 1000, right: 1000 } } }, footers: { default: footer }, children: allChildren }],
  });
  const fullBuf = await Packer.toBuffer(fullDoc);
  return new NextResponse(new Uint8Array(fullBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="EIH_${safeName}_Full_Package.docx"`,
    },
  });
}
