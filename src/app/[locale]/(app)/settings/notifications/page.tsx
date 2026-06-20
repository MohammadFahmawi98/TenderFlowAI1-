"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",               icon: "person" },
  { label: "Security",      href: "/settings/security",      icon: "lock" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",          icon: "group" },
];

const NOTIFICATION_GROUPS = [
  {
    group: "Tender Alerts",
    items: [
      { label: "Tender deadline reminders",       key: "deadline" },
      { label: "New tender assignment",            key: "assignment" },
      { label: "Status change notifications",      key: "status" },
    ],
  },
  {
    group: "AI Notifications",
    items: [
      { label: "AI agent completion",              key: "ai_complete" },
      { label: "AI insight recommendations",       key: "ai_insight" },
      { label: "Knowledge gap alerts",             key: "knowledge_gap" },
    ],
  },
  {
    group: "Team & Collaboration",
    items: [
      { label: "Comment mentions",                 key: "mentions" },
      { label: "Document shared with me",          key: "doc_share" },
      { label: "Approval requests",                key: "approvals" },
    ],
  },
  {
    group: "System",
    items: [
      { label: "Weekly performance digest",        key: "digest" },
      { label: "Security alerts",                  key: "security" },
    ],
  },
];

const DEFAULT_SETTINGS: Record<string, boolean> = {
  deadline: true, assignment: true, status: true,
  ai_complete: true, ai_insight: false, knowledge_gap: true,
  mentions: true, doc_share: true, approvals: true,
  digest: false, security: true,
};

export default function NotificationsPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [userInitials, setUserInitials] = useState("—");

  useEffect(() => {
    const stored = localStorage.getItem("notification_settings");
    if (stored) setSettings(JSON.parse(stored));
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        const fullName = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "";
        const parts = fullName.split(" ");
        setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : fullName.slice(0, 2).toUpperCase() || "ME");
      }
    });
  }, []);

  function toggle(key: string) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    localStorage.setItem("notification_settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Settings</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
          {userInitials}
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
                item.href === "/settings/notifications"
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
          <div className="max-w-xl flex flex-col gap-6">
            <div>
              <h2 className="text-[16px] font-semibold text-text">Notifications</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">Choose which notifications you receive</p>
            </div>

            {NOTIFICATION_GROUPS.map((group) => (
              <div key={group.group} className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border-light bg-surface-dim">
                  <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">{group.group}</p>
                </div>
                <div className="divide-y divide-border-light">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-[13px] text-text">{item.label}</span>
                      <button
                        onClick={() => toggle(item.key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings[item.key] ? "bg-primary" : "bg-surface-mid"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings[item.key] ? "translate-x-4" : "translate-x-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-[12px] text-success font-medium">Preferences saved</span>}
              <button
                onClick={handleSave}
                className="rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
