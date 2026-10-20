# Security self-audit — 2026-10-20 (v0.7)

Not a replacement for the independent security test (PRD §25.3, v1.0). Done by Claude on the live project.

## Checked
| Area | Result |
|---|---|
| RLS on every `public` table | ✅ all on. Tables without policies are server-only on purpose (email_outbox, push tokens, consent_log, deletion_requests, report_refs, storage_purge, ad_free_subscriptions, web_push_subscriptions) |
| Direct table writes (INSERT/UPDATE/DELETE grants to anon/authenticated) | ✅ none after this audit (profiles UPDATE removed — was unused, avatar_url could hold any outside URL) |
| SECURITY DEFINER functions | ✅ all have `search_path=''`; every RPC checks membership/role itself (DB tests 10–97) |
| Functions callable without sign-in | ✅ only 3, all intended: `verify_report` (reveals only found/date/scope), `request_account_deletion` (no email enumeration, 3 per hour per account), `confirm_account_deletion` (hashed single-use token, 24 h) |
| Worker-only functions | ✅ service_role + vault secret (`worker_check`) |
| Storage `room-files` | ✅ private, 10 MB, jpeg/png/webp/pdf only, read/upload only for current Room members, no overwrite/delete from clients |
| Secrets in the repo | ✅ none found (scan for private keys, service keys, Resend keys, JWTs) |
| Display names | 🔧 fixed: invisible control and text-direction characters removed (they could make "50" read as "05" in RTL, or fake names), spaces squeezed, empty → "Member" |

## Still open (for v1.0 / founder)
- Supabase → Auth → **Leaked password protection** ON (needs the paid plan feature check) and `TESTING_MODE=false`, Confirm email ON.
- `pg_net` lives in the `public` schema (Supabase default; moving it can break the cron jobs) — accepted, it is not exposed through the API.
- Old `legacy_attempt` schema (empty archive from before) — not exposed through the API; can be removed before launch.
- Independent security test before Play Store release.
