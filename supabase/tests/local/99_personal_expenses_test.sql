-- v1.1 Personal expenses: private to the owner, separate from Rooms, gone on account deletion.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('a2000000-0000-0000-0000-000000000001', 'pe-a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('b2000000-0000-0000-0000-000000000002', 'pe-b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000001', false);

-- 1. Asha saves two entries; the same form sent twice saves once
insert into ids values ('tea', public.save_personal_expense(null, 'c0000000-0000-0000-0000-000000000001',
  '  Tea  ', 1500, 'inr', 2, 'food', current_date, ''));
do $$ begin
  assert public.save_personal_expense(null, 'c0000000-0000-0000-0000-000000000001', 'Tea', 1500, 'INR', 2,
           'food', current_date, null) = (select id from ids where name = 'tea'), 'retry returns same id';
end $$;
insert into ids values ('bus', public.save_personal_expense(null, 'c0000000-0000-0000-0000-000000000002',
  'Bus pass', 300, 'KWD', 3, null, current_date - 3, 'monthly'));
do $$ begin
  assert (select count(*) from public.personal_expenses) = 2, 'two entries';
  assert (select title from public.personal_expenses where id = (select id from ids where name = 'tea')) = 'Tea', 'title trimmed';
  assert (select currency from public.personal_expenses where id = (select id from ids where name = 'tea')) = 'INR', 'currency upper-cased';
  assert (select notes from public.personal_expenses where id = (select id from ids where name = 'tea')) is null, 'empty note stored as null';
end $$;

-- 2. Validation
create function pg_temp.err(sql text) returns text language plpgsql as $$
begin execute sql; return 'no error'; exception when others then return sqlerrm; end $$;
do $$ begin
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), ' ', 10, 'INR', 2, null, current_date, null)$q$) = 'personal_title_invalid';
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), 'x', 0, 'INR', 2, null, current_date, null)$q$) = 'personal_amount_invalid';
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), 'x', 10, 'RUPEE', 2, null, current_date, null)$q$) = 'personal_currency_invalid';
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), 'x', 10, 'INR', 9, null, current_date, null)$q$) = 'personal_currency_invalid';
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), 'x', 10, 'INR', 2, 'party', current_date, null)$q$) = 'personal_category_invalid';
  assert pg_temp.err($q$select public.save_personal_expense(null, gen_random_uuid(), 'x', 10, 'INR', 2, null, current_date + 5, null)$q$) = 'future_date';
end $$;

-- 3. Owner edits any time
select public.save_personal_expense((select id from ids where name = 'tea'), null, 'Tea and snacks', 2500,
  'INR', 2, 'food', current_date - 1, 'with Bilal');
do $$ begin
  assert (select amount from public.personal_expenses where id = (select id from ids where name = 'tea')) = 2500, 'edited';
end $$;

-- 4. No direct writes, even by the owner
do $$ begin
  begin
    insert into public.personal_expenses (user_id, title, amount, currency, currency_decimals, expense_date, client_id)
    values ('a2000000-0000-0000-0000-000000000001', 'x', 1, 'INR', 2, current_date, gen_random_uuid());
    assert false, 'direct insert must be refused';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.personal_expenses set amount = 1;
    assert false, 'direct update must be refused';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 5. Bilal sees nothing of Asha's and cannot change it
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-000000000002', false);
do $$ begin
  assert (select count(*) from public.personal_expenses) = 0, 'other users see nothing';
  assert pg_temp.err(format('select public.save_personal_expense(%L, null, %L, 1, %L, 2, null, current_date, null)',
           (select id from ids where name = 'tea'), 'hack', 'INR')) = 'not_found', 'cannot edit others';
  assert pg_temp.err(format('select public.delete_personal_expense(%L)', (select id from ids where name = 'tea'))) = 'not_found',
         'cannot delete others';
end $$;
select public.save_personal_expense(null, gen_random_uuid(), 'Lunch', 9000, 'INR', 2, 'food', current_date, null);

-- 6. Signed-out users get nothing
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.personal_expenses;
    assert false, 'anon must not read';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 7. Owner deletes
set role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000001', false);
select public.delete_personal_expense((select id from ids where name = 'bus'));
do $$ begin
  assert (select count(*) from public.personal_expenses) = 1, 'one left after delete';
end $$;
reset role;

-- 8. Nothing in Room tables, history or notifications
do $$ begin
  assert (select count(*) from public.expenses) = 0, 'no Room expense created';
  assert (select count(*) from public.audit_log) = 0, 'no audit rows';
  assert (select count(*) from public.notifications) = 0, 'no notifications';
end $$;

-- 9. Account deletion erases the list at once; other people's lists stay
select public.perform_account_deletion('a2000000-0000-0000-0000-000000000001', 'app');
do $$ begin
  assert (select count(*) from public.personal_expenses where user_id = 'a2000000-0000-0000-0000-000000000001') = 0,
         'erased on account deletion';
  assert (select count(*) from public.personal_expenses where user_id = 'b2000000-0000-0000-0000-000000000002') = 1,
         'others keep theirs';
end $$;

select 'ALL DB TESTS PASSED';
