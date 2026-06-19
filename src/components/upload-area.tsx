"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";

export function UploadArea() {
  const t = useTranslations("home");
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setStaged(Array.from(fileList).map((f) => f.name));
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(fileList).forEach((f) => form.append("files", f));
      const res = await fetch("/api/tenders", { method: "POST", body: form });
      const data = await res.json();
      if (data.tenderId) {
        router.push(`/workspaces/${data.tenderId}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        animate={{ scale: dragging ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={[
          "flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          dragging
            ? "border-ai bg-ai/[0.04] shadow-[0_0_40px_-12px_var(--ai)]"
            : "border-white/10 bg-card hover:border-brand/40",
          uploading ? "pointer-events-none" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-[16px] font-medium text-text-secondary">
              Analysing your RFP and building workspace…
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {staged.map((n) => (
                <li key={n} className="text-[13px] text-text-secondary">{n}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-[22px] font-semibold text-text">{t("uploadCta")}</p>
            <p className="max-w-md text-[14px] text-text-secondary">{t("uploadHint")}</p>
            <span className="rounded-lg bg-brand px-6 py-3 text-[14px] font-semibold text-background">
              {t("uploadButton")}
            </span>
          </>
        )}
      </motion.div>
    </div>
  );
}
