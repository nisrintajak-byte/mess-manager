# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms (flats, hostels, messes, families, offices). Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Current version:** Planning — version plan awaiting founder OK. v0.1 0% done.

**Built so far:** Repo docs structure; PRD v1.2 stored (`docs/PRD.md`, original PDF `docs/PRD_v1.2.pdf`); version plan v0.1 → v1.0 in `docs/versions/`.

**Next:** Founder approves plan → start v0.1 Core MVP (scaffold Expo app, Supabase schema, auth, rooms, expenses, balances).

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
- Claude cannot push to GitHub yet (Claude GitHub App not installed on repo)
- Founder accounts needed for v0.1: Supabase, Expo
- PRD §28 open decisions → `memory/open-questions.md`

_Last updated: 2026-10-18 12:35 (UTC+3)_
