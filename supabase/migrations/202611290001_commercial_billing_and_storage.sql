-- Commercial Billing, Cross-Device Cosmetics/Subscription Sync & Supabase Storage Uploads

alter table public.profiles
  add column if not exists aura_tier text check (aura_tier in ('ember', 'flare', 'nova')),
  add column if not exists aura_cycle text check (aura_cycle in ('month', 'year')),
  add column if not exists aura_renews_at timestamptz,
  add column if not exists equipped_frame text,
  add column if not exists equipped_theme text,
  add column if not exists equipped_stickers text,
  add column if not exists chat_font text not null default 'sans' check (chat_font in ('sans', 'display', 'mono', 'serif')),
  add column if not exists message_effect text not null default 'none' check (message_effect in ('none', 'glow', 'aurora', 'ember'));

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('aura', 'sparks')),
  tier text check (tier in ('ember', 'flare', 'nova')),
  cycle text check (cycle in ('month', 'year')),
  sparks_amount integer not null default 0 check (sparks_amount >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  provider text not null check (provider in ('stripe', 'lemonsqueezy', 'click', 'payme', 'sandbox')),
  provider_session_id text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.billing_orders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'billing_orders' and policyname = 'Users read own billing orders') then
    create policy "Users read own billing orders"
      on public.billing_orders for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;

-- Configure uploads bucket limits and scoped Storage policies
update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac'
    ]
where id = 'uploads';

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read uploads') then
    create policy "Public read uploads"
      on storage.objects for select
      to public
      using (bucket_id = 'uploads');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated upload own folder') then
    create policy "Authenticated upload own folder"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated update own folder') then
    create policy "Authenticated update own folder"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated delete own folder') then
    create policy "Authenticated delete own folder"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

-- Widen banner / media format constraints to allow Supabase Storage URLs, gradients, and frames
alter table public.profiles drop constraint if exists profiles_banner_format;
alter table public.profiles
  add constraint profiles_banner_format check (
    banner is null
    or banner ~ '^grad:[a-z0-9_-]{2,40}$'
    or banner ~ '^frame:[a-z0-9_-]{4,100}$'
    or (char_length(banner) <= 500 and banner ~ '^https://[a-z0-9.-]+/storage/v1/object/public/uploads/[a-zA-Z0-9/_.-]+$')
    or (char_length(banner) <= 320000 and banner ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')
  );

alter table public.direct_messages drop constraint if exists direct_messages_image_format;
alter table public.direct_messages
  add constraint direct_messages_image_format check (
    image is null
    or (char_length(image) <= 500 and image ~ '^https://[a-z0-9.-]+/storage/v1/object/public/uploads/[a-zA-Z0-9/_.-]+$')
    or image ~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$'
  );

alter table public.hub_messages drop constraint if exists hub_message_image_format;
alter table public.hub_messages
  add constraint hub_message_image_format check (
    image is null
    or (char_length(image) <= 500 and image ~ '^https://[a-z0-9.-]+/storage/v1/object/public/uploads/[a-zA-Z0-9/_.-]+$')
    or image ~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$'
  );

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
  storage_re text := '^https://[a-z0-9.-]+/storage/v1/object/public/uploads/[a-zA-Z0-9/_.-]+$';
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
    or (message_image is not null and not (
      (char_length(message_image) <= 500 and message_image ~ storage_re)
      or (char_length(message_image) <= 900000 and message_image ~ '^data:image/(jpeg|gif);base64,[A-Za-z0-9+/=]+$')
    ))
    or (message_audio is not null and not (
      (char_length(message_audio) <= 500 and message_audio ~ storage_re)
      or (char_length(message_audio) <= 900000 and message_audio ~* '^data:audio/(webm|mp4|ogg|mpeg|wav|aac)(;\s*codecs=[^;]+)?;base64,[A-Za-z0-9+/=]+$')
    ))
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

grant select on public.billing_orders to authenticated;
grant execute on function public.send_hub_message(text, text, text, text, uuid, text) to authenticated;

notify pgrst, 'reload schema';
