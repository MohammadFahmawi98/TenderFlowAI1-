"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function EstimationPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="commercial"
      title="Commercial Estimation"
      description="AI-generated cost structure, BOQ analysis, pricing strategy and value engineering opportunities."
    />
  );
}
