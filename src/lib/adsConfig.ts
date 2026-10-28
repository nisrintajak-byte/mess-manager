/**
 * Ads (PRD §19): small banners only, on a short list of screens. Never on screens where money or
 * trust decisions happen, never next to an action button, never in emails/PDFs/notifications.
 * The real Android unit id is used only in store builds (EAS "production" profile sets
 * EXPO_PUBLIC_REAL_ADS=1). Dev and preview/test builds keep Google's TEST ids, so our own testing
 * never counts as invalid clicks on the live AdMob account. iOS has no AdMob app yet: test ids.
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

const REAL_ADS = !__DEV__ && process.env.EXPO_PUBLIC_REAL_ADS === '1';

export const BANNER_UNIT_ID = {
  android: REAL_ADS
    ? 'ca-app-pub-8476518444023309/3308172610' // AdMob "Mess Manager" → Home banner
    : 'ca-app-pub-3940256099942544/9214589741', // Google test adaptive banner
  ios: 'ca-app-pub-3940256099942544/2435281174', // Google test adaptive banner
};
