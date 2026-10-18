# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms (flats, hostels, messes, families, offices). Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Current version:** v0.1 Core MVP — in progress, ~30% (3 of 10 tasks done; T2 schema written + tested, not yet applied to Supabase). Branch `version/v0.1-core-mvp`, CI green.

**Built so far:** Docs + version plan (founder approved 2026-10-18). Expo SDK 58 app skeleton with i18n; money maths (minor units) + tests; country/currency/zone data in 4 languages; full v0.1 database schema with RLS, append-only audit, Admin approval, 30-min edit rule, Last Admin rule — all tested in CI.

**Next:** Apply schema to Supabase (needs connector fully connected) → T5 auth screens → rooms → expenses → balances.

**Version plan:**
- v0.1 Core MVP (auth, rooms, approval, equal-split expenses, audit, balances)
- v0.2 Settlement, lock, receipts, payments
- v0.3 Notifications, disputes, need requests
- v0.4 4 languages + RTL, themes, Google Sign-In, App Lock
- v0.5 Offline mode & safe sync
- v0.6 Reports, retention, account deletion
- v0.7 Minors, legal screens, ads
- v1.0 Security test, QA, Play Store launch

**Key decisions:** Stack per PRD §6 (Expo + TypeScript + Supabase). Money as integer minor units. See `DECISIONS.md`.

**Blockers:**
- Supabase connector shows "connect incomplete" — founder must finish authorising
- PRD §28 open decisions → `memory/open-questions.md`

_Last updated: 2026-10-18 12:55 (UTC+3)_
