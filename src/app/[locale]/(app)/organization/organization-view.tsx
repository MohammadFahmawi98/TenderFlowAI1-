"use client";

import { useState, useEffect } from "react";

interface Member {
  id: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  status: string;
  last_active?: string;
  created_at: string;
}

const ACTIVITY = [
  { icon: "description",  text: "Alex uploaded RFP for Burj Plaza FM Contract", time: "2 min ago" },
  { icon: "smart_toy",    text: "AI Agents completed Qualification module",      time: "8 min ago" },
  { icon: "check_circle", text: "Sarah approved Compliance review",              time: "15 min ago" },
  { icon: "edit",         text: "Mohammed updated risk register",                time: "1 hour ago" },
  { icon: "upload",       text: "David submitted financial model",               time: "2 hours ago" },
];

const TABS = ["Overview", "Team & Collaboration", "Roles", "Governance"];

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-success",
  away:    "bg-warning",
  offline: "bg-text-muted",
};

const ROLES = [
  "Procurement Manager", "Bid Writer", "Compliance Officer",
  "Commercial Manager", "Finance Analyst", "Operations Lead",
];

const DEPARTMENTS = ["Procurement", "Legal & Compliance", "Finance", "Operations", "Engineering"];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function OrganizationView() {
  const [members, setMembers]       = useState<Member[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("Overview");
  const [activeDept, setActiveDept] = useState("All Teams");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: ROLES[0], department: DEPARTMENTS[0] });
  const [inviting, setInviting]     = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  async function loadMembers() {
    setLoading(true);
    const res = await fetch("/api/organization/members");
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  // Build department list from real data
  const deptCounts = members.reduce((acc, m) => {
    const dept = m.department ?? "Other";
    acc[dept] = (acc[dept] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deptList = [
    { label: "All Teams", count: members.length },
    ...Object.entries(deptCounts).map(([label, count]) => ({ label, count })),
  ];

  const filteredMembers = activeDept === "All Teams"
    ? members
    : members.filter((m) => m.department === activeDept);

  function handleExportRoster() {
    const headers = ["Name", "Email", "Role", "Department", "Status"];
    const rows = members.map((m) => [m.name, m.email ?? "", m.role ?? "", m.department ?? "", m.status]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "team-roster.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.name.trim()) return;
    setInviting(true);
    const res = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    if (res.ok) {
      const member = await res.json();
      setMembers((prev) => [member, ...prev]);
      setInviteSent(true);
      setTimeout(() => { setShowInvite(false); setInviteSent(false); setInviteForm({ name: "", email: "", role: ROLES[0], department: DEPARTMENTS[0] }); }, 2000);
    }
    setInviting(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Organization</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Team management, roles &amp; governance</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportRoster} className="flex items-center gap-1.5 rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Roster
          </button>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Invite Member
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
            AS
          </div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-0 px-8 border-b border-border-light bg-surface">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
              activeTab === tab
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-text-secondary hover:text-text border-b-2 border-transparent -mb-px",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid gap-5 lg:grid-cols-4">
          {/* Departments sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border-light">
                <p className="text-[12px] font-semibold text-text">Departments</p>
              </div>
              <div className="p-2">
                {deptList.map((dept) => (
                  <button
                    key={dept.label}
                    onClick={() => setActiveDept(dept.label)}
                    className={[
                      "w-full flex items-center justify-between rounded px-3 py-2 text-[12px] font-medium transition-colors",
                      activeDept === dept.label
                        ? "bg-primary-light text-primary"
                        : "text-text-secondary hover:bg-surface-dim hover:text-text",
                    ].join(" ")}
                  >
                    {dept.label}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeDept === dept.label ? "bg-primary text-white" : "bg-surface-mid text-text-muted"}`}>
                      {dept.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Roster */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                <p className="text-[12px] font-semibold text-text">Active Roster</p>
                <span className="text-[11px] text-text-muted">{filteredMembers.length} members</span>
              </div>
              {loading ? (
                <div className="p-4 flex flex-col gap-3">
                  {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-surface-mid" />)}
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center px-4">
                  <span className="material-symbols-outlined text-[36px] text-text-muted">group</span>
                  <p className="text-[13px] font-medium text-text">No team members yet</p>
                  <p className="text-[12px] text-text-secondary">Invite your first team member to get started.</p>
                  <button
                    onClick={() => setShowInvite(true)}
                    className="rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors"
                  >
                    Invite Member
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {filteredMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-dim transition-colors">
                      <div className="relative flex-shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
                          {initials(m.name)}
                        </div>
                        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${STATUS_COLORS[m.status] ?? "bg-text-muted"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-text">{m.name}</p>
                        <p className="text-[11px] text-text-muted">{m.role ?? "—"}{m.department ? ` · ${m.department}` : ""}</p>
                      </div>
                      <p className="text-[11px] text-text-muted shrink-0">
                        {m.last_active
                          ? new Date(m.last_active).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Activity feed */}
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                <p className="text-[12px] font-semibold text-text">Live Activity</p>
                <span className="flex items-center gap-1 text-[10px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </span>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-text leading-relaxed">{item.text}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Permission Engine banner */}
        <div className="mt-5 rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4" style={{ borderLeft: "3px solid #C8A24A" }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-primary">lock</span>
              <div>
                <p className="text-[12px] font-semibold text-text">Permission Engine</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Role-based access control is active. {members.length > 0 ? `${members.length} member${members.length !== 1 ? "s" : ""} in roster.` : "No members yet."}
                </p>
              </div>
            </div>
            <button className="rounded border border-primary px-4 py-2 text-[12px] font-semibold text-primary hover:bg-primary-light transition-colors">
              Manage Permissions
            </button>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl">
            <h2 className="mb-5 text-[18px] font-semibold text-text">Invite Member</h2>
            {inviteSent ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-[36px] text-success block mb-2">mark_email_read</span>
                <p className="text-[13px] text-text font-medium">Member added!</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Full Name *</label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Doe"
                    required
                    className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Email Address</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="colleague@company.ae"
                    className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary"
                  >
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Department</label>
                  <select
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm((p) => ({ ...p, department: e.target.value }))}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary"
                  >
                    {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="rounded border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting || !inviteForm.name.trim()}
                    className="rounded bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors"
                  >
                    {inviting ? "Adding…" : "Add Member"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
