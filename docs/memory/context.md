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
(to be added in v0.1 T1)

## Env
Secrets go in `.env` (never committed). Needed: SUPABASE_URL, SUPABASE_ANON_KEY (app); service key only in Supabase dashboard / CI secrets.

## Founder
Imran Khan (Abu Uyoon), non-technical. Explain steps in simple Hinglish; Claude does all technical work.

## Gotchas
- (none yet)
