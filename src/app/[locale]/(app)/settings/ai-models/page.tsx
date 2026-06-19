"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";

const SETTINGS_NAV = [
  { label: "Profile",       href: "/settings",               icon: "person" },
  { label: "Security",      href: "/settings/security",      icon: "lock" },
  { label: "AI Models",     href: "/settings/ai-models",     icon: "smart_toy" },
  { label: "Notifications", href: "/settings/notifications", icon: "notifications" },
  { label: "Team",          href: "/settings/team",          icon: "group" },
];

const MODELS = [
  { id: "gpt4o",    name: "GPT-4o Turbo",      provider: "OpenAI",    badge: "Best overall",   status: "healthy" },
  { id: "claude35", name: "Claude 3.5 Sonnet",  provider: "Anthropic", badge: "Best for docs",  status: "healthy" },
  { id: "gemini15", name: "Gemini 1.5 Pro",     provider: "Google",    badge: "Fastest",        status: "healthy" },
  { id: "llama3",   name: "Llama 3 70B",        provider: "Meta",      badge: "Open source",    status: "healthy" },
];

const HEALTH_CHECKS = [
  { label: "API Connectivity",   status: "Operational", good: true },
  { label: "Embedding Index",    status: "Operational", good: true },
  { label: "Token Budget",       status: "84% used",    good: false },
  { label: "Rate Limits",        status: "Normal",      good: true },
];

export default function AIModelsPage() {
  const [selectedModel, setSelectedModel] = useState("gpt4o");
  const [temperature, setTemperature] = useState(0.3);
  const [creativity, setCreativity] = useState(0.5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ai_model_config");
    if (stored) {
      try {
        const c = JSON.parse(stored);
        if (c.model) setSelectedModel(c.model);
        if (c.temperature != null) setTemperature(c.temperature);
        if (c.creativity != null) setCreativity(c.creativity);
      } catch { /* ignore */ }
    }
  }, []);

  function handleSave() {
    localStorage.setItem("ai_model_config", JSON.stringify({ model: selectedModel, temperature, creativity }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-light bg-surface">
        <div>
          <h1 className="text-[20px] font-semibold text-text">Settings</h1>
          <p className="text-[12px] text-text-secondary mt-0.5">Manage your account and preferences</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[12px] font-semibold text-primary">
          AS
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 border-r border-border-light bg-surface p-3 overflow-y-auto">
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-colors mb-0.5",
                item.href === "/settings/ai-models"
                  ? "bg-primary-light text-primary"
                  : "text-text-secondary hover:bg-surface-dim hover:text-text",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-[16px] font-semibold text-text">AI Models</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">Configure AI model preferences for each module</p>
            </div>

            {/* Model selection */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Primary Model</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={[
                      "rounded-lg border p-4 text-start transition-colors",
                      selectedModel === m.id
                        ? "border-primary bg-primary-light/30"
                        : "border-border hover:bg-surface-dim",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-semibold text-text">{m.name}</span>
                      {selectedModel === m.id && (
                        <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted">{m.provider}</p>
                    <span className="mt-2 inline-block rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generation logic sliders */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">Generation Logic</p>
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-text">Temperature (Accuracy)</label>
                    <span className="text-[12px] font-semibold text-primary">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted mt-1">
                    <span>Precise</span><span>Creative</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12px] font-medium text-text">Creativity Level</label>
                    <span className="text-[12px] font-semibold text-primary">{creativity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={creativity}
                    onChange={(e) => setCreativity(parseFloat(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted mt-1">
                    <span>Conservative</span><span>Innovative</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System health */}
            <div className="rounded-lg border border-border bg-surface shadow-sm p-5">
              <p className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-4">System Health Diagnostics</p>
              <div className="flex flex-col gap-3">
                {HEALTH_CHECKS.map((check) => (
                  <div key={check.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${check.good ? "bg-success" : "bg-warning"}`} />
                      <span className="text-[13px] text-text">{check.label}</span>
                    </div>
                    <span className={`text-[12px] font-medium ${check.good ? "text-success" : "text-warning"}`}>
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-[12px] text-success font-medium">Configuration saved</span>}
              <button
                onClick={handleSave}
                className="rounded bg-primary px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-btn transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
