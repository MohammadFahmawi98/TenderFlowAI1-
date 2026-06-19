import { complete } from "./provider";

export interface TenderExtraction {
  client_name: string;
  tender_name: string;
  deadline: string | null;          // ISO date string or null
  contract_duration: string | null;
  scope_of_work: string;
  technical_requirements: string[];
  commercial_requirements: string[];
  evaluation_criteria: string[];
  boq_data: Record<string, unknown> | null;
  asset_information: string[];
  staffing_requirements: string[];
  executive_summary: string;
  win_recommendation: "go" | "no-go" | "conditional";
  win_recommendation_reason: string;
}

const SYSTEM = `You are an expert Facility Management (FM) bid analyst at Etihad International Hospitality.
You analyse RFP/tender documents and extract structured information precisely.
Return ONLY a valid JSON object — no markdown, no extra text.`;

export async function extractTender(
  combinedText: string,
): Promise<TenderExtraction> {
  const user = `Analyse the following tender/RFP documents and extract all key information.
Return a JSON object with EXACTLY these fields:
{
  "client_name": "string",
  "tender_name": "string",
  "deadline": "YYYY-MM-DD or null",
  "contract_duration": "string or null",
  "scope_of_work": "comprehensive description string",
  "technical_requirements": ["array of strings"],
  "commercial_requirements": ["array of strings"],
  "evaluation_criteria": ["array of strings"],
  "boq_data": null or { "items": [...] },
  "asset_information": ["array of strings"],
  "staffing_requirements": ["array of strings"],
  "executive_summary": "2-3 paragraph executive summary of this tender opportunity",
  "win_recommendation": "go" | "no-go" | "conditional",
  "win_recommendation_reason": "brief reason for recommendation"
}

--- TENDER DOCUMENTS ---
${combinedText.slice(0, 60_000)}`;

  const raw = await complete({
    system: SYSTEM,
    user,
    model: "gpt-4o",
    temperature: 0.1,
    maxTokens: 4096,
    responseFormat: "json",
  });

  return JSON.parse(raw) as TenderExtraction;
}
