import { getTranslations } from "next-intl/server";

export async function PageStub({ navKey }: { navKey: string }) {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-8 py-16">
      <h1 className="text-[40px] font-bold text-text">{t(`nav.${navKey}`)}</h1>
      <p className="text-[16px] text-text-secondary">{t("common.comingSoon")}</p>
    </div>
  );
}
