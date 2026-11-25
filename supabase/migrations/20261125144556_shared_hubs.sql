create table if not exists public.hubs (
  id text primary key check (id ~ '^h_[a-z0-9_-]{8,80}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  about text not null default '' check (char_length(about) <= 160),
  emoji text not null default '✳' check (char_length(emoji) between 1 and 8),
  hue smallint not null default 210 check (hue between 0 and 360),
  is_public boolean not null default true,
  invite_code text not null unique check (invite_code ~ '^[a-f0-9]{16,32}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_rooms (
  id text primary key check (id ~ '^h_[a-z0-9_-]{8,80}_[a-z0-9_-]{2,40}$'),
  hub_id text not null references public.hubs (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9_-]{2,24}$'),
  kind text not null default 'text' check (kind in ('text', 'broadcast')),
  topic text not null default '' check (char_length(topic) <= 120),
  created_at timestamptz not null default now(),
  unique (hub_id, name)
);

create table if not exists public.hub_members (
  hub_id text not null references public.hubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'mod', 'member')),
  joined_at timestamptz not null default now(),
  primary key (hub_id, user_id)
);

create table if not exists public.hub_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.hub_rooms (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  image text,
  sticker text,
  reply_to uuid references public.hub_messages (id) on delete set null,
  edited_at timestamptz,
  pinned boolean not null default false,
  reactions jsonb not null default '{}'::jsonb check (jsonb_typeof(reactions) = 'object'),
  created_at timestamptz not null default now(),
  constraint hub_message_content check (body <> '' or image is not null or sticker is not null),
  constraint hub_message_image_size check (image is null or char_length(image) <= 900000),
  constraint hub_message_image_format check (image is null or image ~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$')
);

create or replace function private.touch_hub_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.hubs set updated_at = now() where id = old.hub_id;
    return old;
  end if;
  update public.hubs set updated_at = now() where id = new.hub_id;
  return new;
end;
$$;

revoke all on function private.touch_hub_membership_change() from public, anon, authenticated;
drop trigger if exists touch_hub_membership_change on public.hub_members;
create trigger touch_hub_membership_change
  after insert or delete on public.hub_members
  for each row execute function private.touch_hub_membership_change();

create index if not exists hubs_public_created_idx on public.hubs (created_at desc) where is_public;
create index if not exists hub_members_user_idx on public.hub_members (user_id, hub_id);
create index if not exists hub_messages_room_created_idx on public.hub_messages (room_id, created_at desc);
alter table public.hub_messages replica identity full;

alter table public.hubs enable row level security;
alter table public.hub_rooms enable row level security;
alter table public.hub_members enable row level security;
alter table public.hub_messages enable row level security;

drop policy if exists "Members and public can discover hubs" on public.hubs;
create policy "Members and public can discover hubs" on public.hubs for select to authenticated
  using (is_public or owner_id = (select auth.uid()) or exists (
    select 1 from public.hub_members m where m.hub_id = hubs.id and m.user_id = (select auth.uid())
  ));

drop policy if exists "Members can read rooms" on public.hub_rooms;
create policy "Members can read rooms" on public.hub_rooms for select to authenticated
  using (exists (
    select 1 from public.hubs h where h.id = hub_rooms.hub_id and (
      h.is_public or h.owner_id = (select auth.uid()) or exists (
        select 1 from public.hub_members m where m.hub_id = h.id and m.user_id = (select auth.uid())
      )
    )
  ));

drop policy if exists "Users can view their hub memberships" on public.hub_members;
create policy "Users can view their hub memberships" on public.hub_members for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members can read room messages" on public.hub_messages;
create policy "Members can read room messages" on public.hub_messages for select to authenticated
  using (exists (
    select 1 from public.hub_rooms r join public.hub_members m on m.hub_id = r.hub_id
    where r.id = hub_messages.room_id and m.user_id = (select auth.uid())
  ));

revoke all on public.hubs, public.hub_rooms, public.hub_members, public.hub_messages from anon, authenticated;
grant select on public.hubs, public.hub_rooms, public.hub_members, public.hub_messages to authenticated;

create or replace function public.get_hub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  snapshot jsonb;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'name', h.name, 'about', h.about, 'emoji', h.emoji, 'hue', h.hue,
    'ownerId', h.owner_id, 'public', h.is_public, 'invite', h.invite_code, 'createdAt', extract(epoch from h.created_at) * 1000,
    'members', coalesce((select jsonb_object_agg(m.user_id::text, m.role) from public.hub_members m where m.hub_id = h.id), '{}'::jsonb),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'kind', r.kind, 'topic', r.topic) order by r.created_at, r.id) from public.hub_rooms r where r.hub_id = h.id), '[]'::jsonb),
    'remote', true
  ) order by h.created_at desc), '[]'::jsonb) into snapshot
  from public.hubs h
  where h.is_public or h.owner_id = current_user_id
    or exists (select 1 from public.hub_members m where m.hub_id = h.id and m.user_id = current_user_id);
  return snapshot;
end;
$$;

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

create or replace function public.join_public_hub(target_hub_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if not exists (select 1 from public.hubs where id = target_hub_id and is_public) then
    raise exception using errcode = 'P0002', message = 'Hub is unavailable';
  end if;
  insert into public.hub_members (hub_id, user_id, role) values (target_hub_id, auth.uid(), 'member')
  on conflict (hub_id, user_id) do nothing;
end;
$$;

create or replace function public.join_hub_by_invite(invite_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  found_hub_id text;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  select id into found_hub_id from public.hubs where invite_code = lower(btrim(invite_token));
  if found_hub_id is null then raise exception using errcode = 'P0002', message = 'Invite is unavailable'; end if;
  insert into public.hub_members (hub_id, user_id, role) values (found_hub_id, current_user_id, 'member')
  on conflict (hub_id, user_id) do nothing;
  return found_hub_id;
end;
$$;

create or replace function public.leave_hub(target_hub_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if exists (select 1 from public.hubs where id = target_hub_id and owner_id = auth.uid()) then
    raise exception using errcode = '22023', message = 'The owner cannot leave this hub';
  end if;
  delete from public.hub_members where hub_id = target_hub_id and user_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Hub membership not found'; end if;
end;
$$;

create or replace function public.add_hub_room(target_hub_id text, room_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_room text := lower(regexp_replace(btrim(room_name), '\s+', '-', 'g'));
  new_room_id text := target_hub_id || '_r_' || replace(gen_random_uuid()::text, '-', '');
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if clean_room !~ '^[a-z0-9_-]{2,24}$' then raise exception using errcode = '22023', message = 'Room name is invalid'; end if;
  if not exists (select 1 from public.hub_members where hub_id = target_hub_id and user_id = current_user_id and role in ('owner', 'mod')) then
    raise exception using errcode = '42501', message = 'Room creation is not allowed';
  end if;
  if (select count(*) from public.hub_rooms where hub_id = target_hub_id) >= 100 then raise exception using errcode = '54000', message = 'Room limit reached'; end if;
  insert into public.hub_rooms (id, hub_id, name) values (new_room_id, target_hub_id, clean_room);
  return new_room_id;
end;
$$;

create or replace function public.remove_hub_room(target_hub_id text, target_room_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if not exists (select 1 from public.hub_members where hub_id = target_hub_id and user_id = auth.uid() and role in ('owner', 'mod')) then
    raise exception using errcode = '42501', message = 'Room removal is not allowed';
  end if;
  if (select count(*) from public.hub_rooms where hub_id = target_hub_id) <= 1 then raise exception using errcode = '22023', message = 'The last room cannot be removed'; end if;
  delete from public.hub_rooms where id = target_room_id and hub_id = target_hub_id;
  if not found then raise exception using errcode = 'P0002', message = 'Room is unavailable'; end if;
end;
$$;

create or replace function public.send_hub_message(target_room_id text, message_body text, message_image text, message_sticker text, reply_id uuid)
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
  clean_body text := btrim(message_body);
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  select r.kind, m.role into room_kind, member_role
  from public.hub_rooms r join public.hub_members m on m.hub_id = r.hub_id and m.user_id = current_user_id
  where r.id = target_room_id;
  if not found then raise exception using errcode = '42501', message = 'Room is unavailable'; end if;
  if room_kind = 'broadcast' and member_role not in ('owner', 'mod') then raise exception using errcode = '42501', message = 'Posting is not allowed'; end if;
  if char_length(clean_body) > 4000 or (clean_body = '' and message_image is null and message_sticker is null)
    or (message_image is not null and (char_length(message_image) > 900000 or message_image !~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$'))
    or (message_sticker is not null and char_length(message_sticker) > 24) then
    raise exception using errcode = '22023', message = 'Message content is invalid';
  end if;
  if reply_id is not null and not exists (select 1 from public.hub_messages where id = reply_id and room_id = target_room_id) then
    raise exception using errcode = '22023', message = 'Reply target is unavailable';
  end if;
  insert into public.hub_messages (room_id, sender_id, body, image, sticker, reply_to)
  values (target_room_id, current_user_id, coalesce(clean_body, ''), message_image, message_sticker, reply_id)
  returning * into created_message;
  return created_message;
end;
$$;

create or replace function public.edit_hub_message(message_id uuid, new_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_body is null or btrim(new_body) = '' or char_length(new_body) > 4000 then raise exception using errcode = '22023', message = 'Message text is invalid'; end if;
  update public.hub_messages set body = btrim(new_body), edited_at = now()
  where id = message_id and sender_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Message is unavailable'; end if;
end;
$$;

create or replace function public.delete_hub_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.hub_messages where id = message_id and sender_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Message is unavailable'; end if;
end;
$$;

create or replace function public.toggle_hub_message_pin(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hub_messages set pinned = not pinned
  where id = message_id and exists (
    select 1 from public.hub_rooms r join public.hub_members m on m.hub_id = r.hub_id
    where r.id = hub_messages.room_id and m.user_id = auth.uid() and m.role in ('owner', 'mod')
  );
  if not found then raise exception using errcode = '42501', message = 'Pinning is not allowed'; end if;
end;
$$;

create or replace function public.toggle_hub_message_reaction(message_id uuid, emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reactions jsonb;
  current_users jsonb;
  current_user_text text := auth.uid()::text;
begin
  if emoji is null or char_length(emoji) > 24 then raise exception using errcode = '22023', message = 'Reaction is invalid'; end if;
  select reactions into current_reactions from public.hub_messages h
  where h.id = message_id and exists (
    select 1 from public.hub_rooms r join public.hub_members m on m.hub_id = r.hub_id
    where r.id = h.room_id and m.user_id = auth.uid()
  ) for update;
  if not found then raise exception using errcode = '42501', message = 'Reaction is not allowed'; end if;
  current_users := coalesce(current_reactions -> emoji, '[]'::jsonb);
  if current_users @> to_jsonb(array[current_user_text]) then current_users := current_users - current_user_text;
  else current_users := current_users || to_jsonb(array[current_user_text]); end if;
  if jsonb_array_length(current_users) = 0 then current_reactions := current_reactions - emoji;
  else current_reactions := jsonb_set(current_reactions, array[emoji], current_users, true); end if;
  update public.hub_messages set reactions = current_reactions where id = message_id;
end;
$$;

revoke all on function public.get_hub_snapshot() from public, anon;
revoke all on function public.create_hub(text, text, text, integer, boolean) from public, anon;
revoke all on function public.join_public_hub(text) from public, anon;
revoke all on function public.join_hub_by_invite(text) from public, anon;
revoke all on function public.leave_hub(text) from public, anon;
revoke all on function public.add_hub_room(text, text) from public, anon;
revoke all on function public.remove_hub_room(text, text) from public, anon;
revoke all on function public.send_hub_message(text, text, text, text, uuid) from public, anon;
revoke all on function public.edit_hub_message(uuid, text) from public, anon;
revoke all on function public.delete_hub_message(uuid) from public, anon;
revoke all on function public.toggle_hub_message_pin(uuid) from public, anon;
revoke all on function public.toggle_hub_message_reaction(uuid, text) from public, anon;
grant execute on function public.get_hub_snapshot() to authenticated;
grant execute on function public.create_hub(text, text, text, integer, boolean) to authenticated;
grant execute on function public.join_public_hub(text) to authenticated;
grant execute on function public.join_hub_by_invite(text) to authenticated;
grant execute on function public.leave_hub(text) to authenticated;
grant execute on function public.add_hub_room(text, text) to authenticated;
grant execute on function public.remove_hub_room(text, text) to authenticated;
grant execute on function public.send_hub_message(text, text, text, text, uuid) to authenticated;
grant execute on function public.edit_hub_message(uuid, text) to authenticated;
grant execute on function public.delete_hub_message(uuid) to authenticated;
grant execute on function public.toggle_hub_message_pin(uuid) to authenticated;
grant execute on function public.toggle_hub_message_reaction(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hubs') then alter publication supabase_realtime add table public.hubs; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hub_rooms') then alter publication supabase_realtime add table public.hub_rooms; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hub_members') then alter publication supabase_realtime add table public.hub_members; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hub_messages') then alter publication supabase_realtime add table public.hub_messages; end if;
  end if;
end
$$;
