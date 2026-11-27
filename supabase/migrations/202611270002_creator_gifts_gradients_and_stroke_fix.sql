-- Allow null profile_stroke (remove unwanted default orange ring from non-custom accounts)
-- and allow creators to gift their own created Shop assets to other users without self-royalty exploit.

alter table public.profiles
  alter column profile_stroke drop not null,
  alter column profile_stroke drop default;

alter table public.profiles drop constraint if exists profiles_profile_stroke_format;
alter table public.profiles add constraint profiles_profile_stroke_format
  check (profile_stroke is null or profile_stroke ~ '^#[0-9A-Fa-f]{6}$');

update public.profiles
set profile_stroke = null
where profile_stroke = '#ff5b2e';

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
  current_sparks integer;
  owner_free boolean;
  is_creator_gift boolean;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'Sign in first'; end if;
  target_user_id := coalesce(gift_to, current_user_id);
  if target_user_id = current_user_id and gift_to is not null then raise exception using errcode = '22023', message = 'Choose another account'; end if;
  select exists (select 1 from private.orbit_admin_users a where a.user_id = current_user_id) into owner_free;
  select * into item from public.market_listings where id = item_id and active for update;
  if not found then raise exception using errcode = 'P0002', message = 'Item is unavailable'; end if;
  if gift_to is null and item.seller_id = current_user_id then
    raise exception using errcode = '22023', message = 'You already made this item';
  end if;
  is_creator_gift := (gift_to is not null and item.seller_id = current_user_id);
  if exists (select 1 from public.market_purchases where buyer_id = target_user_id and market_purchases.listing_id = item_id) then
    raise exception using errcode = '23505', message = 'Already in collection';
  end if;
  insert into public.market_wallets (user_id) values (current_user_id), (target_user_id)
  on conflict (user_id) do nothing;
  if not owner_free then
    select sparks into current_sparks from public.market_wallets where user_id = current_user_id for update;
    if current_sparks < item.price then raise exception using errcode = 'P0001', message = 'Not enough credits'; end if;
    update public.market_wallets set sparks = sparks - item.price where user_id = current_user_id;
  end if;
  insert into public.market_purchases (buyer_id, listing_id, gifted_by)
  values (target_user_id, item.id, case when target_user_id = current_user_id then null else current_user_id end);
  update public.market_listings set sales = sales + 1 where id = item.id;
  if not owner_free and not is_creator_gift and item.seller_id is not null and item.seller_id <> current_user_id then
    update public.market_wallets set sparks = least(99999, sparks + floor(item.price * 0.85)::integer) where user_id = item.seller_id;
  end if;
end;
$$;
revoke all on function public.purchase_market_listing(text, uuid) from public, anon;
grant execute on function public.purchase_market_listing(text, uuid) to authenticated;
