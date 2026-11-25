create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.orbit_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.orbit_admin_users from public, anon, authenticated;
insert into private.orbit_admin_users (user_id)
values ('1de35406-8427-4f5e-bb73-5fbc6464e388'::uuid)
on conflict (user_id) do nothing;

create or replace function public.is_orbit_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.orbit_admin_users a where a.user_id = auth.uid()
  );
$$;
revoke all on function public.is_orbit_owner() from public, anon;
grant execute on function public.is_orbit_owner() to authenticated;

create table if not exists private.user_private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date,
  birthday_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on private.user_private_profiles from public, anon, authenticated;

create or replace function private.create_private_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_birth_date text := new.raw_user_meta_data ->> 'birth_date';
  parsed_birth_date date;
begin
  if supplied_birth_date ~ '^\d{4}-\d{2}-\d{2}$' then
    begin parsed_birth_date := supplied_birth_date::date;
    exception when others then parsed_birth_date := null;
    end;
  end if;
  if parsed_birth_date > current_date then parsed_birth_date := null; end if;
  insert into private.user_private_profiles (user_id, birth_date)
  values (new.id, parsed_birth_date)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_private_profile_for_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_private_profile on auth.users;
create trigger on_auth_user_created_private_profile
  after insert on auth.users
  for each row execute procedure private.create_private_profile_for_new_user();

create or replace function public.set_birthday_visibility(show_birthday boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  update private.user_private_profiles
  set birthday_visible = coalesce(show_birthday, false), updated_at = now()
  where user_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Private profile not found'; end if;
end;
$$;
revoke all on function public.set_birthday_visibility(boolean) from public, anon;
grant execute on function public.set_birthday_visibility(boolean) to authenticated;

create or replace function public.get_my_birthday_visibility()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.birthday_visible from private.user_private_profiles p where p.user_id = auth.uid()), false);
$$;
revoke all on function public.get_my_birthday_visibility() from public, anon;
grant execute on function public.get_my_birthday_visibility() to authenticated;

create or replace function public.get_birthday_profiles_today()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id
  from private.user_private_profiles p
  where auth.uid() is not null
    and p.birthday_visible
    and p.birth_date is not null
    and extract(month from p.birth_date) = extract(month from current_date)
    and extract(day from p.birth_date) = extract(day from current_date);
$$;
revoke all on function public.get_birthday_profiles_today() from public, anon;
grant execute on function public.get_birthday_profiles_today() to authenticated;

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('idea', 'problem', 'other')),
  body text not null check (char_length(body) between 8 and 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'done')),
  created_at timestamptz not null default now()
);
alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from public, anon, authenticated;

create or replace function public.submit_orbit_feedback(feedback_category text, feedback_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if feedback_category not in ('idea', 'problem', 'other')
    or char_length(btrim(feedback_body)) not between 8 and 2000 then
    raise exception using errcode = '22023', message = 'Feedback is invalid';
  end if;
  insert into public.user_feedback (user_id, category, body)
  values (auth.uid(), feedback_category, btrim(feedback_body));
end;
$$;
revoke all on function public.submit_orbit_feedback(text, text) from public, anon;
grant execute on function public.submit_orbit_feedback(text, text) to authenticated;

create or replace function public.get_orbit_admin_feedback()
returns table (id uuid, username text, display_name text, category text, body text, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_owner() then raise exception using errcode = '42501', message = 'Admin access required'; end if;
  return query
    select f.id, p.username, p.display_name, f.category, f.body, f.status, f.created_at
    from public.user_feedback f
    join public.profiles p on p.id = f.user_id
    order by f.created_at desc
    limit 100;
end;
$$;
revoke all on function public.get_orbit_admin_feedback() from public, anon;
grant execute on function public.get_orbit_admin_feedback() to authenticated;

create or replace function public.set_orbit_feedback_status(feedback_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_owner() then raise exception using errcode = '42501', message = 'Admin access required'; end if;
  if next_status not in ('new', 'reviewing', 'done') then raise exception using errcode = '22023', message = 'Invalid status'; end if;
  update public.user_feedback set status = next_status where id = feedback_id;
  if not found then raise exception using errcode = 'P0002', message = 'Feedback not found'; end if;
end;
$$;
revoke all on function public.set_orbit_feedback_status(uuid, text) from public, anon;
grant execute on function public.set_orbit_feedback_status(uuid, text) to authenticated;

create table if not exists private.user_plan_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('pro', 'orbit_max')),
  updated_at timestamptz not null default now()
);
revoke all on private.user_plan_entitlements from public, anon, authenticated;

create or replace function public.create_hub(hub_name text, hub_about text, hub_emoji text, hub_hue integer, hub_is_public boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := btrim(regexp_replace(hub_name, '\s+', ' ', 'g'));
  clean_about text := btrim(hub_about);
  new_hub_id text := 'h_' || replace(gen_random_uuid()::text, '-', '');
  new_invite text := replace(gen_random_uuid()::text, '-', '');
  hub_limit integer := 10;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if clean_name is null or char_length(clean_name) not between 2 and 40 or char_length(clean_about) > 160
    or char_length(hub_emoji) not between 1 and 8 or hub_hue not between 0 and 360 then
    raise exception using errcode = '22023', message = 'Hub details are invalid';
  end if;
  if exists (select 1 from private.orbit_admin_users a where a.user_id = current_user_id) then
    hub_limit := 2147483647;
  else
    select case e.tier when 'pro' then 25 when 'orbit_max' then 100 else 10 end
      into hub_limit
      from private.user_plan_entitlements e where e.user_id = current_user_id;
    hub_limit := coalesce(hub_limit, 10);
  end if;
  if (select count(*) from public.hubs where owner_id = current_user_id) >= hub_limit then
    raise exception using errcode = '54000', message = 'Hub limit reached';
  end if;
  insert into public.hubs (id, owner_id, name, about, emoji, hue, is_public, invite_code)
  values (new_hub_id, current_user_id, clean_name, clean_about, hub_emoji, hub_hue, hub_is_public, new_invite);
  insert into public.hub_members (hub_id, user_id, role) values (new_hub_id, current_user_id, 'owner');
  insert into public.hub_rooms (id, hub_id, name) values (new_hub_id || '_general', new_hub_id, 'general');
  return new_hub_id;
end;
$$;
revoke all on function public.create_hub(text, text, text, integer, boolean) from public, anon;
grant execute on function public.create_hub(text, text, text, integer, boolean) to authenticated;
