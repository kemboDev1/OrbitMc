alter table public.market_listings
  drop constraint if exists market_listings_kind_check;

alter table public.market_listings
  add constraint market_listings_kind_check check (kind in ('theme', 'frame', 'bundle', 'stickers'));

alter table public.market_listings
  add column if not exists featured boolean not null default false;

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
  if item_kind not in ('theme', 'frame', 'bundle', 'stickers')
    or cleaned_name is null or char_length(cleaned_name) not between 1 and 40
    or cleaned_about is null or char_length(cleaned_about) not between 3 and 160
    or item_price not between 10 and 9999 or jsonb_typeof(item_design) <> 'object'
    or pg_column_size(item_design) > 2048 then
    raise exception using errcode = '22023', message = 'Listing details are invalid';
  end if;
  if (select count(*) from public.market_listings where seller_id = current_user_id and active) >= 12 then
    raise exception using errcode = '54000', message = 'Shop limit reached';
  end if;

  if item_kind = 'stickers' then
    if jsonb_typeof(item_design->'stickers') is distinct from 'array'
      or jsonb_array_length(item_design->'stickers') not between 6 and 12
      or exists (
        select 1 from jsonb_array_elements_text(item_design->'stickers') as st(value)
        where char_length(btrim(st.value)) not between 1 and 24
      ) then
      raise exception using errcode = '22023', message = 'Sticker pack is invalid';
    end if;
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

create or replace function public.admin_toggle_listing_featured(listing_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_featured boolean;
begin
  if not public.is_orbit_owner() then
    raise exception using errcode = '42501', message = 'Not authorized';
  end if;
  update public.market_listings
  set featured = not featured
  where id = listing_id
  returning featured into next_featured;
  if not found then
    raise exception using errcode = 'P0002', message = 'Listing not found';
  end if;
  return next_featured;
end;
$$;

revoke all on function public.admin_toggle_listing_featured(text) from public, anon;
grant execute on function public.admin_toggle_listing_featured(text) to authenticated;
