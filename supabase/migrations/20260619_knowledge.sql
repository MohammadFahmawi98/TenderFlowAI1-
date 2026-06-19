create table if not exists public.knowledge_documents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text default 'document',
  storage_path text,
  content_text text,
  status       text default 'indexed',  -- indexed | processing | failed
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz not null default now()
);
alter table public.knowledge_documents enable row level security;
create policy "Authenticated users can manage knowledge"
  on public.knowledge_documents for all to authenticated
  using (true) with check (true);
