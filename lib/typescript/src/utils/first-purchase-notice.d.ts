import type { Purchase } from '../types.js';
export declare const FIRST_PURCHASE_NOTICE: readonly ["[OpenIAP] First purchase finished in this app 🎉", "If OpenIAP saved you time, a star helps: https://github.com/hyodotdev/openiap", "When your app ships, list it for free: https://openiap.dev/showcase", "(Shown once, debug builds only.)"];
/** What the notice reads from the running app; tests pass their own. */
export interface FirstPurchaseNoticeSignals {
    isDebugBuild: () => boolean;
    isTestRunner: () => boolean;
    /** Vega OS runs the JS adapter, which has no native once-per-install flag. */
    isVegaOS: () => boolean;
    log: (message: string) => void;
}
/**
 * Returns the hook `finishTransaction` calls after a successful finish. It
 * prints the notice for a purchased purchase in a debug build, at most once per
 * install (`claim` owns the native flag), and never throws.
 */
export declare const createFirstPurchaseNotice: (claim: () => boolean, signals?: FirstPurchaseNoticeSignals) => ((purchase: Purchase) => void);
//# sourceMappingURL=first-purchase-notice.d.ts.map