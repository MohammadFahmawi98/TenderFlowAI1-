"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { OrgChartDetailed, OrgChartSummary, type OrgRole, type OrgChartData } from "@/components/org-chart";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Section {
  section_type: string;
  content_html: string | null;
  section_data: { roles?: OrgRole[] };
  status: "empty" | "generating" | "ready";
  generated_at: string | null;
}

type SectionMap = Record<string, Section>;

const SECTIONS = [
  { key: "experiences", num: 1, label: "Project Experiences",      icon: "work_history",      ai: true },
  { key: "scope",       num: 2, label: "Scope & Company Profile",  icon: "domain",            ai: true },
  { key: "manpower",    num: 3, label: "Manpower & Org Chart",     icon: "groups",            ai: false },
  { key: "qhse",        num: 4, label: "QHSE Plan",                icon: "health_and_safety", ai: true },
  { key: "technical",   num: 5, label: "Technical Proposal",       icon: "engineering",       ai: true },
  { key: "tools",       num: 6, label: "Tools & Technology",       icon: "construction",      ai: true },
  { key: "quality",     num: 7, label: "Quality Assurance",        icon: "verified",          ai: true },
  { key: "references",  num: 8, label: "References",               icon: "star",              ai: true },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];

// ─── Org Chart Editor ─────────────────────────────────────────────────────────

const DEFAULT_ROLES: OrgRole[] = [
  { title: "Senior Facility Engineer", count: 1, tier: "management" },
  { title: "Junior Facility Engineer", count: 2, tier: "mid" },
  { title: "Property Management Executive", count: 1, tier: "management" },
  { title: "FM Coordinator", count: 2, tier: "operational" },
  { title: "Sr. HVAC Technician", count: 2, tier: "operational" },
  { title: "Jr. HVAC Technician", count: 4, tier: "operational" },
  { title: "Sr. Electrician", count: 2, tier: "operational" },
  { title: "Jr. Electrician", count: 4, tier: "operational" },
  { title: "Plumber", count: 2, tier: "operational" },
  { title: "Carpenter", count: 1, tier: "operational" },
];

const DEFAULT_SS_ROLES: OrgRole[] = [
  { title: "Supervisors", count: 4, tier: "management" },
  { title: "Female Cleaners", count: 12, tier: "operational" },
  { title: "Male Cleaners", count: 66, tier: "operational" },
  { title: "Office Boy", count: 2, tier: "operational" },
];

interface OrgEditorProps {
  tenderId: string;
  projectName: string;
  savedData: { roles?: OrgRole[]; ssRoles?: OrgRole[] };
  onSaved: (data: { roles: OrgRole[]; ssRoles: OrgRole[] }) => void;
}

function OrgEditor({ tenderId, projectName, savedData, onSaved }: OrgEditorProps) {
  const [hsRoles, setHsRoles] = useState<OrgRole[]>(savedData.roles ?? DEFAULT_ROLES);
  const [ssRoles, setSsRoles] = useState<OrgRole[]>(savedData.ssRoles ?? DEFAULT_SS_ROLES);
  const [activeChart, setActiveChart] = useState<"detailed" | "summary">("detailed");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("preview");

  const chartData: OrgChartData = {
    projectName,
    hardServices: hsRoles,
    softServices: ssRoles,
  };

  const hsTotal = hsRoles.reduce((s, r) => s + r.count, 0);
  const ssTotal = ssRoles.reduce((s, r) => s + r.count, 0);

  function updateRole(
    list: OrgRole[], setList: (r: OrgRole[]) => void,
    idx: number, field: keyof OrgRole, value: string | number,
  ) {
    const next = list.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setList(next);
  }

  function addRole(list: OrgRole[], setList: (r: OrgRole[]) => void) {
    setList([...list, { title: "New Role", count: 1, tier: "operational" }]);
  }

  function removeRole(list: OrgRole[], setList: (r: OrgRole[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/tenders/${tenderId}/proposal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_type: "manpower",
        section_data: { roles: hsRoles, ssRoles },
        status: "ready",
      }),
    });
    setSaving(false);
    onSaved({ roles: hsRoles, ssRoles });
  }

  function printChart() {
    const svgEl = document.getElementById("org-chart-print");
    if (!svgEl) return;
    const svgContent = svgEl.outerHTML;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Org Chart — ${projectName}</title>
      <style>
        @page { size: A3 landscape; margin: 10mm; }
        body { margin: 0; background: white; }
        svg { width: 100%; height: auto; }
        .cover { text-align:center; padding: 20px 0; font-family: Arial; }
        h1 { color: #8B3520; margin: 0 0 4px; font-size: 22px; }
        p  { color: #666; margin: 0; font-size: 13px; }
        .charts { display: flex; flex-direction: column; gap: 32px; padding: 20px; }
      </style>
    </head><body>
      <div class="cover">
        <h1>${projectName}</h1>
        <p>Manpower &amp; Organisation Chart — Etihad International Hospitality (EIH)</p>
      </div>
      <div class="charts">${svgContent}</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }

  function RoleTable({
    label, roles, setRoles,
  }: { label: string; roles: OrgRole[]; setRoles: (r: OrgRole[]) => void }) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-text-primary">{label}</h4>
          <button onClick={() => addRole(roles, setRoles)}
                  className="text-xs text-primary flex items-center gap-1 hover:underline">
            <span className="material-symbols-outlined text-sm">add</span> Add role
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-text-muted border-b border-border">
              <th className="pb-1 pr-2 w-1/2">Job Title</th>
              <th className="pb-1 pr-2 w-16 text-center">Count</th>
              <th className="pb-1 pr-2">Tier</th>
              <th className="pb-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="py-1 pr-2">
                  <input value={r.title} onChange={(e) => updateRole(roles, setRoles, i, "title", e.target.value)}
                         className="w-full bg-transparent text-text-primary focus:outline-none" />
                </td>
                <td className="py-1 pr-2">
                  <input type="number" min={1} value={r.count}
                         onChange={(e) => updateRole(roles, setRoles, i, "count", parseInt(e.target.value) || 1)}
                         className="w-14 text-center bg-transparent text-text-primary focus:outline-none" />
                </td>
                <td className="py-1 pr-2">
                  <select value={r.tier} onChange={(e) => updateRole(roles, setRoles, i, "tier", e.target.value)}
                          className="bg-transparent text-text-primary text-xs focus:outline-none">
                    <option value="management">Management</option>
                    <option value="mid">Mid-level</option>
                    <option value="operational">Operational</option>
                  </select>
                </td>
                <td className="py-1">
                  <button onClick={() => removeRole(roles, setRoles, i)}
                          className="text-danger hover:text-danger/70">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-surface-mid rounded-lg p-0.5 text-sm">
          <button onClick={() => setView("preview")}
                  className={`px-3 py-1 rounded-md transition-colors ${view === "preview" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
            Preview
          </button>
          <button onClick={() => setView("edit")}
                  className={`px-3 py-1 rounded-md transition-colors ${view === "edit" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
            Edit Roles
          </button>
        </div>

        {view === "preview" && (
          <div className="flex bg-surface-mid rounded-lg p-0.5 text-sm">
            <button onClick={() => setActiveChart("detailed")}
                    className={`px-3 py-1 rounded-md transition-colors ${activeChart === "detailed" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
              Chart 1 — Detailed
            </button>
            <button onClick={() => setActiveChart("summary")}
                    className={`px-3 py-1 rounded-md transition-colors ${activeChart === "summary" ? "bg-surface text-text-primary shadow-sm" : "text-text-muted"}`}>
              Chart 2 — Summary
            </button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <button onClick={save} disabled={saving}
                  className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={printChart}
                  className="px-3 py-1.5 text-sm border border-border text-text-primary rounded-lg hover:bg-surface-mid flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">print</span>
            Print / PDF
          </button>
        </div>
      </div>

      {/* Totals bar */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="px-3 py-1.5 rounded-full bg-[#8B3520]/10 text-[#8B3520] font-semibold">
          HS Total: {hsTotal}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-[#C8A24A]/10 text-[#8B3520] font-semibold">
          SS Total: {ssTotal}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">
          Grand Total: {hsTotal + ssTotal}
        </span>
      </div>

      {/* Edit mode */}
      {view === "edit" && (
        <div className="grid grid-cols-2 gap-6 bg-surface-dim rounded-xl p-4">
          <RoleTable label="Hard Services Roles" roles={hsRoles} setRoles={setHsRoles} />
          <RoleTable label="Soft Services Roles" roles={ssRoles} setRoles={setSsRoles} />
        </div>
      )}

      {/* Preview mode */}
      {view === "preview" && (
        <div id="org-chart-print" className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
          {activeChart === "detailed"
            ? <OrgChartDetailed data={chartData} />
            : <OrgChartSummary data={chartData} />
          }
        </div>
      )}
    </div>
  );
}

// ─── Document Viewer / Editor ─────────────────────────────────────────────────

function DocViewer({
  tenderId, sectionKey, section, projectName,
  onUpdate,
}: {
  tenderId: string;
  sectionKey: SectionKey;
  section: Section;
  projectName: string;
  onUpdate: (s: Section) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editHtml, setEditHtml] = useState(section.content_html ?? "");
  const contentRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setGenerating(true);
    onUpdate({ ...section, status: "generating" });
    const res = await fetch(`/api/tenders/${tenderId}/generate-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionType: sectionKey }),
    });
    const data = await res.json() as { html?: string; error?: string };
    if (data.html) {
      const updated = { ...section, content_html: data.html, status: "ready" as const };
      onUpdate(updated);
      setEditHtml(data.html);
    }
    setGenerating(false);
  }

  async function saveEdit() {
    await fetch(`/api/tenders/${tenderId}/proposal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_type: sectionKey, content_html: editHtml, status: "ready" }),
    });
    onUpdate({ ...section, content_html: editHtml, status: "ready" });
    setEditing(false);
  }

  function printSection() {
    const content = contentRef.current?.innerHTML ?? "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>${SECTIONS.find((s) => s.key === sectionKey)?.label} — ${projectName}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { margin: 0; font-family: Arial, sans-serif; color: #333; }
        .header { border-bottom: 3px solid #C8A24A; padding-bottom: 12px; margin-bottom: 24px; }
        .header h1 { color: #8B3520; margin: 0 0 4px; font-size: 20px; }
        .header p { margin: 0; color: #888; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 6px 10px; border: 1px solid #ddd; }
        th { background: #f9f5f0; font-weight: 600; }
        tr:nth-child(even) { background: #f9f5f0; }
      </style>
    </head><body>
      <div class="header">
        <h1>${projectName}</h1>
        <p>Etihad International Hospitality (EIH) — Technical Proposal Package</p>
      </div>
      ${content}
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const meta = SECTIONS.find((s) => s.key === sectionKey);

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-2 mb-4">
        {meta?.ai && (
          <button onClick={generate} disabled={generating}
                  className="px-3 py-1.5 text-sm bg-[#8B3520] text-white rounded-lg hover:bg-[#7a2e1b] disabled:opacity-50 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">
              {generating ? "hourglass_empty" : "smart_toy"}
            </span>
            {generating ? "Generating…" : section.status === "ready" ? "Regenerate" : "Generate with AI"}
          </button>
        )}
        {section.status === "ready" && (
          <>
            <button onClick={() => { setEditing(!editing); setEditHtml(section.content_html ?? ""); }}
                    className="px-3 py-1.5 text-sm border border-border text-text-primary rounded-lg hover:bg-surface-mid flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">{editing ? "close" : "edit"}</span>
              {editing ? "Cancel Edit" : "Edit"}
            </button>
            {editing && (
              <button onClick={saveEdit}
                      className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">save</span>
                Save Edits
              </button>
            )}
            <button onClick={printSection}
                    className="px-3 py-1.5 text-sm border border-border text-text-primary rounded-lg hover:bg-surface-mid flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">print</span>
              Print / PDF
            </button>
          </>
        )}
        {section.generated_at && (
          <span className="ml-auto text-xs text-text-muted">
            Generated {new Date(section.generated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Content */}
      {section.status === "generating" && (
        <div className="flex items-center gap-3 py-16 justify-center text-text-muted">
          <div className="w-6 h-6 border-2 border-[#8B3520] border-t-transparent rounded-full animate-spin" />
          <span>Generating {meta?.label}…</span>
        </div>
      )}

      {section.status === "empty" && !generating && (
        <div className="py-16 text-center text-text-muted">
          <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">description</span>
          <p className="text-sm">Click <strong>Generate with AI</strong> to produce this section.</p>
        </div>
      )}

      {section.status === "ready" && !editing && (
        <div ref={contentRef}
             className="bg-white rounded-xl shadow-sm p-8 prose prose-sm max-w-none overflow-auto"
             dangerouslySetInnerHTML={{ __html: section.content_html ?? "" }} />
      )}

      {section.status === "ready" && editing && (
        <textarea
          value={editHtml}
          onChange={(e) => setEditHtml(e.target.value)}
          className="w-full h-[60vh] font-mono text-xs p-4 bg-surface-dim border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>();
  const [sections, setSections] = useState<SectionMap>({});
  const [activeKey, setActiveKey] = useState<SectionKey>("technical");
  const [projectName, setProjectName] = useState("Project Name");
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tenders/${id}/proposal`).then((r) => r.json()),
      fetch(`/api/tenders/${id}`).then((r) => r.json()),
    ]).then(([secs, tender]) => {
      setSections(secs as SectionMap);
      if (tender?.name) setProjectName(tender.name as string);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const updateSection = useCallback((key: string, s: Section) => {
    setSections((prev) => ({ ...prev, [key]: s }));
  }, []);

  async function generateAll() {
    setGeneratingAll(true);
    const aiSections = SECTIONS.filter((s) => s.ai).map((s) => s.key);
    for (const key of aiSections) {
      const res = await fetch(`/api/tenders/${id}/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType: key }),
      });
      const data = await res.json() as { html?: string };
      if (data.html) {
        const html = data.html;
        setSections((prev) => ({
          ...prev,
          [key]: { ...(prev[key] ?? {}), content_html: html, status: "ready", section_type: key, section_data: prev[key]?.section_data ?? {}, generated_at: new Date().toISOString() } as Section,
        }));
      }
    }
    setGeneratingAll(false);
  }

  function printAll() {
    const w = window.open("", "_blank");
    if (!w) return;
    const pages = SECTIONS.map((s) => {
      if (s.key === "manpower") return "";
      const html = sections[s.key]?.content_html ?? "";
      if (!html) return "";
      return `<div class="page">
        <div class="page-header">
          <h1>${projectName}</h1>
          <p>${s.num}. ${s.label} — Etihad International Hospitality (EIH)</p>
        </div>
        ${html}
      </div>`;
    }).filter(Boolean).join("\n");

    w.document.write(`<!DOCTYPE html><html><head>
      <title>Technical Proposal — ${projectName}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        @media print { .page { page-break-after: always; } }
        body { font-family: Arial, sans-serif; color: #333; }
        .page { padding: 0 0 40px; }
        .page-header { border-bottom: 3px solid #C8A24A; margin-bottom: 24px; padding-bottom: 12px; }
        .page-header h1 { color: #8B3520; margin: 0 0 4px; font-size: 18px; }
        .page-header p { margin: 0; color: #888; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        td, th { padding: 6px 10px; border: 1px solid #ddd; }
        th { background: #f9f5f0; }
        tr:nth-child(even) td { background: #f9f5f0; }
        h2 { color: #8B3520; border-bottom: 2px solid #C8A24A; padding-bottom: 6px; }
        h3 { color: #C8A24A; }
      </style>
    </head><body>${pages}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const readyCount = Object.values(sections).filter((s) => s.status === "ready").length;
  const activeSection = sections[activeKey] ?? { section_type: activeKey, content_html: null, section_data: {}, status: "empty", generated_at: null };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#8B3520] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left nav */}
      <aside className="w-64 border-r border-border bg-surface-dim flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Technical Proposal</h2>
          <p className="text-xs text-text-muted mt-0.5">{readyCount}/{SECTIONS.length} sections ready</p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-[#C8A24A] rounded-full transition-all"
                 style={{ width: `${(readyCount / SECTIONS.length) * 100}%` }} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {SECTIONS.map((s) => {
            const sec = sections[s.key];
            const isReady = sec?.status === "ready";
            const isGenerating = sec?.status === "generating";
            return (
              <button key={s.key} onClick={() => setActiveKey(s.key)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-sm transition-colors ${
                        activeKey === s.key
                          ? "bg-[#8B3520]/10 text-[#8B3520]"
                          : "text-text-secondary hover:bg-surface hover:text-text-primary"
                      }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isReady ? "bg-success text-white" : isGenerating ? "bg-warning text-white" : "bg-border text-text-muted"
                }`}>
                  {isGenerating ? "…" : isReady ? "✓" : s.num}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
                {!s.ai && (
                  <span className="material-symbols-outlined text-sm text-text-muted">edit_square</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-2">
          <button onClick={generateAll} disabled={generatingAll}
                  className="w-full px-3 py-2 text-sm bg-[#8B3520] text-white rounded-lg hover:bg-[#7a2e1b] disabled:opacity-50 flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">
              {generatingAll ? "hourglass_empty" : "auto_awesome"}
            </span>
            {generatingAll ? "Generating All…" : "Generate All with AI"}
          </button>
          <button onClick={printAll} disabled={readyCount === 0}
                  className="w-full px-3 py-2 text-sm border border-border text-text-primary rounded-lg hover:bg-surface disabled:opacity-40 flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">print</span>
            Export Full Package
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Section title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#8B3520]/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[#8B3520] text-lg">
              {SECTIONS.find((s) => s.key === activeKey)?.icon ?? "description"}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {SECTIONS.find((s) => s.key === activeKey)?.num}.{" "}
              {SECTIONS.find((s) => s.key === activeKey)?.label}
            </h2>
            <p className="text-xs text-text-muted">{projectName}</p>
          </div>
        </div>

        {/* Section content */}
        {activeKey === "manpower" ? (
          <OrgEditor
            tenderId={id}
            projectName={projectName}
            savedData={(activeSection.section_data as { roles?: OrgRole[]; ssRoles?: OrgRole[] }) ?? {}}
            onSaved={(data) => updateSection("manpower", { ...activeSection, section_data: data, status: "ready" })}
          />
        ) : (
          <DocViewer
            tenderId={id}
            sectionKey={activeKey}
            section={activeSection}
            projectName={projectName}
            onUpdate={(s) => updateSection(activeKey, s)}
          />
        )}
      </main>
    </div>
  );
}
