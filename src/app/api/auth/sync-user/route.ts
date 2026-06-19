import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(toSet) {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, reason: "not authenticated" });

    const admin = adminClient();
    const { error } = await admin.from("users").upsert(
      {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
        role: "bid_manager",
        status: "active",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    if (error) {
      console.error("sync-user error:", error);
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("sync-user exception:", e);
    return NextResponse.json({ ok: false });
  }
}
