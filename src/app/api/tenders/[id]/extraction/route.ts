import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await db().from("tender_extractions").select("*").eq("tender_id", id).single();
  return NextResponse.json(data ?? null);
}
