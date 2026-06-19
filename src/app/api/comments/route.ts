import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetId   = searchParams.get("target_id");
  const targetType = searchParams.get("target_type");
  if (!targetId || !targetType) return NextResponse.json([]);
  const { data } = await db()
    .from("comments")
    .select("*, users(full_name, email, avatar_url)")
    .eq("target_id", targetId)
    .eq("target_type", targetType)
    .order("created_at");
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await db()
    .from("comments")
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
