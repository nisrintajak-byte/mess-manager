# Worklog (newest first)

Format: `YYYY-MM-DD HH:MM | version | what was done | files | next`

- 2026-10-18 13:25 | v0.1 | T5–T9: auth (signup w/ consent+DOB, login, reset, verify), rooms, join+approval, roles, expenses add/edit/delete/history, balances; Supabase project restored, old empty tables archived to `legacy_attempt`, schema applied in 4 migrations, advisors checked; CI green; web preview workflow + testing guide | src/**, supabase/migrations, .github/workflows/deploy-web.yml, docs/TESTING_GUIDE.md | founder enables Pages + Supabase URL config, then T10 test
- 2026-10-18 12:45 | v0.1 | DB schema + RLS + audit + expense rules; 30+ behaviour assertions pass on local Postgres; DB tests added to CI | supabase/migrations, supabase/tests/local, scripts/test-db.sh | apply migration to Supabase once connector connected
- 2026-10-18 12:38 | v0.1 | T1 scaffold (Expo SDK 58, TS strict, i18n, ESLint, Prettier, Jest, CI); T3 money utils + tests; T4 country/currency/zone data (246 countries, 4 languages) | App.tsx, index.ts, src/lib, src/data, scripts/generate-countries.py, .github/workflows | T2 schema
- 2026-10-18 12:35 | planning | Created docs structure, converted PRD v1.2 to markdown, split into versions v0.1–v1.0 | docs/* | founder OK on version plan, then v0.1 T1
