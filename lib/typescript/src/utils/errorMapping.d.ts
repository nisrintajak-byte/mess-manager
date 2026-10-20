/**
 * Error-code helpers shared by react-native-iap and expo-iap.
 * Edit the react-native-iap copy; `bun run sync` in specs/client mirrors it to
 * expo-iap, and the parity audit fails if the copies drift.
 */
import { ErrorCode, type IapPlatform, type SubResponseCodeAndroid } from '../types.js';
export interface PurchaseErrorProps {
    message?: string;
    responseCode?: number;
    debugMessage?: string;
    code?: ErrorCode | string | number;
    productId?: string;
    productIds?: string[];
    productType?: string;
    isEmptyProductList?: boolean;
    subResponseCodeAndroid?: SubResponseCodeAndroid;
    platform?: IapPlatform;
}
export interface PurchaseError extends Error {
    responseCode?: number;
    debugMessage?: string;
    code?: ErrorCode;
    productId?: string;
    productIds?: string[];
    productType?: string;
    isEmptyProductList?: boolean;
    subResponseCodeAndroid?: SubResponseCodeAndroid;
    platform?: IapPlatform;
}
/** Error code for duplicate purchase events. */
export declare const DUPLICATE_PURCHASE_CODE = ErrorCode.DuplicatePurchase;
/** Maps any code spelling (`user-cancelled`, `E_USER_CANCELED`, `UserCancelled`) to an ErrorCode. */
export declare const normalizeErrorCodeFromNative: (code: unknown) => ErrorCode;
export declare const ErrorCodeMapping: {
    readonly ios: Record<ErrorCode, string>;
    readonly android: Record<ErrorCode, string>;
};
export declare const ErrorCodeUtils: {
    getNativeErrorCode: (errorCode: ErrorCode) => string;
    fromPlatformCode: (platformCode: string | number | null | undefined, platform: IapPlatform) => ErrorCode;
    toPlatformCode: (errorCode: ErrorCode, _platform: IapPlatform) => string | number;
    isValidForPlatform: (errorCode: ErrorCode, _platform: IapPlatform) => boolean;
};
export declare const createPurchaseError: (props: PurchaseErrorProps) => PurchaseError;
export declare const createPurchaseErrorFromPlatform: (errorData: PurchaseErrorProps, platform: IapPlatform) => PurchaseError;
type ErrorLike = string | {
    code?: ErrorCode | string;
    message?: string;
};
export declare function isUserCancelledError(error: unknown): boolean;
export declare function isDuplicatePurchaseError(error: unknown): boolean;
export declare function isNetworkError(error: unknown): boolean;
export declare function isRecoverableError(error: unknown): boolean;
/**
 * End-user copy for a known error code, derived from the code by design: the
 * native message can name build configuration a customer must not be shown.
 * Developers get that diagnostic as `error.message`.
 */
export declare function getUserFriendlyErrorMessage(error: ErrorLike): string;
export {};
//# sourceMappingURL=errorMapping.d.ts.map