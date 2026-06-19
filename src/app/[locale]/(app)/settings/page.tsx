"use client";

import { useState, useEffect } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",              icon: "person" },
  { label: "Security",      href: "/settings/security",     icon: "lock" },
  { label: "AI Models",     href: "/settings/ai-models",    icon: "smart_toy" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",         icon: "group" },
];

function SettingsLayout({ children, activeHref, initials = "--" }: { children: React.ReactNode; activeHref: string; initials?: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Settings</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
            {initials}
          </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Settings sub-nav */}
        <nav className="w-52 shrink-0 border-r border-border-light bg-surface p-3 overflow-y-auto">
          {SETTINGS_NAV.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-colors mb-0.5",
                  active
                    ? "bg-primary-light text-primary"
                    : "text-text-secondary hover:bg-surface-dim hover:text-text",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function SettingsProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("Etihad International Hospitality");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initials, setInitials] = useState("--");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        setEmail(data.user.email ?? "");
        const fullName = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "";
        setName(fullName);
        setTitle(meta?.job_title ?? "");
        setPhone(meta?.phone ?? "");
        setOrg(meta?.organization ?? "Etihad International Hospitality");
        const parts = fullName.split(" ");
        setInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : fullName.slice(0,2).toUpperCase() || "--");
      } else {
        // fallback: load from localStorage
        const stored = localStorage.getItem("profile");
        if (stored) {
          const p = JSON.parse(stored);
          setName(p.name ?? ""); setEmail(p.email ?? ""); setPhone(p.phone ?? ""); setTitle(p.title ?? ""); setOrg(p.org ?? "Etihad International Hospitality");
        }
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.auth.updateUser({
        data: { full_name: name, job_title: title, phone, organization: org },
      });
    } else {
      localStorage.setItem("profile", JSON.stringify({ name, email, phone, title, org }));
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SettingsLayout activeHref="/settings" initials={initials}>
      <div className="max-w-2xl flex flex-col gap-6">
        <div>
          <h2 className="text-[16px] font-semibold text-text">Profile</h2>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your personal information</p>
        </div>

        {/* Photo */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Profile Photo</p>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-[20px] font-bold text-primary">
              {initials}
            </div>
            <div>
              <button className="rounded border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
                Upload Photo
              </button>
              <p className="mt-1.5 text-[11px] text-text-muted">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>
        </div>

        {/* Personal details */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Personal Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Work Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Job Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
            </div>
          </div>
        </div>

        {/* Organization info */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Organization</p>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Organization Name</label>
            <input value={org} onChange={(e) => setOrg(e.target.value)}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors" />
          </div>
        </div>

        {/* Regional settings */}
        <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Regional Settings</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary">
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Currency</label>
              <select className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary">
                <option>AED — UAE Dirham</option>
                <option>USD — US Dollar</option>
                <option>GBP — British Pound</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-[12px] text-success font-medium">Changes saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </SettingsLayout>
  );
}
