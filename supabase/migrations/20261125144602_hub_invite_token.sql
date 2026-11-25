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
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if clean_name is null or char_length(clean_name) not between 2 and 40 or char_length(clean_about) > 160
    or char_length(hub_emoji) not between 1 and 8 or hub_hue not between 0 and 360 then
    raise exception using errcode = '22023', message = 'Hub details are invalid';
  end if;
  if (select count(*) from public.hubs where owner_id = current_user_id) >= 3 then
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
