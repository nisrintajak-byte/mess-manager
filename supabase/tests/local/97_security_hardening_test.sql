-- v0.7 security hardening: no direct profile writes, clean display names.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), jsonb_build_object('display_name', E'  Asha‮ 50  ', 'consent_version', 'v')),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), jsonb_build_object('display_name', E'⁦‏', 'consent_version', 'v')),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), jsonb_build_object('display_name', E'इमरान‍ खान', 'consent_version', 'v'));
do $$ begin
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Asha 50', 'direction marks + spaces removed';
  assert (select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'Member', 'invisible-only name falls back';
  assert (select display_name from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = E'इमरान‍ खान', 'joiners needed by Indic scripts kept';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ begin
  begin
    update public.profiles set avatar_url = 'https://tracker.example/x.png' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    assert false, 'direct profile update must be refused';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'ALL DB TESTS PASSED';
