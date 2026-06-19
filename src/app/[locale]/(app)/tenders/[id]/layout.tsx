import { WorkspaceShell } from "@/components/workspace-shell";
import { adminClient } from "@/lib/supabase/admin";

export default async function TenderWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const supabase = adminClient();

  const { data: tender } = await supabase
    .from("tenders")
    .select("id,name,client,submission_deadline,contract_value,readiness_score,win_probability,status")
    .eq("id", id)
    .single();

  return <WorkspaceShell tender={tender}>{children}</WorkspaceShell>;
}
