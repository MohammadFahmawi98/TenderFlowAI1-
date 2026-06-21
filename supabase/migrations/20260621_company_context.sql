-- Add AI context fields to company_profiles
alter table company_profiles
  add column if not exists context jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

-- knowledge_documents: ensure content_text column exists (may have been created earlier)
alter table knowledge_documents
  add column if not exists content_text text;
