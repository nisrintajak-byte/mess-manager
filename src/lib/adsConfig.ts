/**
 * Ads (PRD §19): small banners only, on a short list of screens. Never on screens where money or
 * trust decisions happen, never next to an action button, never in emails/PDFs/notifications.
 * Unit ids are Google's TEST ids until the founder's AdMob account exists (then replace them and
 * the app ids in app.json).
 */
export const ADS_ENABLED = true;

/** The only screens that may show a banner. */
export const AD_SCREENS = ['Home', 'Room', 'Inbox', 'Needs'] as const;
export type AdScreen = (typeof AD_SCREENS)[number];

/** Screens that must never show an ad (PRD §19.1) — checked by an automated test. */
export const NO_AD_SCREENS = [
  'PayScreen',
  'SettlementScreen',
  'AddExpenseScreen',
  'AdjustScreen',
  'ExpenseDetailScreen',
  'FlagScreen',
  'DisputesScreen',
  'DeleteAccountScreen',
  'RoomSettingsScreen',
  'RoomMembersScreen',
  'ReportsScreen',
  'SyncScreen',
  'auth/LoginScreen',
  'auth/SignupScreen',
  'auth/ForgotPasswordScreen',
  'auth/CheckEmailScreen',
  'auth/SetNewPasswordScreen',
  'auth/CompleteProfileScreen',
  'auth/ConsentUpdateScreen',
] as const;

export const BANNER_UNIT_ID = {
  android: 'ca-app-pub-3940256099942544/9214589741', // Google test adaptive banner
  ios: 'ca-app-pub-3940256099942544/2435281174', // Google test adaptive banner
};
