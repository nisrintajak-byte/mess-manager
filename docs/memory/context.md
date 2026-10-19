# Context

## Stack
Expo (React Native) + TypeScript strict · Supabase (Postgres + RLS, Auth, Storage, Edge Functions) · i18next · GitHub Actions CI. Android first.

## Repo
- GitHub: nisrintajak-byte/mess-manager
- Branches: `main` (protected later), `version/v0.X-<name>` per version; merge to main when version done; tag `v0.X`
- Commit format: `feat(v0.1): ...` / `fix` / `docs` / `refactor`

## Conventions
- Money: integer minor units + ISO 4217 code on every amount; rounding remainder to payer
- Timestamps: server only; display in Room time zone
- Audit table append-only; locks enforced in DB
- No hard-coded UI text; no flags/maps anywhere

## Commands
- `npm start` — dev server (scan QR with Expo Go) · `npm run web` — browser preview
- `npm run typecheck` · `npm run lint` · `npm test`
- DB tests: `eval "$(scripts/local-pg.sh)" && scripts/test-db.sh` (plain Postgres + stub in supabase/tests/local)
- Regenerate country data: `python3 scripts/generate-countries.py`
- Add/upgrade deps: edit bootstrap workflow, then change `.github/bootstrap-request` and push (no npm in Claude workspace)

## Supabase
- Project `egylgjgimuytmnmrvzhs` (ap-south-1), URL https://egylgjgimuytmnmrvzhs.supabase.co — connected via Supabase connector (apply_migration / execute_sql).
- Connector cancels migrations containing DELETE/DROP unless founder approves on screen → prefer non-destructive SQL.
- Supabase grants EXECUTE on new public functions to anon/authenticated by default → every migration must revoke and re-grant only the public API.
- Claude workspace cannot reach *.supabase.co (proxy 403); verify via connector SQL.
- Default SMTP sends only to Supabase team members (testing limit until custom SMTP in v0.6).

## Previews
- Stable / (STABLE_REF) and next /next/ (NEXT_REF) set in .github/workflows/deploy-web.yml — workflow_run uses the copy on **main**, so edit it on main (keep version branches in sync).

## Env
Secrets go in `.env` (never committed). Needed: SUPABASE_URL, SUPABASE_ANON_KEY (app); service key only in Supabase dashboard / CI secrets.

## Founder
Imran Khan (Abu Uyoon), non-technical. Explain steps in simple Hinglish; Claude does all technical work.

## Gotchas
- GitHub API for repo settings (Pages etc.) is blocked from this workspace; CI logs not downloadable — read check-run annotations instead.
- Claude workspace cannot reach registry.npmjs.org (proxy 403). Use the bootstrap workflow; run tests with `bun test`; local Postgres 16 at /usr/lib/postgresql/16/bin.
- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6.

## Server function (send-emails)
- Source: supabase/functions/send-emails (Deno). Shared code copied by `scripts/sync-function-shared.sh` (report.ts + trimmed locales) — run after changing them; CI fails otherwise.
- Deploy: connector `deploy_edge_function` with a 3-line index.ts that imports `https://raw.githubusercontent.com/nisrintajak-byte/mess-manager/<commit>/supabase/functions/send-emails/index.ts` + deno.json import map; pass `import_map_path: deno.json`. verify_jwt=false (checks x-worker-secret against vault `mm_worker_secret`).
- Test from SQL: net.http_post(... body {"selftest":true}) then read net._http_response.
- `pdf-samples` workflow renders PDFs in 4 languages → branch `ci-samples` (fetch + pdftoppm to look).
- Secrets to set later (Edge Function secrets): RESEND_API_KEY, EMAIL_FROM, DELETE_PAGE_URL.
- DB tests set timezone Asia/Kuwait (CI clock is UTC).
