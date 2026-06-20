"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

/* ─── Types ──────────────────────────────────────────────── */
interface BOQLineItem {
  id: string;
  description: string;
  unit: string;
  qty: number;
  monthly_rate: number;
}
interface BOQSection {
  id: string;
  label: string;
  items: BOQLineItem[];
}
interface StaffRow {
  id: string;
  job_name: string;
  count: number;
  monthly_rate: number;
}
interface BOQData {
  ref_number: string;
  validity_days: number;
  vat_pct: number;
  consumables_monthly: number;
  sections: BOQSection[];
  staff: StaffRow[];
}

/* ─── Helpers ─────────────────────────────────────────────── */
function fmtAED(v: number) {
  if (!v) return "—";
  return v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return Math.random().toString(36).slice(2, 9); }

function sectionTotal(s: BOQSection) {
  return s.items.reduce((sum, it) => sum + it.monthly_rate * it.qty, 0);
}
function boqGrandTotal(boq: BOQData) {
  return boq.sections.reduce((sum, s) => sum + sectionTotal(s), 0);
}
function staffTotal(staff: StaffRow[]) {
  return staff.reduce((sum, r) => sum + r.monthly_rate * r.count * 12, 0);
}

/* ─── Editable cell ──────────────────────────────────────── */
function NumCell({ value, onChange, prefix = "" }: { value: number; onChange: (v: number) => void; prefix?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  function commit() {
    const n = parseFloat(draft.replace(/,/g, ""));
    onChange(isNaN(n) ? 0 : n);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
        className="w-full rounded border border-primary bg-primary-light px-2 py-1 text-right text-[12px] font-mono text-text outline-none"
      />
    );
  }
  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="w-full text-right font-mono text-[12px] text-text hover:bg-primary-light rounded px-2 py-1 transition-colors"
    >
      {prefix}{value ? fmtAED(value) : <span className="text-text-muted">0.00</span>}
    </button>
  );
}

function TextCell({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-[12.5px] text-text placeholder:text-text-muted outline-none px-2 py-1 hover:bg-surface-dim rounded transition-colors"
    />
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function EstimationPage() {
  const { id } = useParams<{ id: string }>();
  const [boq, setBoq] = useState<BOQData | null>(null);
  const [tab, setTab] = useState<"boq" | "staff" | "summary" | "cost" | "settings">("boq");
  const [labMult, setLabMult] = useState({ accommodation: 15, visa_insurance: 10, transport: 8, overhead: 12, profit_target: 20 });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /* Load */
  useEffect(() => {
    fetch(`/api/tenders/${id}/boq`)
      .then((r) => r.json())
      .then((data) => { setBoq(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  /* Save */
  const save = useCallback(async (data: BOQData) => {
    setSaving(true);
    try {
      await fetch(`/api/tenders/${id}/boq`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [id]);

  function update(next: BOQData) { setBoq(next); setDirty(true); }

  /* Section mutations */
  function updateItem(secId: string, itemId: string, patch: Partial<BOQLineItem>) {
    if (!boq) return;
    update({
      ...boq,
      sections: boq.sections.map((s) =>
        s.id !== secId ? s : { ...s, items: s.items.map((it) => it.id !== itemId ? it : { ...it, ...patch }) }
      ),
    });
  }

  function addItem(secId: string) {
    if (!boq) return;
    const newItem: BOQLineItem = { id: uid(), description: "New item", unit: "Months", qty: 12, monthly_rate: 0 };
    update({ ...boq, sections: boq.sections.map((s) => s.id !== secId ? s : { ...s, items: [...s.items, newItem] }) });
  }

  function removeItem(secId: string, itemId: string) {
    if (!boq) return;
    update({ ...boq, sections: boq.sections.map((s) => s.id !== secId ? s : { ...s, items: s.items.filter((it) => it.id !== itemId) }) });
  }

  function updateSectionLabel(secId: string, label: string) {
    if (!boq) return;
    update({ ...boq, sections: boq.sections.map((s) => s.id !== secId ? s : { ...s, label }) });
  }

  function addSection() {
    if (!boq) return;
    const newSec: BOQSection = { id: uid(), label: "NEW SECTION", items: [{ id: uid(), description: "New item", unit: "Months", qty: 12, monthly_rate: 0 }] };
    update({ ...boq, sections: [...boq.sections, newSec] });
  }

  function removeSection(secId: string) {
    if (!boq) return;
    update({ ...boq, sections: boq.sections.filter((s) => s.id !== secId) });
  }

  /* Staff mutations */
  function updateStaff(rowId: string, patch: Partial<StaffRow>) {
    if (!boq) return;
    update({ ...boq, staff: boq.staff.map((r) => r.id !== rowId ? r : { ...r, ...patch }) });
  }

  function addStaff() {
    if (!boq) return;
    update({ ...boq, staff: [...boq.staff, { id: uid(), job_name: "New Role", count: 1, monthly_rate: 0 }] });
  }

  function removeStaff(rowId: string) {
    if (!boq) return;
    update({ ...boq, staff: boq.staff.filter((r) => r.id !== rowId) });
  }

  if (loading || !boq) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const grandTotal = boqGrandTotal(boq);
  const vat = grandTotal * (boq.vat_pct / 100);
  const grandPlusVat = grandTotal + vat;
  const staffYearly = staffTotal(boq.staff);
  const totalStaffCount = boq.staff.reduce((s, r) => s + r.count, 0);

  /* ── Header KPIs ─────────────────────────────────────── */
  const kpis = [
    { label: "Total (ex-VAT)", value: `AED ${fmtAED(grandTotal)}`, color: "text-text" },
    { label: `VAT ${boq.vat_pct}%`, value: `AED ${fmtAED(vat)}`, color: "text-warning" },
    { label: "GRAND TOTAL", value: `AED ${fmtAED(grandPlusVat)}`, color: "text-primary" },
    { label: "Manpower (yearly)", value: staffYearly ? `AED ${fmtAED(staffYearly)}` : "—", color: "text-text-secondary" },
  ];

  const TABS = [
    { key: "boq", label: "BOQ" },
    { key: "staff", label: "Staff Rates" },
    { key: "summary", label: "Summary" },
    { key: "cost", label: "Cost Analysis" },
    { key: "settings", label: "Settings" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">

      {/* KPIs + save */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">{k.label}</p>
            <p className={`text-[17px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Ref + Save row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-secondary font-semibold">Ref:</span>
          <input
            value={boq.ref_number}
            onChange={(e) => update({ ...boq, ref_number: e.target.value })}
            className="rounded border border-border bg-surface px-3 py-1.5 text-[12px] font-mono text-text focus:border-primary outline-none"
            placeholder="EIHBIDQ/FM/YYYY/MM/DD"
          />
          <span className="text-[11px] text-text-secondary">Validity:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={boq.validity_days}
              onChange={(e) => update({ ...boq, validity_days: parseInt(e.target.value) || 90 })}
              className="w-16 rounded border border-border bg-surface px-2 py-1.5 text-[12px] text-center text-text focus:border-primary outline-none"
            />
            <span className="text-[11px] text-text-muted">days</span>
          </div>
        </div>
        <button
          onClick={() => save(boq)}
          disabled={!dirty || saving}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all ${
            dirty ? "bg-primary text-white hover:bg-primary-btn" : "bg-surface-dim text-text-muted cursor-default"
          }`}
        >
          {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          <span className="material-symbols-outlined text-[15px]">{dirty ? "save" : "check"}</span>
          {saving ? "Saving…" : dirty ? "Save BOQ" : "Saved"}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ BOQ TAB ══════════════════════════════════════════ */}
      {tab === "boq" && (
        <div className="flex flex-col gap-4">
          {boq.sections.map((section) => {
            const secTotal = sectionTotal(section);
            return (
              <div key={section.id} className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#8B3520]/8 border-b border-border">
                  <span className="text-[10px] font-bold text-[#8B3520] bg-[#8B3520]/15 px-2 py-0.5 rounded font-mono">{section.id}</span>
                  <input
                    value={section.label}
                    onChange={(e) => updateSectionLabel(section.id, e.target.value)}
                    className="flex-1 bg-transparent text-[13px] font-bold text-text uppercase tracking-wide outline-none"
                  />
                  <span className="text-[12px] font-bold text-text font-mono ml-auto">
                    AED {fmtAED(secTotal)}
                  </span>
                  <button
                    onClick={() => removeSection(section.id)}
                    className="ml-2 text-text-muted hover:text-danger transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>

                {/* Items table */}
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border-light bg-surface-dim">
                      <th className="px-3 py-2 text-start text-[10px] font-semibold uppercase tracking-wide text-text-muted w-8">SN</th>
                      <th className="px-3 py-2 text-start text-[10px] font-semibold uppercase tracking-wide text-text-muted">Description</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted w-20">Unit</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-text-muted w-12">QTY</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted w-36">Monthly (AED)</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted w-36">Yearly (AED)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-border-light last:border-0 hover:bg-surface-dim/50 group">
                        <td className="px-3 py-2 text-[10px] text-text-muted font-mono">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <TextCell
                            value={item.description}
                            onChange={(v) => updateItem(section.id, item.id, { description: v })}
                            placeholder="Description…"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={item.unit}
                            onChange={(e) => updateItem(section.id, item.id, { unit: e.target.value })}
                            className="w-full text-center bg-transparent text-[12px] text-text-secondary outline-none px-2 py-1 hover:bg-surface-dim rounded"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateItem(section.id, item.id, { qty: parseInt(e.target.value) || 0 })}
                            className="w-full text-center bg-transparent text-[12px] font-semibold text-text outline-none px-2 py-1 hover:bg-surface-dim rounded"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <NumCell
                            value={item.monthly_rate}
                            onChange={(v) => updateItem(section.id, item.id, { monthly_rate: v })}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-text">
                          {item.monthly_rate ? fmtAED(item.monthly_rate * item.qty) : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeItem(section.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-dim/50 border-t border-border">
                      <td colSpan={4} className="px-3 py-2.5">
                        <button
                          onClick={() => addItem(section.id)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-btn font-medium transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          Add item
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-text-secondary">Sub-Total</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold text-[#8B3520]">
                        {fmtAED(secTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Add section */}
          <button
            onClick={addSection}
            className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-5 py-3 text-[13px] font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Section
          </button>
        </div>
      )}

      {/* ══ STAFF RATES TAB ══════════════════════════════════ */}
      {tab === "staff" && (
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div>
              <p className="text-[13px] font-semibold text-text">Staff Rate Schedule</p>
              <p className="text-[11px] text-text-secondary mt-0.5">Based on 12-hour shift / 6 days per week</p>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-text-secondary">
              <span>{totalStaffCount} staff</span>
              <span className="font-semibold text-text">AED {fmtAED(staffYearly)} / year</span>
            </div>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border-light bg-[#8B3520]">
                <th className="px-4 py-3 text-start text-[10px] font-semibold uppercase tracking-wide text-white">SN</th>
                <th className="px-4 py-3 text-start text-[10px] font-semibold uppercase tracking-wide text-white">Job Name / Designation</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-white w-20">No.</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-white w-40">Monthly Rate (AED)</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-white w-40">Yearly Total (AED)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {boq.staff.map((row, idx) => (
                <tr key={row.id} className={`border-b border-border-light last:border-0 group ${idx % 2 === 1 ? "bg-surface-dim/40" : ""}`}>
                  <td className="px-4 py-3 text-[11px] text-text-muted font-mono">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <TextCell
                      value={row.job_name}
                      onChange={(v) => updateStaff(row.id, { job_name: v })}
                      placeholder="Job title…"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={row.count}
                      onChange={(e) => updateStaff(row.id, { count: parseInt(e.target.value) || 1 })}
                      className="w-14 text-center bg-transparent text-[12px] font-bold text-text outline-none border border-border rounded px-1 py-0.5 focus:border-primary"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <NumCell
                      value={row.monthly_rate}
                      onChange={(v) => updateStaff(row.id, { monthly_rate: v })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12px] font-semibold text-text">
                    {row.monthly_rate ? fmtAED(row.monthly_rate * row.count * 12) : "—"}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => removeStaff(row.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#8B3520] bg-[#8B3520]/5">
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-[12px] font-bold text-text uppercase tracking-wide">TOTAL</td>
                <td className="px-4 py-3 text-center font-bold text-text">{totalStaffCount}</td>
                <td className="px-4 py-3 text-right font-mono text-[13px] font-bold text-[#8B3520]">
                  {fmtAED(boq.staff.reduce((s, r) => s + r.monthly_rate * r.count, 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[13px] font-bold text-[#8B3520]">
                  {fmtAED(staffYearly)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div className="border-t border-border-light px-5 py-3">
            <button
              onClick={addStaff}
              className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-btn font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">person_add</span>
              Add role
            </button>
          </div>
        </div>
      )}

      {/* ══ SUMMARY TAB ══════════════════════════════════════ */}
      {tab === "summary" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* BOQ summary */}
          <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-light flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#8B3520]">receipt_long</span>
              <p className="text-[13px] font-semibold text-text">BOQ Summary</p>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-[#8B3520] text-white">
                  <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide">SN</th>
                  <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide">Description</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide w-28">Monthly AED</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide w-32">Yearly AED</th>
                </tr>
              </thead>
              <tbody>
                {boq.sections.map((s, idx) => {
                  const st = sectionTotal(s);
                  return (
                    <tr key={s.id} className={`border-b border-border-light ${idx % 2 === 1 ? "bg-surface-dim/40" : ""}`}>
                      <td className="px-4 py-2.5 text-[11px] font-mono text-text-muted">{s.id}</td>
                      <td className="px-4 py-2.5 text-text">{s.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{fmtAED(st / 12)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-text">{fmtAED(st)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#8B3520] font-bold bg-surface-dim">
                  <td colSpan={2} className="px-4 py-3 text-[12px] uppercase tracking-wide text-text">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-[#8B3520]">{fmtAED(grandTotal / 12)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-[#8B3520]">{fmtAED(grandTotal)}</td>
                </tr>
                <tr className="border-t border-border-light">
                  <td colSpan={2} className="px-4 py-2.5 text-[12px] text-text-secondary">VAT ({boq.vat_pct}%)</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-text-secondary">{fmtAED(vat / 12)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[12px] text-text-secondary">{fmtAED(vat)}</td>
                </tr>
                <tr className="bg-[#8B3520]/8 font-bold border-t border-[#8B3520]/30">
                  <td colSpan={2} className="px-4 py-3 text-[13px] uppercase tracking-wide text-[#8B3520]">GRAND TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono text-[14px] text-[#8B3520]">{fmtAED(grandPlusVat / 12)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[15px] font-extrabold text-[#8B3520]">{fmtAED(grandPlusVat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Staff summary */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-light flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#8B3520]">groups</span>
                <p className="text-[13px] font-semibold text-text">Staff Rate Summary</p>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#8B3520] text-white">
                    <th className="px-4 py-2 text-start text-[10px] font-semibold uppercase tracking-wide">Role</th>
                    <th className="px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wide w-12">No.</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide w-28">Rate/Month</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wide w-28">Yearly</th>
                  </tr>
                </thead>
                <tbody>
                  {boq.staff.map((r, idx) => (
                    <tr key={r.id} className={`border-b border-border-light ${idx % 2 === 1 ? "bg-surface-dim/40" : ""}`}>
                      <td className="px-4 py-2 text-text">{r.job_name}</td>
                      <td className="px-4 py-2 text-center font-bold text-text">{r.count}</td>
                      <td className="px-4 py-2 text-right font-mono text-text">{fmtAED(r.monthly_rate)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-text">{fmtAED(r.monthly_rate * r.count * 12)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#8B3520] font-bold bg-surface-dim">
                    <td className="px-4 py-2.5 text-[12px] uppercase text-text">TOTAL</td>
                    <td className="px-4 py-2.5 text-center font-bold text-text">{totalStaffCount}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#8B3520]">
                      {fmtAED(boq.staff.reduce((s, r) => s + r.monthly_rate * r.count, 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[13px] text-[#8B3520]">{fmtAED(staffYearly)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick financials */}
            <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col gap-3">
              <p className="text-[12px] font-semibold text-text uppercase tracking-wide">Financial Snapshot</p>
              {[
                { label: "BOQ Total (ex-VAT)", value: fmtAED(grandTotal), bold: false },
                { label: `VAT ${boq.vat_pct}%`, value: fmtAED(vat), bold: false },
                { label: "GRAND TOTAL", value: fmtAED(grandPlusVat), bold: true },
                { label: "Manpower Cost (yearly)", value: staffYearly ? fmtAED(staffYearly) : "—", bold: false },
                {
                  label: "Labour as % of Total",
                  value: grandPlusVat && staffYearly ? `${Math.round((staffYearly / grandPlusVat) * 100)}%` : "—",
                  bold: false,
                },
              ].map(({ label, value, bold }) => (
                <div key={label} className={`flex justify-between items-center py-1.5 border-b border-border-light last:border-0 ${bold ? "border-t-2 border-[#8B3520] pt-3 mt-1" : ""}`}>
                  <span className={`text-[12px] ${bold ? "font-bold text-[#8B3520] uppercase tracking-wide" : "text-text-secondary"}`}>{label}</span>
                  <span className={`font-mono text-[13px] ${bold ? "font-extrabold text-[#8B3520]" : "text-text"}`}>AED {value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ COST ANALYSIS TAB ════════════════════════════════ */}
      {tab === "cost" && (() => {
        // Internal cost = basic salary × (1 + all add-on %)
        const totalAddOnPct = labMult.accommodation + labMult.visa_insurance + labMult.transport + labMult.overhead;
        const multiplier = 1 + totalAddOnPct / 100;
        const internalStaffCost = boq.staff.reduce((s, r) => s + r.monthly_rate * r.count * 12 * multiplier, 0);
        const internalBoqCost = grandTotal * 0.85; // assume 85% of BOQ is actual cost before margin
        const totalInternalCost = internalStaffCost + internalBoqCost;
        const bidPrice = grandPlusVat;
        const grossProfit = bidPrice - totalInternalCost;
        const marginPct = bidPrice > 0 ? (grossProfit / bidPrice) * 100 : 0;
        const targetProfit = totalInternalCost * (labMult.profit_target / 100);

        const multFields: Array<{ key: keyof typeof labMult; label: string; desc: string }> = [
          { key: "accommodation", label: "Accommodation", desc: "Staff housing cost add-on %" },
          { key: "visa_insurance", label: "Visa & Insurance", desc: "Visa, health, life insurance %" },
          { key: "transport", label: "Transportation", desc: "Company transport allowance %" },
          { key: "overhead", label: "Overhead & Admin", desc: "Office, management, PRO %" },
          { key: "profit_target", label: "Target Profit Margin", desc: "Desired profit margin on cost %" },
        ];

        return (
          <div className="flex flex-col gap-5">
            {/* Warning if no staff rates */}
            {!boq.staff.some((r) => r.monthly_rate > 0) && (
              <div className="flex items-center gap-2 rounded-lg border border-warning bg-warning-bg px-4 py-3 text-[12.5px] text-warning">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Set staff monthly rates in the Staff Rates tab first to get accurate cost analysis.
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Cost multipliers */}
              <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-text">Internal Cost Multipliers</p>
                  <p className="text-[11.5px] text-text-secondary mt-0.5">Adjust add-on % over basic monthly rate</p>
                </div>
                {multFields.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium text-text">{label}</p>
                      <p className="text-[11px] text-text-muted">{desc}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={labMult[key]}
                        onChange={(e) => setLabMult((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                        className="w-16 rounded border border-border bg-surface-dim px-2 py-1.5 text-[12px] text-center text-text focus:border-primary outline-none"
                      />
                      <span className="text-[11px] text-text-muted">%</span>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg bg-surface-dim border border-border-light px-4 py-3 mt-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-secondary">Total add-on over basic rate:</span>
                    <span className="font-bold text-text">{totalAddOnPct}%</span>
                  </div>
                  <div className="flex justify-between text-[12px] mt-1">
                    <span className="text-text-secondary">Effective cost multiplier:</span>
                    <span className="font-bold text-primary">×{multiplier.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* P&L snapshot */}
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
                  <p className="text-[13px] font-semibold text-text mb-4">Bid P&L Snapshot</p>
                  {[
                    { label: "Bid Price (incl. VAT)", value: fmtAED(bidPrice), cls: "text-text" },
                    { label: "Internal Staff Cost", value: fmtAED(internalStaffCost), cls: "text-text-secondary", sub: `basic × ${multiplier.toFixed(2)}` },
                    { label: "Internal BOQ Cost", value: fmtAED(internalBoqCost), cls: "text-text-secondary", sub: "BOQ ex-VAT × 0.85" },
                    { label: "Total Estimated Cost", value: fmtAED(totalInternalCost), cls: "text-text", divider: true },
                    { label: "Gross Profit", value: fmtAED(grossProfit), cls: grossProfit >= 0 ? "text-success" : "text-danger" },
                    { label: "Profit Margin", value: `${marginPct.toFixed(1)}%`, cls: marginPct >= labMult.profit_target ? "text-success font-extrabold" : "text-danger font-extrabold" },
                    { label: "Target Profit", value: fmtAED(targetProfit), cls: "text-text-secondary", sub: `${labMult.profit_target}% on cost` },
                  ].map(({ label, value, cls, sub, divider }) => (
                    <div key={label} className={`flex items-start justify-between py-2 border-b border-border-light last:border-0 ${divider ? "border-t-2 border-[#8B3520] mt-1 pt-3" : ""}`}>
                      <div>
                        <p className="text-[12px] text-text-secondary">{label}</p>
                        {sub && <p className="text-[10.5px] text-text-muted">{sub}</p>}
                      </div>
                      <span className={`font-mono text-[13px] ${cls}`}>AED {value}</span>
                    </div>
                  ))}
                </div>

                {/* Visual margin bar */}
                <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-semibold text-text">Margin vs Target</p>
                    <span className={`text-[13px] font-bold ${marginPct >= labMult.profit_target ? "text-success" : "text-danger"}`}>
                      {marginPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface-mid">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${marginPct >= labMult.profit_target ? "bg-success" : "bg-danger"}`}
                      style={{ width: `${Math.min(Math.max(marginPct, 0), 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                    <span>0%</span>
                    <span className="text-primary">Target {labMult.profit_target}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Staff breakdown table */}
                {boq.staff.some((r) => r.monthly_rate > 0) && (
                  <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-light">
                      <p className="text-[12px] font-semibold text-text">True Staff Cost (per role/year)</p>
                    </div>
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="bg-[#8B3520] text-white">
                          <th className="px-3 py-2 text-start font-medium">Role</th>
                          <th className="px-3 py-2 text-center font-medium w-8">No.</th>
                          <th className="px-3 py-2 text-right font-medium">Basic/yr</th>
                          <th className="px-3 py-2 text-right font-medium">True Cost/yr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boq.staff.map((r, idx) => (
                          <tr key={r.id} className={`border-b border-border-light ${idx % 2 === 1 ? "bg-surface-dim/40" : ""}`}>
                            <td className="px-3 py-2 text-text">{r.job_name}</td>
                            <td className="px-3 py-2 text-center text-text">{r.count}</td>
                            <td className="px-3 py-2 text-right font-mono text-text-secondary">{fmtAED(r.monthly_rate * r.count * 12)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-text">{fmtAED(r.monthly_rate * r.count * 12 * multiplier)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ SETTINGS TAB ══════════════════════════════════════ */}
      {tab === "settings" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface shadow-sm p-5 flex flex-col gap-4">
            <p className="text-[13px] font-semibold text-text">Proposal Settings</p>
            {[
              { label: "Bid Reference Number", key: "ref_number" as const, type: "text", placeholder: "EIHBIDQ/FM/YYYY/MM/DD" },
              { label: "Validity (days)", key: "validity_days" as const, type: "number", placeholder: "90" },
              { label: "VAT %", key: "vat_pct" as const, type: "number", placeholder: "5" },
              { label: "Consumables Monthly (AED)", key: "consumables_monthly" as const, type: "number", placeholder: "0" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">{label}</label>
                <input
                  type={type}
                  value={boq[key] as string | number}
                  onChange={(e) =>
                    update({ ...boq, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })
                  }
                  placeholder={placeholder}
                  className="rounded-lg border border-border px-3 py-2 text-[13px] text-text focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
            <p className="text-[13px] font-semibold text-text mb-3">Standard Assumptions & Exclusions</p>
            <div className="flex flex-col gap-2 text-[12px] text-text-secondary">
              {[
                "Spare parts will be charged at cost plus 5%",
                "Staff manpower cost based on 12 hours/shift, 6 days/week",
                "Any sub-contractors or plant not listed herein will be charged as agreed",
                "Replacement of equipment: Excluded",
                "Refurbishment: Excluded",
                "Maintenance of Furniture, Polishing, Fabrics: Excluded",
                "All Initial Repairs: Excluded",
                "All IT Related works: Excluded",
                "Anything not expressly mentioned in this proposal is not covered",
              ].map((exc) => (
                <div key={exc} className="flex items-start gap-2 py-1.5 border-b border-border-light last:border-0">
                  <span className="material-symbols-outlined text-[14px] text-text-muted mt-0.5 shrink-0">check_small</span>
                  {exc}
                </div>
              ))}
            </div>
            <p className="text-[10.5px] text-text-muted mt-3 italic">These are included in the Commercial Proposal export automatically.</p>
          </div>
        </div>
      )}
    </div>
  );
}
