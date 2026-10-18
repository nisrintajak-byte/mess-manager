# Mess Manager — PRD v1.2

> Source: `docs/PRD_v1.2.pdf` (text extracted 2026-10-18). Never edit directly; record changes in `DECISIONS.md`.

Mess Manager — PRD v1.2
    Oct 13, 2026      · ​@Abu Uyoon

  A Global, Transparent Shared-Expense Management Platform. Developed by Uyoon Tech
  Solutions (A Unit of Unifair Trading Pvt. Ltd., India). Founder: Imran Khan (Abu Uyoon).

  0. Document Control
  v1.2 locks the founder's decisions of 13 October 2026: in-app account deletion with a 2-
  month audit hold, mandatory payment proof with Admin confirmation, month lock after
  settlement, a dispute and flag system, Google Sign-In, an ad-supported free model, and a
  strictly neutral (no flags) interface.

    Field                     Value

    Document Title            Mess Manager — Product Requirements
                              Document

    Version                   1.2

    Prepared For              Uyoon Tech Solutions (A Unit of Unifair Trading Pvt.
                              Ltd., India)

    Document Owner            Imran Khan (Abu Uyoon) — Founder

    Status                    Draft — pending founder sign-off on Section 28
                              (Open Decisions)

Mess Manager — PRD v1.2

  Revision History

    Version         Date     Author               Change Summary

    1.2             13 Oct   Product Team         Account deletion lifecycle; Google Sign-In
                    2026                          with privacy rules and App Lock; currency
                                                  and time-zone change rules; split methods;
                                                  payment proof and Admin confirmation;
                                                  settlement month lock; dispute and flag
                                                  system; offline sync safety rules; neutral
                                                  localization; ads policy; legal and compliance
                                                  section; MoSCoW corrected to match launch
                                                  scope; Play Store publishing requirements

    1.1             25 Jul   Product Team         Added Executive Summary, Goals/KPIs,
                    2026                          Scope, Personas, Prioritization, NFRs, Risks
                                                  and Document Control

    1.0             —        Uyoon Tech           Initial functional requirements draft
                             Solutions

  1. Executive Summary
  Mess Manager is a free, ad-supported app that makes every shared expense in a group
  visible, provable and fairly split. It serves apartments, hostels, messes, families, offices
  and friend groups. Every financial action inside a group (a "Room") is recorded, traceable
  and auditable by all approved members.

  The app is built for worldwide use and is deliberately neutral: four launch languages
  (English, Arabic, Urdu, Hindi), no national flags or country associations in the interface,
  and currency, decimals and time zone driven by each Room's settings.

  2. Problem Statement
  Shared-cost groups track money in chat groups, notebooks or memory. This causes:

       Disputes over who paid what and who owes how much
       No proof (receipts, history) when disagreements arise
       Late or inconsistent settlements with no accountability
       Poor access for non-English speakers in multinational households

Mess Manager — PRD v1.2

  Generic bill-splitting apps lack Admin-controlled membership, an immutable audit trail,
  payment confirmation with proof, and true multi-language, multi-currency support. Mess
  Manager closes this gap.

  3. Goals & Success Metrics (KPIs)
  Targets are indicative; the Product Owner validates them before development sign-off.

    Metric                             Target

    Settlement acknowledgement rate    ≥ 90% of members acknowledge within 7 days

    Expense dispute rate               < 2% of expenses flagged per month

    Dispute resolution time            ≥ 80% of flags resolved within 72 hours

    Payment confirmation turnaround    ≥ 80% of member payment claims confirmed or
                                       rejected by Admin within 48 hours

    Push notification delivery         ≥ 95% delivered within 10 seconds

    Offline sync success               ≥ 99.5% of queued offline actions sync without
                                       manual intervention

    Language coverage at launch        100% of UI strings, notifications, emails, PDFs and
                                       legal documents in all 4 languages

    App stability                      ≥ 99% crash-free sessions

    Admin approval turnaround          ≥ 80% of join requests actioned within 24 hours

  4. Target Users & Personas

    Persona                       Context                       Primary Need

    Room Admin (flat, hostel or   Manages a shared space,       Full visibility and control with
    mess manager)                 approves members,             minimal manual reconciliation
                                  confirms payments, runs
                                  settlements

Mess Manager — PRD v1.2

    Persona                        Context                       Primary Need

    Room Member (roommate,         Adds and shares expenses,     Trust that expenses are
    colleague)                     pays dues                     accurate, visible and fairly
                                                                 split

    Family Member                  Shares household costs        Simple tracking without
                                   with relatives                financial ambiguity

    Office / Team Lead             Manages pantry, outing or     Auditable records for
                                   team-fund expenses            reimbursement

    Low-connectivity user          Patchy or expensive mobile    Add and view expenses
    (worker camps, rural           data                          offline; reliable sync later
    hostels)

  5. Scope

  5.1 In Scope — Version 1
       Email/password and Google Sign-In, signup consent, optional App Lock (PIN/biometric)
       In-app account deletion with a 2-month audit hold, plus the web deletion page Google
       Play requires
       Room creation, join by code or invite, Admin approval workflow
       Expense logging with optional receipts, split methods and a permanent audit history
       Pro-rated settlement engine based on active stay period
       Payment claims with mandatory proof, Admin confirmation, and month lock after
       settlement
       Dispute and flag system
       Need Request system with push notifications
       Offline read and offline expense entry with safe sync
       PDF/CSV reports, including the automatic PDF statement before data deletion
       Four launch languages (English, Arabic, Urdu, Hindi) with full RTL support; four themes
       Ad-supported free model with privacy-compliant consent
       2-calendar-month data retention, then automatic deletion

Mess Manager — PRD v1.2

  5.2 Out of Scope — Version 1
       In-app payment gateway or money transfer (payments are recorded and confirmed,
       never processed)
       Cross-room currency conversion
       OCR receipt scanning, QR join, AI insights, inventory, voice assistant
       Full VoiceOver / TalkBack support (baseline contrast and font scaling are in v1)
       Organization and multi-family workspaces
       Paid / ad-free subscription tier

  6. Recommended Tech Stack

    Layer                      Choice

    Frontend                   React Native (Expo), TypeScript strict mode

    Backend                    Supabase (Edge Functions for settlement, deletion
                               and scheduled jobs)

    Database                   PostgreSQL with Row Level Security

    Authentication             Supabase Auth (email/password + Google OAuth)

    Storage                    Supabase Storage (private buckets, signed URLs)

    Offline store              Local SQLite (e.g. WatermelonDB or expo-sqlite)
                               with an outbox queue

    Push Notifications         Expo Push Notifications + in-app notification inbox

    Transactional Email        A transactional email service (e.g. Resend or
                               Amazon SES)

    PDF Generation             Server-side rendering with embedded Arabic, Urdu
                               (Nastaliq) and Devanagari fonts

    Ads                        Google AdMob with Google's User Messaging
                               Platform (UMP) for consent

    Crash & error reporting    Sentry or Firebase Crashlytics (no personal data in
                               logs)

Mess Manager — PRD v1.2

    Layer                      Choice

    Device security            Expo LocalAuthentication (biometric App Lock),
                               SecureStore for tokens

    Version Control            Git + GitHub with protected main branch and CI

  7. Authentication & User Management

  7.1 Login
       Email + password login, Forgot password (email reset link), Stay signed in (optional),
       Logout
       Continue with Google (Section 7.3)
       Login attempts are rate-limited; after 5 failed attempts the account is temporarily
       locked for 15 minutes

  7.2 Signup
       Fields: Name, Email, Password, Confirm Password
       Password minimum 8 characters, checked against common-password lists; stored only
       as a secure hash by Supabase Auth
       Email verification required before joining or creating a Room
       Signup is blocked until the user ticks the mandatory consent box for the Privacy Policy
       and Terms & Conditions; consent version, date and time are stored
       Date of birth is asked at signup (age gate). Users under 18 need verified
       parent/guardian consent before the account becomes active (Section 20.4)

  7.3 Google Sign-In — Privacy Rules
       Request only the minimum Google permissions: name, email, profile picture. Never
       contacts, Drive, Gmail, location or any other scope.
       Google never shares the user's Google password with the app; the app stores only the
       verified email and Google account ID.
       If an email already registered with a password signs in with Google, the accounts link
       only after the user enters the existing password once. This prevents account takeover.
       A Google-only user can optionally set an app password later from Settings.

Mess Manager — PRD v1.2

       The Privacy Policy states exactly what is received from Google and that it is not used
       for advertising.

  7.4 App Lock (device privacy)
  Google Sign-In keeps the user signed in without a password, so anyone holding an
  unlocked phone could open the app. App Lock solves this:

       Optional PIN, fingerprint or face unlock, set from Settings
       Asked when the app opens and after 5 minutes in the background (configurable)
       Sensitive actions (delete account, change password, Admin removal of members)
       always require re-authentication, regardless of App Lock

  7.5 Member Privacy Inside a Room
       Other members see only display name and profile picture
       A member's email address is visible only to Room Admins
       Receipts are visible only to approved members of that Room

  7.6 Language Selection
  Available before login; applies to login, signup, legal documents and the whole app. Saved
  as a user preference. Languages are shown by their own name in their own script, with no
  flag (Section 16).

  7.7 User Profile & Settings
       Update name and profile picture; change password, theme and language
       App Lock settings
       Notification preferences (mandatory events cannot be switched off)
       Ad privacy choices (Section 19)
       Delete Account — available directly inside Settings (Section 18.3)

  Country selection is not required during signup.

  8. Room Management
  Every Room has: Room Name, Country, Currency, Time Zone and Settlement Cycle. These
  settings belong to the Room, are set by an Admin, and apply identically to every member.

Mess Manager — PRD v1.2

  8.1 Country, Currency & Time Zone
       When an Admin selects the Room's Country, the currency is auto-selected (ISO 4217)
       with its standard decimals — e.g. KWD 3, USD 2, JPY 0.
       Time Zone follows the Country. For countries with more than one time zone, the Admin
       chooses one zone from that country's list (IANA database).
       The selection applies to the whole Room. Every member sees the same Country,
       Currency and Time Zone on the Room screen.
       Any change is shown to all members: a push notification, an in-app banner, and a
       permanent audit entry (who changed what, old value, new value, date and time).
       Country appears only as a plain text name from a standard reference list, in
       alphabetical order. No flags or national symbols (Section 16).

  8.2 Currency Change Rule
  Currency can be changed only when all three conditions are true:

   1. It is the start of a new settlement cycle (for a Monthly cycle: the start of the month, in
       the Room's time zone)
   2. No expense has yet been added in the new cycle
   3. The previous cycle is settled and locked (Section 11.5)

  Once the first expense of the cycle is added, the currency option is disabled until the next
  cycle. Each locked cycle keeps its original currency forever in history and reports;
  amounts are never converted.

  Carried-forward dues: if a member still owes money from a locked cycle in the old
  currency, that balance stays in the old currency and is shown separately until the Admin
  confirms it paid.

  8.3 Time Zone Change Rule
  A time-zone change takes effect from the start of the next settlement cycle, so cycle cut-
  off dates never shift mid-cycle. The new zone is shown to all members as "effective from
  [date]".

  8.4 Room Join Methods
       Room Code
       Email invitation link (includes the app download link)

Mess Manager — PRD v1.2

  8.5 Room Approval
  Every join request needs Admin approval. Until approved, a user cannot enter the Room,
  view expenses or participate. A Room Code never bypasses approval.

  8.6 Admin Management
  Multiple Admins are supported. Admins approve, reject or remove members; promote or
  demote Admins; configure Room settings and the settlement cycle; confirm payments;
  resolve disputes; and delete the Room (conditions apply).

       Last Admin Rule: the last remaining Admin cannot leave, delete their account, or delete
       the Room until another Admin is assigned.
       Room Delete Rule: a Room cannot be deleted while approved members exist or while
       any cycle is unsettled.

  8.7 Leaving a Room
       Expenses are calculated only for the member's active stay period
       The member's statement for the current cycle is automatically emailed as a PDF
       The member's data follows the 2-month Retention Policy (Section 18)
       A former member must request approval again to rejoin

  9. Member Management

    Action                              Member                   Admin

    View expenses, receipts, audit      Yes                      Yes
    history

    Add expense, upload receipt         Yes                      Yes

    Edit / delete own expense           Within 30 minutes,       Any expense, open cycle
                                        open cycle only          only

    Claim own payment as paid (with     Yes                      Yes
    proof)

    Confirm or reject payment claims    No                       Yes

    Raise a dispute / flag              Yes                      Yes

Mess Manager — PRD v1.2

    Action                               Member                    Admin

    Resolve a dispute                    No                        Yes (not on their own
                                                                   expense — Section 12)

    Approve / remove members,            No                        Yes
    manage Admins

    Generate settlement, configure       No                        Yes
    cycle and Room settings

    Download own reports                 Yes                       Yes

    Download full Room reports           No                        Yes

  10. Expense Management
  Each expense contains: Title, Amount, Category, Expense Date, Paid By, Split Method,
  Notes (optional) and Receipt (optional).

  10.1 Split Methods
       Equal, pro-rated by stay (default): shared among members active on the expense
       date, adjusted for each member's active stay period in the cycle
       Selected members: the person adding the expense ticks who shares it (e.g. a personal
       item bought for two members only)
       Meal count (decision pending — Section 28): for food messes; per-meal rate = total
       food expense ÷ total meals, each member pays meals × rate

  10.2 Amounts & Rounding
       All amounts are stored as integers in the currency's minor unit (fils, cents, paise) —
       never floating point
       Rounding follows the currency's decimals; any leftover minor unit from a split is
       assigned to the payer, so totals always match exactly

  10.3 Receipt Upload
  Optional for expenses. Sources: Camera, Gallery. Formats: JPG, PNG, PDF; maximum 10
  MB, images compressed on device. Receipts are visible to all approved Room members
  and stored in a private bucket accessed through short-lived signed links.

Mess Manager — PRD v1.2

  10.4 Expense Edit Policy
       Member: may edit or delete their own expense within 30 minutes, measured by the
       server clock
       Admin: may edit or delete any expense while the cycle is open
       Nobody can edit or delete an expense in a locked cycle (Section 11.5)
       "Delete" is a soft delete: the expense disappears from totals but remains visible in
       history

  10.5 Expense History
  Every add, edit and delete is permanently recorded: Action, Old Value, New Value, User,
  Date and Time (server time, shown in the Room's time zone). History cannot be modified
  by anyone, including Admins and Uyoon Tech staff.

  11. Settlement & Payment Management
  A payment counts as Paid only after an Admin confirms it, and every cycle is locked the
  moment its settlement is generated.

  11.1 Settlement Cycle
  Configured by Admin only: Daily, Weekly or Monthly (Monthly recommended). Settlement
  always follows the Room's time zone and currency, and cut-off times are computed on the
  server.

  11.2 Expense Calculation
  Each member pays only for their active stay: a member joining on the 10th is charged from
  the 10th; a member leaving on the 18th is charged until the 18th. Join and leave days count
  as active days. No member pays before joining or after leaving.

  11.3 Settlement Result
  Total Room expense, each member's share, amount paid, amount payable or receivable,
  and payment status. The app also shows a simplified "who pays whom" list that settles all
  balances with the fewest transfers.

Mess Manager — PRD v1.2

  11.4 Payment Claim & Confirmation
   1. The paying member taps Mark as Paid and enters the amount and method (Bank /
       Wallet / Cash / Other).
   2. Proof is mandatory for every non-cash method: a screenshot or photo of the transfer,
      or a transaction reference number.
   3. For Cash, proof is optional; the Admin's confirmation that cash was received is the
      record.
   4. Status becomes Awaiting Confirmation. All Admins are notified.
   5. An Admin confirms (status becomes Paid or Partially Paid) or rejects with a mandatory
       reason (status returns to Pending).
   6. An Admin can also record a payment directly, e.g. cash received in hand; this is logged
      in the audit trail with the Admin's name.
   7. An Admin cannot confirm a payment they claimed themselves; another Admin must
      confirm it. In a single-Admin Room, the claim is shown to all members as "self-
      confirmed by Admin".

  Payment statuses: Pending · Awaiting Confirmation · Partially Paid · Paid · Rejected.
  Payment history and proofs are visible to all approved members.

  11.5 Settlement Lock
       When the Admin generates a cycle's settlement, that cycle is locked: its expenses can
       no longer be added, edited or deleted by anyone, including Admins.
       Payments against a locked cycle can still be claimed and confirmed until fully paid,
       because collecting money happens after the lock.
       A genuine mistake found after locking is corrected only by an adjustment entry in the
       current open cycle, linked to the original expense and recorded in the audit trail.
       Locking is enforced in the database, not only in the app, so it cannot be bypassed
       through offline sync or a modified app.

  11.6 Settlement Statement on Leaving
  When a member leaves, an automatic PDF email covers: active stay period, expense
  summary, settlement summary, outstanding amount and receipt summary.

Mess Manager — PRD v1.2

  11.7 Settlement Acknowledgement
  Every member must acknowledge each settlement notification. Admins see Delivered /
  Seen / Pending per member.

  12. Dispute & Flag System
  Any approved member can flag an expense, a payment confirmation or a settlement line
  they believe is wrong.

       Flag fields: reason (Wrong amount / Not a shared expense / Duplicate / Payment not
       received / Other), a short note, optional evidence
       All Admins and the person who created the flagged item are notified
       A flagged item shows a visible "Under dispute" badge to all members
       Resolution: an Admin resolves the flag (Accepted → correction made; Rejected →
       reason given). An Admin cannot resolve a flag on their own expense or payment;
       another Admin must, or in a single-Admin Room the resolution is marked "resolved by
       involved Admin"
       An expense under dispute can still be settled; if accepted later, it is corrected by an
       adjustment entry in the next open cycle
       Disputes and their outcomes are part of the permanent audit history and of the 2-
       month retention record
       Flag statuses: Open · Under Review · Accepted · Rejected · Withdrawn

  13. Need Request System
  Any approved member can create a Need Request (e.g. Rice, Oil, Milk, Vegetables, Gas,
  Cleaning Items). All members get a push notification; any member can accept
  responsibility, and others see who accepted, which reduces duplicate purchases. When
  completed, the app offers to turn the purchase into an expense in one tap.

  Statuses: Pending · Accepted · Completed · Cancelled.

  14. Notification System
  Push notifications plus an in-app notification inbox (fallback if push fails) for: Join
  Request, Join Approval / Rejection, Expense Added / Edited / Deleted, Room settings
  changed (country, currency, time zone, cycle), Settlement Generated, Payment Claimed,

Mess Manager — PRD v1.2

  Payment Confirmed / Rejected, Dispute Raised / Resolved, Need Request Created /
  Accepted / Completed, Admin Promotion, Member Removed, Member Account Deletion
  Scheduled.

  Settlement notifications include Cycle, Amount, Payment Status and Due Date.
  Acknowledgement is recorded and Admins see Seen / Not Seen. All notifications follow
  each recipient's chosen language.

  15. Reports & Transparency
       Every member can view and download their own reports; Admins can also download
       full Room reports
       Formats: PDF and CSV
       Reports include Expenses, Settlements, Payments (with proof references), Disputes
       and Audit History
       Reports are generated in the requester's language, with correct right-to-left layout for
       Arabic and Urdu
       Each report carries a generation date and a reference number so its authenticity can
       be checked

  16. Themes, Localization & Neutrality
  Mess Manager is a universal app: no language is tied to a country, and no national flag or
  symbol appears anywhere.

  16.1 Neutrality Rules
       Language picker shows each language by its own name in its own script only: English ·
       ‫ · العربية · اردو‬हिन्दी. No flags, no country names next to languages.
       Country lists show plain text names from a standard reference list (ISO 3166),
       alphabetically, with no flags, maps or emblems.
       Currencies show the ISO code and symbol only (e.g. KWD, INR, USD).
       No maps or borders anywhere in the app, store listing or marketing screenshots, to
       avoid territorial sensitivities.
       Default illustrations, avatars and category icons are culturally neutral.

Mess Manager — PRD v1.2

  16.2 Localization
       The whole app follows the selected language: UI, notifications, emails, PDF reports,
       Privacy Policy and Terms
       Full right-to-left (RTL) layout for Arabic and Urdu, including mirrored navigation and
       correct mixing of numbers inside RTL text
       Number display: Western digits by default, with an optional setting for Eastern Arabic
       digits; stored values never change
       Dates shown in the user's language, calculated in the Room's time zone
       All text is kept in translation files; no text is hard-coded in screens
       Legal documents and app text are translated by professional human translators and
       reviewed by a native speaker; machine translation is not accepted for release
       Urdu uses a Nastaliq font; Hindi uses a Devanagari font; both embedded in PDFs

  16.3 Themes
  Four professional themes (including light and dark), changeable any time. All themes meet
  baseline WCAG contrast and respect the phone's font-size setting.

  17. Offline Mode & Sync
  Offline mode stays in v1 for poor-network regions; these rules keep it bug-free and keep
  money calculations correct.

  17.1 What Works Offline

    Action                                           Offline

    View Room, expenses, balances, history           Yes
    (last synced)

    Add an expense (with receipt photo)              Yes — queued

    Edit / delete own expense                        Yes — queued, still subject to the 30-minute
                                                     and lock rules on sync

    Create or accept a Need Request                  Yes — queued

    Mark a payment as paid with proof                Yes — queued

Mess Manager — PRD v1.2

    Action                                          Offline

    Approve members, confirm payments,              No — Admin actions need a live connection
    resolve disputes, generate settlement,
    change Room settings

  17.2 Sync Safety Rules
   1. Outbox queue: every offline action is saved locally with a unique ID, so retries never
      create duplicates.
   2. Server decides: the server re-checks every queued action (permissions, 30-minute
      window, cycle lock) using server time. The device clock is never trusted.
   3. Locked cycle: an offline expense whose date falls in a cycle locked meanwhile is not
      lost; it is moved to the current open cycle as a late entry, and the creator is told.
   4. Conflicts: if two people changed the same expense, the earlier server-accepted
      change wins; the other is returned to its author to review, never silently overwritten.
   5. Clear status: each queued item shows a "Waiting to sync" badge; failures show the
      reason and a retry button.
   6. Balances offline are labelled "Estimated — not yet synced"; official totals come only
      from the server.
   7. Receipts upload in the background, compressed, resuming after network drops.
   8. Logout warning: the user is warned before logout or account deletion if unsynced
      items exist.

  17.3 Testing Requirement
  Offline flows are tested on low-end Android devices with simulated 2G, network loss mid-
  sync, airplane mode, wrong device clock and app kill during sync, before every release.

  18. Security, Data Retention & Account Deletion
  No financial data is kept longer than 2 complete calendar months; before anything is
  deleted, every affected member receives a PDF record by email.

  18.1 Security
       HTTPS (TLS 1.2+) for all traffic; data encrypted at rest

Mess Manager — PRD v1.2

       Row Level Security on every table: a user can read only Rooms they are an approved
       member of
       Settlement, locking, payment confirmation and deletion run only on the server
       Receipts and proofs in private storage with short-lived signed links
       Audit trail is append-only: no update or delete permission for anyone, including Admins
       Tokens stored in the phone's secure storage; no personal data in crash logs
       An independent security test (Section 25.3) is passed before Play Store release

  18.2 Data Retention (2 calendar months)
       Every expense, settlement, payment, dispute and audit record is kept for two
       complete calendar months after the cycle it belongs to is locked.
       7 days before deletion, every member of the Room automatically receives an email
       with a PDF statement of the cycle that will be deleted (expenses, settlements,
       payments, disputes, audit summary) in their own language, plus an in-app reminder to
       download reports.
       After the 2 months, the records are deleted from the live database and removed from
       backups within 30 days. Uyoon Tech does not keep a long-term archive.
       Users are told clearly, in the app and in the Terms, that the emailed PDF is their
       permanent copy.

  18.3 Account Deletion — In-App (primary)
  Settings → Account → Delete Account. The full flow:

   1. The app shows what happens: login ends immediately; financial records stay for 2
      months only for accounts and dispute purposes; a final PDF will be emailed; the action
       cannot be undone.
   2. Warnings appear if the user has unsynced offline items, unpaid dues or open disputes.
      These do not block deletion.
   3. The last Admin of a Room must first assign another Admin (the only blocking rule).
   4. The user re-enters their password (or re-confirms with Google) and confirms.
   5. Immediately: login is disabled; profile picture, App Lock data, device tokens and
       preferences are deleted; the user leaves all Rooms; their active stay ends today; all
       Room members are notified.

Mess Manager — PRD v1.2

   6. During the 2-month hold: the user's name appears in Room history as "[Name]
       (account deleted)". Records are read-only and used only for accounts, audit and
       dispute resolution, never for ads or marketing.
   7. At the end of the hold: the deleted user (at their last email) and all members of their
      former Rooms receive the final PDF statement by email; then all remaining data linked
       to that person is permanently deleted, including the email address.

  18.4 Account Deletion — Web Page (required by Google Play)
  Google Play requires both an in-app deletion path and a web link where users can request
  deletion, so someone who has already uninstalled the app does not need to reinstall it.
  The in-app option stays the main path. The web page is minimal:

       A page on the Uyoon Tech website: the user enters their email, receives a confirmation
       link, and confirms
       The same lifecycle as 18.3 then runs
       The page link goes into the Play Console Data safety form and the Privacy Policy

  18.5 User Data Rights
  Users can, from Settings: download all their data (PDF/CSV), correct their profile,
  withdraw ad-personalisation consent, and delete their account. Requests by email to the
  Grievance Officer (Section 20) are answered within 30 days.

  19. Ads & Monetization
  Mess Manager is free for all users and earns revenue from ads. The founder's specific ad
  approach is to be added (Section 28); whatever it is, the rules below are mandatory.

  19.1 Placement Rules
       No ads on screens where money or trust decisions happen: payment claim, proof
       upload, payment confirmation, settlement generation, dispute, account deletion, login
       and signup
       No ad ever covers or sits next to an action button (prevents accidental clicks, an ad-
       network policy violation)
       No ads in emails, PDF reports or push notifications
       Full-screen ads, if used, are rare (frequency-capped) and never interrupt a task in
       progress

Mess Manager — PRD v1.2

  19.2 Content Rules
  Block sensitive ad categories in the ad network settings: gambling, alcohol, dating, adult,
  political, religious and get-rich-quick ads. This protects the app's neutral, family-safe
  position across all markets.

  19.3 Privacy & Consent
       Financial data, receipts, Room names and expense details are never shared with
       advertisers or used for ad targeting
       Users in the EEA, UK and Switzerland see a certified consent screen before any
       personalised ad; elsewhere, users can switch to non-personalised ads anytime in
       Settings
       Ads are limited to non-personalised for any user who has not consented, and always
       for users under 18 (Section 20.4)
       Ad SDK data collection is disclosed in the Privacy Policy and the Play Store Data safety
       form

  19.4 Future
  An optional paid ad-free tier can be added later without changing the data model.

  20. Legal & Compliance
  The Privacy Policy and Terms & Conditions are drafted to a professional standard, then
  reviewed and signed off by a qualified Indian technology lawyer before launch. The goal is
  to protect Uyoon Tech Solutions and its founder by stating clearly what the app does and
  does not do.

  20.1 Laws to Address (final list confirmed by counsel)
       India: Digital Personal Data Protection Act 2023 and its Rules; Information Technology
       Act 2000 and related rules on reasonable security practices and grievance redressal
       European Union / UK: GDPR and UK GDPR (if the app is offered there)
       Gulf region: personal data protection laws of Saudi Arabia, UAE, Bahrain, Qatar and
       Kuwait
       Other key markets: e.g. US state privacy laws, Pakistan, Bangladesh — as launch
       markets are confirmed

Mess Manager — PRD v1.2

       Platform policies: Google Play Developer Program Policies, User Data policy, AdMob
       policies

  20.2 Protective Terms & Conditions (key clauses)
       Mess Manager is a record-keeping tool only. It does not hold, transfer or process
       money and is not a bank, wallet or payment service.
       Users and Room Admins are solely responsible for the accuracy of what they enter and
       for settling money among themselves.
       Uyoon Tech is not a party to any dispute between members; the in-app dispute feature
       is a convenience only.
       Records are kept for 2 calendar months only; the emailed PDF is the user's own copy,
       and Uyoon Tech has no obligation to keep data longer.
       Service is provided "as is"; limitation of liability to the maximum extent permitted by
       law; no liability for losses from user error, network failure or third-party services.
       Users under 18 may use the app only with verified parent/guardian consent; the
       parent/guardian accepts these Terms on the child's behalf and is responsible for the
       child's use.
       Acceptable use: no illegal transactions, money laundering, gambling pools or abuse.
       Uyoon Tech may suspend accounts that misuse the service.
       Governing law: India; jurisdiction: courts of [city — to be decided], with users'
       mandatory local consumer rights preserved.
       Terms can change with notice inside the app; continued use means acceptance;
       material changes need fresh consent.

  20.3 Privacy Policy (key contents)
  What data is collected (account, Room, expenses, receipts, device and ad identifiers),
  why, legal basis, who it is shared with (Supabase hosting, email service, ad network, crash
  reporting), where it is stored, the 2-month retention and deletion process, user rights, ad
  choices, security measures, children's policy, and a named Grievance Officer with email
  and response time.

  20.4 Children & Age Policy
  The app is open to all ages, including children of about 10–12 years (for example, in families
  or hostels). Indian law treats everyone under 18 as a child and requires verifiable parent
  consent and no targeted ads for them; similar child-protection rules apply abroad. The

Mess Manager — PRD v1.2

  following protections are mandatory:

       Age gate: date of birth at signup, asked neutrally (no hint of a "right" answer)
       Parental consent: a user under 18 enters a parent/guardian's email; the parent verifies
       and consents before the account is activated. The parent can view the child's Rooms,
       revoke consent and delete the child's account
       No tracking or targeted ads: under-18 users see only non-personalised, child-safe ads
       from child-safe certified ad networks, and no analytics profiling
       Minimal data: no profile picture required; a child's email is never shown to anyone in
       the Room, including Admins (only display name)
       Room safety: a minor cannot create a Room or become an Admin (default — see
       Section 28); a minor joins only with Admin approval as usual
       No free-text contact: the app has no chat or direct messaging, so strangers cannot
       message a child; notes and dispute text are visible only inside the Room
       Google Play: declare the target audience to include children; this brings the app under
       Google Play's Families policy, so only Families-compliant ad SDKs and features are used
       Legal documents: a child-friendly summary of the Privacy Policy in simple words, in all
       4 languages

  20.5 Play Store Publishing Requirements
       Publish under an Organization developer account for Unifair Trading Pvt. Ltd.; apply for
       the company's D-U-N-S number now, as it can take up to 30 days. Organization
       accounts are exempt from the 12-tester, 14-day closed-test rule that applies to new
       personal accounts.
       Complete the Data safety form, including ads, data deletion and the deletion web link
       Privacy Policy hosted at a public web address
       Target the Android API level Google requires at the time of submission

  21. Non-Functional Requirements

    Category              Requirement

    Performance           Expense list and settlement summary load within 2
                          seconds on 4G; usable on 2 GB RAM Android
                          phones

Mess Manager — PRD v1.2

    Category              Requirement

    Availability          Backend targets 99.5% monthly uptime

    Offline               Rules in Section 17; no data loss on network failure
                          or app kill

    Scalability           A Room supports at least 50 active members
                          without redesign

    Accuracy              All money as integer minor units; settlement totals
                          always equal the sum of shares exactly

    Localization          All text externalised; full RTL for Arabic and Urdu

    Security              Section 18.1; independent security test passed
                          before release

    Privacy               Minimum data collected; no financial data to
                          advertisers

    Accessibility         WCAG-aligned contrast and font scaling in v1; full
                          screen-reader support post-v1

    App size              Install size under 40 MB

    Compliance            Section 20

  22. Business Rules
       Admin approval is mandatory for every Room join; a Room Code never bypasses it;
       former members need fresh approval.
       The last Admin cannot leave, delete their account or delete the Room until another
       Admin exists.
       A Room cannot be deleted while approved members exist or a cycle is unsettled.
       Country determines currency; Room settings apply to all members and every change is
       shown to all.
       Currency can change only at the start of a cycle, before its first expense, with the
       previous cycle locked.
       A time-zone change takes effect from the next cycle.
       A member pays only for their active stay period.

Mess Manager — PRD v1.2

       Receipt upload for expenses is optional; payment proof is mandatory for non-cash
       payments.
       A payment is Paid only after Admin confirmation; an Admin cannot confirm their own
       payment where another Admin exists.
       A cycle is locked when its settlement is generated; corrections only by adjustment
       entries.
       Expense and audit history are immutable.
       Any member can flag; an Admin cannot resolve a flag on their own item where another
       Admin exists.
       Push notifications are mandatory for defined events.
       Reports: members download their own; Admins download the full Room.
       Data is retained for 2 complete calendar months, a PDF is emailed to affected
       members, then data is permanently deleted.
       Account deletion is available in Settings and via the web page; financial records are
       held 2 months for audit only.
       Privacy Policy and Terms acceptance are required before signup; users under 18 also
       need verified parent/guardian consent.
       No national flags or symbols anywhere in the app.
       No ads on money, trust or account screens.

  23. Requirement Prioritization (MoSCoW)
  v1.2 moves languages, notifications, reports, offline mode, payment confirmation, month
  lock, disputes and account deletion to Must, because the launch scope and success
  criteria depend on them.

    Feature Area                                           Priority

    Authentication, Google Sign-In, signup consent,        Must
    age gate + parental consent

    Account deletion (in-app + web page) and 2-month       Must
    retention

    Room creation, join, Admin approval, Room settings     Must
    rules

Mess Manager — PRD v1.2

    Feature Area                                            Priority

    Expense add / edit / delete, split (equal + selected    Must
    members), history

    Settlement engine (pro-rated) and month lock            Must

    Payment claim with proof and Admin confirmation         Must

    Dispute & flag system                                   Must

    Security: RLS, HTTPS, audit trail                       Must

    Push notifications + in-app inbox                       Must

    4 languages with RTL, neutral UI                        Must

    Offline read + offline entry with safe sync             Must

    Reports (PDF/CSV) and pre-deletion PDF emails           Must

    Ads with consent                                        Must

    Need Request system                                     Should

    Settlement acknowledgement (Seen / Pending)             Should

    App Lock (PIN / biometric)                              Should

    Four themes                                             Should

    Meal-count split                                        Could (pending decision)

    "Who pays whom" simplified transfers                    Could

    OCR, QR join, AI insights, inventory, voice, full       Won't (v1)
    screen reader, workspaces, cross-room currency,
    ad-free tier

  24. Risks & Assumptions

    Risk                                          Impact   Mitigation

    Offline sync creates duplicate or             High     Outbox with unique IDs, server-side
    wrong entries                                          validation, conflict review (Section 17)

Mess Manager — PRD v1.2

    Risk                                     Impact     Mitigation

    Users lose records after 2 months and    Medium     7-day advance PDF email, in-app
    blame the app                                       reminders, clear Terms

    Payment proofs are fake screenshots      Medium     Admin confirmation required; proofs
                                                        and confirmations auditable; Terms
                                                        place responsibility on users

    Single-Admin Rooms self-confirm          Medium     Visible "self-confirmed" label;
    payments                                            encourage a second Admin

    Ads breach policy or privacy law         High       Placement and content rules, consent
                                                        screen, no financial data to ad network
                                                        (Section 19)

    Poor translations damage trust           Medium     Professional translators + native-
                                                        speaker review

    Time-zone / DST errors shift cut-offs    Medium     IANA database, server-side
                                                        computation, changes effective next
                                                        cycle

    Push delivery failures                   Low        In-app notification inbox fallback

    Clock manipulation to extend 30-         Low        Server timestamps only
    minute edit window

    D-U-N-S / Play verification delays       Medium     Apply for D-U-N-S immediately, in
    launch                                              parallel with development

  Assumptions: users of all ages (minors with parent consent) have basic smartphone
  literacy; internet is available at least intermittently; the Room Admin is the trusted day-to-
  day contact; supported countries, currencies and time zones come from maintained
  standard lists.

Mess Manager — PRD v1.2

  25. Delivery Plan & Future Roadmap

  25.1 Indicative Delivery Timeline (1–2 experienced developers)

    Phase         Work                                             Duration

    0             PRD sign-off, screen designs, D-U-N-S and Play   1–2 weeks
                  Console setup

    1             Auth, Rooms, expenses, settlement, lock,         5–6 weeks
                  payments, audit

    2             Offline sync, disputes, deletion lifecycle,      2–3 weeks
                  notifications

    3             4 languages + RTL, reports, ads, themes, Need    2–3 weeks
                  Requests

    4             Security test, QA on low-end devices in all 4    2 weeks
                  languages

    5             Play Store review and staged rollout             1–2 weeks

  Total: about 13–18 weeks. Offline mode keeps it slightly longer than the v1.1 estimate.

  25.2 Parking Lot (post-v1)
  OCR receipt scanner · QR Room join · AI expense insights · inventory management · voice
  assistant · full VoiceOver / TalkBack · advanced analytics · organization and family
  workspaces · cross-room currency conversion · paid ad-free tier · iOS release.

  25.3 Security Check Before Release
  An independent tester checks: RLS (no cross-Room data access), authentication and
  account linking, locked-cycle bypass attempts, offline sync tampering, storage link
  exposure, and the OWASP Mobile Top 10.

Mess Manager — PRD v1.2

  26. Technical Guidelines (Developer Reference)

  Database
       PostgreSQL (Supabase), UUID primary keys, foreign keys, Row Level Security on every
       table
       Money as integer minor units with an ISO 4217 currency code on every amount
       Automatic created/updated timestamps from the server
       Append-only audit table (no UPDATE/DELETE grants)
       Cycle lock enforced by database rules, not only app logic
       Scheduled server jobs for: cycle cut-off, 7-day pre-deletion emails, retention deletion,
       account-deletion holds
       Idempotency keys on every write so offline retries are safe

  Backend APIs
  Secure, authenticated APIs for: Authentication, Account Deletion, Room Management,
  Member Management, Expenses, Settlement, Payments & Confirmation, Disputes, Need
  Requests, Notifications, Reports, File Upload, Audit Logs.

  Development Standards
  Clean, modular architecture · TypeScript strict mode · reusable components · responsive
  UI · externalised translations with RTL · dark/light themes · secure coding · Git with code
  review and CI · automated tests for settlement maths, locking, permissions and sync ·
  well-documented code.

  27. Success Criteria
       All approved PRD requirements implemented; no feature removed without Product
       Owner approval
       Settlement totals match exactly in every currency precision (0, 2, 3 decimals)
       No locked cycle can be changed through the app, offline sync or the API
       App works correctly in all 4 languages, including RTL
       Offline tests in Section 17.3 pass
       Account deletion and retention emails work end to end
       Independent security test passed

Mess Manager — PRD v1.2

       Privacy Policy and Terms reviewed by a lawyer and published
       App approved and live on Google Play; source code documented; deployment
       instructions provided

  28. Open Decisions for the Founder
       Describe the planned ad approach ("khaas tareeka") so Section 19 can be finalised
       Include the meal-count split in v1, or keep it for a later release?
       City for legal jurisdiction in the Terms
       Name and email of the Grievance Officer
       Company website domain for the Privacy Policy and the account-deletion web page
       Confirm minors cannot create Rooms or become Admins, and whether there is a
       minimum age (e.g. 10)
       Launch markets for the first release (worldwide, or a first set of countries)

  Product Manifesto
  Mess Manager is built on one principle: every shared expense should remain transparent,
  verifiable and fair for every member.
