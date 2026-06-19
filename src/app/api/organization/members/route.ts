import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET() {
  const { data, error } = await db()
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: false });

  // Gracefully handle missing table (42P01 = undefined_table)
  if (error) {
    if (error.code === "42P01") return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, role, department } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("team_members")
    .insert({ name, email, role, department, status: "active", last_active: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ error: "Team members table not yet created. Run migrations first." }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
