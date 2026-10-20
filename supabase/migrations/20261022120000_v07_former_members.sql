-- Former members are shown to everyone in the Room (founder 2026-10-20): who left or was removed,
-- when, and by whom — so expenses of people no longer in the Room are never a mystery.

create function public.room_former_members(p_room uuid)
returns table (user_id uuid, status text, joined_on date, left_on date, removed_by uuid, removed_by_name text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select distinct on (m.user_id) m.user_id, m.status::text, m.joined_on, m.left_on,
         case when m.status = 'removed' then m.decided_by end,
         case when m.status = 'removed' then public.display_name(m.decided_by) end
  from public.room_members m
  where m.room_id = p_room and m.status in ('left', 'removed')
    and not exists (select 1 from public.room_members c
                     where c.room_id = p_room and c.user_id = m.user_id and c.status in ('approved', 'pending'))
  order by m.user_id, coalesce(m.left_on, m.decided_at::date) desc nulls last, m.requested_at desc;
end;
$$;

revoke execute on function public.room_former_members(uuid) from public, anon;
grant execute on function public.room_former_members(uuid) to authenticated;
