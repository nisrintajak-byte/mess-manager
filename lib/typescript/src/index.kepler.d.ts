import type { MutationField, ProductQueryType, ProductRequest, Purchase, PurchaseError, PurchaseUpdatedListenerOptions, QueryField } from './types.js';
import type { RnIap } from './specs/RnIap.nitro.js';
export * from './types.js';
export * from './utils/error.js';
export { isVegaOS } from './vega.js';
export declare const getVegaIapModule: () => Omit<RnIap, "claimFirstPurchaseNotice"> | null;
export { useIAP, type UseIapOptions } from './hooks/useIAP.js';
export { kitApi, KitApiError, resolveLocalizedPayload } from './kit-api.js';
export type { EntitlementsResponse, KitApiOptions, KitClientPayloadCache, KitClientPayloadOptions, KitClientPayloadResponse, KitLocalizedClientPayload, KitLocalizedClientPayloadOptions, KitLocalizedPayloadOptions, KitProduct, KitProductClientPayload, KitProductOffer, KitProductPlatform, KitProductsOptions, KitProductsResponse, KitSubscription, StatusResponse, } from './kit-api.js';
/** Product type accepted by the Amazon Vega entry point. */
export type ProductTypeInput = 'in-app' | 'subs';
export interface EventSubscription {
    remove(): void;
}
export declare const isNitroReady: () => boolean;
export declare const isTVOS: () => boolean;
export declare const isMacOS: () => boolean;
export declare const isStandardIOS: () => boolean;
export declare const initConnection: MutationField<'initConnection'>;
export declare const endConnection: MutationField<'endConnection'>;
export declare const fetchProducts: (request: Omit<ProductRequest, "type"> & {
    type?: ProductQueryType | ProductTypeInput | null;
}) => ReturnType<QueryField<"fetchProducts">>;
export declare const requestPurchase: MutationField<'requestPurchase'>;
export declare const getAvailablePurchases: QueryField<'getAvailablePurchases'>;
export declare const finishTransaction: MutationField<'finishTransaction'>;
export declare const restorePurchases: MutationField<'restorePurchases'>;
export declare const getActiveSubscriptions: QueryField<'getActiveSubscriptions'>;
export declare const hasActiveSubscriptions: QueryField<'hasActiveSubscriptions'>;
export declare const purchaseUpdatedListener: (listener: (purchase: Purchase) => void, options?: PurchaseUpdatedListenerOptions | null) => EventSubscription;
export declare const purchaseErrorListener: (listener: (error: PurchaseError) => void) => EventSubscription;
export declare const getStorefront: QueryField<'getStorefront'>;
export declare const verifyPurchaseWithProvider: MutationField<'verifyPurchaseWithProvider'>;
export declare const verifyPurchase: MutationField<'verifyPurchase'>;
export declare const syncIOS: MutationField<'syncIOS'>;
export declare const verifyAppOwnership: QueryField<'verifyAppOwnership'>;
export declare const getAppTransactionIOS: QueryField<'getAppTransactionIOS'>;
export declare const getPromotedProductIOS: QueryField<'getPromotedProductIOS'>;
export declare const showManageSubscriptionsIOS: MutationField<'showManageSubscriptionsIOS'>;
export declare const openRedeemOfferCode: MutationField<'openRedeemOfferCode'>;
export declare const presentExternalPurchaseLinkIOS: MutationField<'presentExternalPurchaseLinkIOS'>;
export declare const deepLinkToSubscriptions: MutationField<'deepLinkToSubscriptions'>;
export declare const promotedProductListenerIOS: () => EventSubscription;
export declare const acknowledgePurchaseAndroid: MutationField<'acknowledgePurchaseAndroid'>;
export declare const consumePurchaseAndroid: MutationField<'consumePurchaseAndroid'>;
export declare const isBillingProgramAvailableAndroid: MutationField<'isBillingProgramAvailableAndroid'>;
export declare const getBillingChoiceInfoAndroid: QueryField<'getBillingChoiceInfoAndroid'>;
export declare const launchExternalLinkAndroid: MutationField<'launchExternalLinkAndroid'>;
export declare const createBillingProgramReportingDetailsAndroid: MutationField<'createBillingProgramReportingDetailsAndroid'>;
export declare const showBillingProgramInformationDialogAndroid: MutationField<'showBillingProgramInformationDialogAndroid'>;
export declare const showInAppMessagesAndroid: MutationField<'showInAppMessagesAndroid'>;
export declare const userChoiceBillingListenerAndroid: () => EventSubscription;
export declare const developerProvidedBillingListenerAndroid: () => EventSubscription;
export declare const subscriptionBillingIssueListener: () => EventSubscription;
//# sourceMappingURL=index.kepler.d.ts.map