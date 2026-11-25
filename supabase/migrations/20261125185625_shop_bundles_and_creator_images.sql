alter table public.market_listings drop constraint if exists market_listings_kind_check;
alter table public.market_listings add constraint market_listings_kind_check
  check (kind in ('theme', 'frame', 'bundle'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-assets', 'market-assets', true, 2621440, array['image/jpeg']::text[])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Shop creators upload their own designs" on storage.objects;
create policy "Shop creators upload their own designs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'market-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  );

create or replace function public.create_market_listing(
  item_kind text,
  item_name text,
  item_about text,
  item_price integer,
  item_design jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  item_id text := 'm_' || replace(gen_random_uuid()::text, '-', '');
  cleaned_name text := btrim(item_name);
  cleaned_about text := btrim(item_about);
  theme_design jsonb;
  frame_design jsonb;
  image_path text;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if item_kind not in ('theme', 'frame', 'bundle') or cleaned_name is null or char_length(cleaned_name) not between 1 and 40
    or cleaned_about is null or char_length(cleaned_about) not between 3 and 160
    or item_price not between 10 and 9999 or jsonb_typeof(item_design) <> 'object'
    or pg_column_size(item_design) > 2048 then
    raise exception using errcode = '22023', message = 'Listing details are invalid';
  end if;
  if (select count(*) from public.market_listings where seller_id = current_user_id and active) >= 10 then
    raise exception using errcode = '54000', message = 'Shop limit reached';
  end if;

  theme_design := case when item_kind = 'bundle' then item_design->'theme' else item_design end;
  frame_design := case when item_kind = 'bundle' then item_design->'frame' else item_design end;
  image_path := case when item_kind = 'bundle' then item_design->'theme'->>'image' else item_design->>'image' end;
  if item_kind in ('theme', 'bundle') and (
    jsonb_typeof(theme_design) is distinct from 'object'
    or jsonb_typeof(theme_design->'dark') is distinct from 'boolean'
    or coalesce(theme_design->>'bg', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(theme_design->>'panel', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(theme_design->>'raised', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(theme_design->>'line', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(theme_design->>'accent', '') !~ '^#[0-9A-Fa-f]{6}$'
  ) then raise exception using errcode = '22023', message = 'Theme colors are invalid'; end if;

  if item_kind in ('frame', 'bundle') then
    if jsonb_typeof(frame_design) is distinct from 'object'
      or jsonb_typeof(frame_design->'spin') is distinct from 'boolean' then
      raise exception using errcode = '22023', message = 'Frame colors are invalid';
    end if;
    if jsonb_typeof(frame_design->'colors') is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Frame colors are invalid';
    end if;
    if jsonb_array_length(frame_design->'colors') not between 1 and 5
      or exists (select 1 from jsonb_array_elements_text(frame_design->'colors') as color(value) where value !~ '^#[0-9A-Fa-f]{6}$') then
      raise exception using errcode = '22023', message = 'Frame colors are invalid';
    end if;
  end if;
  if image_path is not null and (item_kind not in ('theme', 'bundle')
    or image_path !~ ('^' || current_user_id::text || '/[0-9a-f-]{36}\.jpg$')) then
    raise exception using errcode = '22023', message = 'Shop image is invalid';
  end if;

  insert into public.market_listings (id, seller_id, kind, name, about, price, design)
  values (item_id, current_user_id, item_kind, cleaned_name, cleaned_about, item_price, item_design);
  return item_id;
end;
$$;
revoke all on function public.create_market_listing(text, text, text, integer, jsonb) from public, anon;
grant execute on function public.create_market_listing(text, text, text, integer, jsonb) to authenticated;

create or replace function public.update_hub_details(
  target_hub_id text,
  next_name text,
  next_about text,
  next_emoji text,
  next_hue integer,
  next_public boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := btrim(regexp_replace(next_name, '\s+', ' ', 'g'));
  clean_about text := btrim(next_about);
  clean_emoji text := left(btrim(next_emoji), 4);
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if clean_name is null or clean_about is null or clean_emoji is null or next_hue is null
    or char_length(clean_name) not between 2 and 40 or char_length(clean_about) > 160
    or char_length(clean_emoji) not between 1 and 4 or next_hue not between 0 and 360
    or next_public is null then raise exception using errcode = '22023', message = 'Community details are invalid'; end if;
  update public.hubs set name = clean_name, about = clean_about, emoji = clean_emoji,
    hue = next_hue, is_public = next_public, updated_at = now()
  where id = target_hub_id and owner_id = current_user_id;
  if not found then raise exception using errcode = '42501', message = 'Only the community owner can update settings'; end if;
end;
$$;
revoke all on function public.update_hub_details(text, text, text, text, integer, boolean) from public, anon;
grant execute on function public.update_hub_details(text, text, text, text, integer, boolean) to authenticated;
