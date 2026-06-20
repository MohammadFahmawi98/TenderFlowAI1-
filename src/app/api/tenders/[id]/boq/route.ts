import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export interface BOQLineItem {
  id: string;
  description: string;
  unit: string;
  qty: number;
  monthly_rate: number;
}

export interface BOQSection {
  id: string;
  label: string;
  items: BOQLineItem[];
}

export interface StaffRow {
  id: string;
  job_name: string;
  count: number;
  monthly_rate: number;
}

export interface BOQData {
  ref_number: string;
  validity_days: number;
  vat_pct: number;
  consumables_monthly: number;
  sections: BOQSection[];
  staff: StaffRow[];
}

const DEFAULT_BOQ: BOQData = {
  ref_number: "",
  validity_days: 90,
  vat_pct: 5,
  consumables_monthly: 0,
  sections: [
    {
      id: "1",
      label: "PROJECT MOBILIZATION FEE",
      items: [
        { id: "1.1", description: "Project Mobilization Fee", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
    {
      id: "2.1",
      label: "AIR CONDITIONING SYSTEM",
      items: [
        { id: "2.1.1", description: "DX Units", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.1.2", description: "Package Units", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.1.3", description: "Split Units AC", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
    {
      id: "2.2",
      label: "ELECTRICAL AND CONTROL COMPLETE SYSTEM AND TESTING",
      items: [
        { id: "2.2.1", description: "Main Distribution Boards", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.2.2", description: "Sub Main Distribution Boards", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.2.3", description: "All Internal Lights (LED, Recessed, Chandelier, Downlight, etc.)", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.2.4", description: "External Lighting (Street lights, Bollard, Garden, Pole, etc.)", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.2.5", description: "Capacitor Banks", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.2.6", description: "All Motors", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
    {
      id: "2.3",
      label: "PLUMBING / DRAINAGE COMPLETE SYSTEM",
      items: [
        { id: "2.3.1", description: "Pumps (Booster, Transfer, Circulation, Irrigation, etc.)", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.3.2", description: "Electric Water Heater", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.3.3", description: "Piping, Accessories (toilets, kitchen, etc.) & Fittings", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.3.4", description: "Tank Cleaning – every 6 months", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "2.3.5", description: "Periodic Water Quality Test – every 3 months (MOE/ADEK)", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
    {
      id: "3",
      label: "SPECIAL SYSTEM SERVICES",
      items: [
        { id: "3.1", description: "Firefighting System (Sprinkler, Fire Extinguisher, FM200)", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "3.2", description: "Fire Alarm System (Disabled Toilet Alarm, PA/Voice Evacuation)", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "3.3", description: "ADCD / AACD and MCC Contract Approval / Attestation", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "3.4", description: "CCTV System and Access Control System", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "3.5", description: "Emergency and Exit Lighting System", unit: "Months", qty: 12, monthly_rate: 0 },
        { id: "3.6", description: "Storm Water Network Maintenance Services", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
    {
      id: "4",
      label: "MEP CONSUMABLES & ADDITIONAL WORKS",
      items: [
        { id: "4.1", description: "MEP Consumables including submission of monthly inventory report", unit: "Months", qty: 12, monthly_rate: 0 },
      ],
    },
  ],
  staff: [
    { id: "s1", job_name: "FM Supervisor", count: 1, monthly_rate: 0 },
    { id: "s2", job_name: "A/C Technician", count: 1, monthly_rate: 0 },
    { id: "s3", job_name: "Electrician", count: 1, monthly_rate: 0 },
    { id: "s4", job_name: "Plumber", count: 1, monthly_rate: 0 },
  ],
};

function genRef(createdAt: string): string {
  const d = new Date(createdAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `EIHBIDQ/FM/${yyyy}/${mm}/${dd}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const supabase = db();

  const [{ data: extraction }, { data: tender }] = await Promise.all([
    supabase.from("tender_extractions").select("boq_data").eq("tender_id", tenderId).maybeSingle(),
    supabase.from("tenders").select("created_at").eq("id", tenderId).single(),
  ]);

  const stored = extraction?.boq_data as BOQData | null;

  // If it already has our structured format, return it
  if (stored?.sections) return NextResponse.json(stored);

  // Return default template with auto ref number
  const ref = tender?.created_at ? genRef(tender.created_at) : "";
  return NextResponse.json({ ...DEFAULT_BOQ, ref_number: ref });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tenderId } = await params;
  const body: BOQData = await req.json();
  const supabase = db();

  // Check if row exists
  const { data: existing } = await supabase
    .from("tender_extractions")
    .select("tender_id")
    .eq("tender_id", tenderId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("tender_extractions")
      .update({ boq_data: body })
      .eq("tender_id", tenderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("tender_extractions")
      .insert({ tender_id: tenderId, boq_data: body });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
