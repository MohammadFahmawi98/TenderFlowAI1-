"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="flex h-screen w-full">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-start justify-between p-12"
        style={{ background: "linear-gradient(135deg, #8B3520 0%, #C8A24A 100%)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20">
            <span className="text-[13px] font-bold text-white">TF</span>
          </div>
          <span className="text-[15px] font-semibold text-white">EIH BidDesk</span>
        </div>
        <div>
          <h1 className="text-[36px] font-bold text-white leading-tight max-w-sm">
            Join EIH TenderFM
          </h1>
          <p className="mt-4 text-[15px] text-white/70 max-w-xs">
            Request access to the EIH Bidding Department platform.
          </p>
        </div>
        <p className="text-[12px] text-white/40">© 2026 EIH BidDesk. All rights reserved.</p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-[26px] font-bold text-text">Request Access</h2>
          <p className="mt-1 text-[14px] text-text-secondary">Create your account to get started</p>

          {success ? (
            <div className="mt-8 rounded border border-success bg-success-bg p-5 text-center">
              <span className="material-symbols-outlined text-[32px] text-success block mb-2">mark_email_read</span>
              <p className="text-[15px] font-semibold text-text">Check your email</p>
              <p className="mt-2 text-[13px] text-text-secondary">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <a
                href="/sign-in"
                className="mt-4 inline-block text-[13px] font-semibold text-primary hover:underline"
              >
                Back to Sign In
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
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
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="w-full rounded border border-border px-3 py-2.5 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors bg-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary" htmlFor="confirm">
                  Confirm Password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className="w-full rounded border border-border px-3 py-2.5 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors bg-white"
                />
              </div>

              {error && (
                <p className="rounded border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Request Access →"}
              </button>

              <p className="text-center text-[12px] text-text-secondary">
                Already have an account?{" "}
                <a href="/sign-in" className="text-primary hover:underline font-medium">Sign In</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
