# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms (flats, hostels, messes, families, offices). Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Current version:** v0.1 Core MVP — ~90% (9 of 10 tasks). Only T10 (founder end-to-end test) left. Branch `version/v0.1-core-mvp`, CI green.

**Built so far:** Expo SDK 58 app: signup (consent, DOB, under-18 blocked for now), login, password reset, email verification; create Room (country → currency/decimals/time zone, no flags); join by code + Admin approval; roles and Last Admin rule; expenses add/edit (30-min rule)/soft delete with full history; equal split (leftover to payer); balances. Supabase project live with RLS + append-only audit. Web preview workflow + docs/TESTING_GUIDE.md.

**Next:** Founder enables GitHub Pages + Supabase URL config → tests v0.1 → merge to main, tag v0.1 → start v0.2 (settlement, lock, payments).

**Key decisions:** PRD §6 stack; all writes via server functions with server time; money as integer minor units; old Supabase tables archived not deleted. See DECISIONS.md.

**Blockers:**
- Founder: GitHub Pages switch; Supabase Site URL; add second tester to Supabase team
- PRD §28 open decisions → memory/open-questions.md

_Last updated: 2026-10-18 13:25 (UTC+3)_
