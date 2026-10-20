# Open Questions

## Blocking now
1. ~~Approve version plan~~ — approved 2026-10-18.
2. ~~GitHub push access~~ — resolved 2026-10-18 (push works).
3. ~~Supabase~~ — connected, schema live.
3a. Founder: enable GitHub Pages (Settings → Pages → Source: GitHub Actions).
3b. Founder: Supabase Auth URL config (Site URL + redirect URL, see docs/TESTING_GUIDE.md).

## PRD §28 — needed before v0.6/v0.7 (not blocking v0.1)
4. Ad approach ("khaas tareeka") for §19
5. ~~Meal-count split~~ — after launch (2026-10-20)
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
- ~~Founder: run account-deletion SQL~~ — done 2026-10-19 23:55 (verified: functions, constraint, hourly job).
- Founder: Expo account + EXPO_TOKEN GitHub secret → Android test app; then Firebase project for Android push (steps to follow).

## v0.7 (2026-10-19)
- Founder: AdMob account → real app id + banner unit id; in AdMob block categories (gambling, alcohol, dating, adult, political, religious, get-rich-quick).
- Lawyer: review src/legal texts; fill [city], Grievance Officer name/email, hosting region.
- ~~Meal-count split (PRD §28 #5)~~ — decided 2026-10-20: after launch (future-plan.md).
- Founder (ad-free, after Play Console exists): create subscriptions `mm_adfree_monthly` + `mm_adfree_yearly` with prices; create a Google Cloud service account with Play Console access and add its JSON as Edge Function secret GOOGLE_PLAY_SERVICE_ACCOUNT (steps to follow).

## 2026-10-20
- Founder: Supabase → Authentication → Attack Protection → turn ON leaked-password protection (before launch).
- Company support email + website domain for the Play listing.
- Translators: also review docs/store/play-store-listing.md (AR/UR/HI).
- No new EAS (APK) builds until really needed — monthly limit (founder 2026-10-20).
