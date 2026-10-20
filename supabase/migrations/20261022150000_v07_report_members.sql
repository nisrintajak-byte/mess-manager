-- Reports list every member of the period (role, status, paid, share) and mark people who
-- left or were removed (founder 2026-10-20: a removed member must be visible as removed).
create or replace function public.report_data_internal(p_user uuid, p_room uuid, p_cycle uuid, p_scope text,
                                            p_from date default null, p_to date default null,
                                            p_channel text default 'app') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  v_mine boolean := p_scope = 'mine';
  v_cycles uuid[];
  v_exp uuid[];
  v_lines uuid[];
  v_out jsonb;
  v_from date;
  v_to date;
begin
  select * into r from public.rooms where id = p_room;
  if r.id is null then
    raise exception 'not_found' using errcode = '02000';
  end if;
  select array_agg(c.id order by c.starts_on) into v_cycles from public.cycles c
   where c.room_id = p_room and c.purged_at is null
     and (p_cycle is null or c.id = p_cycle)
     and (p_from is null or c.ends_on >= p_from)
     and (p_to is null or c.starts_on <= p_to);
  v_cycles := coalesce(v_cycles, '{}');
  select min(starts_on), max(ends_on) into v_from, v_to from public.cycles where id = any (v_cycles);
  v_from := greatest(v_from, p_from);
  v_to := least(v_to, p_to);

  select array_agg(e.id) into v_exp from public.expenses e
   where e.room_id = p_room and e.cycle_id = any (v_cycles)
     and (p_from is null or e.expense_date >= p_from)
     and (p_to is null or e.expense_date <= p_to)
     and (not v_mine or e.paid_by = p_user or e.created_by = p_user
          or exists (select 1 from public.expense_splits s where s.expense_id = e.id and s.user_id = p_user));
  v_exp := coalesce(v_exp, '{}');

  select array_agg(l.id) into v_lines from public.settlement_lines l
    join public.settlements s on s.id = l.settlement_id
   where s.cycle_id = any (v_cycles) and (not v_mine or l.user_id = p_user);
  v_lines := coalesce(v_lines, '{}');

  select jsonb_build_object(
    'ref', public.new_report_ref(p_user, p_room, p_scope, p_channel),
    'generated_at', now(),
    'scope', p_scope,
    'requester', p_user,
    'room', jsonb_build_object('name', r.name, 'currency', r.currency, 'decimals', r.currency_decimals,
                               'time_zone', r.time_zone),
    'period', jsonb_build_object('from', v_from, 'to', v_to),
    'people', coalesce((select jsonb_object_agg(l.user_id, jsonb_build_object(
                            'name', l.label, 'deleted', l.deleted,
                            'role', ms.role, 'status', ms.status, 'joined_on', ms.joined_on,
                            'left_on', ms.left_on))
                          from public.member_labels_for(p_room) l
                          left join lateral (
                            select m.role, m.status, m.joined_on,
                                   case when m.status in ('left', 'removed') then m.left_on end as left_on
                              from public.room_members m
                             where m.room_id = p_room and m.user_id = l.user_id
                             order by (m.status in ('approved', 'pending')) desc, m.requested_at desc
                             limit 1) ms on true), '{}'::jsonb),
    -- Everyone who was in the Room during the period, with what they paid and their share
    -- (the same numbers every member sees on the Balances tab), whatever the report's scope.
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'paid', x.paid, 'share', x.share)
                                          order by x.first_at)
                           from (select l.user_id,
                                        (select min(m.requested_at) from public.room_members m
                                          where m.room_id = p_room and m.user_id = l.user_id) as first_at,
                                        coalesce((select sum(e.amount * public.expense_sign(e.is_credit))
                                                    from public.expenses e
                                                   where e.room_id = p_room and e.cycle_id = any (v_cycles)
                                                     and e.deleted_at is null and e.paid_by = l.user_id
                                                     and (p_from is null or e.expense_date >= p_from)
                                                     and (p_to is null or e.expense_date <= p_to)), 0) as paid,
                                        coalesce((select sum(s.amount * public.expense_sign(e.is_credit))
                                                    from public.expenses e
                                                    join public.expense_splits s on s.expense_id = e.id
                                                   where e.room_id = p_room and e.cycle_id = any (v_cycles)
                                                     and e.deleted_at is null and s.user_id = l.user_id
                                                     and (p_from is null or e.expense_date >= p_from)
                                                     and (p_to is null or e.expense_date <= p_to)), 0) as share
                                   from public.member_labels_for(p_room) l
                                  where exists (select 1 from public.room_members m
                                                 where m.room_id = p_room and m.user_id = l.user_id
                                                   and m.status in ('approved', 'left', 'removed')
                                                   and (v_to is null or m.joined_on <= v_to)
                                                   and (v_from is null or m.left_on is null or m.left_on >= v_from))) x
                        ),
                        '[]'::jsonb),
    'cycles', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', c.id, 'starts_on', c.starts_on, 'ends_on', c.ends_on, 'status', c.status,
                 'locked_at', c.locked_at, 'currency', c.currency, 'decimals', c.currency_decimals,
                 'delete_on', public.cycle_purge_on(c.id)) order by c.starts_on)
               from public.cycles c where c.id = any (v_cycles)), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', e.id, 'cycle_id', e.cycle_id, 'date', e.expense_date, 'title', e.title,
                 'amount', e.amount * public.expense_sign(e.is_credit), 'currency', e.currency,
                 'paid_by', e.paid_by, 'created_by', e.created_by, 'created_at', e.created_at,
                 'notes', e.notes, 'deleted', e.deleted_at is not null, 'adjustment', e.adjusts_expense_id is not null
                                                                       or e.adjusts_purged,
                 'late_entry_from', e.late_entry_from, 'has_receipt', e.receipt_path is not null,
                 'my_share', (select s.amount * public.expense_sign(e.is_credit) from public.expense_splits s
                               where s.expense_id = e.id and s.user_id = p_user),
                 'participants', (select count(*) from public.expense_splits s where s.expense_id = e.id))
                 order by e.expense_date, e.created_at)
               from public.expenses e where e.id = any (v_exp)), '[]'::jsonb),
    'settlements', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', s.id, 'cycle_id', s.cycle_id, 'total', s.total, 'currency', s.currency,
                 'decimals', s.currency_decimals, 'generated_at', s.generated_at,
                 'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                             'user_id', l.user_id, 'share', l.share, 'paid', l.paid, 'net', l.net,
                             'confirmed', public.line_confirmed(l.id), 'awaiting', public.line_awaiting(l.id))
                             order by l.net), '[]'::jsonb)
                           from public.settlement_lines l where l.settlement_id = s.id and l.id = any (v_lines)))
                 order by s.generated_at)
               from public.settlements s where s.cycle_id = any (v_cycles)), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'payer', p.payer_id, 'amount', p.amount, 'currency', p.currency,
                 'method', p.method, 'reference', p.reference, 'has_proof', p.proof_path is not null,
                 'status', p.status, 'claimed_at', p.claimed_at, 'decided_by', p.decided_by,
                 'decided_at', p.decided_at, 'reject_reason', p.reject_reason)
                 order by p.claimed_at)
               from public.payments p
              where p.settlement_line_id = any (v_lines)), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', f.id, 'target_type', f.target_type, 'target_id', f.target_id, 'reason', f.reason,
                 'note', f.note, 'status', f.status, 'raised_by', f.raised_by, 'created_at', f.created_at,
                 'resolved_by', f.resolved_by, 'resolved_at', f.resolved_at, 'resolution_note', f.resolution_note)
                 order by f.created_at)
               from public.flags f
              where f.room_id = p_room
                and (f.target_id = any (v_exp) or f.target_id = any (v_lines)
                     or f.target_id in (select p.id from public.payments p where p.settlement_line_id = any (v_lines)))
                and (not v_mine or f.raised_by = p_user or f.target_owner = p_user)), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
                 'at', a.created_at, 'entity', a.entity_type, 'action', a.action, 'actor', a.actor_id,
                 'title', coalesce(a.new_value ->> 'title', a.new_value ->> 'name')) order by a.created_at)
               from (select * from public.audit_log a
                      where a.room_id = p_room
                        and (a.entity_id = any (v_exp) or a.entity_id = any (v_cycles)
                             or a.entity_id in (select s.id from public.settlements s where s.cycle_id = any (v_cycles))
                             or a.entity_id in (select p.id from public.payments p where p.settlement_line_id = any (v_lines)))
                        and (not v_mine or a.actor_id = p_user)
                      order by a.created_at desc limit 500) a), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;
