'use client';

import { useState } from 'react';

import { authApi } from '@/lib/api';
import { deriveKey, deriveMasterPasswordVerifier, decryptData } from '@/lib/crypto';
import { getSessionAwareError, parseApiError } from '@/lib/errors';
import { toastService } from '@/lib/toast';
import type { SidebarCounts, VaultItem } from '@/lib/types';

type UseVaultUnlockArgs = {
  user: { vault_salt?: string } | null;
  setVaultKey: (key: CryptoKey) => void;
  setVaultItems: (items: VaultItem[]) => void;
  setTotalPages: (value: number) => void;
  setTotalItems: (value: number) => void;
  setSidebarCounts: (counts: SidebarCounts) => void;
  cacheAllView: (items: VaultItem[], totalPages: number, totalItems: number) => void;
};

export function useVaultUnlock({
  user,
  setVaultKey,
  setVaultItems,
  setTotalPages,
  setTotalItems,
  setSidebarCounts,
  cacheAllView,
}: Readonly<UseVaultUnlockArgs>) {
  const [masterPassword, setMasterPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const unlockVault = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setUnlocking(true);
    try {
      await toastService.withProgress(
        'Unlocking vault...',
        async (update) => {
          const salt = user?.vault_salt;
          if (!salt) throw new Error('NO_SALT');

          const key = await deriveKey(masterPassword, salt);
          const verifier = await deriveMasterPasswordVerifier(masterPassword, salt);

          update('Unlocking vault...');
          const { data: listResult } = await authApi.unlock(verifier);

          setVaultKey(key);
          update('Decrypting items...');

          const decryptedItems = await Promise.all(
            listResult.items.map(async (item) => {
              if (!item.encrypted_data) return item;
              try {
                return { ...item, decrypted: await decryptData(item.encrypted_data, key) };
              } catch {
                return item;
              }
            }),
          );

          setVaultItems(decryptedItems);
          setTotalPages(listResult.total_pages ?? 1);
          setTotalItems(listResult.total ?? 0);
          if (listResult.sidebar_counts) {
            setSidebarCounts(listResult.sidebar_counts);
          }
          cacheAllView(
            decryptedItems,
            listResult.total_pages ?? 1,
            listResult.total ?? 0,
          );
          setMasterPassword('');
        },
        'Vault unlocked',
        {
          getError: (err: unknown) => {
            const error = err as Error;
            const apiMessage = parseApiError(err, '');
            if (error?.message === 'WRONG_PASSWORD' || apiMessage === 'Invalid master password') {
              return 'Wrong master password';
            }
            if (error?.message === 'NO_SALT') return 'Session error - please sign out and sign in again';
            if ((err as { response?: { status?: number } })?.response?.status === 401) {
              return getSessionAwareError(err, 'Session expired - please sign in again');
            }
            console.error('[unlock] Error:', err);
            return parseApiError(err, 'Failed to unlock vault');
          },
        },
      );
    } finally {
      setUnlocking(false);
    }
  };

  return { masterPassword, setMasterPassword, unlocking, unlockVault };
}
