export type KitApiOptions = {
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
    /** Optional AsyncStorage-compatible persistent cache for direct client
     * payload reads. Cache failures never change a successful API result. */
    clientPayloadCache?: KitClientPayloadCache;
};
export type KitClientPayloadCache = {
    getItem: (key: string) => Promise<string | null> | string | null;
    setItem: (key: string, value: string) => Promise<void> | void;
    removeItem?: (key: string) => Promise<void> | void;
};
export type KitClientPayloadOptions = {
    /** Revalidate a cached payload with its scoped ETag. Without this flag,
     * a valid persistent entry is returned without a network request. A
     * network error, 429, or 5xx returns the cached copy marked `stale`. */
    refresh?: boolean;
};
export type KitLocalizedPayloadOptions = {
    /** BCP 47 tag such as `ko-KR`. */
    locale: string;
    fallbackLocales?: string[];
    /** Defaults to `[1]`. Any other `schemaVersion` resolves to null. */
    supportedSchemaVersions?: number[];
};
export type KitLocalizedClientPayloadOptions = KitLocalizedPayloadOptions & KitClientPayloadOptions;
export type KitLocalizedClientPayload = {
    values: Record<string, unknown>;
    version: number;
    stale: boolean;
};
export type KitSubscription = {
    id: string;
    productId: string;
    platform: "IOS" | "Android";
    state: "Active" | "InGracePeriod" | "InBillingRetry" | "Expired" | "Revoked" | "Refunded" | "Paused" | "Unknown";
    expiresAt?: number;
    renewsAt?: number;
    willRenew?: boolean;
    cancellationReason?: string;
    currency?: string;
    priceAmountMicros?: number;
    startedAt: number;
    updatedAt: number;
    purchaseToken: string;
    originalTransactionId?: string;
    userId?: string;
};
export type EntitlementsResponse = {
    userId: string;
    productIds: string[];
    subscriptions: KitSubscription[];
};
export type StatusResponse = {
    active: boolean;
    subscription: KitSubscription | null;
};
export type KitProductPlatform = "IOS" | "Android";
export type KitProductClientPayload = {
    /** Current values are toml, json, and text; preserve unknown values. */
    format: string;
    body: string;
    version: number;
    updatedAt: number;
};
export type KitProductOffer = {
    id: string;
    kind: "FreeTrial" | "IntroPayUpFront" | "IntroPayAsYouGo" | "PromotionalOffer" | "BasePlan";
    duration?: string;
    numberOfPeriods?: number;
    priceAmountMicros?: number;
    currency?: string;
};
export type KitProduct = {
    productId: string;
    platform: KitProductPlatform;
    type: "Subscription" | "NonConsumable" | "Consumable";
    title: string;
    description?: string;
    baseLocale?: string;
    localizations?: {
        locale: string;
        title: string;
        description?: string;
    }[];
    regions?: "all" | string[];
    priceAmountMicros?: number;
    currency?: string;
    state: "Draft" | "Ready" | "Active" | "Removed";
    storeRef?: string;
    subscriptionGroupId?: string;
    subscriptionGroupName?: string;
    billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
    offers?: KitProductOffer[];
    updatedAt: number;
    clientPayload?: KitProductClientPayload;
};
export type KitProductsOptions = {
    platform?: KitProductPlatform;
    /** Include public client payload bodies in a bounded platform page. */
    includeClientPayload?: boolean;
    /** Page size for every catalog read (default 25, maximum 50). */
    limit?: number;
    /** Opaque cursor returned as `nextCursor` by the previous page. */
    cursor?: string;
};
export type KitProductsResponse = {
    products: KitProduct[];
    hasMore: boolean;
    /** Present when a catalog page has another page. */
    nextCursor?: string;
};
export type KitSubscriptionsResponse = {
    items: KitSubscription[];
    total: number;
};
export type KitMrrCurrencyEntry = {
    currency: string;
    mrrMicros: number;
};
export type KitMetricsResponse = {
    /** Headline counts and MRR are usable only when current; absent on older servers. */
    stats?: {
        state: "current" | "rebuilding" | "incomplete";
        /** Last evaluation time in Unix milliseconds. */
        asOf: number;
        /** Earliest counted expiry in Unix milliseconds; null means no known expiry. */
        validUntil: number | null;
    };
    /** The bounded 30-day scan omitted older matching rows. */
    recentCountsTruncated?: boolean;
    activeSubs: number;
    inGracePeriod: number;
    inBillingRetry: number;
    refunded30d: number;
    canceled30d: number;
    mrrMicros: number;
    currency: string;
    reportingCurrency: string;
    mrrByCurrency: KitMrrCurrencyEntry[];
    excludedMrrByCurrency: KitMrrCurrencyEntry[];
};
export type KitRevenueMetricsResponse = {
    days: {
        day: string;
        currency: string;
        productId: string;
        platform: KitProductPlatform;
        activeSubs: number;
        newSubs: number;
        renewals: number;
        cancellations: number;
        refunds: number;
        revenueMicros: number;
    }[];
    currencies: string[];
    productIds: string[];
    platforms: KitProductPlatform[];
    truncated: boolean;
};
export type KitProductUpsertResponse = {
    id: string;
    created: boolean;
};
export type KitProductStateResponse = {
    id: string;
    state: KitProduct["state"];
};
export type KitClientPayloadStateResponse = {
    expectedVersion: number;
    clientPayload?: KitProductClientPayload;
};
export type KitSetClientPayloadResponse = {
    id: string;
    created: boolean;
    changed: boolean;
    version: number;
    updatedAt: number;
};
export type KitRemoveClientPayloadResponse = {
    ok: boolean;
};
export type KitClientPayloadDraftStateResponse = {
    expectedDraftRevision: number;
    draft?: {
        format: string;
        body: string;
        baseVersion: number;
        updatedAt: number;
    };
};
export type KitSaveClientPayloadDraftResponse = {
    changed: boolean;
    revision: number;
    baseVersion: number;
    updatedAt: number;
};
export type KitClientPayloadVersion = {
    version: number;
    action: "publish" | "rollback" | "remove";
    format?: string;
    byteLength?: number;
    rolledBackFrom?: number;
    note?: string;
    /** `name` is a display or API key name, never an email. */
    author?: {
        type: "user" | "apiKey";
        name?: string;
    };
    createdAt: number;
    /** Absent for a `remove` entry and in history listings. */
    body?: string;
};
export type KitClientPayloadVersionSummary = Omit<KitClientPayloadVersion, "body">;
export type KitClientPayloadHistoryResponse = {
    versions: KitClientPayloadVersionSummary[];
};
export type KitClientPayloadVersionResponse = {
    version: KitClientPayloadVersion;
};
export type KitProductSyncResponse = {
    jobId: string;
    deduped: boolean;
};
export type KitProductSyncJobResponse = {
    _id: string;
    _creationTime: number;
    projectId: string;
    platform: KitProductPlatform;
    direction: "pull" | "push" | "both" | "purge-local";
    dryRun: boolean;
    status: "queued" | "running" | "succeeded" | "failed";
    progress: {
        phase: string;
        current?: number;
        total?: number;
        failuresCount?: number;
    };
    result?: {
        pulled: number;
        pushed: number;
        deleted?: number;
        failures: {
            productId: string;
            reason: string;
        }[];
        failuresTruncated?: boolean;
        plannedWrites?: {
            productId: string;
            step: string;
            detail?: string;
        }[];
        plannedWritesTruncated?: boolean;
        manualActions?: {
            productId: string;
            code: string;
            message: string;
        }[];
        manualActionsTruncated?: boolean;
    };
    error?: string;
    cancelRequested?: boolean;
    expectedDeadline?: number;
    createdBy?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
};
export type KitClientPayloadResponse = {
    clientPayload: KitProductClientPayload;
    /** Set when a refresh failed and the cached copy was returned. */
    stale?: true;
};
export declare class KitApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, body: unknown, message: string);
}
export declare function kitApi(options: KitApiOptions): {
    apiKey: string;
    baseUrl: string;
    /** @deprecated Mobile account paths return 410. Use your authenticated
     * backend and secret-only v2 reads: https://kit.openiap.dev/docs/api. */
    status: (userId: string) => Promise<StatusResponse>;
    /** @deprecated Mobile account paths return 410. Use your authenticated
     * backend and secret-only v2 reads: https://kit.openiap.dev/docs/api. */
    entitlements: (userId: string) => Promise<EntitlementsResponse>;
    /** GET /v1/products — read the store-synced catalog. Client payloads
     * are excluded unless explicitly requested because they may add up to
     * 16 KiB per product. */
    products: (productOptions?: KitProductsOptions) => Promise<KitProductsResponse>;
    /** GET one public client payload by its store-specific natural key.
     * Payloads are app-facing data; never store secrets in them. */
    clientPayload: (productId: string, platform: KitProductPlatform, payloadOptions?: KitClientPayloadOptions) => Promise<KitClientPayloadResponse>;
    /** Read a JSON payload that follows the localization convention and
     * resolve it for `locale`. Never throws: any failure, a non-JSON format,
     * or an unsupported `schemaVersion` returns null so the app can use its
     * built-in copy. */
    localizedClientPayload: (productId: string, platform: KitProductPlatform, localizedOptions: KitLocalizedClientPayloadOptions) => Promise<KitLocalizedClientPayload | null>;
    /** @deprecated Mobile binding paths return 410. Bind on your authenticated
     * backend with a secret key: https://kit.openiap.dev/docs/api. */
    bindUser: (purchaseToken: string, userId: string) => Promise<{
        ok: boolean;
        bound: boolean;
    }>;
};
/**
 * Resolve the OpenIAP payload localization convention:
 * `{ schemaVersion: 1, default: {...}, locales: { "ko": {...}, "en-US": {...} } }`.
 * Tries each requested tag and its shorter prefixes (`zh-Hant-TW`, `zh-Hant`,
 * `zh`), then `fallbackLocales` the same way, and shallow-merges the first
 * match over `default`. Returns null for an unsupported or missing
 * `schemaVersion`, or when nothing matches and there is no `default`.
 */
export declare function resolveLocalizedPayload(payload: unknown, options: KitLocalizedPayloadOptions): Record<string, unknown> | null;
//# sourceMappingURL=kit-api.d.ts.map