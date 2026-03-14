import { vaultApi } from '@/lib/api';
import { decryptData } from '@/lib/crypto';
import type { VaultItem } from '@/lib/types';

import type { Category, ItemForm } from './types';
export const tryGetFaviconUrl = (url: string): string | undefined => {
    try {
        const { hostname } = new URL(url.includes('://') ? url : `https://${url}`);
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
        return undefined;
    }
};

/**
 * fetchAndDecryptItem
 * Fetches encrypted_data from the API if not already present, decrypts it,
 * and calls onUpdate with the enriched item.
 *
 * Accepts the crypto key and the store updater as explicit parameters so this
 * utility has no direct dependency on the Zustand store (SRP, testability).
 */
export const fetchAndDecryptItem = async (item: VaultItem,
    key: CryptoKey,
    onUpdate: (id: string, enriched: VaultItem) => void,
): Promise<VaultItem> => {
    let encryptedData = item.encrypted_data;
    if (!encryptedData) {
        const { data } = await vaultApi.get(item.id);
        encryptedData = data.encrypted_data as string;
    }
    if (!encryptedData?.includes('.')) throw new Error('BAD_FORMAT');
    let dec: unknown;
    try {
        dec = await decryptData(encryptedData, key);
    } catch (cryptoErr) {
        console.error('[decrypt] WebCrypto error for item', item.id, cryptoErr);
        throw new Error('CRYPTO_FAIL');
    }
    const enriched: VaultItem = { ...item, encrypted_data: encryptedData, decrypted: dec as VaultItem['decrypted'] };
    onUpdate(item.id, enriched);
    return enriched;
};

/**
 * buildPayload
 * Extracts the category-specific fields from the item form to be encrypted.
 */

export const buildPayload = (form: ItemForm) => {
    switch (form.category as Category) {
        case 'card':
            return { cardNumber: form.cardNumber, cardHolder: form.cardHolder, expiry: form.expiry, cvv: form.cvv, notes: form.notes };
        case 'identity':
            return { firstName: form.firstName, lastName: form.lastName, phone: form.phone, address: form.address, notes: form.notes };
        case 'note':
            return { notes: form.notes };
        default:
            return { username: form.username, password: form.password, url: form.url, notes: form.notes };
    }
};
