-- Technical Proposal Package sections
create table if not exists proposal_sections (
  id           uuid primary key default gen_random_uuid(),
  tender_id    uuid references tenders(id) on delete cascade not null,
  section_type text not null,
  -- section_type values:
  --   'experiences' | 'scope' | 'manpower' | 'qhse' | 'technical' | 'tools' | 'quality' | 'references'
  content_html text,
  section_data jsonb default '{}'::jsonb,  -- structured data (org chart roles, etc.)
  status       text default 'empty',       -- 'empty' | 'generating' | 'ready'
  generated_at timestamptz,
  created_at   timestamptz default now(),
  unique(tender_id, section_type)
);

alter table proposal_sections enable row level security;
create policy "auth users full access" on proposal_sections
  for all using (auth.role() = 'authenticated');
