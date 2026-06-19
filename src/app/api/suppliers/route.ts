import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET() {
  const { data, error } = await db()
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });
  // If the table doesn't exist yet, return empty array instead of crashing
  if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await db()
    .from("suppliers")
    .insert({
      name: body.name,
      email: body.email ?? null,
      category: body.category ?? null,
      region: body.region ?? null,
      status: "pending",
      compliance: "pending",
      rating: 3,
    })
    .select()
    .single();
  if (error) {
    // Table not yet created — return helpful message
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "Suppliers table not yet created. Run the database migration in your Supabase dashboard." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 201 });
}
