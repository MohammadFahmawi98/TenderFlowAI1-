"use client";

import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";

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
  analyzing:   { label: "Analyzing",   cls: "text-primary bg-primary-light" },
  in_progress: { label: "In Proposal", cls: "text-primary bg-primary-light" },
  in_review:   { label: "Review Req.", cls: "text-warning bg-warning-bg" },
  ready:       { label: "Ready",       cls: "text-success bg-success-bg" },
  submitted:   { label: "Submitted",   cls: "text-success bg-success-bg" },
  archived:    { label: "Archived",    cls: "text-text-muted bg-surface-dim" },
};

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

  const statusStyle = tender?.status
    ? STATUS_STYLES[tender.status] ?? { label: tender.status, cls: "text-text-muted bg-surface-dim" }
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
            <button className="rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
              Save Changes
            </button>
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
    </div>
  );
}
