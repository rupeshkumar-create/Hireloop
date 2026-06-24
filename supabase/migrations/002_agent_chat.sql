-- Agent chat persistence (optional — also stored in profiles.data.agentChat)
create table if not exists public.agent_chat_messages (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  attachment jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_chat_user on public.agent_chat_messages (user_id, created_at asc);

alter table public.agent_chat_messages enable row level security;

create policy "agent_chat_select_own" on public.agent_chat_messages
  for select using (auth.uid() = user_id);
create policy "agent_chat_insert_own" on public.agent_chat_messages
  for insert with check (auth.uid() = user_id);
create policy "agent_chat_update_own" on public.agent_chat_messages
  for update using (auth.uid() = user_id);
create policy "agent_chat_delete_own" on public.agent_chat_messages
  for delete using (auth.uid() = user_id);
