"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function ManpowerPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="manpower"
      title="Manpower Plan"
      description="AI-generated staffing plan, shift matrix, mobilisation timeline and training strategy."
    />
  );
}
