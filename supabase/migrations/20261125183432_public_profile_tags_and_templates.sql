alter table public.profiles
  add column if not exists profile_tags text[] not null default '{}',
  add column if not exists profile_template text not null default 'clean';

create or replace function private.valid_profile_tags(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(tags) <= 5 and array_position(tags, null) is null
    and coalesce(bool_and(char_length(tag) between 1 and 20 and tag ~ '^[[:alnum:] _-]+$'), true), false)
  from unnest(tags) as tag;
$$;
revoke all on function private.valid_profile_tags(text[]) from public, anon, authenticated;

alter table public.profiles drop constraint if exists profiles_profile_tags_format;
alter table public.profiles add constraint profiles_profile_tags_format
  check (private.valid_profile_tags(profile_tags));
alter table public.profiles drop constraint if exists profiles_profile_template_value;
alter table public.profiles add constraint profiles_profile_template_value
  check (profile_template in ('clean', 'halo', 'frame'));

grant update (profile_tags, profile_template) on public.profiles to authenticated;
