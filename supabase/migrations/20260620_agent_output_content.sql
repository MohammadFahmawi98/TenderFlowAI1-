-- Add output_content to agent_runs so AI text is always readable
-- even if the documents/document_versions tables have issues.
alter table public.agent_runs
  add column if not exists output_content text;
