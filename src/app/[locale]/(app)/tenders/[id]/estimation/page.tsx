"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { parseAllTables } from "@/lib/parse-agent-table";

interface BOQRow {
  code: string;
  description: string;
  category: string;
  unit: string;
  qty: number;
  rate: number;
  total: number;
  aiFlag?: "ok" | "risk" | "missing";
}

const CATEGORY_COLORS: Record<string, string> = {
  hvac:         "bg-warning/10 text-warning",
  electrical:   "bg-warning/10 text-warning",
  civil:        "bg-surface-dim text-text-secondary",
  soft:         "bg-success/10 text-success",
  cleaning:     "bg-success/10 text-success",
  security:     "bg-danger/10 text-danger",
  mechanical:   "bg-warning/10 text-warning",
  general:      "bg-primary-light text-primary",
  preliminaries:"bg-primary-light text-primary",
  plant:        "bg-warning/10 text-warning",
  labour:       "bg-success/10 text-success",
};

function catColor(cat: string): string {
  const lower = cat.toLowerCase();
  return Object.entries(CATEGORY_COLORS).find(([k]) => lower.includes(k))?.[1] ?? "bg-surface-dim text-text-secondary";
}

function parseMoney(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function buildBOQ(tables: Record<string, string>[][]): BOQRow[] {
  for (const table of tables) {
    if (table.length === 0) continue;
    const keys = Object.keys(table[0]);
    const isBOQ = keys.some((k) => k.includes("description") || k.includes("qty") || k.includes("unit") || k.includes("total") || k.includes("rate"));
    if (!isBOQ) continue;
    let counter = 0;
    return table.map((row) => {
      const vals = Object.values(row);
      counter++;
      const qty = parseMoney(vals[2] ?? vals[1] ?? "1");
      const rate = parseMoney(vals[3] ?? vals[2] ?? "0");
      const totalParsed = parseMoney(vals[4] ?? "0") || qty * rate;
      return {
        code: `${counter}.${Math.floor(Math.random() * 3) + 1}`,
        description: vals[0] ?? "—",
        category: vals[1] ?? "General",
        unit: vals[2]?.match(/^[a-zA-Z]+$/) ? vals[2] : "No.",
        qty: qty || 1,
        rate,
        total: totalParsed,
        aiFlag: (totalParsed > 50000 ? "risk" : "ok") as BOQRow["aiFlag"],
      };
    }).filter((r) => r.description && r.description !== "—" && r.total > 0);
  }
  return [];
}

function fmtAED(v: number) {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v.toLocaleString();
}

export default function EstimationPage() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState("");
  const [agentStatus, setAgentStatus] = useState("waiting");
  const [overhead, setOverhead] = useState(12.5);
  const [margin, setMargin] = useState(8.8);
  const [contingency, setContingency] = useState(5.0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/tenders/${id}/agents`).then((r) => r.json()).then((agents) => {
      const tech = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "technical");
      const comm = Array.isArray(agents) && agents.find((a: { agent_type: string }) => a.agent_type === "commercial");
      const run = comm?.output_content ? comm : tech;
      if (run) { setAgentStatus(run.status); setContent(run.output_content ?? ""); }
    }).catch(console.error);
  }, [id]);

  const tables = useMemo(() => parseAllTables(content), [content]);
  const allRows = useMemo(() => buildBOQ(tables), [tables]);
  const filtered = useMemo(() => allRows.filter((r) =>
    !search || r.description.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())
  ), [allRows, search]);

  const directCosts = allRows.reduce((s, r) => s + r.total, 0);
  const overheadAmt = directCosts * (overhead / 100);
  const marginAmt = (directCosts + overheadAmt) * (margin / 100);
  const contingencyAmt = directCosts * (contingency / 100);
  const totalBid = directCosts + overheadAmt + marginAmt + contingencyAmt;

  if (agentStatus !== "completed" && !content) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="material-symbols-outlined text-[44px] text-text-muted">receipt_long</span>
        <p className="text-[15px] font-semibold text-text">Estimation Not Generated</p>
        <p className="text-[13px] text-text-secondary max-w-sm">
          Click <strong>Run AI</strong> in the workspace header to generate the Bill of Quantities.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Bid Price", value: directCosts > 0 ? `AED ${fmtAED(totalBid)}` : "—", color: "text-text", sub: "Incl. overhead & margin" },
          { label: "Profit Margin", value: `${margin}%`, color: "text-success", sub: `AED ${fmtAED(marginAmt)}` },
          { label: "Direct Costs", value: directCosts > 0 ? `AED ${fmtAED(directCosts)}` : "—", color: "text-text", sub: "Before overheads" },
          { label: "Risk Contingency", value: `${contingency}%`, color: "text-warning", sub: `AED ${fmtAED(contingencyAmt)}` },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-1">{kpi.label}</p>
            <p className={`text-[20px] font-bold leading-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* BOQ + Cost Summary */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* BOQ Table */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-light px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-text-muted">table_rows</span>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Bill of Quantities (BOQ)</p>
            </div>
            <div className="flex items-center gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter items…"
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] placeholder:text-text-muted focus:border-primary outline-none" />
              <span className="text-[11px] text-text-muted whitespace-nowrap">{filtered.length} items</span>
            </div>
          </div>
          {allRows.length === 0 ? (
            <p className="p-6 text-[12px] text-text-muted text-center">BOQ will appear here once AI agents complete.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface-dim">
                    {["Code", "Description", "Category", "Unit", "QTY", "Rate AED", "Total AED", "AI"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-border-light last:border-0 hover:bg-surface-dim/40 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[10.5px] text-text-secondary whitespace-nowrap">{row.code}</td>
                      <td className="px-3 py-2.5 text-[12px] text-text max-w-[180px]">
                        <p className="line-clamp-2">{row.description}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase ${catColor(row.category)}`}>
                          {row.category.slice(0, 10)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary">{row.unit}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-text">{row.qty}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-text-secondary">{row.rate.toLocaleString()}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-text">{row.total.toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <span className={`material-symbols-outlined text-[16px] ${row.aiFlag === "risk" ? "text-warning" : "text-success"}`}>
                          {row.aiFlag === "risk" ? "warning" : "check_circle"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-surface-dim font-bold">
                    <td className="px-3 py-3 font-bold text-text" colSpan={6}>WORKSPACE TOTALS</td>
                    <td className="px-3 py-3 font-mono text-[13px] font-bold text-text">{directCosts.toLocaleString()}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cost Summary */}
        <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-light px-5 py-3.5">
            <span className="material-symbols-outlined text-[16px] text-text-muted">calculate</span>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">Cost Summary</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            {/* Direct Costs */}
            <div className="rounded-lg border border-border-light bg-surface-dim p-3">
              <div className="flex justify-between">
                <p className="text-[11.5px] font-semibold text-text">Direct Costs (65%)</p>
                <p className="text-[12px] font-bold text-text">AED {fmtAED(directCosts)}</p>
              </div>
            </div>

            {/* Adjustable inputs */}
            {[
              { label: "Overheads (%)", value: overhead, setter: setOverhead, amount: overheadAmt },
              { label: "Profit Margin (%)", value: margin, setter: setMargin, amount: marginAmt },
              { label: "Contingency (%)", value: contingency, setter: setContingency, amount: contingencyAmt },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] text-text-secondary">{item.label}</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => item.setter(Math.max(0, item.value - 0.5))}
                      className="h-5 w-5 rounded text-text-muted hover:bg-surface-dim flex items-center justify-center text-[12px]">−</button>
                    <span className="w-10 text-center text-[12px] font-semibold text-text">{item.value}%</span>
                    <button onClick={() => item.setter(Math.min(50, item.value + 0.5))}
                      className="h-5 w-5 rounded text-text-muted hover:bg-surface-dim flex items-center justify-center text-[12px]">+</button>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-text-muted">
                  <span>AED {fmtAED(item.amount)}</span>
                  <div className="flex-1 mx-2 h-1 rounded-full bg-surface-mid self-center">
                    <div className="h-full rounded-full bg-primary/50" style={{ width: `${item.value * 2}%` }} />
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-3 mt-1">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-text">Total Bid Value</p>
                <p className="text-[16px] font-bold text-primary">AED {fmtAED(totalBid)}</p>
              </div>
            </div>

            {/* Cost Distribution donut placeholder */}
            <div className="rounded-lg border border-border-light bg-surface-dim p-3">
              <p className="text-[10.5px] uppercase tracking-wide text-text-secondary mb-2">Cost Distribution</p>
              {[
                { label: "Direct Labour", pct: 65 },
                { label: "Materials",     pct: 20 },
                { label: "Overheads",     pct: Math.round(overhead) },
                { label: "Plant & Equip", pct: 5 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 mb-1.5">
                  <span className="w-20 text-[10.5px] text-text-secondary shrink-0">{item.label}</span>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-surface-mid">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${item.pct}%` }} />
                  </div>
                  <span className="text-[10.5px] font-semibold text-text w-8 text-right">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
