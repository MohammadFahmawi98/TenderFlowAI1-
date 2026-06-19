-- Suppliers table for EIH TenderFM
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  category     text,
  region       text,
  status       text not null default 'pending',   -- pending | approved | preferred | blacklisted
  compliance   text not null default 'pending',   -- pending | compliant | non-compliant
  rating       int  not null default 3 check (rating between 1 and 5),
  contact      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.suppliers enable row level security;

-- Allow all authenticated users to read and write suppliers
create policy "Authenticated users can manage suppliers"
  on public.suppliers for all
  to authenticated
  using (true)
  with check (true);

-- Index for common queries
create index if not exists suppliers_category_idx on public.suppliers (category);
create index if not exists suppliers_status_idx   on public.suppliers (status);
create index if not exists suppliers_compliance_idx on public.suppliers (compliance);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at
  before update on public.suppliers
  for each row execute procedure public.handle_updated_at();
