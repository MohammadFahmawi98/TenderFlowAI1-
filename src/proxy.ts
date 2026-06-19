import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/api/"];

// Strip BOM and whitespace that Windows/PowerShell can inject into env vars
function clean(s: string | undefined): string {
  return (s ?? "").replace(/^﻿/, "").trim();
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Pass static and API paths straight through
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Strip locale prefix (en has none with as-needed; ar has /ar/)
  const stripped = pathname.replace(/^\/(en|ar)/, "") || "/";

  const isPublic  = PUBLIC_PATHS.some((p) => stripped.startsWith(p));
  const isAuthPage = stripped === "/sign-in" || stripped === "/sign-up";

  // Build initial response (run intl routing first so cookies/headers are set)
  let response = intlMiddleware(request);

  // Create Supabase server client that refreshes session cookies
  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated -> redirect to sign-in (unless already on a public path)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Authenticated -> redirect away from auth pages
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

// next-intl's createIntlMiddleware returns a function named "middleware"
// In Next.js 16 the proxy file uses "proxy" as the export name.
// We also keep a "config" export for the matcher (same shape as before).
export const config = {
  // Match all paths except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};