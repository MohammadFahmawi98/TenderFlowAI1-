import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { adminClient } from "@/lib/supabase/admin";

function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
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

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && session?.user) {
      // Ensure user exists in public.users (required for RLS policies)
      const admin = adminClient();
      await admin.from("users").upsert(
        {
          id: session.user.id,
          email: session.user.email!,
          full_name: session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "User",
          role: "bid_manager",
          status: "active",
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
