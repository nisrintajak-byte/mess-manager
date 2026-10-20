/**
 * Error utilities for parsing platform-specific error responses
 */
export interface IapError {
    code: string;
    message: string;
    responseCode?: number;
    debugMessage?: string;
    productId?: string;
    productIds?: string[];
    productType?: string;
    isEmptyProductList?: boolean;
    [key: string]: any;
}
/**
 * Parses error string from native modules into a structured error object
 *
 * Native modules return errors in different formats:
 * - Android: JSON string like '{"code":"E_USER_CANCELLED","message":"User cancelled the purchase","responseCode":1}'
 * - iOS: JSON string, Nitro NSError string with embedded JSON, or plain message
 * - Legacy: "CODE: message" format
 *
 * @param errorString - The error string from native module
 * @returns Parsed error object with code and message
 */
export declare function parseErrorStringToJsonObj(errorString: string | Error | unknown): IapError;
/**
 * Checks if an error code indicates user cancellation
 * @param error - Error object or string
 * @returns true if the error is a user cancellation
 */
export declare function isUserCancelledError(error: IapError | string | Error | unknown): boolean;
export { isDuplicatePurchaseError, DUPLICATE_PURCHASE_CODE, } from './errorMapping.js';
//# sourceMappingURL=error.d.ts.map