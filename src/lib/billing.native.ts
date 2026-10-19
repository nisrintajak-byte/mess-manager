/**
 * Ad-free subscription through Google Play Billing (react-native-iap). Every purchase is checked
 * on our server (verify-purchase) before it is finished; the server then marks the account
 * ad-free on all devices. Product ids are created in the Play Console by the founder.
 */
import { Platform } from 'react-native';
import {
  type Purchase,
  deepLinkToSubscriptions,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from 'react-native-iap';

import { refreshAdFree } from './adFree';
import { api } from './api';

export type Plan = { id: string; price: string; offerToken: string | null };
export type BuyResult = 'ok' | 'cancelled' | 'pending' | 'not_configured' | 'error' | 'unsupported';

export const AD_FREE_PRODUCTS = ['mm_adfree_monthly', 'mm_adfree_yearly'];
export const BILLING_SUPPORTED = Platform.OS === 'android';
const PACKAGE = 'com.uyoontech.messmanager';

let started = false;
let waiting: ((r: BuyResult) => void) | null = null;

async function handle(purchase: Purchase): Promise<BuyResult> {
  if (purchase.purchaseState === 'pending') return 'pending';
  const token = purchase.purchaseToken;
  if (!token || !AD_FREE_PRODUCTS.includes(purchase.productId)) return 'error';
  const res = await api.verifyPurchase(purchase.productId, token);
  if (res.error === 'not_configured') return 'not_configured';
  if (!res.ok) return 'error';
  await finishTransaction({ purchase, isConsumable: false });
  await refreshAdFree();
  return 'ok';
}

export async function startBilling(): Promise<void> {
  if (!BILLING_SUPPORTED || started) return;
  started = true;
  try {
    await initConnection();
    purchaseUpdatedListener((p) => {
      void handle(p)
        .catch(() => 'error' as const)
        .then((r) => {
          waiting?.(r);
          waiting = null;
        });
    });
    purchaseErrorListener((e) => {
      waiting?.(e.code === ErrorCode.UserCancelled ? 'cancelled' : 'error');
      waiting = null;
    });
  } catch {
    started = false;
  }
}

export async function loadPlans(): Promise<Plan[]> {
  if (!BILLING_SUPPORTED) return [];
  await startBilling();
  try {
    const products = (await fetchProducts({ skus: AD_FREE_PRODUCTS, type: 'subs' })) ?? [];
    return products
      .map((p) => {
        const offer = 'subscriptionOffers' in p ? p.subscriptionOffers?.[0] : undefined;
        const token = (offer as { offerTokenAndroid?: string | null } | undefined)?.offerTokenAndroid ?? null;
        return { id: p.id, price: offer?.displayPrice ?? p.displayPrice, offerToken: token };
      })
      .sort((a, b) => AD_FREE_PRODUCTS.indexOf(a.id) - AD_FREE_PRODUCTS.indexOf(b.id));
  } catch {
    return [];
  }
}

export async function buy(plan: Plan): Promise<BuyResult> {
  if (!BILLING_SUPPORTED) return 'unsupported';
  await startBilling();
  const result = new Promise<BuyResult>((resolve) => (waiting = resolve));
  try {
    await requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [plan.id],
          subscriptionOffers: plan.offerToken ? [{ sku: plan.id, offerToken: plan.offerToken }] : null,
        },
      },
    });
  } catch {
    waiting = null;
    return 'error';
  }
  return result;
}

/** New phone or reinstall: find the user's subscription again. */
export async function restorePurchases(): Promise<BuyResult> {
  if (!BILLING_SUPPORTED) return 'unsupported';
  await startBilling();
  try {
    const purchases = await getAvailablePurchases();
    let best: BuyResult = 'error';
    for (const p of purchases) {
      if (!AD_FREE_PRODUCTS.includes(p.productId)) continue;
      const r = await handle(p);
      if (r === 'ok' || best === 'error') best = r;
    }
    await refreshAdFree();
    return best;
  } catch {
    return 'error';
  }
}

export async function manageSubscription(): Promise<void> {
  try {
    await deepLinkToSubscriptions({ packageNameAndroid: PACKAGE, skuAndroid: AD_FREE_PRODUCTS[0] });
  } catch {
    // Play Store not available
  }
}
