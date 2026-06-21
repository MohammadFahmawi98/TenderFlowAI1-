"use client";

import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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

interface PresenceUser {
  user_id: string;
  initials: string;
  color: string;
  tab: string;
}

interface AgentStatus {
  status: "waiting" | "running" | "completed" | "failed";
  progress: number;
}

const PRESENCE_COLORS = ["#8B3520","#C8A24A","#2563EB","#16A34A","#9333EA","#DC2626","#0891B2"];
function colorFor(id: string) { return PRESENCE_COLORS[Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % PRESENCE_COLORS.length]; }
function initials(email: string) { return email.split("@")[0].slice(0, 2).toUpperCase(); }

// Two parallel batches + sequential tail
const AGENT_BATCHES: string[][] = [
  ["intelligence", "qualification", "compliance", "technical", "manpower"],
  ["commercial", "ppm", "risk", "hse", "sla"],
  ["presentation"],
  ["executive_review"],
];

const AGENT_LABELS: Record<string, string> = {
  intelligence: "Intel", qualification: "Qual", compliance: "Comply",
  technical: "Tech", commercial: "Comm", manpower: "Staff",
  ppm: "PPM", risk: "Risk", hse: "HSE", sla: "SLA",
  presentation: "Pres", executive_review: "Review",
};

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
  const pathname  = usePathname();
  const router    = useRouter();

  const [running,          setRunning]          = useState(false);
  const [runError,         setRunError]         = useState("");
  const [showMenu,         setShowMenu]         = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [showStatusModal,  setShowStatusModal]  = useState(false);
  const [currentStatus,    setCurrentStatus]    = useState(tender?.status ?? "");
  const [savingStatus,     setSavingStatus]     = useState(false);
  const [presence,         setPresence]         = useState<PresenceUser[]>([]);
  const [agentStatuses,    setAgentStatuses]    = useState<Record<string, AgentStatus>>({});
  const [completedCount,   setCompletedCount]   = useState(0);

  const menuRef     = useRef<HTMLDivElement>(null);
  const channelRef  = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const rtChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Close menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Supabase Realtime: presence + agent progress ─────────────────────────
  useEffect(() => {
    if (!tender?.id) return;
    const supabase = createClient();
    let myId = "";

    // Presence channel
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? `guest-${Math.random().toString(36).slice(2, 7)}`;
      myId = data.user?.id ?? email;
      const tab = pathname.split("/").pop() ?? "overview";

      const presenceCh = supabase.channel(`workspace:${tender.id}`, {
        config: { presence: { key: myId } },
      });
      channelRef.current = presenceCh;

      presenceCh
        .on("presence", { event: "sync" }, () => {
          const state = presenceCh.presenceState<{ initials: string; color: string; tab: string }>();
          const users: PresenceUser[] = Object.entries(state)
            .filter(([uid]) => uid !== myId)
            .map(([uid, metas]) => {
              const m = (metas as Array<{ initials: string; color: string; tab: string }>)[0];
              return { user_id: uid, initials: m.initials, color: m.color, tab: m.tab };
            });
          setPresence(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceCh.track({ initials: initials(email), color: colorFor(myId), tab });
          }
        });
    });

    // Agent progress channel — listens for agent_runs row updates
    const rtCh = supabase
      .channel(`agent-progress:${tender.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_runs", filter: `tender_id=eq.${tender.id}` },
        (payload) => {
          const row = payload.new as { agent_type: string; status: string; progress: number };
          setAgentStatuses((prev) => ({
            ...prev,
            [row.agent_type]: { status: row.status as AgentStatus["status"], progress: row.progress ?? 0 },
          }));
          if (row.status === "completed" || row.status === "failed") {
            setCompletedCount((n) => n + 1);
          }
        },
      )
      .subscribe();
    rtChannelRef.current = rtCh;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      rtChannelRef.current?.unsubscribe();
      rtChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tender?.id]);

  const tenderId   = tender?.id;

  // ── Status helpers ────────────────────────────────────────────────────────
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

  // ── Per-agent orchestration ───────────────────────────────────────────────
  const runAgents = useCallback(async () => {
    if (!tenderId || running) return;
    setRunning(true);
    setRunError("");
    setAgentStatuses({});
    setCompletedCount(0);
    router.push(`/tenders/${tenderId}`);

    try {
      // 1. Seed all agents as "waiting"
      const seedRes = await fetch(`/api/tenders/${tenderId}/run-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: true }),
      });
      if (!seedRes.ok) {
        const b = await seedRes.json().catch(() => ({}));
        throw new Error(b.error ?? "Failed to initialise agents");
      }

      // 2. Helper — call one agent
      async function runOne(type: string) {
        try {
          await fetch(`/api/tenders/${tenderId}/run-agents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentType: type }),
          });
        } catch (err) {
          console.error(`[runAgents] ${type} network error:`, err);
        }
      }

      // 3. Run in batches — each batch is parallel, batches are sequential
      for (const batch of AGENT_BATCHES) {
        await Promise.all(batch.map(runOne));
      }
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Agent run failed");
    } finally {
      setRunning(false);
    }
  }, [tenderId, running, router]);

  const base       = `/tenders/${tenderId}`;
  const allAgents = Object.keys(AGENT_LABELS);
  const doneCount = Object.values(agentStatuses).filter((a) => a.status === "completed").length;
  const failCount = Object.values(agentStatuses).filter((a) => a.status === "failed").length;

  function isActive(tabPath: string) {
    if (tabPath === "") return pathname === base || pathname === base + "/";
    return pathname.startsWith(base + tabPath);
  }

  const activeStatus = currentStatus || tender?.status || "";
  const statusStyle  = activeStatus
    ? STATUS_STYLES[activeStatus] ?? { label: activeStatus.replace(/_/g, " "), cls: "text-text-muted bg-surface-dim" }
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <header className="border-b border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <div className="min-w-0">
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
                  <span>Value: <span className="text-text">{tender.contract_value.toLocaleString()} AED</span></span>
                )}
              </div>
            )}
          </div>

          {/* Right-side controls */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Team presence avatars */}
            {presence.length > 0 && (
              <div className="flex items-center -space-x-2 mr-1">
                {presence.slice(0, 4).map((u) => (
                  <div
                    key={u.user_id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[10px] font-bold text-white"
                    style={{ background: u.color }}
                    title={`Viewing: ${u.tab}`}
                  >
                    {u.initials}
                  </div>
                ))}
                {presence.length > 4 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-surface-dim text-[10px] font-bold text-text-secondary">
                    +{presence.length - 4}
                  </div>
                )}
              </div>
            )}

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
              {running
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-text-secondary border-t-transparent" />
                : <span className="material-symbols-outlined text-[15px]">smart_toy</span>}
              {running ? `Running ${doneCount}/12…` : "Run AI"}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="flex items-center rounded border border-border p-2 text-text-secondary hover:bg-surface-dim transition-colors"
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

        {/* ── Agent progress bar (shows while running or just after) ─────── */}
        {(running || doneCount > 0 || failCount > 0) && (
          <div className="px-6 pb-3">
            {/* Overall bar */}
            <div className="flex items-center gap-3 mb-1.5">
              <div className="flex-1 h-1.5 bg-surface-mid rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(((doneCount + failCount) / 12) * 100)}%`,
                    background: failCount > 0 ? "#ef4444" : "#8B3520",
                  }}
                />
              </div>
              <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                {doneCount}/12 done{failCount > 0 ? ` · ${failCount} failed` : ""}
              </span>
            </div>
            {/* Per-agent chips */}
            <div className="flex flex-wrap gap-1">
              {allAgents.map((type) => {
                const s = agentStatuses[type];
                const cls = !s || s.status === "waiting"
                  ? "bg-surface-dim text-text-muted"
                  : s.status === "running"
                  ? "bg-primary/10 text-primary border border-primary/30 animate-pulse"
                  : s.status === "completed"
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-danger/10 text-danger border border-danger/20";
                return (
                  <span key={type} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
                    {s?.status === "running" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    )}
                    {s?.status === "completed" && "✓ "}
                    {s?.status === "failed" && "✕ "}
                    {AGENT_LABELS[type]}
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
                {/* Show dot if agent for this tab is running */}
                {(() => {
                  const map: Record<string, string> = {
                    qualification: "qualification", compliance: "compliance",
                    manpower: "manpower", risk: "risk", sla: "sla",
                    assets: "ppm", documents: "technical",
                  };
                  const agent = map[tab.key];
                  const st = agent ? agentStatuses[agent]?.status : undefined;
                  if (st === "running") return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle animate-pulse" />;
                  if (st === "completed") return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />;
                  return null;
                })()}
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
                      isSelected ? "border-primary bg-primary-light font-semibold" : "border-border hover:bg-surface-dim",
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
            {savingStatus && <p className="mt-3 text-center text-[12px] text-text-muted">Saving…</p>}
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
