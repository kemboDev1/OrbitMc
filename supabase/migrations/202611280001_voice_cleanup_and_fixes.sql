-- Drop stale 5-arg send_hub_message overload and normalize audio data URL validation across DMs & Hubs

drop function if exists public.send_hub_message(text, text, text, text, uuid);

create or replace function public.send_hub_message(
  target_room_id text,
  message_body text,
  message_image text,
  message_sticker text,
  reply_id uuid,
  message_audio text default null
)
returns public.hub_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  room_kind text;
  member_role text;
  created_message public.hub_messages;
  clean_body text := coalesce(btrim(message_body), '');
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in first';
  end if;
  select r.kind, m.role into room_kind, member_role
  from public.hub_rooms r
  join public.hub_members m on m.hub_id = r.hub_id and m.user_id = current_user_id
  where r.id = target_room_id;
  if not found then
    raise exception using errcode = '42501', message = 'Room is unavailable';
  end if;
  if room_kind = 'broadcast' and member_role not in ('owner', 'mod') then
    raise exception using errcode = '42501', message = 'Posting is not allowed';
  end if;
  if char_length(clean_body) > 4000
    or (clean_body = '' and message_image is null and message_sticker is null and message_audio is null)
    or (message_image is not null and (char_length(message_image) > 900000 or message_image !~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$'))
    or (message_audio is not null and (char_length(message_audio) > 900000 or message_audio !~* '^data:audio/(webm|mp4|ogg|mpeg|wav|aac)(;\s*codecs=[^;]+)?;base64,[A-Za-z0-9+/=]+$'))
    or (message_sticker is not null and char_length(message_sticker) > 24) then
    raise exception using errcode = '22023', message = 'Message content is invalid';
  end if;
  if reply_id is not null and not exists (select 1 from public.hub_messages where id = reply_id and room_id = target_room_id) then
    raise exception using errcode = '22023', message = 'Reply target is unavailable';
  end if;
  insert into public.hub_messages (room_id, sender_id, body, image, audio, sticker, reply_to)
  values (target_room_id, current_user_id, clean_body, message_image, message_audio, message_sticker, reply_id)
  returning * into created_message;
  return created_message;
end;
$$;

grant execute on function public.send_hub_message(text, text, text, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
