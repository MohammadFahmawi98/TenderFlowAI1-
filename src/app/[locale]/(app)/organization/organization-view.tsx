"use client";

import { useState, useEffect } from "react";

// ── Company AI Context ─────────────────────────────────────────────────────

interface CompanyContext {
  company_name?: string;
  tagline?: string;
  founded_year?: string;
  employees_count?: string;
  headquarters?: string;
  operating_regions?: string;
  core_services?: string;
  key_clients?: string;
  past_projects?: string;
  certifications?: string;
  differentiators?: string;
  financial_turnover?: string;
  bid_win_rate?: string;
}

const CONTEXT_FIELDS: { key: keyof CompanyContext; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: "company_name",      label: "Company Name",             placeholder: "Etihad International Hospitality" },
  { key: "tagline",           label: "Tagline / Positioning",    placeholder: "UAE's premier FM solutions provider" },
  { key: "founded_year",      label: "Founded Year",             placeholder: "2005" },
  { key: "employees_count",   label: "Employees Count",          placeholder: "1,200+" },
  { key: "headquarters",      label: "HQ / Location",            placeholder: "Abu Dhabi, UAE" },
  { key: "operating_regions", label: "Operating Regions",        placeholder: "UAE, KSA, Qatar, Bahrain" },
  { key: "core_services",     label: "Core FM Services",         placeholder: "Soft services, hard services, hospitality FM, MME…", multiline: true },
  { key: "certifications",    label: "Certifications & Accreditations", placeholder: "ISO 9001:2015, ISO 45001, ISSA, BIFM…", multiline: true },
  { key: "key_clients",       label: "Key Clients (references)", placeholder: "ADNOC, Etihad Airways, Dubai Airports, DEWA…", multiline: true },
  { key: "past_projects",     label: "Notable Past Projects",    placeholder: "Describe 3-5 relevant FM contracts with scope and value…", multiline: true },
  { key: "differentiators",   label: "Key Differentiators",      placeholder: "24/7 command centre, IoT-enabled CAFM, bilingual team…", multiline: true },
  { key: "financial_turnover",label: "Annual Turnover (AED)",    placeholder: "350,000,000" },
  { key: "bid_win_rate",      label: "Bid Win Rate",             placeholder: "42%" },
];

function CompanyContextForm() {
  const [ctx, setCtx]       = useState<CompanyContext>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    fetch("/api/company-profile")
      .then((r) => r.json())
      .then((data) => { setCtx(data?.context ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/company-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: ctx }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex flex-col gap-3 p-5">
      {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-surface-mid" />)}
    </div>
  );

  return (
    <div className="p-5">
      <p className="text-[12px] text-text-secondary mb-5 leading-relaxed">
        This information is injected into every AI agent when generating bid documents. The more detail you provide, the more accurate and personalised the AI output will be.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTEXT_FIELDS.map(({ key, label, placeholder, multiline }) => (
          <div key={key} className={multiline ? "sm:col-span-2" : ""}>
            <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">{label}</label>
            {multiline ? (
              <textarea
                rows={3}
                value={ctx[key] ?? ""}
                onChange={(e) => setCtx((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary resize-none"
              />
            ) : (
              <input
                type="text"
                value={ctx[key] ?? ""}
                onChange={(e) => setCtx((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded bg-primary px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
        >
          {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {saving ? "Saving…" : "Save Company Profile"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-success font-medium">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            Saved — AI agents will use this data
          </span>
        )}
      </div>
    </div>
  );
}

interface Member {
  id: string;
  name: string;
  email?: string;
  role?: string;
  status: string;
  last_active?: string;
  created_at: string;
}

const BID_ROLES = [
  "Bid Manager",
  "Bid Writer",
  "Technical Lead",
  "Commercial Estimator",
  "Compliance Officer",
  "SLA & KPI Specialist",
  "Risk Analyst",
  "HSE Specialist",
  "Proposal Coordinator",
];

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-success",
  away:    "bg-warning",
  offline: "bg-text-muted",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function OrganizationView() {
  const [members, setMembers]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: BID_ROLES[0] });
  const [inviting, setInviting]   = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showContext, setShowContext] = useState(true);

  async function loadMembers() {
    setLoading(true);
    const res = await fetch("/api/organization/members");
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.name.trim()) return;
    setInviting(true);
    const res = await fetch("/api/organization/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inviteForm, department: "Bid Department" }),
    });
    if (res.ok) {
      const member = await res.json();
      setMembers((prev) => [member, ...prev]);
      setInviteSent(true);
      setTimeout(() => {
        setShowInvite(false);
        setInviteSent(false);
        setInviteForm({ name: "", email: "", role: BID_ROLES[0] });
      }, 1800);
    }
    setInviting(false);
  }

  function handleExportRoster() {
    const headers = ["Name", "Email", "Role", "Status"];
    const rows = members.map((m) => [m.name, m.email ?? "", m.role ?? "", m.status]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bid-team.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const active  = members.filter((m) => m.status === "active").length;
  const byRole  = BID_ROLES.filter((r) => members.some((m) => m.role === r));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Bid Team</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""} &middot; {active} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportRoster} className="flex items-center gap-1.5 rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
            <span className="material-symbols-outlined text-[15px]">download</span>
            Export
          </button>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
            <span className="material-symbols-outlined text-[15px]">person_add</span>
            Add Member
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Role breakdown chips */}
        {byRole.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {byRole.map((role) => {
              const count = members.filter((m) => m.role === role).length;
              return (
                <span key={role} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {role}
                  <span className="font-semibold text-text">{count}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Team roster */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light">
            <p className="text-[12px] font-semibold text-text">Bid Department Roster</p>
            <span className="text-[11px] text-text-muted">{members.length} people</span>
          </div>

          {loading ? (
            <div className="p-4 flex flex-col gap-3">
              {[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-surface-mid" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center px-4">
              <span className="material-symbols-outlined text-[40px] text-text-muted">group</span>
              <p className="text-[14px] font-medium text-text">No team members yet</p>
              <p className="text-[12px] text-text-secondary">Add your bid team members to track assignments and access.</p>
              <button onClick={() => setShowInvite(true)} className="mt-1 rounded bg-primary px-5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
                Add First Member
              </button>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Bid Role</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[11px] font-semibold text-primary">
                            {initials(m.name)}
                          </div>
                          <span className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white ${STATUS_COLORS[m.status] ?? "bg-text-muted"}`} />
                        </div>
                        <span className="font-medium text-text">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">{m.role ?? "—"}</td>
                    <td className="px-4 py-3.5 text-text-secondary">{m.email ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        m.status === "active" ? "bg-success-bg text-success" : "bg-surface-dim text-text-muted"
                      }`}>{m.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-text-secondary">
                      {m.last_active ? new Date(m.last_active).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Company AI Profile */}
        <div className="mt-5 rounded-lg border border-[#8B3520]/30 bg-surface shadow-sm overflow-hidden">
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-start hover:bg-surface-dim transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#8B3520]">smart_toy</span>
              <div>
                <p className="text-[13px] font-semibold text-text">Company AI Profile</p>
                <p className="text-[11px] text-text-secondary">Injected into all 12 AI agents when generating bid documents</p>
              </div>
            </div>
            <span className={`material-symbols-outlined text-[18px] text-text-muted transition-transform ${showContext ? "rotate-180" : ""}`}>
              expand_more
            </span>
          </button>
          {showContext && (
            <>
              <div className="border-t border-border-light" />
              <CompanyContextForm />
            </>
          )}
        </div>

        {/* Bid roles guide */}
        <div className="mt-5 rounded-lg border border-border bg-surface shadow-sm p-5">
          <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Bid Department Roles</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { role: "Bid Manager",          desc: "Owns the end-to-end bid process and submission" },
              { role: "Bid Writer",            desc: "Produces technical narratives and proposal copy" },
              { role: "Commercial Estimator",  desc: "Prices BOQ, labour, materials and overhead" },
              { role: "Compliance Officer",    desc: "Ensures all requirements and certifications are met" },
              { role: "Technical Lead",        desc: "Designs the FM delivery model and methodology" },
              { role: "Risk Analyst",          desc: "Identifies and mitigates bid and contract risk" },
            ].map((item) => (
              <div key={item.role} className="rounded border border-border-light bg-surface-dim p-3">
                <p className="text-[12px] font-semibold text-text">{item.role}</p>
                <p className="mt-0.5 text-[11px] text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-xl">
            <h2 className="mb-5 text-[18px] font-semibold text-text">Add Bid Team Member</h2>
            {inviteSent ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-[40px] text-success block mb-2">check_circle</span>
                <p className="text-[14px] font-medium text-text">Member added!</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Full Name *</label>
                  <input type="text" value={inviteForm.name}
                    onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Jane Doe" required
                    className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Work Email</label>
                  <input type="email" value={inviteForm.email}
                    onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="colleague@eih.ae"
                    className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Bid Role</label>
                  <select value={inviteForm.role}
                    onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary">
                    {BID_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-1">
                  <button type="button" onClick={() => setShowInvite(false)}
                    className="rounded border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting || !inviteForm.name.trim()}
                    className="rounded bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors">
                    {inviting ? "Adding..." : "Add Member"}
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
