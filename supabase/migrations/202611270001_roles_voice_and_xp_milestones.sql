alter table public.profiles
  add column if not exists role text not null default 'member';

alter table public.direct_messages
  add column if not exists audio text;

alter table public.hub_messages
  add column if not exists audio text;

create or replace function public.admin_set_user_role(target_user_id uuid, next_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_owner() then
    raise exception using errcode = '42501', message = 'Owner only';
  end if;
  if next_role not in ('member', 'mod', 'admin') then
    raise exception using errcode = '22023', message = 'Invalid role';
  end if;
  update public.profiles set role = next_role where id = target_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;
  if next_role = 'admin' then
    insert into private.orbit_admin_users (user_id) values (target_user_id) on conflict (user_id) do nothing;
  else
    if target_user_id <> auth.uid() then
      delete from private.orbit_admin_users where user_id = target_user_id;
    end if;
  end if;
  return next_role;
end;
$$;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_orbit_owner() then
    raise exception using errcode = '42501', message = 'Owner only';
  end if;
  if target_user_id = auth.uid() then
    raise exception using errcode = '22023', message = 'Cannot delete own owner account';
  end if;
  delete from auth.users where id = target_user_id;
  if not found then
    delete from public.profiles where id = target_user_id;
  end if;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
