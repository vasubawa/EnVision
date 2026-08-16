create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.id := old.id;
    new.email := old.email;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
