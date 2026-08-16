-- Workspaces Table
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled workspace',
  initial_file_path text,
  canvas_snapshot_path text,
  canvas_snapshot_updated_at timestamptz,
  is_auto_check_enabled boolean not null default false,
  auto_check_delay_ms integer not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspaces_user_id_idx on public.workspaces(user_id);
alter table public.workspaces enable row level security;

create policy "workspaces_crud_own" on public.workspaces
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Messages Table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  kind text not null check (kind in ('chat', 'feedback')),
  content text not null,
  is_correct boolean,
  created_at timestamptz not null default now()
);

create index messages_workspace_id_created_at_idx on public.messages(workspace_id, created_at);
alter table public.messages enable row level security;

create policy "messages_crud_via_workspace" on public.messages
  for all using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.user_id = auth.uid()));

-- Enable Realtime for Messages
begin;
  -- Remove the supabase_realtime publication if it exists
  drop publication if exists supabase_realtime;

  -- Re-create the publication and add the messages table to it
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.messages;

-- Storage Bucket for Snapshots
insert into storage.buckets (id, name, public) values ('workspace-snapshots', 'workspace-snapshots', false) on conflict (id) do nothing;

create policy "workspace_snapshots_crud_own" on storage.objects
  for all using (bucket_id = 'workspace-snapshots' and auth.uid() = owner)
  with check (bucket_id = 'workspace-snapshots' and auth.uid() = owner);
