"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else if (data.session) {
      // Sync user into public.users via server action so RLS policies work
      await fetch("/api/auth/sync-user", { method: "POST" }).catch(() => {});
      // Full page reload so the server-side middleware reads the fresh session cookie
      window.location.href = "/dashboard";
    } else {
      setError("Sign-in succeeded but no session was created. Please try again.");
    }
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  return (
    <div className="flex h-screen w-full">
      {/* Left — blue gradient panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-start justify-between p-12"
        style={{ background: "linear-gradient(135deg, #8B3520 0%, #C8A24A 100%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20">
            <span className="text-[13px] font-bold text-white">TF</span>
          </div>
          <span className="text-[15px] font-semibold text-white">TenderFM AI</span>
        </div>

        {/* Tagline */}
        <div>
          <h1 className="text-[36px] font-bold text-white leading-tight max-w-sm">
            Intelligence at scale for enterprise procurement
          </h1>
          <p className="mt-4 text-[15px] text-white/70 max-w-xs">
            AI-powered bid department. Upload an RFP, generate a complete tender package in minutes.
          </p>

          {/* Feature list */}
          <ul className="mt-8 flex flex-col gap-3">
            {[
              "Automated compliance analysis",
              "AI-generated technical proposals",
              "Real-time win probability scoring",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[14px] text-white/80">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] text-white">✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-white/40">© 2026 TenderFM AI. All rights reserved.</p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex lg:hidden items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <span className="text-[13px] font-bold text-white">TF</span>
            </div>
            <span className="text-[15px] font-semibold text-text">TenderFM AI</span>
          </div>

          <h2 className="text-[26px] font-bold text-text">Welcome back</h2>
          <p className="mt-1 text-[14px] text-text-secondary">Sign in to your account to continue</p>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded border border-border px-4 py-2.5 text-[13px] font-medium text-text hover:bg-surface-dim transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border-light" />
            <span className="text-[11px] uppercase tracking-wide text-text-muted">Or continue with email</span>
            <div className="flex-1 h-px bg-border-light" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary" htmlFor="email">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded border border-border px-3 py-2.5 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors bg-white"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded border border-border px-3 py-2.5 pr-10 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center px-3 text-text-muted hover:text-text"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Remember me
              </label>
              <a href="#" className="text-[12px] text-primary hover:underline">Forgot password?</a>
            </div>

            {/* Error message */}
            {error && (
              <p className="rounded border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-[12px] text-text-secondary">
              Don&apos;t have an account?{" "}
              <a href="/sign-up" className="text-primary hover:underline font-medium">Request Access</a>
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <a href="#" className="text-[11px] text-text-muted hover:text-text-secondary">Privacy Policy</a>
              <span className="text-text-muted">·</span>
              <a href="#" className="text-[11px] text-text-muted hover:text-text-secondary">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
