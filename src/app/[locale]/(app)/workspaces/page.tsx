import { setRequestLocale } from "next-intl/server";
import { WorkspacesList } from "./workspaces-list";

export default async function WorkspacesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WorkspacesList />;
}
