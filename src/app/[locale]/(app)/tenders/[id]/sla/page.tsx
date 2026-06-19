"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function SlaPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="sla"
      title="SLA & KPI Framework"
      description="Service level agreements, KPIs, penalty regime and performance review process aligned with ISO 41001."
    />
  );
}
