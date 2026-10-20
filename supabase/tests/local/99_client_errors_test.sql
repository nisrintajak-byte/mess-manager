-- Crash log: no personal data, one row per error per day, callable before sign-in.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
set role anon;
select public.log_client_error('android', '1.0.0', 'Room', 'TypeError at a@b.com card 4111111111111111', 'at x (y.js:1)');
select public.log_client_error('android', '1.0.0', 'Room', 'TypeError at a@b.com card 4111111111111111', 'at x (y.js:1)');
set role authenticated;
select public.log_client_error('web', '1.0.0', null, 'Other', null);
do $$ begin
  begin
    perform * from public.client_errors;
    assert false, 'apps cannot read the crash log';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ declare r record; begin
  assert (select count(*) from public.client_errors) = 2, 'deduplicated per day';
  select * into r from public.client_errors where platform = 'android';
  assert r.count = 2, 'counter';
  assert r.message = 'TypeError at <email> card <number>', 'scrubbed: ' || r.message;
end $$;
select 'ALL DB TESTS PASSED';
