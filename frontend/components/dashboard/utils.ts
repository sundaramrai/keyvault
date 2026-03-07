import { vaultApi } from '@/lib/api';
import { decryptData } from '@/lib/crypto';
import { useAuthStore, VaultItem } from '@/lib/store';
import { emptyForm } from './types';

export const tryGetFaviconUrl = (url: string): string | undefined => {
    try {
        const { hostname } = new URL(url.includes('://') ? url : `https://${url}`);
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
        return undefined;
    }
};

export const fetchAndDecryptItem = async (item: VaultItem): Promise<VaultItem> => {
    const { data } = await vaultApi.get(item.id);
    if (!data.encrypted_data?.includes('.')) throw new Error('BAD_FORMAT');
    const { cryptoKey: key } = useAuthStore.getState();
    if (!key) throw new Error('NO_KEY');
    let dec: any;
    try {
        dec = await decryptData(data.encrypted_data, key);
    } catch (cryptoErr) {
        console.error('[decrypt] WebCrypto error for item', item.id, cryptoErr);
        throw new Error('CRYPTO_FAIL');
    }
    const enriched: VaultItem = { ...item, encrypted_data: data.encrypted_data, decrypted: dec };
    useAuthStore.getState().updateVaultItem(item.id, enriched);
    return enriched;
};

export const buildPayload = (form: typeof emptyForm) => {
    switch (form.category) {
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
