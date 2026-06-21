import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET() {
  const supabase = db();
  const { data } = await supabase
    .from("company_profiles")
    .select("*")
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? {});
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supabase = db();

  // Upsert: if no row exists yet, insert; otherwise update
  const { data: existing } = await supabase
    .from("company_profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("company_profiles")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("company_profiles")
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
