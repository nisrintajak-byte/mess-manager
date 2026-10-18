-- The production project had empty tables from an earlier attempt (verified 0 rows, founder approved).
-- Move them into a private `legacy_attempt` schema instead of deleting them. No-op on fresh databases.
-- public.handle_new_user is kept: the existing auth trigger points at it and the next migration replaces its body.
create schema if not exists legacy_attempt;
revoke all on schema legacy_attempt from public;

do $$
declare
  t text;
  f text;
begin
  foreach t in array array['expense_history', 'settlements', 'need_requests', 'audit_logs',
                           'expenses', 'room_members', 'rooms', 'profiles'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I set schema legacy_attempt', t);
    end if;
  end loop;
  foreach f in array array['can_modify_expense', 'log_expense_changes'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = f) then
      execute (select format('alter function %s set schema legacy_attempt', p.oid::regprocedure)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = f limit 1);
    end if;
  end loop;
end $$;
