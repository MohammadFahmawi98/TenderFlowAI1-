import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json([]);
  const { data } = await db()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const { id } = await req.json();
  await db().from("notifications").update({ read: true }).eq("id", id);
  return NextResponse.json({ success: true });
}
