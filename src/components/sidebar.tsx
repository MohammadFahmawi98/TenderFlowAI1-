"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const NAV = [
  { key: "home", href: "/home" },
  { key: "workspaces", href: "/workspaces" },
  { key: "knowledge", href: "/knowledge" },
  { key: "documents", href: "/documents" },
  { key: "organization", href: "/organization" },
  { key: "settings", href: "/settings" },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);

  function switchLocale(next: "en" | "ar") {
    router.replace(pathname, { locale: next });
  }

  return (
    <motion.aside
      animate={{ width: expanded ? 240 : 80 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="flex h-screen shrink-0 flex-col border-e border-border bg-surface"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5">
        <span className="text-[18px] font-bold tracking-tight text-brand">
          EIH
        </span>
        {expanded && (
          <span className="text-[13px] font-medium text-text-secondary">
            TenderFlow
          </span>
        )}
      </div>

      {/* Navigation — text only, no icons */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
              href={item.href}
              className={[
                "relative rounded-md px-3 py-2.5 text-[14px] transition-colors",
                active
                  ? "bg-white/[0.04] font-semibold text-text"
                  : "font-medium text-text-secondary hover:bg-white/[0.03] hover:text-text",
              ].join(" ")}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-brand"
                />
              )}
              <span className={expanded ? "" : "truncate"}>
                {expanded ? t(item.key) : t(item.key).slice(0, 1)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: language + collapse */}
      <div className="flex flex-col gap-2 border-t border-border p-3">
        {expanded && (
          <div className="flex items-center gap-1 px-1">
            <span className="me-1 text-[11px] uppercase tracking-wide text-text-secondary">
              {tc("language")}
            </span>
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className={[
                  "rounded px-2 py-1 text-[12px] transition-colors",
                  locale === l
                    ? "bg-brand/15 font-semibold text-brand"
                    : "text-text-secondary hover:text-text",
                ].join(" ")}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md px-3 py-2 text-start text-[12px] font-medium text-text-secondary hover:bg-white/[0.03] hover:text-text"
        >
          {expanded ? "‹ Collapse" : "›"}
        </button>
      </div>
    </motion.aside>
  );
}
