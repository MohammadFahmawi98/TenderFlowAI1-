"use client";

import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { useState, useRef, useEffect } from "react";

interface Tender {
  id: string;
  name: string;
  client?: string;
  submission_deadline?: string;
  contract_value?: number;
  readiness_score?: number;
  win_probability?: number;
  status: string;
}

const TABS = [
  { key: "overview",      label: "Overview",     path: "" },
  { key: "qualification", label: "Qualification", path: "/qualification" },
  { key: "compliance",    label: "Compliance",    path: "/compliance" },
  { key: "estimation",    label: "Estimation",    path: "/estimation" },
  { key: "manpower",      label: "Manpower",      path: "/manpower" },
  { key: "assets",        label: "Assets & PPM",  path: "/assets" },
  { key: "risk",          label: "Risk",          path: "/risk" },
  { key: "sla",           label: "SLA & KPI",     path: "/sla" },
  { key: "documents",     label: "Documents",     path: "/documents" },
  { key: "chat",          label: "Chat",          path: "/chat" },
  { key: "export",        label: "Export",        path: "/export" },
] as const;

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "text-text-muted bg-surface-dim" },
  analyzing:   { label: "Analyzing",   cls: "text-primary bg-primary-light" },
  in_progress: { label: "In Proposal", cls: "text-primary bg-primary-light" },
  in_review:   { label: "Review Req.", cls: "text-warning bg-warning-bg" },
  ready:       { label: "Ready",       cls: "text-success bg-success-bg" },
  submitted:   { label: "Submitted",   cls: "text-success bg-success-bg" },
  won:         { label: "Won",         cls: "text-success bg-success-bg" },
  lost:        { label: "Lost",        cls: "text-danger bg-danger-bg" },
  no_bid:      { label: "No Bid",      cls: "text-text-muted bg-surface-dim" },
  archived:    { label: "Archived",    cls: "text-text-muted bg-surface-dim" },
};

const STATUS_OPTIONS = [
  { value: "draft",       label: "Draft" },
  { value: "in_progress", label: "In Proposal" },
  { value: "in_review",   label: "Review Required" },
  { value: "ready",       label: "Ready to Submit" },
  { value: "submitted",   label: "Submitted" },
  { value: "won",         label: "Won" },
  { value: "lost",        label: "Lost" },
  { value: "no_bid",      label: "No Bid" },
  { value: "archived",    label: "Archived" },
];

export function WorkspaceShell({
  tender,
  children,
}: {
  tender: Tender | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(tender?.status ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function updateStatus(status: string) {
    if (!tenderId) return;
    setSavingStatus(true);
    await fetch(`/api/tenders/${tenderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setCurrentStatus(status);
    setSavingStatus(false);
    setShowStatusModal(false);
  }

  async function deleteTender() {
    if (!tenderId) return;
    setDeleting(true);
    await fetch(`/api/tenders/${tenderId}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    router.push("/tenders");
  }

  const tenderId = tender?.id;
  const base = `/tenders/${tenderId}`;

  function isActive(tabPath: string) {
    if (tabPath === "") return pathname === base || pathname === base + "/";
    return pathname.startsWith(base + tabPath);
  }

  async function runAgents() {
    if (!tenderId || running) return;
    setRunning(true);
    setRunError("");
    router.push(`/tenders/${tenderId}`);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/run-agents`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRunError(body.error ?? `Agent run failed (${res.status})`);
      }
    } catch (e) {
      setRunError("Network error — check your connection and try again.");
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

  const activeStatus = currentStatus || tender?.status || "";
  const statusStyle = activeStatus
    ? STATUS_STYLES[activeStatus] ?? { label: activeStatus.replace(/_/g, " "), cls: "text-text-muted bg-surface-dim" }
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <header className="border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <div className="min-w-0">
            {/* Back link */}
            <Link
              href="/tenders"
              className="mb-1.5 flex items-center gap-1 text-[12px] text-text-secondary hover:text-text transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              All Tenders
            </Link>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[18px] font-semibold text-text truncate max-w-[400px]">
                {tender?.name ?? "Tender Workspace"}
              </h1>
              {statusStyle && (
                <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle.cls}`}>
                  {statusStyle.label}
                </span>
              )}
            </div>
            {(tender?.client || tender?.submission_deadline) && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-text-secondary">
                {tender.client && <span>{tender.client}</span>}
                {tender.submission_deadline && (
                  <span>
                    Deadline:{" "}
                    <span className="text-text">
                      {new Date(tender.submission_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                )}
                {tender.contract_value && (
                  <span>
                    Value:{" "}
                    <span className="text-text">{tender.contract_value.toLocaleString()} AED</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/tenders/${tenderId}/export`}
              className="rounded px-3.5 py-2 text-[12px] font-semibold text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #8B3520 0%, #C8A24A 100%)" }}
            >
              Export Package
            </Link>
            <button
              onClick={runAgents}
              disabled={running}
              className="flex items-center gap-1.5 rounded border border-border px-3 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim disabled:opacity-50 transition-colors"
            >
              {running && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
              )}
              <span className="material-symbols-outlined text-[15px]">smart_toy</span>
              {running ? "Running…" : "Run AI"}
            </button>
            {/* More actions menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="flex items-center rounded border border-border p-2 text-text-secondary hover:bg-surface-dim transition-colors"
                title="More actions"
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
              {showMenu && (
                <div className="absolute end-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
                  <button
                    onClick={() => { setShowMenu(false); setShowStatusModal(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-text hover:bg-surface-dim transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px] text-text-muted">swap_horiz</span>
                    Change Status
                  </button>
                  <div className="border-t border-border-light" />
                  <button
                    onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-[13px] text-danger hover:bg-danger-bg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                    Delete Tender
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error banner */}
        {runError && (
          <div className="mx-6 mb-2 flex items-center gap-2 rounded border border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {runError}
            <button onClick={() => setRunError("")} className="ml-auto text-danger hover:opacity-70">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto px-6 border-t border-border-light">
          {TABS.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Link
                key={tab.key}
                href={`${base}${tab.path}`}
                className={[
                  "relative shrink-0 px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
                  active
                    ? "border-b-2 -mb-px font-semibold"
                    : "text-text-secondary hover:text-text border-b-2 border-transparent -mb-px",
                ].join(" ")}
                style={active ? { color: "#8B3520", borderBottomColor: "#C8A24A" } : {}}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto bg-bg">
        <div className="mx-auto w-full max-w-5xl px-8 py-7">
          {children}
        </div>
      </div>

      {/* Change Status modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-text">Change Tender Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-text-muted hover:text-text">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const s = STATUS_STYLES[opt.value];
                const isSelected = opt.value === activeStatus;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateStatus(opt.value)}
                    disabled={savingStatus}
                    className={[
                      "flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors text-start",
                      isSelected
                        ? "border-primary bg-primary-light font-semibold"
                        : "border-border hover:bg-surface-dim",
                    ].join(" ")}
                  >
                    <span className={isSelected ? "text-primary" : "text-text"}>{opt.label}</span>
                    <div className="flex items-center gap-2">
                      {s && (
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>
                          {s.label}
                        </span>
                      )}
                      {isSelected && <span className="material-symbols-outlined text-[14px] text-primary">check</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {savingStatus && (
              <p className="mt-3 text-center text-[12px] text-text-muted">Saving…</p>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-bg">
                <span className="material-symbols-outlined text-[18px] text-danger">delete_forever</span>
              </div>
              <h3 className="text-[16px] font-semibold text-text">Delete Tender?</h3>
            </div>
            <p className="text-[13px] text-text-secondary">
              This will permanently delete <strong>{tender?.name ?? "this tender"}</strong> and all associated documents, agent outputs, and files. This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={deleteTender}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-danger px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {deleting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-surface-dim transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
