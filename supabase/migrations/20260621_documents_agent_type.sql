-- Add agent_type to documents so we can link documents back to which AI agent generated them
-- Also add notes column to tender_files if not already present
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS agent_type text;

ALTER TABLE public.tender_files
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '[]'::jsonb;

-- Index for fast lookup of docs by agent_type within a tender
CREATE INDEX IF NOT EXISTS documents_tender_agent_idx
  ON public.documents(tender_id, agent_type)
  WHERE agent_type IS NOT NULL;
