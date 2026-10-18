# How to test Mess Manager (founder guide)

## Open the app
- **Next version (v0.3 = v0.2 + v0.3, in progress):** https://nisrintajak-byte.github.io/mess-manager/next/ — same accounts and data.
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

## v0.2 test checklist (open the /next/ link)
1. Room screen shows the **current cycle** (dates) with tabs Expenses · Balances · Settlements.
2. Add an expense with **Selected members** (tick 2 people) → only they share it.
3. Attach a **receipt** (Camera / Gallery / PDF) → open the expense → **View receipt**.
4. Admin: tap **Settle up to yesterday** (or **Settle this cycle** after it ends) → confirm.
   The cycle becomes **Settled & locked**; try editing one of its expenses → blocked.
5. Open the settlement: each member shows *to pay / receives*, status, and **Who pays whom**.
6. As a member who owes: **Mark as paid** → Bank needs a screenshot or reference; Cash doesn't.
7. As Admin: **Confirm** or **Reject** (reason required) the payment; or **Record payment received**.
8. Admin: open a locked expense → **Adjust this expense** (e.g. -1.000) → it appears in the open cycle.
9. Admin: **Settings** → try changing currency after an expense exists → explained and blocked;
   change time zone or cycle → "applies from <date>".
Tip: for quick testing, settle a cycle the day after you add expenses.

## v0.3 test checklist (/next/ link)
1. Home → **Notifications**: join requests, approvals, expenses, settlements and payments appear here (bold = unread).
2. Notifications → **Notification settings**: expense / Need notifications can be turned off; money ones can't.
3. Open any expense → **Report a problem** → pick a reason → the expense shows **Under dispute** to everyone.
4. Admin: Room → **Disputes** → Start review → **Accept** / **Reject** (note required). Admin can't decide on own item if another Admin exists.
5. Room → **Need Requests** → ask "Milk" → another member taps **I'll buy it** → then **Bought — add expense** (title pre-filled).
6. Settle a cycle → each member opens it (Seen) → taps **I have seen this settlement** (Acknowledged). Admin sees status per member.
7. Members with the same name show as Name1, Name2 (join order).
Push notifications on the phone come with the installable Android app; in the browser use the inbox.
