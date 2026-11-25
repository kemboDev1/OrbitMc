create table if not exists public.market_wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sparks integer not null default 300 check (sparks between 0 and 99999),
  daily_claimed_on date
);

create table if not exists public.market_listings (
  id text primary key check (id ~ '^[a-z0-9_-]{6,100}$'),
  seller_id uuid references public.profiles (id) on delete set null,
  seller_name text not null default '',
  kind text not null check (kind in ('theme', 'frame')),
  name text not null check (char_length(name) between 1 and 40),
  about text not null check (char_length(about) between 3 and 160),
  price integer not null check (price between 10 and 9999),
  design jsonb not null,
  sales integer not null default 0 check (sales >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint market_listing_design_object check (jsonb_typeof(design) = 'object')
);

create index if not exists market_listings_active_created_idx
  on public.market_listings (created_at desc) where active;
create index if not exists market_listings_seller_idx
  on public.market_listings (seller_id, created_at desc);

create table if not exists public.market_purchases (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  listing_id text not null references public.market_listings (id) on delete restrict,
  gifted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (buyer_id, listing_id)
);

alter table public.market_wallets enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_purchases enable row level security;

drop policy if exists "Users can view their market wallet" on public.market_wallets;
create policy "Users can view their market wallet"
  on public.market_wallets for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Everyone can view active shop listings" on public.market_listings;
create policy "Everyone can view active shop listings"
  on public.market_listings for select to authenticated
  using (active or seller_id = (select auth.uid()));

drop policy if exists "Users can view their purchases" on public.market_purchases;
create policy "Users can view their purchases"
  on public.market_purchases for select to authenticated
  using ((select auth.uid()) = buyer_id);

revoke all on public.market_wallets, public.market_listings, public.market_purchases from anon, authenticated;
grant select on public.market_wallets, public.market_listings, public.market_purchases to authenticated;

create or replace function private.initialize_market_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.market_wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.initialize_market_wallet() from public, anon, authenticated;
drop trigger if exists initialize_market_wallet on public.profiles;
create trigger initialize_market_wallet
  after insert on public.profiles
  for each row execute function private.initialize_market_wallet();

insert into public.market_wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.market_listings (id, seller_id, seller_name, kind, name, about, price, design, created_at)
values
  ('orbit_theme_nightglass', null, 'Orbit Studio', 'theme', 'Nightglass', 'A deep ink canvas with a crisp blue signal.', 180,
   '{"dark":true,"bg":"#10161C","panel":"#172129","raised":"#202D36","line":"#34444F","accent":"#70C7E5"}'::jsonb, '2026-01-01T00:00:00Z'),
  ('orbit_theme_sunroom', null, 'Orbit Studio', 'theme', 'Sunroom', 'Warm paper, soft stone and a clear coral accent.', 160,
   '{"dark":false,"bg":"#F4F2EC","panel":"#FBF9F4","raised":"#E9E6DC","line":"#D4D1C7","accent":"#D95742"}'::jsonb, '2026-01-02T00:00:00Z'),
  ('orbit_theme_mossline', null, 'Orbit Studio', 'theme', 'Mossline', 'A muted green palette with a quiet gold accent.', 170,
   '{"dark":true,"bg":"#121815","panel":"#1B241F","raised":"#26312A","line":"#39463D","accent":"#B6CA84"}'::jsonb, '2026-01-03T00:00:00Z'),
  ('orbit_frame_arc', null, 'Orbit Studio', 'frame', 'Arc frame', 'A clean two-tone orbit around your portrait.', 220,
   '{"colors":["#73C9E4","#B7E3EF"],"spin":false,"auraOnly":true}'::jsonb, '2026-01-04T00:00:00Z'),
  ('orbit_frame_ember', null, 'Orbit Studio', 'frame', 'Ember loop', 'A still copper ring with a small warm glint.', 200,
   '{"colors":["#E07A50","#F0BE79"],"spin":false,"auraOnly":true}'::jsonb, '2026-01-05T00:00:00Z')
on conflict (id) do nothing;

create or replace function public.get_market_snapshot()
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
  insert into public.market_wallets (user_id) values (current_user_id)
  on conflict (user_id) do nothing;
  select jsonb_build_object(
    'listings', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.market_listings l
      where l.active or l.seller_id = current_user_id
        or exists (select 1 from public.market_purchases p where p.buyer_id = current_user_id and p.listing_id = l.id)
    ), '[]'::jsonb),
    'wallet', (select to_jsonb(w) from public.market_wallets w where w.user_id = current_user_id),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from public.market_purchases p where p.buyer_id = current_user_id
    ), '[]'::jsonb),
    'gift_totals', coalesce((
      select jsonb_object_agg(g.buyer_id::text, g.gift_count)
      from (
        select buyer_id, count(*)::integer as gift_count
        from public.market_purchases where gifted_by is not null group by buyer_id
      ) g
    ), '{}'::jsonb)
  ) into snapshot;
  return snapshot;
end;
$$;

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
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  if item_kind not in ('theme', 'frame') or cleaned_name is null or char_length(cleaned_name) not between 1 and 40
    or cleaned_about is null or char_length(cleaned_about) not between 3 and 160
    or item_price not between 10 and 9999 or jsonb_typeof(item_design) <> 'object'
    or pg_column_size(item_design) > 2048 then
    raise exception using errcode = '22023', message = 'Listing details are invalid';
  end if;
  if (select count(*) from public.market_listings where seller_id = current_user_id and active) >= 10 then
    raise exception using errcode = '54000', message = 'Shop limit reached';
  end if;
  if item_kind = 'theme' and (
    jsonb_typeof(item_design->'dark') is distinct from 'boolean'
    or coalesce(item_design->>'bg', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(item_design->>'panel', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(item_design->>'raised', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(item_design->>'line', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(item_design->>'accent', '') !~ '^#[0-9A-Fa-f]{6}$'
  ) then raise exception using errcode = '22023', message = 'Theme colors are invalid'; end if;
  if item_kind = 'frame' and (
    jsonb_typeof(item_design->'colors') is distinct from 'array'
    or jsonb_array_length(item_design->'colors') not between 1 and 5
    or exists (select 1 from jsonb_array_elements_text(item_design->'colors') as color(value) where value !~ '^#[0-9A-Fa-f]{6}$')
    or jsonb_typeof(item_design->'spin') is distinct from 'boolean'
  ) then raise exception using errcode = '22023', message = 'Frame colors are invalid'; end if;
  insert into public.market_listings (id, seller_id, kind, name, about, price, design)
  values (item_id, current_user_id, item_kind, cleaned_name, cleaned_about, item_price, item_design);
  return item_id;
end;
$$;

create or replace function public.purchase_market_listing(item_id text, gift_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  item public.market_listings%rowtype;
  target_user_id uuid;
  price integer;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  target_user_id := coalesce(gift_to, current_user_id);
  if target_user_id = current_user_id and gift_to is not null then raise exception using errcode = '22023', message = 'Choose another account'; end if;
  select * into item from public.market_listings where id = item_id and active for update;
  if not found then raise exception using errcode = 'P0002', message = 'Item is unavailable'; end if;
  if item.seller_id = current_user_id then raise exception using errcode = '22023', message = 'You already made this item'; end if;
  if exists (select 1 from public.market_purchases where buyer_id = target_user_id and market_purchases.listing_id = item_id) then
    raise exception using errcode = '23505', message = 'Already in collection';
  end if;
  insert into public.market_wallets (user_id) values (current_user_id), (target_user_id)
  on conflict (user_id) do nothing;
  select sparks into price from public.market_wallets where user_id = current_user_id for update;
  if price < item.price then raise exception using errcode = 'P0001', message = 'Not enough credits'; end if;
  update public.market_wallets set sparks = sparks - item.price where user_id = current_user_id;
  insert into public.market_purchases (buyer_id, listing_id, gifted_by)
  values (target_user_id, item.id, case when target_user_id = current_user_id then null else current_user_id end);
  update public.market_listings set sales = sales + 1 where id = item.id;
  if item.seller_id is not null then
    update public.market_wallets set sparks = least(99999, sparks + floor(item.price * 0.85)::integer) where user_id = item.seller_id;
  end if;
end;
$$;

create or replace function public.claim_daily_market_sparks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  reward integer := 25;
  current_day date := (now() at time zone 'utc')::date;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  insert into public.market_wallets (user_id) values (current_user_id) on conflict (user_id) do nothing;
  update public.market_wallets
  set sparks = least(99999, sparks + reward), daily_claimed_on = current_day
  where user_id = current_user_id and (daily_claimed_on is null or daily_claimed_on < current_day);
  if not found then raise exception using errcode = '23505', message = 'Daily credits already collected'; end if;
  return reward;
end;
$$;

create or replace function public.remove_market_listing(listing_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  update public.market_listings set active = false
  where id = listing_id and seller_id = auth.uid() and active;
  if not found then raise exception using errcode = 'P0002', message = 'Item is unavailable'; end if;
end;
$$;

revoke all on function public.get_market_snapshot() from public, anon;
revoke all on function public.create_market_listing(text, text, text, integer, jsonb) from public, anon;
revoke all on function public.purchase_market_listing(text, uuid) from public, anon;
revoke all on function public.claim_daily_market_sparks() from public, anon;
revoke all on function public.remove_market_listing(text) from public, anon;
grant execute on function public.get_market_snapshot() to authenticated;
grant execute on function public.create_market_listing(text, text, text, integer, jsonb) to authenticated;
grant execute on function public.purchase_market_listing(text, uuid) to authenticated;
grant execute on function public.claim_daily_market_sparks() to authenticated;
grant execute on function public.remove_market_listing(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'market_listings') then
    alter publication supabase_realtime add table public.market_listings;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'market_wallets') then
    alter publication supabase_realtime add table public.market_wallets;
  end if;
end
$$;
