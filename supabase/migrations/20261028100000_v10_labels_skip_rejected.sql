-- Same-name numbers (Lenovo1, Lenovo2) only count people who were in the Room. Someone whose
-- join request was rejected was never a member: before this, a rejected "Imran" who asked
-- first turned the real member into "Imran2". Pending requests still count (the Admin sees
-- them in the list), and leaving never changes a number.
create or replace function public.room_member_labels(p_room uuid)
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
    from public.room_members rm
    where rm.room_id = p_room and rm.status <> 'rejected'
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
