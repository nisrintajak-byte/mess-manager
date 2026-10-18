# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms (flats, hostels, messes, families, offices). Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Current version:** v0.1 built — founder testing (needs 2nd tester). v0.2 built (~95%) on `version/v0.2-settlement-payments` — founder test pending. CI green on both.

**Previews:** stable https://nisrintajak-byte.github.io/mess-manager/ (v0.1) · next …/mess-manager/next/ (v0.2). Same Supabase DB (v0.2 schema is backward compatible).

**Built:** auth (testing mode: 6+ char passwords, email confirmation off), Rooms, code join + Admin approval, roles, Last Admin rule, expenses (equal or selected members, receipts, 30-min edit, soft delete, history), cycles (daily/weekly/monthly, Room time zone), settlement + DB-enforced lock (also early "up to yesterday"), adjustments, payments with proof + Admin confirm/reject/record, who-pays-whom, Room settings rules (currency/time zone/cycle), delete Room. Category removed from UI (founder).

**Next:** founder tests v0.1 + v0.2 → merge v0.1 → main (tag v0.1), then v0.2 (tag) → v0.3 notifications, disputes, need requests.

**Key decisions:** all writes via server functions with server time; money in integer minor units; no DROP/DELETE migrations; see DECISIONS.md.

**Blockers / founder:** second tester for v0.1; PRD §28 decisions (memory/open-questions.md).

_Last updated: 2026-10-18 17:20 (UTC+3)_
