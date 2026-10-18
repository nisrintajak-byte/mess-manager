# Worklog (newest first)

Format: `YYYY-MM-DD HH:MM | version | what was done | files | next`

- 2026-10-18 17:35 | v0.1+v0.2 | Payer = creator: server migration 20261018210000 (create_expense/edit_expense ignore p_paid_by), payer picker removed from both apps, DB tests updated | supabase/migrations, AddExpenseScreen, tests | founder retest

- 2026-10-18 17:20 | v0.2 | Cycles, DB lock, settlement (incl. early), payments with proof + Admin confirm/reject/record, adjustments, selected-member splits, receipts (private storage), Room settings rules, delete Room; 2 DB test suites pass; applied to Supabase; screens: Room (cycles/tabs), AddExpense (split+receipt), ExpenseDetail, Adjust, Settlement (who-pays-whom), Pay, RoomSettings; CI green; /next/ preview live | supabase/migrations/20261018200000_*, supabase/tests/local/20_*, src/screens/*, src/lib/{api,files,transfers}.ts, deploy-web.yml | founder tests v0.1 (/) and v0.2 (/next/)
- 2026-10-18 16:05 | v0.1 | Removed category picker from expense form, list and detail (founder request) | AddExpenseScreen, RoomScreen, ExpenseDetailScreen, en.json | start v0.2 on its own branch

- 2026-10-18 15:45 | v0.1 | Web preview live (GitHub Pages via workflow_run) + live browser smoke test; TESTING_MODE: simple passwords + auto sign-in when email confirmation is off | src/config.ts, src/lib/validation.ts, SignupScreen, deploy-web.yml | founder turns off Confirm email, tests v0.1
- 2026-10-18 13:25 | v0.1 | T5–T9: auth (signup w/ consent+DOB, login, reset, verify), rooms, join+approval, roles, expenses add/edit/delete/history, balances; Supabase project restored, old empty tables archived to `legacy_attempt`, schema applied in 4 migrations, advisors checked; CI green; web preview workflow + testing guide | src/**, supabase/migrations, .github/workflows/deploy-web.yml, docs/TESTING_GUIDE.md | founder enables Pages + Supabase URL config, then T10 test
- 2026-10-18 12:45 | v0.1 | DB schema + RLS + audit + expense rules; 30+ behaviour assertions pass on local Postgres; DB tests added to CI | supabase/migrations, supabase/tests/local, scripts/test-db.sh | apply migration to Supabase once connector connected
- 2026-10-18 12:38 | v0.1 | T1 scaffold (Expo SDK 58, TS strict, i18n, ESLint, Prettier, Jest, CI); T3 money utils + tests; T4 country/currency/zone data (246 countries, 4 languages) | App.tsx, index.ts, src/lib, src/data, scripts/generate-countries.py, .github/workflows | T2 schema
- 2026-10-18 12:35 | planning | Created docs structure, converted PRD v1.2 to markdown, split into versions v0.1–v1.0 | docs/* | founder OK on version plan, then v0.1 T1
