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
- DB tests: `PGHOST=… PGPORT=… PGUSER=postgres scripts/test-db.sh` (plain Postgres + stub in supabase/tests/local)
- Regenerate country data: `python3 scripts/generate-countries.py`
- Add/upgrade deps: edit bootstrap workflow, then change `.github/bootstrap-request` and push (no npm in Claude workspace)

## Env
Secrets go in `.env` (never committed). Needed: SUPABASE_URL, SUPABASE_ANON_KEY (app); service key only in Supabase dashboard / CI secrets.

## Founder
Imran Khan (Abu Uyoon), non-technical. Explain steps in simple Hinglish; Claude does all technical work.

## Gotchas
- Claude workspace cannot reach registry.npmjs.org (proxy 403). Use the bootstrap workflow; run tests with `bun test`; local Postgres 16 at /usr/lib/postgresql/16/bin.
- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6.
