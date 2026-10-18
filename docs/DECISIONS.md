# Decisions

Format: date — decision — why — alternatives considered

- 2026-10-18 — Use PRD §6 stack: Expo (React Native) + TypeScript strict + Supabase (Postgres, RLS, Auth, Storage, Edge Functions) — specified in PRD; one codebase, managed backend suits a non-technical founder — Flutter + Firebase (rejected: PRD already chose stack).
- 2026-10-18 — Android first, iOS post-v1 — PRD §25.2 lists iOS in parking lot — simultaneous iOS (rejected: cost/time).
- 2026-10-18 — v0.1 is English-only but every string goes through i18n files from day one — avoids rewrite when adding AR/UR/HI in v0.4 — hard-coded strings (rejected: violates §16.2).
- 2026-10-18 — v0.1 uses simple equal split among currently approved members; pro-rated-by-stay and cycles arrive in v0.2 — keeps first MVP small and testable — full engine in v0.1 (rejected: too large for first slice).
- 2026-10-18 — Original PRD kept as PDF plus extracted markdown; PRD changes recorded here, not in PRD.md.
