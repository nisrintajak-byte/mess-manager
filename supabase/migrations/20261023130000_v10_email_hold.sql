-- Until the company domain is verified, Resend only delivers to the account owner's own address
-- and refuses the rest (HTTP 403). Those emails must wait, not fail after 6 tries: put them back
-- in the queue for 6 hours without using up an attempt.
create function public.email_hold(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_outbox
     set status = 'queued',
         attempts = greatest(attempts - 1, 0),
         last_error = left(p_error, 500),
         next_attempt_at = now() + interval '6 hours'
   where id = p_id;
end;
$$;
revoke execute on function public.email_hold(uuid, text) from public, anon, authenticated;
grant execute on function public.email_hold(uuid, text) to service_role;
