import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/sidebar";
import { CommandBar } from "@/components/command-bar";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <CommandBar />
    </div>
  );
}
