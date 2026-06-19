"use client";

import { Link } from "@/i18n/navigation";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",               icon: "person" },
  { label: "Security",      href: "/settings/security",      icon: "lock" },
  { label: "AI Models",     href: "/settings/ai-models",     icon: "smart_toy" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",          icon: "group" },
];

const TEAM_MEMBERS = [
  { name: "Alex Sterling",    email: "alex.sterling@company.ae",    role: "Admin",   initials: "AS" },
  { name: "Sarah Chen",       email: "sarah.chen@company.ae",       role: "Editor",  initials: "SC" },
  { name: "Mohammed Al Rashid", email: "mohammed.r@company.ae",     role: "Viewer",  initials: "MA" },
  { name: "Elena Torres",     email: "elena.torres@company.ae",     role: "Editor",  initials: "ET" },
  { name: "David Kim",        email: "david.kim@company.ae",        role: "Viewer",  initials: "DK" },
];

const ROLE_STYLES: Record<string, string> = {
  Admin:  "text-primary bg-primary-light",
  Editor: "text-success bg-success-bg",
  Viewer: "text-text-muted bg-surface-dim",
};

export default function TeamPage() {
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
                item.href === "/settings/team"
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-text">Team</h2>
                <p className="text-[12px] text-text-secondary mt-0.5">Manage team members and their access levels</p>
              </div>
              <button className="flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Invite Member
              </button>
            </div>

            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-light bg-surface-dim">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">{TEAM_MEMBERS.length} Members</p>
              </div>
              <div className="divide-y divide-border-light">
                {TEAM_MEMBERS.map((m) => (
                  <div key={m.email} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
                        {m.initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-text">{m.name}</p>
                        <p className="text-[11px] text-text-muted">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[m.role]}`}>
                        {m.role}
                      </span>
                      <button className="text-text-muted hover:text-danger transition-colors">
                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending invites */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-3">Pending Invites</p>
              <p className="text-[12px] text-text-muted text-center py-4">No pending invitations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
