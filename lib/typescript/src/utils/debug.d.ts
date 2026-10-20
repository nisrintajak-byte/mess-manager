/**
 * Debug logger for React Native IAP.
 * log/debug/info print only when library developers set RN_IAP_DEV_MODE=true,
 * so apps stay silent even in their dev builds. warn/error always print.
 */
export declare const RnIapConsole: {
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
};
//# sourceMappingURL=debug.d.ts.map