insert into private.user_private_profiles (user_id, birth_date)
select u.id, null
from auth.users u
left join private.user_private_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

create or replace function public.set_hub_member_role(target_hub_id text, target_user_id uuid, next_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if next_role not in ('member', 'mod') or target_user_id = auth.uid() then
    raise exception using errcode = '22023', message = 'Invalid role change';
  end if;
  if not exists (select 1 from public.hubs h where h.id = target_hub_id and h.owner_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Hub owner required';
  end if;
  update public.hub_members set role = next_role where hub_id = target_hub_id and user_id = target_user_id and role <> 'owner';
  if not found then raise exception using errcode = 'P0002', message = 'Hub member not found'; end if;
end;
$$;
revoke all on function public.set_hub_member_role(text, uuid, text) from public, anon;
grant execute on function public.set_hub_member_role(text, uuid, text) to authenticated;

create or replace function public.remove_hub_member(target_hub_id text, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if not exists (select 1 from public.hubs h where h.id = target_hub_id and h.owner_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'Hub owner required';
  end if;
  delete from public.hub_members where hub_id = target_hub_id and user_id = target_user_id and role <> 'owner';
  if not found then raise exception using errcode = 'P0002', message = 'Hub member not found'; end if;
end;
$$;
revoke all on function public.remove_hub_member(text, uuid) from public, anon;
grant execute on function public.remove_hub_member(text, uuid) to authenticated;
