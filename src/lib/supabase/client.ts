"use client";

import { createBrowserClient } from "@supabase/ssr";

// Strip BOM and whitespace that PowerShell/Windows can inject into env vars
function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

export function createClient() {
  return createBrowserClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}