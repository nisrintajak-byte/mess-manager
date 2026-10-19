# Project Summary

**App:** Mess Manager — free, ad-supported, neutral (no flags) shared-expense app for Rooms. Every expense, payment and settlement is visible, provable and audited. Android first; 4 languages (EN, AR, UR, HI).

**Status:** v0.1–v0.5 merged to main. v0.6 (reports, 2-month retention, account deletion) built, CI green, live at /next/; data-deleting DB part waits for founder approval; emails wait for Resend + domain.

**Previews:** stable https://nisrintajak-byte.github.io/mess-manager/ (main = v0.5) · next …/mess-manager/next/ (v0.6) · deletion page …/next/delete-account/.

**Built:** auth (testing mode), Rooms, approval, roles; expenses (payer = creator, equal/selected split, receipts, 30-min edit, history); cycles + DB lock + settlement (incl. early), adjustments, payments with proof + Admin confirm; who-pays-whom; Room settings rules; same-name labels (Name1/Name2); notifications inbox + push pipeline (pg_net → Expo), optional prefs; settlement acknowledgement; disputes/flags with Admin resolution; Need Requests → one-tap expense; 4 languages + RTL, themes, App Lock; offline cache + outbox sync; PDF/CSV reports with reference numbers, data export, account deletion (app + web), retention purge, emailed PDF statements (HarfBuzz) via send-emails function.

**Next:** founder approves purge migration + tests v0.6 → merge → v0.7 compliance & ads. Resend + domain for emails; Google OAuth client.

**Founder items:** PRD §28 decisions (memory/open-questions.md); later: Google Cloud OAuth client (v0.4), translators.

_Last updated: 2026-10-19 12:15 (UTC+3)_
