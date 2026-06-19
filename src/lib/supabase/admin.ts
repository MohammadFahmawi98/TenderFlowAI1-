import { createClient } from "@supabase/supabase-js";

function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

export function adminClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}