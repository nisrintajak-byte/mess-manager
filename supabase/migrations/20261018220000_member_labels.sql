-- Founder decision 2026-10-18: identical display names inside a Room get a join-order number
-- (Lenovo1, Lenovo2, Lenovo3). Unique names stay unchanged. Computed on the server so every
-- member sees the same labels; order = first time the person asked to join this Room, so a
-- number never changes when someone leaves.
create function public.room_member_labels(p_room uuid)
returns table (user_id uuid, label text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_room_member(p_room) and not exists (
       select 1 from public.room_members where room_id = p_room and user_id = auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with firsts as (
    select rm.user_id, min(rm.requested_at) as first_at
    from public.room_members rm where rm.room_id = p_room
    group by rm.user_id
  ),
  named as (
    select f.user_id, f.first_at, trim(p.display_name) as name, lower(trim(p.display_name)) as k
    from firsts f join public.profiles p on p.id = f.user_id
  ),
  numbered as (
    select n.user_id, n.name,
           row_number() over (partition by n.k order by n.first_at, n.user_id) as num,
           count(*) over (partition by n.k) as dupes
    from named n
  )
  select x.user_id, case when x.dupes > 1 then x.name || x.num::text else x.name end
  from numbered x;
end;
$$;

revoke execute on function public.room_member_labels(uuid) from public, anon;
grant execute on function public.room_member_labels(uuid) to authenticated;
