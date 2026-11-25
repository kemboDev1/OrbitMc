create or replace function public.delete_direct_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.direct_messages dm
  where dm.id = message_id
    and auth.uid() is not null
    and auth.uid() in (dm.sender_id, dm.recipient_id);
  if not found then
    raise exception using errcode = '42501', message = 'Message is unavailable';
  end if;
end;
$$;

create or replace function public.delete_hub_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.hub_messages hm
  where hm.id = message_id
    and auth.uid() is not null
    and (
      hm.sender_id = auth.uid()
      or exists (
        select 1
        from public.hub_rooms r
        join public.hub_members m on m.hub_id = r.hub_id
        where r.id = hm.room_id
          and m.user_id = auth.uid()
          and m.role in ('owner', 'mod')
      )
    );
  if not found then
    raise exception using errcode = '42501', message = 'Message is unavailable';
  end if;
end;
$$;

revoke all on function public.delete_direct_message(uuid) from public, anon;
revoke all on function public.delete_hub_message(uuid) from public, anon;
grant execute on function public.delete_direct_message(uuid) to authenticated;
grant execute on function public.delete_hub_message(uuid) to authenticated;
