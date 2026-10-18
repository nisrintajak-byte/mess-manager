# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms. Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Status:** v0.1 tested OK by founder + tester (payer fix + same-name numbering applied). v0.2 and v0.3 built, CI green, founder test pending at /next/.

**Previews:** stable https://nisrintajak-byte.github.io/mess-manager/ (v0.1) · next …/mess-manager/next/ (v0.3 = v0.2 + v0.3). One Supabase DB, all migrations backward compatible.

**Built:** auth (testing mode), Rooms, approval, roles; expenses (payer = creator, equal/selected split, receipts, 30-min edit, history); cycles + DB lock + settlement (incl. early), adjustments, payments with proof + Admin confirm; who-pays-whom; Room settings rules; same-name labels (Name1/Name2); notifications inbox + push pipeline (pg_net → Expo), optional prefs; settlement acknowledgement; disputes/flags with Admin resolution; Need Requests → one-tap expense.

**Next:** founder tests /next/ → merge v0.1 → v0.2 → v0.3 into main with tags → v0.4 (4 languages + RTL, themes, Google Sign-In, App Lock).

**Founder items:** PRD §28 decisions (memory/open-questions.md); later: Google Cloud OAuth client (v0.4), translators.

_Last updated: 2026-10-18 18:30 (UTC+3)_
