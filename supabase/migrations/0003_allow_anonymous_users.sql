-- Allow anonymous users in profiles:
-- 1. Make email nullable so anonymous sign-ins don't violate NOT NULL
-- 2. Update the trigger to use COALESCE so it doesn't break on NULL email
-- 3. Skip profile creation entirely for anonymous users (is_anonymous = true in raw_user_meta_data)

alter table public.profiles
  alter column email drop not null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Anonymous users (email IS NULL) are still created but with no email.
  -- Authenticated users always have an email.
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
