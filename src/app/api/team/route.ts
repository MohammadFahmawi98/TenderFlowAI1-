import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET() {
  const supabase = db();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, role, department } = body as {
    name: string; email: string; role: string; department?: string;
  };
  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }
  const supabase = db();
  const { data, error } = await supabase
    .from("team_members")
    .insert({ name, email, role: role ?? "Viewer", department: department ?? "", status: "invited" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
