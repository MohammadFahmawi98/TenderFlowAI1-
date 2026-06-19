import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenderId = searchParams.get("tender_id");

  let query = db()
    .from("documents")
    .select("*, document_versions(*)")
    .order("created_at", { ascending: false });

  if (tenderId) query = query.eq("tender_id", tenderId);

  const { data } = await query;
  return NextResponse.json(data ?? []);
}
