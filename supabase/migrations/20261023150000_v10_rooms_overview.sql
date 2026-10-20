-- New Home screen (founder 2026-10-20): one call gives every Room with this period's numbers.
create function public.my_rooms_overview()
returns table (room_id uuid, name text, currency text, decimals smallint, role text, members int,
               cycle_id uuid, starts_on date, ends_on date, total bigint, my_paid bigint,
               my_share bigint, open_needs int, pending_requests int)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.room_id, m.role::text as role
      from public.room_members m
      join public.rooms r on r.id = m.room_id
     where m.user_id = auth.uid() and m.status = 'approved' and r.deleted_at is null
  ),
  cur as (
    select distinct on (c.room_id) c.room_id, c.id, c.starts_on, c.ends_on, c.currency, c.currency_decimals
      from public.cycles c join mine on mine.room_id = c.room_id
     where c.purged_at is null
     order by c.room_id, (c.status = 'open') desc, c.starts_on desc
  )
  select r.id, r.name, coalesce(cur.currency, r.currency)::text, coalesce(cur.currency_decimals, r.currency_decimals),
         mine.role,
         (select count(*)::int from public.room_members m where m.room_id = r.id and m.status = 'approved'),
         cur.id, cur.starts_on, cur.ends_on,
         coalesce((select sum(e.amount * public.expense_sign(e.is_credit)) from public.expenses e
                    where e.cycle_id = cur.id and e.deleted_at is null), 0)::bigint,
         coalesce((select sum(e.amount * public.expense_sign(e.is_credit)) from public.expenses e
                    where e.cycle_id = cur.id and e.deleted_at is null and e.paid_by = auth.uid()), 0)::bigint,
         coalesce((select sum(s.amount * public.expense_sign(e.is_credit)) from public.expenses e
                    join public.expense_splits s on s.expense_id = e.id
                    where e.cycle_id = cur.id and e.deleted_at is null and s.user_id = auth.uid()), 0)::bigint,
         (select count(*)::int from public.need_requests n
           where n.room_id = r.id and n.status in ('pending', 'accepted')),
         case when mine.role = 'admin'
              then (select count(*)::int from public.room_members m where m.room_id = r.id and m.status = 'pending')
              else 0 end
    from mine
    join public.rooms r on r.id = mine.room_id
    left join cur on cur.room_id = r.id
   order by r.created_at;
$$;
revoke execute on function public.my_rooms_overview() from public, anon;
grant execute on function public.my_rooms_overview() to authenticated;
