"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

const AGENTS = [
  "intelligence",
  "qualification",
  "compliance",
  "technical",
  "commercial",
  "manpower",
  "ppm",
  "risk",
  "hse",
  "presentation",
  "executive",
] as const;

export function AgentStrip() {
  const t = useTranslations("agents");

  return (
    <section className="w-full">
      <div className="mb-4">
        <h2 className="text-[20px] font-semibold text-text">{t("title")}</h2>
        <p className="text-[14px] text-text-secondary">{t("subtitle")}</p>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {AGENTS.map((key) => (
          <motion.div
            key={key}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-text">
                {t(key)}
              </span>
              <span className="h-2 w-2 rounded-full bg-text-secondary/40" />
            </div>
            <span className="mt-3 inline-block rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-wide text-text-secondary">
              {t("status.waiting")}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
