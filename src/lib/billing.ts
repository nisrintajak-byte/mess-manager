/** Browser version: subscriptions are bought in the Android app (Google Play). See billing.native.ts. */
export type Plan = { id: string; price: string; offerToken: string | null };
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'not_configured' | 'error' | 'unsupported';

export const BILLING_SUPPORTED = false;
export async function startBilling(): Promise<void> {}
export async function loadPlans(): Promise<Plan[]> {
  return [];
}
export async function buy(_plan: Plan): Promise<BuyResult> {
  return 'unsupported';
}
export async function restorePurchases(): Promise<BuyResult> {
  return 'unsupported';
}
export async function manageSubscription(): Promise<void> {}
