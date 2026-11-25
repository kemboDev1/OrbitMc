alter table public.profiles
  add column if not exists banner text,
  add column if not exists profile_stroke text not null default '#ff5b2e';

alter table public.profiles drop constraint if exists profiles_banner_format;
alter table public.profiles add constraint profiles_banner_format
  check (banner is null or (char_length(banner) <= 320000 and banner ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'));
alter table public.profiles drop constraint if exists profiles_profile_stroke_format;
alter table public.profiles add constraint profiles_profile_stroke_format
  check (profile_stroke ~ '^#[0-9A-Fa-f]{6}$');

grant update (banner, profile_stroke) on public.profiles to authenticated;
