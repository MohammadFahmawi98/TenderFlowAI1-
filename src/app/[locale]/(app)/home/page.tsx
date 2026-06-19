import { getTranslations, setRequestLocale } from "next-intl/server";
import { Greeting } from "@/components/greeting";
import { UploadArea } from "@/components/upload-area";
import { AgentStrip } from "@/components/agent-strip";

const PROMPT_KEYS = [
  "technical",
  "commercial",
  "manpower",
  "ppm",
  "sla",
  "presentation",
  "analyze",
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-8 py-16">
      {/* Hero */}
      <header className="flex flex-col gap-3">
        <h1 className="text-[40px] font-bold leading-tight text-text">
          <Greeting />
        </h1>
        <p className="text-[24px] font-medium text-text-secondary">
          {t("question")}
        </p>
      </header>

      {/* Upload — primary CTA */}
      <UploadArea />

      {/* Example prompts */}
      <section className="flex flex-col gap-3">
        <span className="text-[13px] uppercase tracking-wide text-text-secondary">
          {t("prompts.title")}
        </span>
        <div className="flex flex-wrap gap-2">
          {PROMPT_KEYS.map((key) => (
            <button
              key={key}
              className="rounded-full border border-border bg-surface px-4 py-2 text-[14px] text-text transition-colors hover:border-brand/50 hover:text-brand"
            >
              {t(`prompts.${key}`)}
            </button>
          ))}
        </div>
      </section>

      {/* AI Bid Department */}
      <AgentStrip />
    </div>
  );
}
