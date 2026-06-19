"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function QualificationPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="qualification"
      title="Qualification Assessment"
      description="AI-generated Go/No-Go analysis with eligibility assessment and qualification matrix."
    />
  );
}
