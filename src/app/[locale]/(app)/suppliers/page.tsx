"use client";

import { useState, useEffect } from "react";

interface Supplier {
  id: string;
  name: string;
  category?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  status?: string;
  rating?: number;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  active:   "text-success bg-success-bg",
  inactive: "text-text-muted bg-surface-dim",
  pending:  "text-warning bg-warning-bg",
};

const CATEGORIES = [
  "All",
  "MEP",
  "Civil & Structure",
  "Cleaning & Janitorial",
  "Landscaping",
  "Security",
  "Catering",
  "Pest Control",
  "IT & AV",
  "Other",
];

export default function SubcontractorsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState("All");
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    name: "", category: "", contact_name: "", email: "", phone: "", location: "",
  });

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSuppliers(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || s.category === category;
    return matchSearch && matchCat;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status: "active" }),
      });
      if (res.ok) {
        const added = await res.json();
        setSuppliers((prev) => [added, ...prev]);
        setForm({ name: "", category: "", contact_name: "", email: "", phone: "", location: "" });
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Subcontractors</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">
            {suppliers.length} subcontractor{suppliers.length !== 1 ? "s" : ""} · Manage your bid partner network
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded bg-primary px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Subcontractor
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
        {/* KPI chips */}
        <div className="mb-5 flex flex-wrap gap-3">
          {[
            { label: "Total Subcontractors", value: String(suppliers.length), cls: "border-primary text-primary bg-primary-light/30" },
            { label: "Active",  value: String(suppliers.filter((s) => s.status === "active").length),   cls: "border-border text-text-secondary bg-surface" },
            { label: "Pending", value: String(suppliers.filter((s) => s.status === "pending").length),  cls: "border-warning text-warning bg-warning-bg" },
          ].map((kpi) => (
            <div key={kpi.label} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[12px] font-medium ${kpi.cls}`}>
              <span className="font-bold">{kpi.value}</span>
              <span>{kpi.label}</span>
            </div>
          ))}
        </div>

        {/* Search + category filter */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subcontractors…"
              className="w-full rounded border border-border bg-surface pl-9 pr-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden mb-5">
          {loading ? (
            <div className="p-6 flex flex-col gap-3">
              {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-surface-mid" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="material-symbols-outlined text-[40px] text-text-muted">handshake</span>
              <p className="text-[14px] font-medium text-text">
                {suppliers.length === 0 ? "No subcontractors yet" : "No matches found"}
              </p>
              <p className="text-[12px] text-text-secondary max-w-xs">
                {suppliers.length === 0
                  ? "Add your subcontractor network to include them in bids and track quoted values."
                  : "Try adjusting your search or category filter."}
              </p>
              {suppliers.length === 0 && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-1 flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add First Subcontractor
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border-light bg-surface-dim">
                  <th className="px-5 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Contact</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Location</th>
                  <th className="px-4 py-3 text-start text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text">{s.name}</p>
                      {s.email && <p className="text-[11px] text-text-muted mt-0.5">{s.email}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">{s.category ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      {s.contact_name && <p className="text-text">{s.contact_name}</p>}
                      {s.phone && <p className="text-[11px] text-text-muted">{s.phone}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">{s.location ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[s.status ?? ""] ?? "text-text-muted bg-surface-dim"}`}>
                        {s.status ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add subcontractor modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold text-text">Add Subcontractor</h2>
              <button onClick={() => setShowAdd(false)} className="text-text-muted hover:text-text transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              {[
                { label: "Company Name *", field: "name",         placeholder: "e.g. Al Futtaim MEP", required: true },
                { label: "Category",       field: "category",     placeholder: "e.g. MEP, Cleaning, Security" },
                { label: "Contact Name",   field: "contact_name", placeholder: "Primary contact" },
                { label: "Email",          field: "email",        placeholder: "contact@company.com" },
                { label: "Phone",          field: "phone",        placeholder: "+971 50 000 0000" },
                { label: "Location",       field: "location",     placeholder: "Dubai, UAE" },
              ].map(({ label, field, placeholder, required }) => (
                <div key={field}>
                  <label className="block mb-1 text-[11px] font-medium text-text-secondary">{label}</label>
                  <input
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    required={required}
                    className="w-full rounded border border-border px-3 py-2 text-[13px] text-text placeholder:text-text-muted outline-none focus:border-primary transition-colors bg-white"
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 rounded border border-border px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-dim transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 rounded bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-btn disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving…" : "Add Subcontractor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
