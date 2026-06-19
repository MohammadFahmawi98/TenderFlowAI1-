import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const q    = searchParams.get("q");

  let query = db().from("knowledge_items").select("*").order("created_at", { ascending: false });
  if (type)  query = query.eq("type", type);
  if (q)     query = query.ilike("title", `%${q}%`);

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await db()
    .from("knowledge_items")
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
