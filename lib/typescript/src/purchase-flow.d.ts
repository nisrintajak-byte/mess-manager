/** Purchase fields the flow reads. Every OpenIAP `Purchase` matches. */
export interface PurchaseFlowPurchase {
    id: string;
    productId: string;
    purchaseState: string;
    purchaseToken?: string | null;
    store: string;
    ids?: string[] | null;
    quantity?: number;
    isAcknowledgedAndroid?: boolean | null;
}
/** Body the app sends its backend, which takes the user from its own session. */
export interface PurchaseConfirmationRequest {
    store: "apple" | "google";
    /** Apple JWS or Google Play purchase token, forwarded to IAPKit as is. */
    purchaseToken: string;
    /** The product the app expected; IAPKit rejects a store mismatch. */
    productId: string;
}
/**
 * The app backend's verdict on one purchase. Only `entitled` grants access;
 * `verified` and `linked` mean the purchase is valid but access is not granted
 * yet. `ownership_conflict` sets `alreadyGranted` when another account already
 * got access, which lets the app finish it. `invalid` and
 * `test_account_restricted` are settled rejections: return
 * `verification_delayed` for any answer that may still change.
 */
export type PurchaseConfirmation = {
    status: "store_pending";
} | {
    status: "verification_delayed";
    retryAfterMs: number;
} | {
    status: "ownership_conflict";
    alreadyGranted: boolean;
} | {
    status: "test_account_restricted";
} | {
    status: "invalid";
    reason?: string;
} | {
    status: "verified";
    retryAfterMs?: number;
} | {
    status: "linked";
    retryAfterMs?: number;
} | {
    status: "entitled";
    alreadyGranted: boolean;
};
type Finishable = "entitled" | "ownership_conflict" | "test_account_restricted";
/**
 * Where a purchase stands after the flow ran. `finishError` means finishing
 * failed and recovery retries it; an `entitled` status still grants access.
 * `recovered` marks an `invalid` purchase recovery found, not one the user
 * just bought.
 */
export type PurchaseFlowStatus = Exclude<PurchaseConfirmation, {
    status: Finishable | "invalid";
}> | (Extract<PurchaseConfirmation, {
    status: Finishable;
}> & {
    finishError?: unknown;
}) | (Extract<PurchaseConfirmation, {
    status: "invalid";
}> & {
    finishError?: unknown;
    recovered?: true;
}) | {
    status: "failed";
    error: unknown;
};
export interface PurchaseFlowOutcome<P extends PurchaseFlowPurchase> {
    purchase: P;
    status: PurchaseFlowStatus;
}
export interface PurchaseFlowOptions<P extends PurchaseFlowPurchase> {
    /** Sends the purchase to the app backend, which holds the IAPKit secret key. */
    confirmWithBackend: (purchase: P) => Promise<PurchaseConfirmation>;
    /**
     * Milliseconds `confirmWithBackend` may take before the purchase ends as
     * `failed`, so a hung call cannot hold it for the session. Default 30000.
     */
    confirmTimeoutMs?: number;
    finishTransaction: (args: {
        purchase: P;
        isConsumable: boolean;
    }) => Promise<unknown>;
    /**
     * From the app's product config. On Android a wrong answer consumes a
     * non-consumable or blocks rebuying a consumable.
     */
    isConsumable: (productId: string) => boolean;
    getAvailablePurchases: () => Promise<P[]>;
    /**
     * The SDK's `getPendingTransactionsIOS` on iOS, `undefined` elsewhere: off
     * iOS an SDK may answer `[]`, which would hide unacknowledged Android
     * purchases.
     * Recovery reads unfinished StoreKit transactions, consumables included,
     * from it. If it throws, recovery confirms every Apple purchase
     * `getAvailablePurchases` lists instead.
     */
    getPendingTransactionsIOS: (() => Promise<P[]>) | undefined;
}
export interface RecoverPurchasesOptions {
    /** Also re-confirm purchases that were already finished, for a restore button. */
    includeFinished?: boolean;
}
export interface PurchaseFlow<P extends PurchaseFlowPurchase> {
    /**
     * Confirms one purchase with the backend. Finishes it once access is granted
     * to this or another account, and a settled rejection on iOS only: Google
     * Play refunds a rejected purchase left unacknowledged, while iOS would
     * redeliver it forever.
     */
    processPurchase: (purchase: P) => Promise<PurchaseFlowStatus>;
    /**
     * Runs unfinished purchases (or every owned one) through `processPurchase`,
     * one at a time. Throws if it meets an Apple purchase without
     * `getPendingTransactionsIOS`.
     */
    recoverPurchases: (options?: RecoverPurchasesOptions) => Promise<PurchaseFlowOutcome<P>[]>;
}
/**
 * Single-product, single-unit Apple App Store and Google Play purchases only.
 * Create one flow per authenticated app account. Capture that session in
 * confirmWithBackend and discard its results after switching accounts.
 */
export declare function createPurchaseFlow<P extends PurchaseFlowPurchase>(options: PurchaseFlowOptions<P>): PurchaseFlow<P>;
/** Builds the backend request body; throws for a purchase without Apple or Google evidence. */
export declare function toPurchaseConfirmationRequest(purchase: PurchaseFlowPurchase): PurchaseConfirmationRequest;
export type PurchaseFlowGuidanceKey = "payment_pending" | "verification_delayed" | "owned_by_another_account" | "test_purchase_not_accepted" | "purchase_not_valid" | "access_pending" | "access_granted" | "try_again_later";
/** Neutral guidance an app maps to its own copy. */
export interface PurchaseFlowGuidance {
    key: PurchaseFlowGuidanceKey;
    /**
     * True only for an `invalid` purchase the user just made. False whenever the
     * user may already have paid: never ask them to buy again.
     */
    offerPurchase: boolean;
    /** Earliest time to run the purchase through the flow again. */
    retryAfterMs?: number;
}
export declare function describePurchaseFlowStatus(status: PurchaseFlowStatus): PurchaseFlowGuidance;
export {};
//# sourceMappingURL=purchase-flow.d.ts.map