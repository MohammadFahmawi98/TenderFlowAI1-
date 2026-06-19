"use client";

import { useParams } from "next/navigation";
import { AgentDocumentView } from "@/components/agent-doc-view";

export default function CompliancePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AgentDocumentView
      tenderId={id}
      agentType="compliance"
      title="Compliance Matrix"
      description="Requirement-by-requirement compliance status with submission checklist and gap report."
    />
  );
}
