-- TenderFlow AI — Etihad International Hospitality
-- Full schema: run once on a fresh Supabase project.

-- ──────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ──────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────
create type user_role as enum (
  'owner','admin','bid_manager','commercial_manager',
  'operations_manager','reviewer','viewer'
);
create type user_status as enum ('active','invited','suspended');

create type tender_status as enum (
  'analyzing','in_progress','in_review','ready','submitted','archived'
);

create type file_category as enum (
  'rfp_main','boq','technical_spec','contract_conditions','drawings',
  'appendices','compliance_docs','pricing_docs','client_forms','other'
);
create type extraction_status as enum ('pending','running','done','failed');

create type agent_type as enum (
  'intelligence','qualification','compliance','technical','commercial',
  'manpower','ppm','risk','hse','presentation','executive_review'
);
create type agent_status as enum ('waiting','running','completed','failed');

create type doc_type as enum (
  'technical_proposal','commercial_proposal','compliance_matrix',
  'manpower_plan','ppm_schedule','sla_matrix','kpi_matrix','risk_register',
  'hse_plan','method_statement','executive_summary','presentation','cost_sheet','other'
);
create type review_status as enum (
  'draft','ai_generated','in_review','changes_requested','approved','final'
);

create type task_priority as enum ('low','medium','high','critical');
create type task_status   as enum ('todo','in_progress','in_review','approved','blocked','completed');

create type knowledge_type as enum (
  'technical_proposal','method_statement','sop','ppm_library','sla_library',
  'kpi_library','hse_plan','risk_register','mobilization_plan','company_profile',
  'certification','past_project','reference','case_study','template','other'
);

-- ──────────────────────────────────────────────────
-- users (extends auth.users)
-- ──────────────────────────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        user_role not null default 'viewer',
  status      user_status not null default 'invited',
  invited_by  uuid references public.users(id),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.users enable row level security;

-- ──────────────────────────────────────────────────
-- company_profile (single row)
-- ──────────────────────────────────────────────────
create table public.company_profile (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null default 'Etihad International Hospitality',
  logo_url     text,
  profile_json jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.company_profile enable row level security;

-- ──────────────────────────────────────────────────
-- knowledge_items (company knowledge base)
-- ──────────────────────────────────────────────────
create table public.knowledge_items (
  id          uuid primary key default uuid_generate_v4(),
  type        knowledge_type not null,
  title       text not null,
  content     text,
  file_url    text,
  embedding   vector(1536),
  tags        text[] default '{}',
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.knowledge_items using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table public.knowledge_items enable row level security;

-- ──────────────────────────────────────────────────
-- tenders (each = one workspace)
-- ──────────────────────────────────────────────────
create table public.tenders (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  client               text,
  submission_deadline  date,
  contract_duration    text,
  contract_value       numeric(18,2),
  status               tender_status not null default 'analyzing',
  readiness_score      smallint check (readiness_score between 0 and 100),
  win_probability      smallint check (win_probability between 0 and 100),
  executive_summary    text,
  created_by           uuid references public.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.tenders enable row level security;

-- ──────────────────────────────────────────────────
-- tender_files (uploaded source files)
-- ──────────────────────────────────────────────────
create table public.tender_files (
  id                uuid primary key default uuid_generate_v4(),
  tender_id         uuid not null references public.tenders(id) on delete cascade,
  name              text not null,
  original_name     text not null,
  category          file_category not null default 'other',
  description       text,
  important         boolean not null default false,
  version           smallint not null default 1,
  storage_path      text not null,
  mime              text,
  size_bytes        bigint,
  extraction_status extraction_status not null default 'pending',
  used_by_agents    agent_type[] default '{}',
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now()
);
alter table public.tender_files enable row level security;

-- ──────────────────────────────────────────────────
-- tender_extractions (structured AI intelligence)
-- ──────────────────────────────────────────────────
create table public.tender_extractions (
  id                       uuid primary key default uuid_generate_v4(),
  tender_id                uuid not null references public.tenders(id) on delete cascade unique,
  client_name              text,
  tender_name              text,
  deadline                 date,
  contract_duration        text,
  scope_of_work            text,
  technical_requirements   jsonb,
  commercial_requirements  jsonb,
  evaluation_criteria      jsonb,
  boq_data                 jsonb,
  asset_information        jsonb,
  staffing_requirements    jsonb,
  raw_json                 jsonb,
  extracted_at             timestamptz not null default now()
);
alter table public.tender_extractions enable row level security;

-- ──────────────────────────────────────────────────
-- agent_runs
-- ──────────────────────────────────────────────────
create table public.agent_runs (
  id            uuid primary key default uuid_generate_v4(),
  tender_id     uuid not null references public.tenders(id) on delete cascade,
  agent_type    agent_type not null,
  status        agent_status not null default 'waiting',
  progress      smallint not null default 0 check (progress between 0 and 100),
  current_task  text,
  output_doc_id uuid,
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  unique (tender_id, agent_type)
);
alter table public.agent_runs enable row level security;

-- ──────────────────────────────────────────────────
-- documents (generated deliverables)
-- ──────────────────────────────────────────────────
create table public.documents (
  id                  uuid primary key default uuid_generate_v4(),
  tender_id           uuid not null references public.tenders(id) on delete cascade,
  type                doc_type not null,
  title               text not null,
  current_version_id  uuid,
  review_status       review_status not null default 'draft',
  assigned_reviewer   uuid references public.users(id),
  locked              boolean not null default false,
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.documents enable row level security;

-- forward-ref: agent_runs.output_doc_id → documents
alter table public.agent_runs add constraint fk_agent_doc
  foreign key (output_doc_id) references public.documents(id) on delete set null;

-- ──────────────────────────────────────────────────
-- document_versions
-- ──────────────────────────────────────────────────
create table public.document_versions (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  version_no   smallint not null default 1,
  content_json jsonb,
  content_html text,
  note         text,
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now()
);
alter table public.document_versions enable row level security;

-- back-fill current_version_id FK
alter table public.documents add constraint fk_current_version
  foreign key (current_version_id) references public.document_versions(id) on delete set null;

-- ──────────────────────────────────────────────────
-- tasks
-- ──────────────────────────────────────────────────
create table public.tasks (
  id                   uuid primary key default uuid_generate_v4(),
  tender_id            uuid not null references public.tenders(id) on delete cascade,
  title                text not null,
  description          text,
  assignee_id          uuid references public.users(id),
  due_date             date,
  priority             task_priority not null default 'medium',
  status               task_status not null default 'todo',
  related_document_id  uuid references public.documents(id),
  related_agent_run_id uuid references public.agent_runs(id),
  created_by           uuid references public.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table public.tasks enable row level security;

-- ──────────────────────────────────────────────────
-- comments (on documents, tasks, tenders)
-- ──────────────────────────────────────────────────
create table public.comments (
  id           uuid primary key default uuid_generate_v4(),
  target_type  text not null check (target_type in ('document','task','tender')),
  target_id    uuid not null,
  anchor       text,
  author_id    uuid not null references public.users(id),
  body         text not null,
  mentions     uuid[] default '{}',
  resolved     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.comments enable row level security;

-- ──────────────────────────────────────────────────
-- activity_log
-- ──────────────────────────────────────────────────
create table public.activity_log (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references public.users(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
alter table public.activity_log enable row level security;

-- ──────────────────────────────────────────────────
-- notifications
-- ──────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

-- ──────────────────────────────────────────────────
-- RLS POLICIES
-- ──────────────────────────────────────────────────

-- Helper: get current user role
create or replace function public.current_user_role()
returns user_role
language sql stable security definer
as $$
  select role from public.users where id = auth.uid();
$$;

-- Helper: is at least role
create or replace function public.is_role(minimum_role user_role)
returns boolean
language sql stable security definer
as $$
  select public.current_user_role()::text = any(
    case minimum_role
      when 'owner'                then array['owner']
      when 'admin'                then array['owner','admin']
      when 'bid_manager'          then array['owner','admin','bid_manager']
      when 'commercial_manager'   then array['owner','admin','bid_manager','commercial_manager']
      when 'operations_manager'   then array['owner','admin','bid_manager','operations_manager']
      when 'reviewer'             then array['owner','admin','bid_manager','commercial_manager','operations_manager','reviewer']
      when 'viewer'               then array['owner','admin','bid_manager','commercial_manager','operations_manager','reviewer','viewer']
    end
  );
$$;

-- users: everyone can read; only owner/admin can update others
create policy "users_select" on public.users for select using (public.is_role('viewer'));
create policy "users_insert" on public.users for insert with check (public.is_role('admin'));
create policy "users_update" on public.users for update using (id = auth.uid() or public.is_role('admin'));

-- company_profile: all read; owner/admin write
create policy "company_select" on public.company_profile for select using (public.is_role('viewer'));
create policy "company_write"  on public.company_profile for all using (public.is_role('admin'));

-- knowledge_items: all read; bid_manager+ write
create policy "knowledge_select" on public.knowledge_items for select using (public.is_role('viewer'));
create policy "knowledge_write"  on public.knowledge_items for all using (public.is_role('bid_manager'));

-- tenders: all read; bid_manager+ write; admin delete
create policy "tenders_select" on public.tenders for select using (public.is_role('viewer'));
create policy "tenders_insert" on public.tenders for insert with check (public.is_role('bid_manager'));
create policy "tenders_update" on public.tenders for update using (public.is_role('bid_manager'));
create policy "tenders_delete" on public.tenders for delete using (public.is_role('admin'));

-- tender_files
create policy "files_select" on public.tender_files for select using (public.is_role('viewer'));
create policy "files_write"  on public.tender_files for all using (public.is_role('bid_manager'));

-- tender_extractions
create policy "extractions_select" on public.tender_extractions for select using (public.is_role('viewer'));
create policy "extractions_write"  on public.tender_extractions for all using (public.is_role('bid_manager'));

-- agent_runs: all read; server-side write (service role)
create policy "agents_select" on public.agent_runs for select using (public.is_role('viewer'));
create policy "agents_write"  on public.agent_runs for all using (public.is_role('bid_manager'));

-- documents
create policy "docs_select" on public.documents for select using (public.is_role('viewer'));
create policy "docs_write"  on public.documents for all using (public.is_role('reviewer'));

-- document_versions
create policy "dv_select" on public.document_versions for select using (public.is_role('viewer'));
create policy "dv_write"  on public.document_versions for all using (public.is_role('reviewer'));

-- tasks
create policy "tasks_select" on public.tasks for select using (public.is_role('viewer'));
create policy "tasks_write"  on public.tasks for all using (public.is_role('reviewer'));

-- comments
create policy "comments_select" on public.comments for select using (public.is_role('viewer'));
create policy "comments_write"  on public.comments for all using (public.is_role('reviewer'));
create policy "comments_update_own" on public.comments for update using (author_id = auth.uid());

-- activity_log: read-only for all; insert server-side
create policy "activity_select" on public.activity_log for select using (public.is_role('viewer'));
create policy "activity_insert" on public.activity_log for insert with check (public.is_role('reviewer'));

-- notifications: own only
create policy "notif_select" on public.notifications for select using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert with check (public.is_role('reviewer'));

-- ──────────────────────────────────────────────────
-- Supabase Storage bucket
-- ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tender-files',
  'tender-files',
  false,
  104857600, -- 100 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip','application/x-zip-compressed',
    'image/jpeg','image/png','image/webp','image/tiff',
    'application/octet-stream'
  ]
) on conflict (id) do nothing;

-- Storage RLS
create policy "tf_upload" on storage.objects for insert
  with check (bucket_id = 'tender-files' and public.is_role('bid_manager'));
create policy "tf_select" on storage.objects for select
  using (bucket_id = 'tender-files' and public.is_role('viewer'));
create policy "tf_delete" on storage.objects for delete
  using (bucket_id = 'tender-files' and public.is_role('bid_manager'));

-- ──────────────────────────────────────────────────
-- Seed: company profile + owner account placeholder
-- ──────────────────────────────────────────────────
insert into public.company_profile (name)
values ('Etihad International Hospitality')
on conflict do nothing;
