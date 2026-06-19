"use client";

import { motion } from "framer-motion";

export interface ViewTab {
  key: string;
  label: string;
}

interface ViewsBarProps {
  tabs: ViewTab[];
  active: string;
  onChange: (key: string) => void;
}

export function ViewsBar({ tabs, active, onChange }: ViewsBarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={[
              "relative px-4 py-3 text-[13px] font-medium transition-colors",
              isActive ? "text-text" : "text-text-secondary hover:text-text",
            ].join(" ")}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId="views-bar-indicator"
                className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 380, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
