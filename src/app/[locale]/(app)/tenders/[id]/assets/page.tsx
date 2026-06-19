"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function AssetsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="ppm"
      title="Assets & PPM Schedule"
      description="Planned preventive maintenance schedule, asset register and lifecycle management plan."
    />
  );
}
