-- Room limit per account (founder 2026-10-28): free accounts can be in at most 2 Rooms, Mess
-- Manager Plus (the paid plan, which also removes ads) up to 10. A Room counts while the member
-- is in it or waiting to join (approved or pending); Rooms they left, were removed from or were
-- rejected by don't count, nor do deleted Rooms. People already over the limit keep their Rooms;
-- they just can't create or join another one.

create or replace function public.room_limit_for(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when public.ad_free_until(p_user) is not null then 10 else 2 end;
$$;

create or replace function public.rooms_in_use(p_user uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(distinct rm.room_id)::int
  from public.room_members rm join public.rooms r on r.id = rm.room_id
  where rm.user_id = p_user and rm.status in ('pending', 'approved') and r.deleted_at is null;
$$;

-- App: how many Rooms I use, my limit, and whether I have Plus.
create or replace function public.my_room_allowance()
returns table (used int, room_limit int, plus boolean)
language sql stable security definer set search_path = '' as $$
  select public.rooms_in_use(auth.uid()), public.room_limit_for(auth.uid()),
         public.ad_free_until(auth.uid()) is not null;
$$;

-- Checked when a member creates a Room or asks to join one (both insert their own row).
-- Rows written by the server for someone else (tests, support) are not limited.
create or replace function public.enforce_room_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('pending', 'approved') and new.user_id = auth.uid()
     and public.rooms_in_use(new.user_id) >= public.room_limit_for(new.user_id) then
    if public.ad_free_until(new.user_id) is not null then
      raise exception 'room_limit_max' using errcode = '23514';
    end if;
    raise exception 'room_limit_free' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists room_members_limit on public.room_members;
create trigger room_members_limit before insert on public.room_members
  for each row execute function public.enforce_room_limit();

revoke execute on function public.room_limit_for(uuid) from public, anon, authenticated;
revoke execute on function public.rooms_in_use(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_room_limit() from public, anon, authenticated;
revoke execute on function public.my_room_allowance() from public, anon;
grant execute on function public.my_room_allowance() to authenticated;
