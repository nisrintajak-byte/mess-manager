/**
 * App-wide switches.
 *
 * TESTING_MODE (founder request 2026-10-18): during early testing allow simple passwords
 * (min 6 characters, no common-password check) and work with Supabase email confirmation
 * turned OFF. MUST be set to false before launch (tracked in docs/versions/v1.0-launch.md).
 */
export const TESTING_MODE = false;

export const PASSWORD_MIN_LENGTH = TESTING_MODE ? 6 : 8;

/**
 * Google Sign-In button. Turn on once the Google Cloud OAuth client is created and the Google
 * provider is enabled in Supabase (Authentication → Providers → Google).
 */
export const GOOGLE_SIGNIN_ENABLED = false;

/** Link sent in Room invitations: the app's page on the company site (Google Play once published). */
export const INVITE_APP_LINK = 'https://tech.utplgroup.com/mess-manager/';

/**
 * Contact support (founder 2026-10-23: use the Grievance Officer's address until the company
 * domain has its own helpdesk address).
 */
export const SUPPORT_EMAIL = 'unifairtrading@gmail.com';

/** "Rate Mess Manager" appears in Me once the Play Store listing is public. */
export const PLAY_LISTING_LIVE = false;
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.uyoontech.messmanager';
