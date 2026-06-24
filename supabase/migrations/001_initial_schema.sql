-- HireSchema: Supabase Auth + Postgres (replaces Firebase Auth + Firestore)
-- Run in Supabase SQL Editor or via `supabase db push`

-- ── Profiles (replaces users/{uid}) ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text,
  photo_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  role text not null default 'user' check (role in ('user', 'super_admin')),
  receive_daily_alerts boolean not null default true,
  last_job_fetch_time timestamptz not null default '1970-01-01T00:00:00Z',
  next_job_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create index if not exists idx_profiles_next_delivery
  on public.profiles (next_job_delivery_at asc nulls last)
  where receive_daily_alerts = true;

create index if not exists idx_profiles_email on public.profiles (lower(email));
create index if not exists idx_profiles_created_at on public.profiles (created_at desc);

-- ── Daily matches (replaces users/{uid}/daily_matches/{date}) ─────────────────
create table if not exists public.daily_matches (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_date text not null,
  jobs jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_date)
);

create index if not exists idx_daily_matches_user on public.daily_matches (user_id, match_date desc);

-- ── Tracked jobs (replaces trackedJobs/{id}) ──────────────────────────────────
create table if not exists public.tracked_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  status text not null check (status in ('saved', 'applied', 'interviewing', 'offered', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

create index if not exists idx_tracked_jobs_user on public.tracked_jobs (user_id, created_at desc);

-- ── Connection requests ───────────────────────────────────────────────────────
create table if not exists public.connection_requests (
  id text primary key,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_connection_requests_candidate
  on public.connection_requests (candidate_user_id, created_at desc);

-- ── Cron run dedup guards ─────────────────────────────────────────────────────
create table if not exists public.cron_runs (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── AI + admin audit logs ─────────────────────────────────────────────────────
create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Generic doc store (blog, content growth, marketing, job_sources) ──────────
create table if not exists public.firestore_docs (
  collection text not null,
  doc_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, doc_id)
);

create index if not exists idx_firestore_docs_collection on public.firestore_docs (collection);

-- ── Auto-create profile on signup ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_emails text[] := array['rupesh7126@gmail.com', 'kv3244@gmail.com'];
  user_role text := 'user';
begin
  if lower(coalesce(new.email, '')) = any(admin_emails) then
    user_role := 'super_admin';
  end if;

  insert into public.profiles (
    id, email, display_name, photo_url, role,
    last_job_fetch_time, next_job_delivery_at, data
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      ''
    ),
    user_role,
    '1970-01-01T00:00:00Z',
    now(),
    jsonb_build_object(
      'uid', new.id::text,
      'plan', 'free',
      'jobType', 'remote',
      'receiveDailyAlerts', true,
      'antiSlopEnabled', true,
      'deliveryTimezone', 'UTC',
      'preferredDeliveryHour', 8,
      'targetMarkets', '["us","eu","uk"]'::jsonb,
      'matchReadiness', jsonb_build_object(
        'status', 'blocked',
        'hasResume', false,
        'hasCareerPaths', false,
        'blockingReason', 'Profile missing usable resume text and career paths.',
        'qualityWarnings', '[]'::jsonb
      ),
      'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'lastActiveAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at helper ─────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists daily_matches_updated_at on public.daily_matches;
create trigger daily_matches_updated_at before update on public.daily_matches
  for each row execute function public.set_updated_at();

drop trigger if exists tracked_jobs_updated_at on public.tracked_jobs;
create trigger tracked_jobs_updated_at before update on public.tracked_jobs
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.daily_matches enable row level security;
alter table public.tracked_jobs enable row level security;
alter table public.connection_requests enable row level security;
alter table public.cron_runs enable row level security;
alter table public.ai_logs enable row level security;
alter table public.admin_logs enable row level security;
alter table public.firestore_docs enable row level security;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_super_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_super_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- daily_matches: read own
create policy "daily_matches_select_own_or_admin" on public.daily_matches
  for select using (auth.uid() = user_id or public.is_super_admin());

-- tracked_jobs
create policy "tracked_jobs_select_own_or_admin" on public.tracked_jobs
  for select using (auth.uid() = user_id or public.is_super_admin());
create policy "tracked_jobs_insert_own" on public.tracked_jobs
  for insert with check (auth.uid() = user_id);
create policy "tracked_jobs_update_own" on public.tracked_jobs
  for update using (auth.uid() = user_id);
create policy "tracked_jobs_delete_own" on public.tracked_jobs
  for delete using (auth.uid() = user_id);

-- connection_requests: read own
create policy "connection_requests_select_own" on public.connection_requests
  for select using (auth.uid() = candidate_user_id);

-- blog_posts public read (published)
create policy "firestore_docs_blog_public_read" on public.firestore_docs
  for select using (
    collection = 'blog_posts' and (data->>'status') = 'published'
  );
create policy "firestore_docs_admin_all" on public.firestore_docs
  for all using (public.is_super_admin());

-- content clusters public read
create policy "firestore_docs_clusters_public_read" on public.firestore_docs
  for select using (collection = 'content_clusters');

-- Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.tracked_jobs;
alter publication supabase_realtime add table public.daily_matches;
