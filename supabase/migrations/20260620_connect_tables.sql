-- Connect the 4 orphaned tables to the main schema
-- Run in Supabase SQL Editor

-- ── 1. team_members → link to auth.users (optional FK, nullable so manual entries still work)
alter table public.team_members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists team_members_user_id_idx on public.team_members(user_id);

-- ── 2. suppliers ↔ tenders (junction table: which subcontractors are used in which bid)
create table if not exists public.tender_suppliers (
  id          uuid primary key default gen_random_uuid(),
  tender_id   uuid not null references public.tenders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  scope       text,                          -- what scope this sub covers in the bid
  quoted_value numeric(18,2),               -- their quoted amount
  status      text not null default 'invited',  -- invited | quoted | selected | rejected
  notes       text,
  created_at  timestamptz not null default now(),
  unique (tender_id, supplier_id)
);
alter table public.tender_suppliers enable row level security;
create policy "Authenticated users can manage tender_suppliers"
  on public.tender_suppliers for all to authenticated
  using (true) with check (true);

-- ── 3. knowledge_documents → link to tenders (optional: which bid generated/used this doc)
alter table public.knowledge_documents
  add column if not exists tender_id  uuid references public.tenders(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists tags       text[] default '{}',
  add column if not exists knowledge_type text default 'other';

create index if not exists knowledge_documents_tender_id_idx on public.knowledge_documents(tender_id);
create index if not exists knowledge_documents_type_idx      on public.knowledge_documents(knowledge_type);

-- ── 4. company_profile → add updated_by so changes are traceable
alter table public.company_profile
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- ── RLS policies for new junction table already added above
-- ── Existing tables' RLS unchanged
