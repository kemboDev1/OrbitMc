alter table public.profiles drop constraint if exists profiles_profile_tags_format;
alter table public.profiles add constraint profiles_profile_tags_format
  check (cardinality(profile_tags) <= 5 and array_position(profile_tags, null) is null
    and (cardinality(profile_tags) = 0 or array_to_string(profile_tags, ',') ~ '^([[:alnum:] _-]{1,20})(,[[:alnum:] _-]{1,20}){0,4}$'));
drop function if exists private.valid_profile_tags(text[]);
