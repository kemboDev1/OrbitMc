create index if not exists direct_messages_reply_to_idx
  on public.direct_messages (reply_to);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages"
  on public.direct_messages for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

drop policy if exists "Users can send direct messages as themselves" on public.direct_messages;
create policy "Users can send direct messages as themselves"
  on public.direct_messages for insert to authenticated
  with check ((select auth.uid()) = sender_id and sender_id <> recipient_id);

drop policy if exists "Senders can delete their direct messages" on public.direct_messages;

revoke all on public.profiles, public.direct_messages from public, anon, authenticated;
grant select on public.profiles, public.direct_messages to authenticated;
grant update (display_name, bio, avatar, presence, status_text) on public.profiles to authenticated;
grant insert (sender_id, recipient_id, body, image, sticker, reply_to) on public.direct_messages to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.create_profile_for_new_user()') is not null
    and to_regprocedure('private.create_profile_for_new_user()') is null then
    execute 'alter function public.create_profile_for_new_user() set schema private';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null
    and to_regprocedure('private.rls_auto_enable()') is null then
    execute 'alter function public.rls_auto_enable() set schema private';
  end if;
  if to_regprocedure('private.create_profile_for_new_user()') is not null then
    execute 'revoke all on function private.create_profile_for_new_user() from public, anon, authenticated';
  end if;
  if to_regprocedure('private.rls_auto_enable()') is not null then
    execute 'revoke all on function private.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
revoke all on schema private from public, anon, authenticated;
