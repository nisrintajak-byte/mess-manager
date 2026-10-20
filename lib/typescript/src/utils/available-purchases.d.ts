import type { IapPlatform, Purchase, PurchaseIOS } from '../types.js';
/** Decode an authoritative native purchase list atomically. */
export declare const convertAvailablePurchasesOrThrow: (purchases: unknown, platform?: IapPlatform) => Purchase[];
/** Decode an authoritative Apple-platform purchase list without filtering entries. */
export declare const convertApplePurchasesOrThrow: (purchases: unknown) => PurchaseIOS[];
/** Decode an authoritative Android-family purchase list without foreign stores. */
export declare const convertAndroidPurchasesOrThrow: (purchases: unknown) => Purchase[];
//# sourceMappingURL=available-purchases.d.ts.map