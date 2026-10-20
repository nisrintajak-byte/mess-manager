import type { ProductQueryType, RequestPurchaseProps, BillingChoiceScreenTypeAndroid, BillingProgramAndroid, DeveloperProvidedBillingDetailsAndroid, UserChoiceBillingDetails, VerifyPurchaseProps, VerifyPurchaseResult, VerifyPurchaseWithProviderProps, VerifyPurchaseWithProviderResult, PurchaseOptions, ActiveSubscription, Product, Purchase, PurchaseError, PurchaseUpdatedListenerOptions, ProductSubscription, MutationField, QueryField, MutationFinishTransactionArgs } from '../types.js';
type UseIap = {
    connected: boolean;
    products: Product[];
    subscriptions: ProductSubscription[];
    availablePurchases: Purchase[];
    promotedProductIOS?: Product;
    activeSubscriptions: ActiveSubscription[];
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
    finishTransaction: (args: MutationFinishTransactionArgs) => Promise<void>;
    /**
     * List the user's unfinished purchases — non-consumables, active subscriptions, and any
     * pending transactions not yet finished.
     *
     * @param options Optional `PurchaseOptions`.
     *   - iOS: `alsoPublishToEventListenerIOS`, `onlyIncludeActiveItemsIOS`.
     *   - Android: `includeSuspendedAndroid` (include subscriptions in a paused/grace state).
     * @returns Promise that resolves when the request is dispatched; results land in the
     *   hook's reactive `availablePurchases` state — read from there, don't expect a return value.
     * @throws When the platform query fails.
     *
     * @example
     * ```ts
     * const { connected, availablePurchases, getAvailablePurchases, finishTransaction } = useIAP();
     *
     * useEffect(() => {
     *   if (!connected) return;
     *   void getAvailablePurchases().catch((error) => {
     *     console.warn('Purchase restore failed', error);
     *   });
     * }, [connected, getAvailablePurchases]);
     *
     * useEffect(() => {
     *   void (async () => {
     *     for (const p of availablePurchases) {
     *       if (await verifyOnServer(p)) {
     *         await finishTransaction({ purchase: p, isConsumable: false });
     *       }
     *     }
     *   })().catch((error) => {
     *     console.warn('Restored purchase processing failed', error);
     *   });
     * }, [availablePurchases, finishTransaction]);
     * ```
     *
     * @see {@link https://openiap.dev/docs/apis/get-available-purchases}
     */
    getAvailablePurchases: (options?: PurchaseOptions) => Promise<void>;
    /**
     * Retrieve products or subscriptions from the store by SKU.
     *
     * @param params `ProductRequest` — `skus` (string[]) and optional `type`
     *   (`'in-app' | 'subs' | 'all'`, defaults to `'in-app'`).
     * @returns Promise that resolves when the request is dispatched; results land in the
     *   hook's reactive `products` / `subscriptions` state — read from there, don't expect a return value.
     * @throws When the store rejects the request (empty `skus`, not connected,
     *   network/store error). Unknown SKUs are simply omitted from the result, not thrown.
     *
     * @example
     * ```ts
     * const { connected, products, fetchProducts } = useIAP();
     *
     * useEffect(() => {
     *   if (!connected) return;
     *   void fetchProducts({
     *     skus: ['com.app.coins_100', 'com.app.premium'],
     *     type: 'in-app',
     *   }).catch((error) => {
     *     console.warn('Product fetch failed', error);
     *   });
     * }, [connected, fetchProducts]);
     *
     * // Render `products` directly from hook state.
     * ```
     *
     * @remarks This is a regular promise-based call. Don't confuse with `request*` APIs
     *   (`requestPurchase`), which are event-based.
     *
     * @see {@link https://openiap.dev/docs/apis/fetch-products}
     */
    fetchProducts: (params: {
        skus: string[];
        type?: ProductQueryType | null;
    }) => Promise<void>;
    /**
     * Initiate a purchase or subscription flow. The result is delivered through
     * `purchaseUpdatedListener` — NOT the return value.
     *
     * @param props `RequestPurchaseProps`, discriminated by `type`:
     *   - `type: 'in-app'` — pass `request.apple.sku` (iOS) and/or `request.google.skus` (Android).
     *   - `type: 'subs'`  — same shape, plus `request.google.subscriptionOffers: [{ sku, offerToken }]`.
     * @returns Promise that resolves when the request is dispatched; results land in the
     *   hook's `onPurchaseSuccess` / `onPurchaseError` callbacks.
     * @throws Invalid arguments or failures that prevent dispatch. Store outcomes are event-based;
     *   on Android, `not-prepared` is delivered through `onPurchaseError`.
     *
     * @example
     * ```ts
     * const { connected, requestPurchase } = useIAP();
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
    requestPurchase: (params: RequestPurchaseProps) => Promise<void>;
    /**
     * Verify a purchase against your own backend (returns isValid + raw store metadata).
     *
     * @see {@link https://openiap.dev/docs/features/validation#verify-purchase}
     */
    verifyPurchase: (options: VerifyPurchaseProps) => Promise<VerifyPurchaseResult>;
    /**
     * Verify via a managed provider. `iapkit` (IAPKit) is the only one.
     *
     * @see {@link https://openiap.dev/docs/features/validation#verify-purchase-with-provider}
     */
    verifyPurchaseWithProvider: (options: VerifyPurchaseWithProviderProps) => Promise<VerifyPurchaseWithProviderResult>;
    /**
     * Restore non-consumable and active subscription purchases.
     *
     * @see {@link https://openiap.dev/docs/apis/restore-purchases}
     */
    restorePurchases: (options?: PurchaseOptions) => Promise<void>;
    /**
     * Read the App Store-promoted product, if any.
     *
     * @see {@link https://openiap.dev/docs/apis/ios/get-promoted-product-ios}
     */
    getPromotedProductIOS: () => Promise<Product | null>;
    /**
     * Get details of all currently active subscriptions.
     *
     * @see {@link https://openiap.dev/docs/apis/get-active-subscriptions}
     */
    getActiveSubscriptions: (subscriptionIds?: string[]) => Promise<ActiveSubscription[]>;
    /**
     * Check whether the user has any active subscription.
     *
     * @see {@link https://openiap.dev/docs/apis/has-active-subscriptions}
     */
    hasActiveSubscriptions: (subscriptionIds?: string[]) => Promise<boolean>;
    /**
     * Manually retry the store connection.
     * Useful when the initial auto-connect fails (e.g., Play Store not ready at mount time).
     * Updates the `connected` state on success.
     */
    reconnect: () => Promise<boolean>;
    /**
     * Open the store's offer/promo code redemption flow. Resolves the redeemed
     * purchase only when StoreKit reports it synchronously (iOS 27+ built with
     * Xcode 27+), otherwise null; redeemed purchases arrive through the standard
     * purchase listeners.
     *
     * @see {@link https://openiap.dev/docs/apis/open-redeem-offer-code}
     */
    openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
    /** Fetch assets and loyalty text for a developer-rendered Billing Choice screen. */
    getBillingChoiceInfoAndroid?: QueryField<'getBillingChoiceInfoAndroid'>;
    /** Check Billing Program availability and the configured choice renderer. */
    isBillingProgramAvailableAndroid?: MutationField<'isBillingProgramAvailableAndroid'>;
    /** Create Google Play reporting details for a developer billing transaction. */
    createBillingProgramReportingDetailsAndroid?: MutationField<'createBillingProgramReportingDetailsAndroid'>;
    /** Launch a supported Billing Program external link. */
    launchExternalLinkAndroid?: MutationField<'launchExternalLinkAndroid'>;
    /** Show the required Billing Choice information dialog. */
    showBillingProgramInformationDialogAndroid?: MutationField<'showBillingProgramInformationDialogAndroid'>;
    /** Show Play billing in-app messages. */
    showInAppMessagesAndroid?: MutationField<'showInAppMessagesAndroid'>;
};
export interface UseIapOptions {
    onPurchaseSuccess?: (purchase: Purchase) => void;
    /**
     * Options for the purchase success listener. iOS defaults to suppressing
     * StoreKit replay events for the same transaction ID; set
     * `dedupeTransactionIOS` to false only for diagnostics.
     */
    purchaseUpdatedListenerOptions?: PurchaseUpdatedListenerOptions | null;
    onPurchaseError?: (error: PurchaseError) => void;
    /** Callback for non-purchase errors (fetchProducts, getAvailablePurchases, etc.) */
    onError?: (error: Error) => void;
    onPromotedProductIOS?: (product: Product) => void;
    onUserChoiceBillingAndroid?: (details: UserChoiceBillingDetails) => void;
    /**
     * Fires when the user selects developer-provided billing in an External
     * Payments or Google-rendered Billing Choice flow.
     */
    onDeveloperProvidedBillingAndroid?: (details: DeveloperProvidedBillingDetailsAndroid) => void;
    /**
     * Fires when a subscription enters a billing-issue state (StoreKit 2
     * Message.billingIssue on iOS / Mac Catalyst 16.4+ and visionOS 1.0+,
     * Purchase.isSuspended on Play Billing 8.1+); never on Meta Horizon or Amazon
     * Appstore. Recommended: call deepLinkToSubscriptions so the user can update
     * their payment method in the platform subscription center.
     */
    onSubscriptionBillingIssue?: (purchase: Purchase) => void;
    /**
     * Enable a specific billing program for Android (8.2.0+)
     * Use 'user-choice-billing' for User Choice Billing (7.0+).
     * Use 'external-offer' for External Offer program.
     * Use 'external-payments' for Developer Provided Billing (Japan only, 8.3.0+).
     * Use 'billing-choice' for Billing Choice (9.1.0+).
     */
    enableBillingProgramAndroid?: BillingProgramAndroid;
    /**
     * Select who renders the Billing Choice screen (9.1.0+). Must match the
     * choiceScreenType returned by isBillingProgramAvailableAndroid.
     */
    billingChoiceScreenTypeAndroid?: BillingChoiceScreenTypeAndroid;
}
/**
 * React Hook for managing In-App Purchases.
 * See documentation at https://react-native-iap.hyo.dev/docs/hooks/useIAP
 */
export declare function useIAP(options?: UseIapOptions): UseIap;
export {};
//# sourceMappingURL=useIAP.d.ts.map