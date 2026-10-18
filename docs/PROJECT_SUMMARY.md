# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms. Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Status:** v0.1–v0.4 merged to main (founder-tested). v0.5 (offline mode + safe sync) built, CI green, founder test pending at /next/.

**Previews:** stable https://nisrintajak-byte.github.io/mess-manager/ (v0.1) · next …/mess-manager/next/ (v0.3 = v0.2 + v0.3). One Supabase DB, all migrations backward compatible.

**Built:** auth (testing mode), Rooms, approval, roles; expenses (payer = creator, equal/selected split, receipts, 30-min edit, history); cycles + DB lock + settlement (incl. early), adjustments, payments with proof + Admin confirm; who-pays-whom; Room settings rules; same-name labels (Name1/Name2); notifications inbox + push pipeline (pg_net → Expo), optional prefs; settlement acknowledgement; disputes/flags with Admin resolution; Need Requests → one-tap expense; 4 languages + RTL, themes, App Lock; offline cache + outbox sync.

**Next:** founder tests v0.5 → merge to main → v0.6 reports, retention, deletion. Google button needs founder's OAuth client.

**Founder items:** PRD §28 decisions (memory/open-questions.md); later: Google Cloud OAuth client (v0.4), translators.

_Last updated: 2026-10-18 23:59 (UTC+3)_
