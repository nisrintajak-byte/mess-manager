import type { RnIap } from './specs/RnIap.nitro.js';
import type { BillingProgramAndroid, BillingProgramReportingDetailsAndroid, DeveloperBillingTypeAndroid, DeveloperProvidedBillingDetailsAndroid, MutationField, Product, Purchase, PurchaseError, PurchaseUpdatedListenerOptions, QueryField, UserChoiceBillingDetails } from './types.js';
export type { NitroProduct, NitroPurchase, NitroPurchaseResult, } from './specs/RnIap.nitro.js';
type PublicRnIap = Omit<RnIap, 'claimFirstPurchaseNotice'>;
export type { PublicRnIap as RnIap };
export * from './types.js';
export * from './utils/error.js';
export { isVegaOS } from './vega.js';
export declare const getVegaIapModule: () => PublicRnIap | null;
/** Product type accepted by public query and purchase helpers. */
export type ProductTypeInput = 'in-app' | 'subs';
export interface EventSubscription {
    remove(): void;
}
export { useIAP } from './hooks/useIAP.js';
export { kitApi, KitApiError, resolveLocalizedPayload } from './kit-api.js';
export { getUserFriendlyErrorMessage } from './utils/errorMapping.js';
export type { KitApiOptions, KitClientPayloadCache, KitClientPayloadOptions, KitClientPayloadResponse, KitLocalizedClientPayload, KitLocalizedClientPayloadOptions, KitLocalizedPayloadOptions, KitProduct, KitProductClientPayload, KitProductOffer, KitProductPlatform, KitProductsOptions, KitProductsResponse, KitSubscription, EntitlementsResponse, StatusResponse, } from './kit-api.js';
export { createPurchaseFlow, describePurchaseFlowStatus, toPurchaseConfirmationRequest, } from './purchase-flow.js';
export type { PurchaseConfirmation, PurchaseConfirmationRequest, PurchaseFlow, PurchaseFlowGuidance, PurchaseFlowGuidanceKey, PurchaseFlowOptions, PurchaseFlowOutcome, PurchaseFlowPurchase, PurchaseFlowStatus, RecoverPurchasesOptions, } from './purchase-flow.js';
/**
 * Check if Nitro runtime is ready for IAP operations.
 * This is useful for platforms like tvOS where Nitro may initialize later.
 * @returns true if Nitro is ready, false otherwise
 */
export declare const isNitroReady: () => boolean;
/**
 * Check if we're running on tvOS.
 * tvOS reports Platform.OS as 'ios' but has Platform.isTV = true.
 */
export declare const isTVOS: () => boolean;
/**
 * Check if we're running on macOS (Catalyst or native).
 * macOS may report Platform.OS as 'ios' (Catalyst) or 'macos'.
 */
export declare const isMacOS: () => boolean;
/**
 * Check if we're running on a standard iOS device (iPhone/iPad, not tvOS or macOS Catalyst).
 */
export declare const isStandardIOS: () => boolean;
/**
 * Forget the native listener attachments that endConnection drops. JS
 * listeners stay registered and reattach on the next initConnection.
 */
export declare const resetListenerState: () => void;
export declare const purchaseUpdatedListener: (listener: (purchase: Purchase) => void, options?: PurchaseUpdatedListenerOptions | null) => EventSubscription;
export declare const purchaseErrorListener: (listener: (error: PurchaseError) => void) => EventSubscription;
export declare const promotedProductListenerIOS: (listener: (product: Product) => void) => EventSubscription;
/**
 * Add a listener for user choice billing events (Android only).
 * Fires when a user selects alternative billing in the User Choice Billing dialog.
 *
 * @param listener - Function to call when user chooses alternative billing
 * @returns EventSubscription with remove() method to unsubscribe
 * @platform Android
 *
 * @example
 * ```typescript
 * const subscription = userChoiceBillingListenerAndroid((details) => {
 *   console.log('User chose alternative billing');
 *   console.log('Products:', details.products);
 *   console.log('External transaction token received; send it to your backend without logging it.');
 *
 *   // Send token to backend for Google Play reporting
 *   void reportToGooglePlay(details.externalTransactionToken).catch((error) => {
 *     console.warn('Alternative billing report failed', error);
 *   });
 * });
 *
 * // Later, remove the listener
 * subscription.remove();
 * ```
 */
export declare const userChoiceBillingListenerAndroid: (listener: (details: UserChoiceBillingDetails) => void) => EventSubscription;
/**
 * Add a listener for developer provided billing events (Android 8.3.0+).
 * Fires for External Payments and Billing Choice developer billing flows.
 *
 * The payload includes selected products and nullable token, link, and original
 * transaction fields. Billing Choice fields require Billing Library 9.1.0+.
 *
 * @param listener - Function to call when user chooses developer billing
 * @returns EventSubscription with remove() method to unsubscribe
 * @platform Android
 * @since Google Play Billing Library 8.3.0+
 *
 * @example
 * ```typescript
 * const subscription = developerProvidedBillingListenerAndroid((details) => {
 *   void processExternalPayment(details.products, details.linkUri)
 *     .then(() => details.externalTransactionToken
 *       ? reportToGooglePlay(details.externalTransactionToken)
 *       : undefined)
 *     .catch((error) => console.warn('Developer billing failed', error));
 * });
 *
 * // Later, remove the listener
 * subscription.remove();
 * ```
 */
export declare const developerProvidedBillingListenerAndroid: (listener: (details: DeveloperProvidedBillingDetailsAndroid) => void) => EventSubscription;
/**
 * Listen for subscription billing-issue events (cross-platform).
 *
 * Fires when a subscription enters a billing-issue state:
 * - iOS / Mac Catalyst 16.4+ and visionOS 1.0+: via StoreKit 2 `Message.Reason.billingIssue`.
 * - Android (Play Billing 8.1+): when `isSuspendedAndroid === true` is observed.
 * - Horizon, Amazon, macOS, tvOS, watchOS, and iOS before 16.4: never fires.
 *
 * Recommended UX: on fire, call `deepLinkToSubscriptions()` so the user can
 * update their payment method in the platform subscription center.
 *
 * @param listener - Function to call with the affected Purchase
 * @returns EventSubscription with remove() method to unsubscribe
 *
 * @example
 * ```typescript
 * const subscription = subscriptionBillingIssueListener((purchase) => {
 *   console.warn('Subscription needs attention:', purchase.productId);
 *   deepLinkToSubscriptions({skuAndroid: purchase.productId, packageNameAndroid: 'com.example.app'});
 * });
 *
 * subscription.remove();
 * ```
 */
export declare const subscriptionBillingIssueListener: (listener: (purchase: Purchase) => void) => EventSubscription;
/**
 * Retrieve products or subscriptions from the store by SKU.
 *
 * @param request `ProductRequest` — `skus` (string[]) and optional `type`
 *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
 * @returns Promise resolving to a `FetchProductsResult` union — `Product[]` for `'in-app'`,
 *   `ProductSubscription[]` for `'subs'`, a mixed array for `'all'`, or `null`
 *   (the schema retains the nullable branch for backwards compatibility).
 * @throws When the store rejects the request (empty `skus`, not connected,
 *   network/store error). Unknown SKUs are simply omitted from the result, not thrown.
 *
 * @example
 * ```ts
 * const products = await fetchProducts({
 *   skus: ['com.app.coins_100', 'com.app.premium'],
 *   type: 'in-app',
 * });
 * ```
 *
 * @remarks This is a regular promise-based call. Don't confuse with `request*` APIs
 *   (`requestPurchase`), which are event-based.
 *
 * @see {@link https://openiap.dev/docs/apis/fetch-products}
 */
export declare const fetchProducts: QueryField<'fetchProducts'>;
/**
 * List the user's unfinished purchases — non-consumables, active subscriptions, and any
 * pending transactions not yet finished.
 *
 * @param options Optional `PurchaseOptions`.
 *   - iOS: `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
 *   - Android: `includeSuspendedAndroid` (include subscriptions in a paused/grace state).
 * @returns Promise resolving to an array of `Purchase` currently held by the store.
 * @throws When the platform query fails.
 *
 * @example
 * ```ts
 * const purchases = await getAvailablePurchases();
 * for (const p of purchases) {
 *   if (await verifyOnServer(p)) await finishTransaction({ purchase: p, isConsumable: false });
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
 */
export declare const getAvailablePurchases: QueryField<'getAvailablePurchases'>;
/**
 * Request the promoted product from the App Store (iOS only)
 * @returns Promise<Product | null> - The promoted product or null if none available
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
 */
export declare const getPromotedProductIOS: QueryField<'getPromotedProductIOS'>;
/**
 * Return the user's storefront country code.
 *
 * @see {@link https://openiap.dev/docs/apis/get-storefront}
 */
export declare const getStorefront: QueryField<'getStorefront'>;
/** Verify app acquisition; send Android integrity tokens to your backend. */
export declare const verifyAppOwnership: QueryField<'verifyAppOwnership'>;
/**
 * Get the app transaction: StoreKit's JWS-verified record of how the app was
 * acquired (iOS 16+). Returns null when none is available.
 * @platform iOS
 *
 * @returns {Promise<AppTransaction | null>} The parsed app transaction, or null
 *
 * @example
 * ```typescript
 * const appTransaction = await getAppTransactionIOS();
 * if (appTransaction) {
 *   console.log('Original app version:', appTransaction.originalAppVersion);
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-app-transaction-ios}
 */
export declare const getAppTransactionIOS: QueryField<'getAppTransactionIOS'>;
/**
 * Get subscription status for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<SubscriptionStatusIOS[]> - Array of subscription status objects
 * @throws Error when called on non-iOS platforms or when IAP is not initialized
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/subscription-status-ios}
 */
export declare const subscriptionStatusIOS: QueryField<'subscriptionStatusIOS'>;
/**
 * Get current entitlement for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<Purchase | null> - Current entitlement or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/current-entitlement-ios}
 */
export declare const currentEntitlementIOS: QueryField<'currentEntitlementIOS'>;
/**
 * Get latest transaction for a product (iOS only)
 * @param sku - The product SKU
 * @returns Promise<Purchase | null> - Latest transaction or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/latest-transaction-ios}
 */
export declare const latestTransactionIOS: QueryField<'latestTransactionIOS'>;
/**
 * Get pending transactions (iOS only)
 * @returns Promise<Purchase[]> - Array of pending transactions
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-pending-transactions-ios}
 */
export declare const getPendingTransactionsIOS: QueryField<'getPendingTransactionsIOS'>;
/**
 * List every StoreKit transaction (finished + unfinished) for the current user.
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-all-transactions-ios}
 */
export declare const getAllTransactionsIOS: QueryField<'getAllTransactionsIOS'>;
/**
 * Show manage subscriptions screen (iOS only)
 * @returns Promise<Purchase[]> - Subscriptions where auto-renewal status changed
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-manage-subscriptions-ios}
 */
export declare const showManageSubscriptionsIOS: MutationField<'showManageSubscriptionsIOS'>;
/**
 * Check if user is eligible for intro offer (iOS only)
 * @param groupID - The subscription group ID
 * @returns Promise<boolean> - Eligibility status
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-intro-offer-ios}
 */
export declare const isEligibleForIntroOfferIOS: QueryField<'isEligibleForIntroOfferIOS'>;
/**
 * Get receipt data (iOS only)
 * @returns Promise<string> - Base64 encoded receipt data
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-receipt-data-ios}
 */
export declare const getReceiptDataIOS: QueryField<'getReceiptDataIOS'>;
export declare const requestReceiptRefreshIOS: () => Promise<string>;
/**
 * Check if transaction is verified (iOS only)
 * @param sku - The product SKU
 * @returns Promise<boolean> - Verification status
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-transaction-verified-ios}
 */
export declare const isTransactionVerifiedIOS: QueryField<'isTransactionVerifiedIOS'>;
/**
 * Get transaction JWS representation (iOS only)
 * @param sku - The product SKU
 * @returns Promise<string | null> - JWS representation or null
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-transaction-jws-ios}
 */
export declare const getTransactionJwsIOS: QueryField<'getTransactionJwsIOS'>;
/**
 * Initialize the store connection. Must be called before any other IAP API.
 *
 * @param config Optional connection config. Use `enableBillingProgramAndroid` (Android,
 *   Play Billing 8.2.0+) to opt into External Payments etc. iOS ignores Android-specific fields.
 * @returns Promise resolving to `true` when the platform billing client is connected.
 * @throws When the platform billing client fails to initialize.
 *
 * @example
 * ```ts
 * // Choose exactly one connection call for the session.
 * const connected = await initConnection();
 * // Or replace the call above with one Android billing program:
 * // const connected = await initConnection({
 * //   enableBillingProgramAndroid: 'external-offer',
 * // });
 * // const connected = await initConnection({
 * //   enableBillingProgramAndroid: 'billing-choice',
 * //   billingChoiceScreenTypeAndroid: 'developer-rendered',
 * // });
 * if (!connected) throw new Error('Store connection failed');
 * ```
 *
 * @remarks When using `useIAP()`, the connection initializes on mount. On unmount,
 *   React Native removes hook listeners but keeps the native connection open across
 *   screens. Pass options to the hook instead of calling this directly.
 *
 * @see {@link https://openiap.dev/docs/apis/init-connection}
 */
export declare const initConnection: MutationField<'initConnection'>;
/**
 * Close the store connection and release resources.
 *
 * @see {@link https://openiap.dev/docs/apis/end-connection}
 */
export declare const endConnection: MutationField<'endConnection'>;
/**
 * Restore non-consumable and active subscription purchases.
 *
 * @see {@link https://openiap.dev/docs/apis/restore-purchases}
 */
export declare const restorePurchases: MutationField<'restorePurchases'>;
/**
 * Initiate a purchase or subscription flow. The result is delivered through
 * `purchaseUpdatedListener` — NOT the return value.
 *
 * @param request `RequestPurchaseProps`, discriminated by `type`:
 *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
 *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
 * @returns The dispatched purchase payload. **Do not rely on it** for the actual outcome.
 * @throws Invalid arguments or failures that prevent dispatch. Store outcomes are event-based;
 *   on Android, `not-prepared` is delivered through `purchaseErrorListener`.
 *
 * @example
 * ```ts
 * const connected = await initConnection();
 * if (!connected) return;
 *
 * await requestPurchase({
 *   request: {
 *     apple: { sku: 'com.app.premium' },
 *     google: { skus: ['com.app.premium'] },
 *   },
 *   type: 'in-app',
 * });
 * ```
 *
 * @remarks Event-based. Listen for the result via {@link purchaseUpdatedListener} /
 *   {@link purchaseErrorListener}, or use `useIAP({ onPurchaseSuccess, onPurchaseError })`.
 *
 * @see {@link https://openiap.dev/docs/apis/request-purchase}
 */
export declare const requestPurchase: MutationField<'requestPurchase'>;
/**
 * Complete a purchase transaction. Call after server-side verification to remove it
 * from the queue.
 *
 * @param args.purchase The `Purchase` to finalize.
 * @param args.isConsumable `true` for consumables (consumes the token so the SKU can be
 *   re-bought, e.g. coins); `false` (default) for non-consumables and subscriptions.
 * @returns Promise that resolves once the platform finalizes the transaction.
 * @throws When the platform finalize call fails.
 *
 * @example
 * ```ts
 * purchaseUpdatedListener((purchase) => {
 *   void verifyOnServer(purchase)
 *     .then((verified) => verified
 *       ? finishTransaction({ purchase, isConsumable: false })
 *       : undefined)
 *     .catch((error) => console.warn('Transaction finalization failed:', error));
 * });
 * ```
 *
 * @remarks **Critical:** Android purchases must be finalized within 3 days or Google
 *   auto-refunds. iOS unfinished transactions replay on every app launch.
 *
 * @see {@link https://openiap.dev/docs/apis/finish-transaction}
 */
export declare const finishTransaction: MutationField<'finishTransaction'>;
/**
 * Acknowledge a purchase (Android only)
 * @param purchaseToken - The purchase token to acknowledge
 * @returns Promise<boolean> - Indicates whether the acknowledgement succeeded
 *
 * @example
 * ```typescript
 * await acknowledgePurchaseAndroid('purchase_token_here');
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/acknowledge-purchase-android}
 */
export declare const acknowledgePurchaseAndroid: MutationField<'acknowledgePurchaseAndroid'>;
/**
 * Consume a purchase (Android only)
 * @param purchaseToken - The purchase token to consume
 * @returns Promise<boolean> - Indicates whether the consumption succeeded
 *
 * @example
 * ```typescript
 * await consumePurchaseAndroid('purchase_token_here');
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/consume-purchase-android}
 */
export declare const consumePurchaseAndroid: MutationField<'consumePurchaseAndroid'>;
/**
 * Verify a purchase on iOS or Android.
 * @param options - Platform-specific verification options
 * @param options.apple - Apple App Store verification options (iOS)
 * @param options.google - Google Play verification options (Android)
 * @param options.horizon - Meta Horizon (Quest) verification options
 * @returns Promise<VerifyPurchaseResultIOS | VerifyPurchaseResultAndroid> - Platform-specific receipt validation result
 *
 * @example
 * ```typescript
 * const result = await verifyPurchase({
 *   apple: { sku: 'premium_monthly' },
 *   google: {
 *     sku: 'premium_monthly',
 *     packageName: 'com.example.app',
 *     purchaseToken: 'token...',
 *     accessToken: 'oauth_token...',
 *     isSub: true
 *   }
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/validate-receipt}
 */
export declare const verifyPurchase: MutationField<'verifyPurchase'>;
/**
 * Verify a purchase with an external provider such as IAPKit.
 *
 * @param options - Verification options including provider and credentials
 * @returns Promise resolving to provider-specific verification result
 *
 * @example
 * ```typescript
 * const result = await verifyPurchaseWithProvider({
 *   provider: 'iapkit',
 *   iapkit: {
 *     apiKey: 'your-api-key',
 *     // Choose exactly one store payload.
 *     // apple: { jws: purchase.purchaseToken },
 *     // google: { purchaseToken: purchase.purchaseToken },
 *     amazon: {
 *       expectedProductId: purchase.productId,
 *       userId: amazonUserId,
 *       receiptId: purchase.purchaseToken,
 *       // Enable only for App Tester after the IAPKit project opt-in.
 *       sandbox: amazonSandboxEnabled,
 *     },
 *   },
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
 */
export declare const verifyPurchaseWithProvider: MutationField<'verifyPurchaseWithProvider'>;
/**
 * Sync iOS purchases with App Store (iOS only)
 * @returns Promise<boolean>
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/sync-ios}
 */
export declare const syncIOS: MutationField<'syncIOS'>;
/**
 * Open the store's offer/promo code redemption flow.
 *
 * Resolves the redeemed purchase only when the store reports it synchronously;
 * every other path resolves null, so reconcile with `getAvailablePurchases`
 * when the app resumes.
 *
 * @returns Promise<Purchase | null> - The redeemed purchase, or null
 * @throws When a redemption flow exists but cannot be opened
 *
 * @see {@link https://openiap.dev/docs/apis/open-redeem-offer-code}
 */
export declare const openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
/**
 * Clear unfinished transactions on iOS
 * @returns Promise<boolean>
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/clear-transaction-ios}
 */
export declare const clearTransactionIOS: MutationField<'clearTransactionIOS'>;
/**
 * Begin a refund request for a product on iOS 15+
 * @param sku - The product SKU to refund
 * @returns Promise<string | null> - The refund status or null if not available
 * @platform iOS
 *
 * @see {@link https://openiap.dev/docs/apis/ios/begin-refund-request-ios}
 */
export declare const beginRefundRequestIOS: MutationField<'beginRefundRequestIOS'>;
/**
 * Deeplinks to native interface that allows users to manage their subscriptions
 * Cross-platform alias aligning with expo-iap
 *
 * @see {@link https://openiap.dev/docs/apis/deep-link-to-subscriptions}
 */
export declare const deepLinkToSubscriptions: MutationField<'deepLinkToSubscriptions'>;
export declare const deepLinkToSubscriptionsIOS: () => Promise<boolean>;
/**
 * Get active subscriptions, limited to `subscriptionIds` when given.
 * On iOS each result includes renewalInfoIOS: renewal status, pending
 * upgrades/downgrades, and auto-renewal preference.
 *
 * @param subscriptionIds - Optional array of subscription IDs to filter by
 * @returns Promise<ActiveSubscription[]> - Array of active subscriptions
 *
 * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
 */
export declare const getActiveSubscriptions: QueryField<'getActiveSubscriptions'>;
/**
 * Check whether the user has an active subscription, limited to
 * `subscriptionIds` when given.
 *
 * @param subscriptionIds - Optional array of subscription IDs to check
 * @returns Promise<boolean> - True if there are active subscriptions
 * @throws When the store cannot determine subscription status
 *
 * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
 */
export declare const hasActiveSubscriptions: QueryField<'hasActiveSubscriptions'>;
export { convertNitroProductToProduct, convertNitroPurchaseToPurchase, convertProductToProductSubscription, validateNitroProduct, validateNitroPurchase, checkTypeSynchronization, } from './utils/type-bridge.js';
/**
 * Enable a billing program (Android only). Must be called before
 * initConnection() to configure the BillingClient.
 *
 * @param program - The billing program to enable (external-content-link or external-offer)
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * // Enable external offers before connecting
 * enableBillingProgramAndroid('external-offer');
 * const connected = await initConnection();
 * if (!connected) throw new Error('Store connection failed');
 * ```
 */
export declare const enableBillingProgramAndroid: (program: BillingProgramAndroid) => void;
/**
 * Check if a billing program is available for this user/device (Android only).
 *
 * @param program - The billing program to check
 * @returns Promise with availability result
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const result = await isBillingProgramAvailableAndroid('external-offer');
 * if (result.isAvailable) {
 *   // External offers are available for this user
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/is-billing-program-available-android}
 */
export declare const isBillingProgramAvailableAndroid: MutationField<'isBillingProgramAvailableAndroid'>;
/**
 * Fetch Play Billing assets and loyalty text for developer-rendered Billing Choice screens (Android only).
 *
 * @param params - Billing Choice info request parameters
 * @returns Promise with Play-hosted image URL and optional loyalty information
 * @platform Android
 * @since Google Play Billing Library 9.1.0+
 *
 * @see {@link https://openiap.dev/docs/apis/android/get-billing-choice-info-android}
 */
export declare const getBillingChoiceInfoAndroid: QueryField<'getBillingChoiceInfoAndroid'>;
/**
 * Create billing program reporting details for external transactions (Android only).
 * Used to get the external transaction token needed for reporting to Google.
 *
 * @param program - The billing program to create reporting details for
 * @returns Promise with reporting details including external transaction token
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const details = await createBillingProgramReportingDetailsAndroid('external-offer');
 * // Use details.externalTransactionToken to report the transaction
 * await fetch('/api/report-external-transaction', {
 *   method: 'POST',
 *   body: JSON.stringify({ token: details.externalTransactionToken })
 * });
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/create-billing-program-reporting-details-android}
 */
export declare const createBillingProgramReportingDetailsAndroid: MutationField<'createBillingProgramReportingDetailsAndroid'> & ((program: BillingProgramAndroid, developerBillingType?: DeveloperBillingTypeAndroid | null) => Promise<BillingProgramReportingDetailsAndroid>);
/**
 * Show Google's mandatory information dialog before a developer-rendered,
 * in-app Billing Choice screen (Android only).
 *
 * @param params - Dialog parameters with the external transaction token
 * @returns Promise with BillingResult
 * @platform Android
 * @since Google Play Billing Library 9.1.0+
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-billing-program-information-dialog-android}
 */
export declare const showBillingProgramInformationDialogAndroid: MutationField<'showBillingProgramInformationDialogAndroid'>;
/**
 * Show Play Billing in-app messages, such as transactional subscription updates (Android only).
 *
 * @param params - Optional in-app message categories
 * @returns Promise with in-app message result
 * @platform Android
 * @since Google Play Billing Library 4.1.0+
 *
 * @see {@link https://openiap.dev/docs/apis/android/show-in-app-messages-android}
 */
export declare const showInAppMessagesAndroid: MutationField<'showInAppMessagesAndroid'>;
/**
 * Launch an external link for Billing Programs (Android only). Developer-rendered
 * Billing Choice external-link flows require 9.1.0+ and a pre-generated token.
 *
 * @param params - Parameters for launching the external link
 * @returns Promise<boolean> - true if user accepted, false otherwise
 * @platform Android
 * @since Google Play Billing Library 8.2.0+
 *
 * @example
 * ```typescript
 * const success = await launchExternalLinkAndroid({
 *   billingProgram: 'billing-choice',
 *   externalTransactionToken: reportingDetails.externalTransactionToken,
 *   launchMode: 'launch-in-external-browser-or-app',
 *   linkType: 'link-to-digital-content-offer',
 *   linkUri: 'https://your-website.com/purchase'
 * });
 * if (success) {
 *   console.log('User accepted external link');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/android/launch-external-link-android}
 */
export declare const launchExternalLinkAndroid: MutationField<'launchExternalLinkAndroid'>;
/**
 * Check if the device can present an external purchase notice sheet (iOS 17.4+).
 * Wraps `ExternalPurchase.canPresent`.
 *
 * @returns Promise<boolean> - true if notice sheet can be presented
 * @platform iOS
 *
 * @example
 * ```typescript
 * const canPresent = await canPresentExternalPurchaseNoticeIOS();
 * if (canPresent) {
 *   // Present notice before external purchase
 *   const result = await presentExternalPurchaseNoticeSheetIOS();
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/can-present-external-purchase-notice-ios}
 */
export declare const canPresentExternalPurchaseNoticeIOS: QueryField<'canPresentExternalPurchaseNoticeIOS'>;
/**
 * Present an external purchase notice sheet to inform users about external purchases (iOS 17.4+).
 * This must be called before opening an external purchase link.
 *
 * @returns Promise<ExternalPurchaseNoticeResultIOS> - Result with action and error if any
 * @platform iOS
 *
 * @example
 * ```typescript
 * const result = await presentExternalPurchaseNoticeSheetIOS();
 * if (result.result === 'continue') {
 *   // User chose to continue, open external purchase link
 *   await presentExternalPurchaseLinkIOS('https://your-website.com/purchase');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-notice-sheet-ios}
 */
export declare const presentExternalPurchaseNoticeSheetIOS: MutationField<'presentExternalPurchaseNoticeSheetIOS'>;
/**
 * Present an external purchase link to redirect users to your website (iOS 16.0+).
 *
 * @param url - The external purchase URL to open
 * @returns Promise<ExternalPurchaseLinkResultIOS> - Result with success status and error if any
 * @platform iOS
 *
 * @example
 * ```typescript
 * const result = await presentExternalPurchaseLinkIOS('https://your-website.com/purchase');
 * if (result.success) {
 *   console.log('User completed external purchase');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/present-external-purchase-link-ios}
 */
export declare const presentExternalPurchaseLinkIOS: MutationField<'presentExternalPurchaseLinkIOS'>;
/**
 * Check if app is eligible for ExternalPurchaseCustomLink API (iOS 18.1+).
 *
 * @returns Promise<boolean> - true if eligible
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/iseligible
 *
 * @example
 * ```typescript
 * const isEligible = await isEligibleForExternalPurchaseCustomLinkIOS();
 * if (isEligible) {
 *   // App can use custom external purchase links
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/is-eligible-for-external-purchase-custom-link-ios}
 */
export declare const isEligibleForExternalPurchaseCustomLinkIOS: QueryField<'isEligibleForExternalPurchaseCustomLinkIOS'>;
/**
 * Get external purchase token for reporting to Apple (iOS 18.1+).
 * Use this token with Apple's External Purchase Server API to report transactions.
 *
 * @param tokenType - Token type: 'acquisition' (new customers) or 'services' (existing customers)
 * @returns Promise<ExternalPurchaseCustomLinkTokenResultIOS> - Result with token string or error
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/token(for:)
 *
 * @example
 * ```typescript
 * // For new customer acquisition
 * const result = await getExternalPurchaseCustomLinkTokenIOS('acquisition');
 * if (result.token) {
 *   // Report token to Apple's External Purchase Server API
 *   await reportToApple(result.token);
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/get-external-purchase-custom-link-token-ios}
 */
export declare const getExternalPurchaseCustomLinkTokenIOS: QueryField<'getExternalPurchaseCustomLinkTokenIOS'>;
/**
 * Show the system disclosure sheet for ExternalPurchaseCustomLink (iOS 18.1+).
 * Call it after a deliberate customer interaction, before linking out.
 *
 * @param noticeType - Notice type: 'browser' (external purchases displayed in browser)
 * @returns Promise<ExternalPurchaseCustomLinkNoticeResultIOS> - Result with continued status and error if any
 * @platform iOS
 * @see https://developer.apple.com/documentation/storekit/externalpurchasecustomlink/shownotice(type:)
 *
 * @example
 * ```typescript
 * const result = await showExternalPurchaseCustomLinkNoticeIOS('browser');
 * if (result.continued) {
 *   // User agreed to continue to external purchase
 *   await Linking.openURL('https://your-store.com/checkout');
 * }
 * ```
 *
 * @see {@link https://openiap.dev/docs/apis/ios/show-external-purchase-custom-link-notice-ios}
 */
export declare const showExternalPurchaseCustomLinkNoticeIOS: MutationField<'showExternalPurchaseCustomLinkNoticeIOS'>;
//# sourceMappingURL=index.d.ts.map