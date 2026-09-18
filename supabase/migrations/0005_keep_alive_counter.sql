-- Keep-alive tables + one RPC that performs several DB ops per cron hit
-- (writes + reads across app tables) so free-tier pausing sees real activity.

create table public.keep_alive_counter (
  id integer primary key default 1 check (id = 1),
  ping_count bigint not null default 0,
  last_ping_at timestamptz not null default now(),
  last_source text
);

insert into public.keep_alive_counter (id, ping_count, last_ping_at)
values (1, 0, now());

create table public.keep_alive_pings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text not null default 'vercel-cron'
);

create index keep_alive_pings_created_at_idx on public.keep_alive_pings (created_at desc);

alter table public.keep_alive_counter enable row level security;
alter table public.keep_alive_pings enable row level security;
-- No policies: anon/authenticated cannot access; service_role bypasses RLS.

create or replace function public.run_keep_alive(p_source text default 'vercel-cron')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
  profiles_n bigint;
  workspaces_n bigint;
  messages_n bigint;
  pruned int;
begin
  -- 1) Counter write
  update public.keep_alive_counter
  set
    ping_count = ping_count + 1,
    last_ping_at = now(),
    last_source = p_source
  where id = 1
  returning ping_count into new_count;

  if new_count is null then
    insert into public.keep_alive_counter (id, ping_count, last_ping_at, last_source)
    values (1, 1, now(), p_source)
    returning ping_count into new_count;
  end if;

  -- 2) Append ping log (write)
  insert into public.keep_alive_pings (source) values (p_source);

  -- 3) Prune old ping rows — keep newest 60 (write/delete)
  with doomed as (
    select id
    from public.keep_alive_pings
    order by created_at desc
    offset 60
  )
  delete from public.keep_alive_pings
  where id in (select id from doomed);
  get diagnostics pruned = row_count;

  -- 4) Touch real app tables (reads)
  select count(*) into profiles_n from public.profiles;
  select count(*) into workspaces_n from public.workspaces;
  select count(*) into messages_n from public.messages;

  return jsonb_build_object(
    'pingCount', new_count,
    'source', p_source,
    'pruned', pruned,
    'counts', jsonb_build_object(
      'profiles', profiles_n,
      'workspaces', workspaces_n,
      'messages', messages_n
    )
  );
end;
$$;

revoke all on function public.run_keep_alive(text) from public;
grant execute on function public.run_keep_alive(text) to service_role;
