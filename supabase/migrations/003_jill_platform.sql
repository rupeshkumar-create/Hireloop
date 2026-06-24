-- Jill recruiter platform + warm intro threads

create table if not exists public.recruiter_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null,
  company_website text,
  title text,
  bio text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  location text not null default 'Remote',
  salary_range text,
  description text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed', 'filled')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recruiter_jobs_user on public.recruiter_jobs (recruiter_user_id, created_at desc);
create index if not exists idx_recruiter_jobs_open on public.recruiter_jobs (status, created_at desc) where status = 'open';

alter table public.connection_requests
  add column if not exists recruiter_user_id uuid references public.profiles(id) on delete set null;

alter table public.connection_requests
  add column if not exists recruiter_job_id uuid references public.recruiter_jobs(id) on delete set null;

create index if not exists idx_connection_requests_recruiter
  on public.connection_requests (recruiter_user_id, created_at desc)
  where recruiter_user_id is not null;

drop trigger if exists recruiter_profiles_updated_at on public.recruiter_profiles;
create trigger recruiter_profiles_updated_at before update on public.recruiter_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists recruiter_jobs_updated_at on public.recruiter_jobs;
create trigger recruiter_jobs_updated_at before update on public.recruiter_jobs
  for each row execute function public.set_updated_at();

alter table public.recruiter_profiles enable row level security;
alter table public.recruiter_jobs enable row level security;

create policy "recruiter_profiles_select_own_or_admin" on public.recruiter_profiles
  for select using (auth.uid() = user_id or public.is_super_admin());
create policy "recruiter_profiles_insert_own" on public.recruiter_profiles
  for insert with check (auth.uid() = user_id);
create policy "recruiter_profiles_update_own" on public.recruiter_profiles
  for update using (auth.uid() = user_id);

create policy "recruiter_jobs_select_open_or_own" on public.recruiter_jobs
  for select using (status = 'open' or auth.uid() = recruiter_user_id or public.is_super_admin());
create policy "recruiter_jobs_insert_own" on public.recruiter_jobs
  for insert with check (auth.uid() = recruiter_user_id);
create policy "recruiter_jobs_update_own" on public.recruiter_jobs
  for update using (auth.uid() = recruiter_user_id);
create policy "recruiter_jobs_delete_own" on public.recruiter_jobs
  for delete using (auth.uid() = recruiter_user_id);

create policy "connection_requests_update_recruiter" on public.connection_requests
  for update using (auth.uid() = recruiter_user_id);

alter publication supabase_realtime add table public.recruiter_jobs;
alter publication supabase_realtime add table public.connection_requests;
