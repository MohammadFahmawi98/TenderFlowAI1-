"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",               icon: "person" },
  { label: "Security",      href: "/settings/security",      icon: "lock" },
  { label: "AI Models",     href: "/settings/ai-models",     icon: "smart_toy" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",          icon: "group" },
];

const SESSIONS = [
  { device: "Chrome on Windows", location: "Dubai, UAE", time: "Active now", current: true },
  { device: "Safari on iPhone",  location: "Abu Dhabi, UAE", time: "2 hours ago", current: false },
];

const AUDIT_LOG = [
  { action: "Login",           detail: "Chrome on Windows",   time: "Just now" },
  { action: "Settings changed", detail: "Updated notification preferences", time: "1 day ago" },
  { action: "Login",           detail: "Safari on iPhone",    time: "2 days ago" },
  { action: "Password changed", detail: "—",                  time: "7 days ago" },
];

export default function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(""); setPwError("");
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return; }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) { setPwError(error.message); } else { setPwMsg("Password updated successfully."); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
  }

  function handleMfaToggle() {
    if (!mfaEnabled) {
      alert("MFA setup is coming soon. Contact your administrator to enable this feature.");
    } else {
      setMfaEnabled(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Settings</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
          AS
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border-light bg-surface p-3 overflow-y-auto">
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-colors mb-0.5",
                item.href === "/settings/security"
                  ? "bg-primary-light text-primary"
                  : "text-text-secondary hover:bg-surface-dim hover:text-text",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-[16px] font-semibold text-text">Security</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">Manage your password and account security</p>
            </div>

            {/* Password */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Change Password</p>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Current Password</label>
                  <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">New Password</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
                </div>
                {pwError && <p className="text-[12px] text-danger">{pwError}</p>}
                {pwMsg && <p className="text-[12px] text-success">{pwMsg}</p>}
                <div className="mt-2">
                  <button type="submit" disabled={pwSaving} className="rounded bg-primary px-5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60">
                    {pwSaving ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </form>
            </div>

            {/* MFA */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-text">Two-Factor Authentication</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">Add an extra layer of security to your account</p>
                </div>
                <button
                  onClick={handleMfaToggle}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mfaEnabled ? "bg-primary" : "bg-surface-mid"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${mfaEnabled ? "translate-x-4" : "translate-x-1"}`} />
                </button>
              </div>
            </div>

            {/* Active sessions */}
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-light">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">Active Sessions</p>
              </div>
              <div className="divide-y divide-border-light">
                {SESSIONS.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-text-muted">devices</span>
                      <div>
                        <p className="text-[13px] font-medium text-text">{s.device}</p>
                        <p className="text-[11px] text-text-muted">{s.location} · {s.time}</p>
                      </div>
                    </div>
                    {s.current ? (
                      <span className="text-[11px] font-semibold text-success">Current</span>
                    ) : (
                      <button className="text-[11px] text-danger hover:underline">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Audit log */}
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-light">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">Audit Log</p>
              </div>
              <div className="divide-y divide-border-light">
                {AUDIT_LOG.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-[12px] font-medium text-text">{entry.action}</p>
                      <p className="text-[11px] text-text-muted">{entry.detail}</p>
                    </div>
                    <span className="text-[11px] text-text-muted">{entry.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
