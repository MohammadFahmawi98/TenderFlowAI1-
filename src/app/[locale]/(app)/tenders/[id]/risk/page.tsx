"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function RiskPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="risk"
      title="Risk Register"
      description="AI-identified risks with likelihood, impact, mitigation strategies and opportunity register."
    />
  );
}
