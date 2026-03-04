/**
 * errors.ts — Centralised error-message helpers.
 *
 * Import these wherever you need to turn an API / crypto error into a
 * human-readable string.  Keeping them here means the messages stay
 * consistent across pages and hooks without being copy-pasted.
 */

/**
 * Extract the best error message from a FastAPI / axios error.
 *
 * FastAPI can return:
 *   - `{ detail: "string" }`          – plain 4xx/5xx
 *   - `{ detail: [{msg, loc, …}] }`   – pydantic validation errors
 *
 * Falls back to `fallback` when no detail is present.
 */
export const parseApiError = (err: unknown, fallback: string): string => {
    const detail = (err as any)?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0)
        return detail
            .map((d: any) => String(d.msg ?? d).replace(/^Value error,\s*/i, ''))
            .join('; ');
    return fallback;
};

/**
 * Human-readable error for vault item load / decrypt failures.
 * Used by `handleSelectItem` and similar item-fetch flows.
 */
export const getItemLoadError = (err: unknown): string => {
    const e = err as any;
    if (e?.message === 'CRYPTO_FAIL') return 'Decrypt failed — wrong master password?';
    if (e?.message === 'BAD_FORMAT') return 'Item data is corrupted';
    if (e?.message === 'NO_KEY') return 'Vault is locked — please re-enter master password';
    if (e?.response?.status === 404) return 'Item not found';
    if (e?.response?.status === 401) return 'Session expired — please sign in again';
    return 'Failed to load item';
};
