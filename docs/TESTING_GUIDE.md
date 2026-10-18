# How to test Mess Manager (founder guide)

## Open the app
- **Phone browser (easiest):** https://nisrintajak-byte.github.io/mess-manager/
  - Updates automatically a few minutes after every change.
  - Tip: in Chrome tap ⋮ → "Add to Home screen" so it opens like an app.
- **Real Android app (later):** an installable test build arrives before launch (EAS build).

## One-time setup (already done / to do)
1. GitHub → repo **Settings → Pages → Source: GitHub Actions** (turns on the web preview).
2. Supabase → **Authentication → URL Configuration**
   - Site URL: `https://nisrintajak-byte.github.io/mess-manager/`
   - Redirect URLs: add `https://nisrintajak-byte.github.io/mess-manager/**`
3. Testing mode (now): Supabase → Authentication → Sign In / Providers → Email → **Confirm email OFF** → Save.
   Then any email works, no confirmation needed, simple passwords (6+ characters) allowed.
   Before launch this is switched back ON.
4. (Only if Confirm email is ON) Testing emails: until a custom email service is set up (v0.6), Supabase only sends signup
   emails to people on your Supabase team. To add a second tester: Supabase → Organization →
   **Team → Invite**.

## v0.1 test checklist
1. Sign up with your email → open the confirmation email → come back → sign in.
2. Create a Room (e.g. country Kuwait → currency KWD is set automatically).
3. Note the 8-letter join code on the Room screen.
4. Second tester signs up, taps **Join with a code**, enters the code.
5. You (Admin) open **Members** → **Approve**.
6. Both add expenses → open **Balances**: totals must match exactly.
7. Edit an expense within 30 minutes (works); a member trying after 30 minutes is blocked.
8. Delete an expense → it shows "Deleted" and leaves the totals, but history keeps it.
9. Try **Leave Room** as the only Admin → blocked until another Admin exists.

Report anything odd with a screenshot.
