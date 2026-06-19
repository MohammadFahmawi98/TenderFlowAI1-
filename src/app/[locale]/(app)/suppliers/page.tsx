"use client";

import { useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  preferred:   "text-primary bg-primary-light",
  approved:    "text-success bg-success-bg",
  pending:     "text-warning bg-warning-bg",
  blacklisted: "text-danger bg-danger-bg",
};

const COMPLIANCE_STYLES: Record<string, string> = {
  compliant:      "text-success bg-success-bg",
  "non-compliant": "text-danger bg-danger-bg",
  pending:        "text-warning bg-warning-bg",
};

interface Supplier {
  id: string;
  name: string;
  category: string;
  compliance: string;
  rating: number;
  contact: string;
  region: string;
  status: string;
}

const EMPTY_SUPPLIERS: Supplier[] = [];

const CATEGORIES = ["All Categories", "MEP", "HVAC", "Security / ELV", "Soft Services", "Fire & Safety", "Vertical Transport", "Civil Works"];
const REGIONS = ["All Regions", "Abu Dhabi", "Dubai", "Sharjah", "Northern Emirates"];

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [region, setRegion] = useState("All Regions");
  const [complianceFilter, setComplianceFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", email: "", category: "MEP" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSupplier),
      });
      setToast("Supplier added successfully");
      setShowModal(false);
      setNewSupplier({ name: "", email: "", category: "MEP" });
      setTimeout(() => setToast(""), 3000);
    } catch {
      setToast("Error adding supplier");
      setTimeout(() => setToast(""), 3000);
    }
    setSubmitting(false);
  }

  function openModal() { setShowModal(true); }

  const filtered = EMPTY_SUPPLIERS.filter((s) => {
    const matchCat = category === "All Categories" || s.category === category;
    const matchRegion = region === "All Regions" || s.region === region;
    const matchCompliance = complianceFilter === "All" || s.compliance === complianceFilter;
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchRegion && matchCompliance && matchSearch;
  });

  const totalSuppliers = EMPTY_SUPPLIERS.length;
  const nonCompliant = EMPTY_SUPPLIERS.filter((s) => s.compliance === "non-compliant").length;
  const prequalified = EMPTY_SUPPLIERS.length > 0
    ? Math.round((EMPTY_SUPPLIERS.filter((s) => s.status === "preferred" || s.status === "approved").length / EMPTY_SUPPLIERS.length) * 100)
    : 0;

  function Stars({ n }: { n: number }) {
    return (
      <span className="text-warning text-[13px]">
        {"★".repeat(Math.round(n))}{"☆".repeat(5 - Math.round(n))}
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-text-muted mb-1">
            <span>Directory</span>
            <span>/</span>
            <span className="text-text-secondary">Suppliers</span>
          </div>
          <h1 className="text-[20px] font-semibold text-text">Suppliers Database</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openModal} className="flex items-center gap-1.5 rounded border border-border px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors">
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Invite Supplier
          </button>
          <button onClick={openModal} className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Supplier
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-dim transition-colors text-text-secondary">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
            AS
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* KPI cards */}
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">Total Suppliers</p>
            <p className="text-[32px] font-bold text-text">{totalSuppliers}</p>
          </div>
          <div className={`rounded-lg border shadow-sm p-5 ${nonCompliant > 0 ? "border-danger bg-danger-bg" : "border-border bg-surface"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wide text-text-secondary">Non-Compliant Alerts</p>
              {nonCompliant > 0 && <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-danger text-white">CRITICAL</span>}
            </div>
            <p className={`text-[32px] font-bold ${nonCompliant > 0 ? "text-danger" : "text-text"}`}>{nonCompliant}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
            <p className="text-[11px] uppercase tracking-wide text-text-secondary mb-2">Pre-Qualified</p>
            <p className="text-[32px] font-bold text-success">{prequalified}%</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="w-full rounded border border-border bg-surface pl-9 pr-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            <option value="All">Compliance Status</option>
            <option value="compliant">Compliant</option>
            <option value="non-compliant">Non-Compliant</option>
            <option value="pending">Pending</option>
          </select>
          <button className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            More Filters
          </button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-light bg-surface-dim">
                <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Supplier Name</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Compliance</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Rating</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Key Contact</th>
                <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Region</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text">{s.name}</p>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">{s.category}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${COMPLIANCE_STYLES[s.compliance] ?? "text-text-muted bg-surface-dim"}`}>
                        {s.compliance}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Stars n={s.rating} />
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">
                      {s.contact ? (
                        <a href={`mailto:${s.contact}`} className="hover:text-primary transition-colors">{s.contact}</a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">{s.region}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[48px] text-text-muted">inventory_2</span>
                      <p className="text-[14px] font-medium text-text">No suppliers yet</p>
                      <p className="text-[12px] text-text-secondary max-w-xs">
                        Add your pre-qualified subcontractors and supply chain partners to start building your supplier database.
                      </p>
                      <button onClick={openModal} className="mt-2 flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Add First Supplier
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* AI insight banner */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 p-4" style={{ borderLeft: "3px solid #C8A24A" }}>
            <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">smart_toy</span>
            <div>
              <p className="text-[12px] font-semibold text-text">AI Supplier Optimization Insight</p>
              <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
                Based on your active tenders, 3 new MEP suppliers in Abu Dhabi region meet your pre-qualification criteria. AI recommends adding backup suppliers for Fire & Safety category to improve tender competitiveness.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button onClick={openModal} className="fixed bottom-8 right-8 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-btn transition-colors">
        <span className="material-symbols-outlined text-[22px]">add</span>
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-8 z-50 rounded border border-border bg-surface px-4 py-3 shadow-lg text-[13px] text-text">
          {toast}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
            <h2 className="mb-5 text-[18px] font-semibold text-text">Add Supplier</h2>
            <form onSubmit={handleAddSupplier} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Supplier Name</label>
                <input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Al Futtaim Engineering"
                  required
                  className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Email</label>
                <input
                  type="email"
                  value={newSupplier.email}
                  onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contact@supplier.ae"
                  className="w-full rounded border border-border bg-surface px-3 py-2.5 text-[13px] text-text outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-text-secondary">Category</label>
                <select
                  value={newSupplier.category}
                  onChange={(e) => setNewSupplier((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-primary"
                >
                  {CATEGORIES.filter((c) => c !== "All Categories").map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface-dim transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newSupplier.name.trim()}
                  className="rounded bg-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-btn disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Adding…" : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

