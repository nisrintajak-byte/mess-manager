-- v0.7 security self-audit fixes.
-- 1. The app never writes profiles directly (all changes go through RPCs), so signed-in users
--    lose the direct UPDATE grant. avatar_url in particular could have held any outside URL.
revoke update on public.profiles from authenticated, anon;

-- 2. Display names are shown to other members, in PDFs and in emails: remove invisible
--    control and text-direction characters (they can flip how a name or amount reads),
--    squeeze spaces, and never leave a name empty.
create function public.clean_display_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      left(
        btrim(regexp_replace(
          regexp_replace(coalesce(p, ''), '[\x01-\x1F\x7F-\x9F؜​‎‏‪-‮⁠⁦-⁩﻿]', '', 'g'),
          '\s+', ' ', 'g')),
        80),
      ''),
    'Member');
$$;

create function public.profiles_clean_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := public.clean_display_name(new.display_name);
  return new;
end;
$$;

create trigger profiles_clean_name
  before insert or update of display_name on public.profiles
  for each row execute function public.profiles_clean_name();

update public.profiles
   set display_name = public.clean_display_name(display_name)
 where display_name is distinct from public.clean_display_name(display_name);

revoke execute on function public.clean_display_name(text) from public, anon, authenticated;
revoke execute on function public.profiles_clean_name() from public, anon, authenticated;
