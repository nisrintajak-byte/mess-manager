/**
 * App-wide switches.
 *
 * TESTING_MODE (founder request 2026-10-18): during early testing allow simple passwords
 * (min 6 characters, no common-password check) and work with Supabase email confirmation
 * turned OFF. MUST be set to false before launch (tracked in docs/versions/v1.0-launch.md).
 */
export const TESTING_MODE = true;

export const PASSWORD_MIN_LENGTH = TESTING_MODE ? 6 : 8;
