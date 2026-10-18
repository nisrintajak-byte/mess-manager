/** Map Supabase / database errors to translation keys. */
export function authErrorKey(err: { message?: string; code?: string; status?: number } | null): string {
  const msg = (err?.message ?? '').toLowerCase();
  const code = err?.code ?? '';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'auth.errors.invalidCredentials';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'auth.errors.emailNotConfirmed';
  if (code === 'over_request_rate_limit' || err?.status === 429 || msg.includes('rate limit'))
    return 'auth.errors.tooManyAttempts';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'auth.errors.alreadyRegistered';
  if (code === 'weak_password' || msg.includes('pwned') || msg.includes('weak'))
    return 'auth.errors.passwordCommon';
  return 'common.genericError';
}

/** Database function errors raise short codes like `last_admin`; map to `errors.<code>`. */
export function dbErrorKey(err: { message?: string } | null): string {
  const m = /^([a-z_]+)$/.exec((err?.message ?? '').trim());
  return m ? `errors.${m[1]}` : 'common.genericError';
}
