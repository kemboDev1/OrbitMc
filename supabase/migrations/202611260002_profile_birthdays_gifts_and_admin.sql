alter table public.profiles
  add column if not exists hide_gift_senders boolean not null default false,
  add column if not exists chat_font text not null default 'sans',
  add column if not exists message_effect text not null default 'none';

create or replace function public.set_my_birthday(
  next_birth_date text default null,
  next_visible boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  parsed_date date;
  cleaned text := nullif(btrim(next_birth_date), '');
  result_row private.user_private_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in first';
  end if;

  if cleaned is not null then
    if cleaned !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'Invalid birth date';
    end if;
    parsed_date := cleaned::date;
    if parsed_date > current_date or parsed_date < date '1900-01-01' then
      raise exception using errcode = '22023', message = 'Birth date out of range';
    end if;
  end if;

  insert into private.user_private_profiles (user_id, birth_date, birthday_visible, updated_at)
  values (current_user_id, parsed_date, coalesce(next_visible, false), now())
  on conflict (user_id) do update
    set birth_date = case when next_birth_date is null then private.user_private_profiles.birth_date else parsed_date end,
        birthday_visible = coalesce(next_visible, private.user_private_profiles.birthday_visible),
        updated_at = now()
  returning * into result_row;

  return jsonb_build_object(
    'birth_date', result_row.birth_date,
    'birthday_visible', result_row.birthday_visible
  );
end;
$$;
revoke all on function public.set_my_birthday(text, boolean) from public, anon;
grant execute on function public.set_my_birthday(text, boolean) to authenticated;

create or replace function public.get_my_birthday()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'birth_date', p.birth_date,
    'birthday_visible', coalesce(p.birthday_visible, false)
  )
  from private.user_private_profiles p
  where p.user_id = auth.uid();
$$;
revoke all on function public.get_my_birthday() from public, anon;
grant execute on function public.get_my_birthday() to authenticated;

create or replace function public.get_public_profile_details(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  priv private.user_private_profiles%rowtype;
  hide_senders boolean;
  gifts_json jsonb;
begin
  if caller_id is null then
    raise exception using errcode = '42501', message = 'Sign in first';
  end if;

  select * into target_profile from public.profiles where id = target_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  select * into priv from private.user_private_profiles where user_id = target_user_id;
  hide_senders := coalesce(target_profile.hide_gift_senders, false) and caller_id <> target_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'listing_id', mp.listing_id,
        'listing_name', ml.name,
        'listing_kind', ml.kind,
        'from_id', case when hide_senders then null else mp.gifted_by end,
        'from_username', case when hide_senders then null else sp.username end,
        'from_name', case when hide_senders then null else sp.display_name end,
        'created_at', mp.created_at
      )
      order by mp.created_at desc
    ),
    '[]'::jsonb
  )
  into gifts_json
  from public.market_purchases mp
  join public.market_listings ml on ml.id = mp.listing_id
  left join public.profiles sp on sp.id = mp.gifted_by
  where mp.buyer_id = target_user_id
    and mp.gifted_by is not null;

  return jsonb_build_object(
    'birth_date', case when caller_id = target_user_id or coalesce(priv.birthday_visible, false) then priv.birth_date else null end,
    'birthday_visible', coalesce(priv.birthday_visible, false),
    'hide_gift_senders', coalesce(target_profile.hide_gift_senders, false),
    'gifts', gifts_json
  );
end;
$$;
revoke all on function public.get_public_profile_details(uuid) from public, anon;
grant execute on function public.get_public_profile_details(uuid) to authenticated;

create or replace function public.admin_grant_sparks(target_user_id uuid, amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_balance integer;
begin
  if not public.is_orbit_owner() then
    raise exception using errcode = '42501', message = 'Owner only';
  end if;
  if amount is null or amount < -99999 or amount > 99999 then
    raise exception using errcode = '22023', message = 'Invalid amount';
  end if;

  insert into public.market_wallets (user_id, sparks)
  values (target_user_id, greatest(0, least(99999, 300 + amount)))
  on conflict (user_id) do update
    set sparks = greatest(0, least(99999, public.market_wallets.sparks + amount))
  returning sparks into next_balance;

  return next_balance;
end;
$$;
revoke all on function public.admin_grant_sparks(uuid, integer) from public, anon;
grant execute on function public.admin_grant_sparks(uuid, integer) to authenticated;

insert into public.market_listings (id, seller_id, seller_name, kind, name, about, price, design, featured, active)
values
  (
    'orbit_pack_signals',
    null,
    'Orbit Studio',
    'stickers',
    'Signal Badges',
    'Crisp vector chat badges crafted for clean reactions and status moments.',
    140,
    '{"stickers":["badge:rocket","badge:crown","badge:flame","badge:zap","badge:gem","badge:orbit"],"nameRu":"Набор сигналов","nameUz":"Signal nishonlari","aboutRu":"Четкие векторные бейджи для чатов и реакций.","aboutUz":"Chat va reaksiyalar uchun tiniq vektor nishonlar to‘plami."}'::jsonb,
    true,
    true
  ),
  (
    'orbit_pack_cosmos',
    null,
    'Orbit Studio',
    'stickers',
    'Cosmos Emblems',
    'Precision vector emblems with vibrant gradients built for Orbit+ creators.',
    180,
    '{"stickers":["badge:shield","badge:star","badge:award","badge:compass","badge:music","badge:heart"],"nameRu":"Эмблемы Космоса","nameUz":"Kosmos nishonlari","aboutRu":"Векторные эмблемы с яркими градиентами.","aboutUz":"Yorqin gradientli vektor emblemalar to‘plami."}'::jsonb,
    true,
    true
  )
on conflict (id) do update
  set design = excluded.design,
      featured = true,
      active = true;

update public.market_listings
set featured = true
where id in ('orbit_bundle_orchid', 'orbit_bundle_tidal', 'orbit_theme_nightglass', 'orbit_frame_aurora');
