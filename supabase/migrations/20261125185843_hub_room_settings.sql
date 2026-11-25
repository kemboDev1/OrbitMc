create or replace function public.update_hub_room_settings(
  target_hub_id text,
  target_room_id text,
  next_topic text,
  next_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_topic text := btrim(next_topic);
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if clean_topic is null or char_length(clean_topic) > 120 or next_kind not in ('text', 'broadcast') then
    raise exception using errcode = '22023', message = 'Room settings are invalid';
  end if;
  update public.hub_rooms as r set topic = clean_topic, kind = next_kind
  where r.id = target_room_id and r.hub_id = target_hub_id
    and exists (select 1 from public.hubs h where h.id = target_hub_id and h.owner_id = current_user_id);
  if not found then raise exception using errcode = '42501', message = 'Only the community owner can update rooms'; end if;
end;
$$;
revoke all on function public.update_hub_room_settings(text, text, text, text) from public, anon;
grant execute on function public.update_hub_room_settings(text, text, text, text) to authenticated;
