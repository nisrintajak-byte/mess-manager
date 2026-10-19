# Open Questions

## Blocking now
1. ~~Approve version plan~~ — approved 2026-10-18.
2. ~~GitHub push access~~ — resolved 2026-10-18 (push works).
3. ~~Supabase~~ — connected, schema live.
3a. Founder: enable GitHub Pages (Settings → Pages → Source: GitHub Actions).
3b. Founder: Supabase Auth URL config (Site URL + redirect URL, see docs/TESTING_GUIDE.md).

## PRD §28 — needed before v0.6/v0.7 (not blocking v0.1)
4. Ad approach ("khaas tareeka") for §19
5. Meal-count split: in v1 or later?
6. City for legal jurisdiction in Terms
7. Grievance Officer name + email
8. Company website domain (Privacy Policy + deletion page)
9. Minors: confirm cannot create Rooms / be Admin; minimum age (e.g. 10)?
10. Launch markets (worldwide or first set of countries)

## Founder parallel tasks (long lead time)
- Apply for D-U-N-S number for Unifair Trading Pvt. Ltd. (up to 30 days)
- Google Play Organization developer account
- Engage Indian technology lawyer for Privacy Policy + Terms
- Engage professional translators (AR, UR, HI)

- Google Sign-In: founder must create a Google Cloud OAuth client (steps given in chat), then I enable it. Decide linking rule: Supabase auto-links verified Google email to existing account (PRD wants password first).
- Professional translators for Arabic, Urdu, Hindi (launch blocker).

## v0.6 (2026-10-19)
- Founder: approve the data-deleting DB update (v06_purge_jobs) on screen when asked — enables retention purge + account deletion.
- Founder: company domain (none yet) + Resend account → then emails (retention notices, statements, deletion links) start. Until then they wait in the queue.
- Web deletion page lives on the preview site for now; move to the company website when there is one (Play Console needs the link).
- Google-only accounts: deleting needs a fresh Google sign-in (build when Google is enabled).
- Grievance Officer name + email for the deletion page and Privacy Policy.
- Founder: run `mess-manager-account-deletion.sql` (= migrations/20261021110000_v06_purge_jobs.sql) in Supabase SQL Editor.
- Founder: Expo account + EXPO_TOKEN GitHub secret → Android test app; then Firebase project for Android push (steps to follow).

## v0.7 (2026-10-19)
- Founder: AdMob account → real app id + banner unit id; in AdMob block categories (gambling, alcohol, dating, adult, political, religious, get-rich-quick).
- Lawyer: review src/legal texts; fill [city], Grievance Officer name/email, hosting region.
- Meal-count split (PRD §28 #5) still undecided.
