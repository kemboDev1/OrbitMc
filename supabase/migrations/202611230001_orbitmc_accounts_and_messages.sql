create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_]{2,18}[a-z0-9]$'),
  display_name text not null check (char_length(display_name) between 2 and 32),
  bio text not null default '' check (char_length(bio) <= 160),
  hue smallint not null default 210 check (hue between 0 and 360),
  avatar text,
  presence text not null default 'offline' check (presence in ('online', 'idle', 'dnd', 'offline')),
  status_text text not null default '' check (char_length(status_text) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  image text,
  sticker text,
  reply_to uuid references public.direct_messages (id) on delete set null,
  edited_at timestamptz,
  pinned boolean not null default false,
  reactions jsonb not null default '{}'::jsonb check (jsonb_typeof(reactions) = 'object'),
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id),
  constraint direct_messages_content check (body <> '' or image is not null or sticker is not null),
  constraint direct_messages_image_size check (image is null or char_length(image) <= 900000)
);

create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);
create index if not exists direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages"
  on public.direct_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send direct messages as themselves" on public.direct_messages;
create policy "Users can send direct messages as themselves"
  on public.direct_messages for insert to authenticated
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

drop policy if exists "Senders can delete their direct messages" on public.direct_messages;
create policy "Senders can delete their direct messages"
  on public.direct_messages for delete to authenticated using (auth.uid() = sender_id);

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.direct_messages to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text := lower(new.raw_user_meta_data ->> 'username');
  chosen_name text := btrim(new.raw_user_meta_data ->> 'display_name');
begin
  if chosen_username is null or chosen_username !~ '^[a-z0-9][a-z0-9_]{2,18}[a-z0-9]$' then
    raise exception 'A valid username is required';
  end if;
  if chosen_name is null or char_length(chosen_name) not between 2 and 32 then
    raise exception 'A valid display name is required';
  end if;

  insert into public.profiles (id, username, display_name, hue)
  values (
    new.id,
    chosen_username,
    chosen_name,
    floor(random() * 360)::smallint
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.edit_direct_message(message_id uuid, new_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_body is null or btrim(new_body) = '' or char_length(new_body) > 4000 then
    raise exception 'Invalid message text';
  end if;
  update public.direct_messages
  set body = btrim(new_body), edited_at = now()
  where id = message_id and sender_id = auth.uid();
  if not found then raise exception 'Message not found or not owned by user'; end if;
end;
$$;

create or replace function public.delete_direct_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.direct_messages where id = message_id and sender_id = auth.uid();
  if not found then raise exception 'Message not found or not owned by user'; end if;
end;
$$;

create or replace function public.toggle_direct_message_reaction(message_id uuid, emoji text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reactions jsonb;
  current_users jsonb;
  user_id text := auth.uid()::text;
begin
  if emoji is null or char_length(emoji) > 24 then raise exception 'Invalid reaction'; end if;
  select reactions into current_reactions
  from public.direct_messages
  where id = message_id and (sender_id = auth.uid() or recipient_id = auth.uid())
  for update;
  if not found then raise exception 'Message not found'; end if;

  current_users := coalesce(current_reactions -> emoji, '[]'::jsonb);
  if current_users @> to_jsonb(array[user_id]) then
    current_users := current_users - user_id;
  else
    current_users := current_users || to_jsonb(user_id);
  end if;
  if jsonb_array_length(current_users) = 0 then
    current_reactions := current_reactions - emoji;
  else
    current_reactions := jsonb_set(current_reactions, array[emoji], current_users, true);
  end if;
  update public.direct_messages set reactions = current_reactions where id = message_id;
end;
$$;

create or replace function public.toggle_direct_message_pin(message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.direct_messages
  set pinned = not pinned
  where id = message_id and (sender_id = auth.uid() or recipient_id = auth.uid());
  if not found then raise exception 'Message not found'; end if;
end;
$$;

revoke all on function public.edit_direct_message(uuid, text) from public, anon;
revoke all on function public.delete_direct_message(uuid) from public, anon;
revoke all on function public.toggle_direct_message_reaction(uuid, text) from public, anon;
revoke all on function public.toggle_direct_message_pin(uuid) from public, anon;
grant execute on function public.edit_direct_message(uuid, text) to authenticated;
grant execute on function public.delete_direct_message(uuid) to authenticated;
grant execute on function public.toggle_direct_message_reaction(uuid, text) to authenticated;
grant execute on function public.toggle_direct_message_pin(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'direct_messages'
    ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end
$$;
