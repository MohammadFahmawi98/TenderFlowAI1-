import { setRequestLocale } from "next-intl/server";
import { TenderWorkspace } from "./tender-workspace";

export default async function TenderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TenderWorkspace tenderId={id} />;
}
