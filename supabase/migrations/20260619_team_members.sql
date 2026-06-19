create table if not exists public.team_members (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  role         text,
  department   text,
  status       text default 'active',
  last_active  timestamptz default now(),
  created_at   timestamptz not null default now()
);
alter table public.team_members enable row level security;
create policy "Authenticated users can manage team"
  on public.team_members for all to authenticated
  using (true) with check (true);
