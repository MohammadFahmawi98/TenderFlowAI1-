"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",               icon: "person" },
  { label: "Security",      href: "/settings/security",      icon: "lock" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",          icon: "group" },
];

const ROLE_OPTIONS = ["Admin", "Editor", "Viewer"];

const ROLE_STYLES: Record<string, string> = {
  Admin:  "text-primary bg-primary-light border-primary/20",
  Editor: "text-success bg-success/8 border-success/20",
  Viewer: "text-text-muted bg-surface-dim border-border",
};

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  status: string;
  last_active?: string;
  created_at: string;
}

function initials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase() || "??";
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ initials: string } | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteDept, setInviteDept] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/team");
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        const fullName = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "";
        const parts = fullName.split(" ");
        const ini = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : fullName.slice(0, 2).toUpperCase() || "ME";
        setCurrentUser({ initials: ini });
      }
    });
  }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("Name and email are required.");
      return;
    }
    setInviting(true);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inviteName, email: inviteEmail, role: inviteRole, department: inviteDept }),
    });
    setInviting(false);
    if (res.ok) {
      setShowInvite(false);
      setInviteName(""); setInviteEmail(""); setInviteRole("Viewer"); setInviteDept("");
      loadMembers();
    } else {
      const err = await res.json();
      setInviteError(err.error ?? "Failed to add member.");
    }
  }

  async function changeRole(id: string, role: string) {
    setChangingRole(id);
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setChangingRole(null);
    setMenuOpen(null);
    loadMembers();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this team member?")) return;
    setRemovingId(id);
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    setRemovingId(null);
    setMenuOpen(null);
    loadMembers();
  }

  const active = members.filter((m) => m.status !== "invited");
  const pending = members.filter((m) => m.status === "invited");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Settings</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
          {currentUser?.initials ?? "—"}
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

        <div className="flex-1 overflow-y-auto p-8" onClick={() => setMenuOpen(null)}>
          <div className="max-w-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-text">Team</h2>
                <p className="text-[12px] text-text-secondary mt-0.5">Manage members and their access levels</p>
              </div>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Invite Member
              </button>
            </div>

            {/* Active members */}
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light bg-surface-dim">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">
                  {loading ? "Loading…" : `${active.length} Member${active.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : active.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="material-symbols-outlined text-[32px] text-text-muted">group</span>
                  <p className="text-[13px] text-text-secondary">No team members yet</p>
                  <p className="text-[11.5px] text-text-muted">Invite colleagues to collaborate on tenders</p>
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {active.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-dim/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary shrink-0">
                          {initials(m.name)}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-text">{m.name}</p>
                          <p className="text-[11px] text-text-muted">{m.email}{m.department ? ` · ${m.department}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {m.last_active && (
                          <span className="hidden sm:block text-[11px] text-text-muted">
                            {new Date(m.last_active).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                        <span className={`rounded border px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[m.role] ?? ROLE_STYLES.Viewer}`}>
                          {m.role}
                        </span>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                            disabled={changingRole === m.id || removingId === m.id}
                            className="flex items-center justify-center h-7 w-7 rounded hover:bg-surface-dim text-text-muted transition-colors disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>
                          {menuOpen === m.id && (
                            <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-border bg-surface shadow-lg py-1 text-[13px]">
                              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Change Role</p>
                              {ROLE_OPTIONS.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => changeRole(m.id, r)}
                                  className={`flex items-center justify-between w-full px-3 py-1.5 text-left hover:bg-surface-dim transition-colors ${m.role === r ? "text-primary font-semibold" : "text-text"}`}
                                >
                                  {r}
                                  {m.role === r && <span className="material-symbols-outlined text-[14px]">check</span>}
                                </button>
                              ))}
                              <div className="border-t border-border-light mt-1 pt-1">
                                <button
                                  onClick={() => removeMember(m.id)}
                                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-danger hover:bg-danger/5 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[15px]">person_remove</span>
                                  Remove Member
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending invites */}
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light bg-surface-dim">
                <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide">Pending Invites</p>
                {pending.length > 0 && (
                  <span className="rounded-full bg-warning/15 text-warning text-[10px] font-bold px-2 py-0.5 border border-warning/25">
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-6">No pending invitations</p>
              ) : (
                <div className="divide-y divide-border-light">
                  {pending.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-mid text-[12px] font-semibold text-text-muted shrink-0">
                          {initials(m.name)}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-text">{m.name}</p>
                          <p className="text-[11px] text-text-muted">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded border border-warning/25 bg-warning/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-warning">
                          Invited
                        </span>
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-[11px] text-danger hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-semibold text-text">Invite Team Member</h3>
                <p className="text-[12px] text-text-secondary mt-0.5">Add a colleague to your workspace</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface-dim text-text-muted">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sara Al Mansouri"
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors placeholder:text-text-muted"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">
                  Work Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.ae"
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors placeholder:text-text-muted"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary"
                  >
                    {ROLE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Department</label>
                  <input
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    placeholder="e.g. Bid Management"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary transition-colors placeholder:text-text-muted"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border-light bg-primary-light/20 px-3.5 py-3 text-[11.5px] text-text-secondary leading-relaxed">
                <span className="font-semibold text-text">Permissions: </span>
                <span className="text-primary font-medium">Admin</span> — full access ·{" "}
                <span className="text-success font-medium">Editor</span> — create &amp; edit tenders ·{" "}
                <span className="text-text-muted font-medium">Viewer</span> — read-only
              </div>

              {inviteError && (
                <p className="rounded bg-danger/8 border border-danger/20 px-3 py-2 text-[12px] text-danger">{inviteError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="flex-1 rounded border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-surface-dim transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 rounded bg-primary px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Adding…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[15px]">person_add</span> Add Member</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
