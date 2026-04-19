'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { emitAuthEvent, subscribeToAuthEvents } from '@/lib/authSync';
import type { AuthSyncEvent } from '@/lib/authSync';
import { authApi, vaultApi } from '@/lib/api';
import { decryptData, deriveKey, deriveMasterPasswordVerifier, encryptData, generateSaltHex } from '@/lib/crypto';
import { getItemLoadError, getSessionAwareError } from '@/lib/errors';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import type { VaultItem } from '@/lib/types';
import { LockedVaultScreen } from '../../../components/dashboard/LockedVaultScreen';
import { MainDashboard } from '../../../components/dashboard/MainDashboard';
import { SettingsModal } from '../../../components/dashboard/SettingsModal';
import { useIdleTimer } from '../../../components/dashboard/hooks/useIdleTimer';
import { useVaultUnlock } from '../../../components/dashboard/hooks/useVaultUnlock';
import {
  applySidebarDelta,
  computeTotalPages,
  getViewCacheKey,
  itemMatchesSearch,
  itemMatchesView,
  reconcileVisibleItems,
  type ViewRequest,
  useVaultViews,
} from '../../../components/dashboard/hooks/useVaultViews';
import { emptyForm, genOptions } from '../../../components/dashboard/types';
import type { ItemForm } from '../../../components/dashboard/types';
import { buildPayload, fetchAndDecryptItem, tryGetFaviconUrl } from '../../../components/dashboard/utils';

function toItemFormCategory(category: string): ItemForm['category'] {
  return category === 'card' || category === 'note' || category === 'identity'
    ? category
    : 'login';
}

function FullScreenMessage({ message }: Readonly<{ message: string }>) {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{message}</div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const {
    user,
    cryptoKey,
    isAuthenticated,
    vaultItems,
    isVaultLocked,
    setUser,
    setVaultKey,
    setVaultItems,
    updateVaultItem,
    logout,
    lockVault,
    restoreSession,
  } = useAuthStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [newItem, setNewItem] = useState<ItemForm>({ ...emptyForm });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<ItemForm | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [updatingItem, setUpdatingItem] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedItemLoading, setSelectedItemLoading] = useState(false);
  const [hibp, setHibp] = useState<{ checking: boolean; count: number | null }>({ checking: false, count: null });
  const [profileForm, setProfileForm] = useState({ full_name: '', master_hint: '' });
  const [masterPasswordForm, setMasterPasswordForm] = useState({ password: '', confirm: '', master_hint: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [masterPasswordSaving, setMasterPasswordSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const decryptingItemIds = useRef(new Set<string>());
  const currentSelectionRef = useRef<string | null>(null);

  const {
    category,
    search,
    isFavouritesView,
    isTrashView,
    searchResults,
    searchLoading,
    listLoading,
    page,
    totalPages,
    totalItems,
    sidebarCounts,
    setSearchResults,
    setSidebarCounts,
    setTotalPages,
    setTotalItems,
    setPage,
    setCachedView,
    invalidateCachedViews,
    getCurrentView,
    refreshCurrentView,
    handleSearchChange,
    handlePageChange,
    handleCategoryChange,
    handleToggleFavourites,
    handleToggleTrash,
  } = useVaultViews({
    isVaultLocked,
    setVaultItems,
    onVisibleItemsReset: () => {
      decryptingItemIds.current.clear();
      setSelectedItem(null);
    },
    onLockReset: () => {
      currentSelectionRef.current = null;
    },
  });

  const { masterPassword, setMasterPassword, unlocking, unlockVault } = useVaultUnlock({
    user,
    setVaultKey,
    setVaultItems,
    setTotalPages,
    setTotalItems,
    setSidebarCounts,
    cacheAllView: (items, nextTotalPages, nextTotalItems) => {
      setCachedView('all', items, 1, nextTotalPages, nextTotalItems);
    },
  });

  const applyOptimisticMutation = useCallback((
    before: VaultItem | null,
    after: VaultItem | null,
    view: ViewRequest = getCurrentView(),
  ) => {
    const activeSearch = search.trim().toLowerCase();
    const previousVisibleMatch = before ? itemMatchesView(before, view) && itemMatchesSearch(before, activeSearch) : false;
    const nextVisibleMatch = after ? itemMatchesView(after, view) && itemMatchesSearch(after, activeSearch) : false;
    const totalDelta = (nextVisibleMatch ? 1 : 0) - (previousVisibleMatch ? 1 : 0);
    const nextTotalItems = Math.max(0, (totalItems ?? 0) + totalDelta);
    const nextTotalPages = computeTotalPages(nextTotalItems);

    setSidebarCounts((current) => applySidebarDelta(current, before, after));
    setTotalItems(nextTotalItems);
    setTotalPages(nextTotalPages);
    if (nextTotalPages === 0) {
      setPage(1);
    } else if (page > nextTotalPages) {
      setPage(nextTotalPages);
    }

    if (activeSearch) {
      setSearchResults((current) => (
        current
          ? reconcileVisibleItems(current, before, after, view, activeSearch, page)
          : current
      ));
      invalidateCachedViews();
      return;
    }

    const nextItems = reconcileVisibleItems(vaultItems, before, after, view, '', page);
    setVaultItems(nextItems);
    invalidateCachedViews(getViewCacheKey(view));
    setCachedView(
      getViewCacheKey(view),
      nextItems,
      nextTotalPages > 0 ? Math.min(page, nextTotalPages) : 1,
      nextTotalPages,
      nextTotalItems,
    );
  }, [
    getCurrentView,
    invalidateCachedViews,
    page,
    search,
    setCachedView,
    setPage,
    setSearchResults,
    setSidebarCounts,
    setTotalItems,
    setTotalPages,
    setVaultItems,
    totalItems,
    vaultItems,
  ]);

  const getKnownItemById = useCallback((id: string) => {
    if (selectedItem?.id === id) return selectedItem;
    return (searchResults ?? vaultItems).find((item) => item.id === id) ?? null;
  }, [searchResults, selectedItem, vaultItems]);

  const handleLockVault = useCallback(() => {
    lockVault();
    emitAuthEvent('lock');
  }, [lockVault]);

  useIdleTimer(isVaultLocked, handleLockVault);

  useEffect(() => {
    let active = true;

    if (isAuthenticated) {
      setSessionLoading(false);
      return () => {
        active = false;
      };
    }

    void restoreSession().then((ok) => {
      if (!active) return;
      setSessionLoading(false);
      if (!ok) {
        router.replace('/auth');
      }
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, restoreSession, router]);

  useEffect(() => {
    return subscribeToAuthEvents((event: AuthSyncEvent) => {
      if (event.type === 'logout') {
        logout();
        router.replace('/auth');
        return;
      }

      if (event.type === 'lock') {
        lockVault();
        return;
      }

      if (event.type === 'user-updated') {
        if (event.user) {
          setUser(event.user);
          return;
        }

        void authApi.me()
          .then(({ data }) => setUser(data))
          .catch(() => {
            // Ignore transient sync failures; the next restore/me path will recover.
          });
      }
    });
  }, [lockVault, logout, router, setUser]);

  useEffect(() => {
    setProfileForm({
      full_name: user?.full_name ?? '',
      master_hint: user?.master_hint ?? '',
    });
    setMasterPasswordForm((prev) => ({ ...prev, master_hint: user?.master_hint ?? '' }));
  }, [user]);

  const buildEncryptedPayload = useCallback(async (form: ItemForm) => {
    if (!cryptoKey) throw new Error('Crypto key not available');
    const payload = buildPayload(form);
    const encrypted_data = await encryptData(payload, cryptoKey);
    return { payload, encrypted_data };
  }, [cryptoKey]);

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout.
    }
    logout();
    emitAuthEvent('logout');
    router.replace('/auth');
  }, [logout, router]);

  const handleMasterPasswordChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setMasterPassword(event.target.value),
    [setMasterPassword],
  );

  const handleSelectItem = useCallback(async (item: VaultItem) => {
    setSelectedItem(item);
    setHibp({ checking: false, count: null });
    currentSelectionRef.current = item.id;

    const { vaultItems: storeItems, cryptoKey: liveKey } = useAuthStore.getState();
    const cached = storeItems.find((vaultItem) => vaultItem.id === item.id);
    if (cached?.decrypted) {
      setSelectedItem(cached);
      return;
    }
    if (item.decrypted || !liveKey) return;
    if (decryptingItemIds.current.has(item.id)) return;

    decryptingItemIds.current.add(item.id);
    setSelectedItemLoading(true);
    try {
      const enriched = await fetchAndDecryptItem(item, liveKey, updateVaultItem);
      if (currentSelectionRef.current === item.id) {
        setSelectedItem(enriched);
      }
    } catch (err: unknown) {
      console.error('[handleSelectItem] Failed for item', item.id, err);
      toastService.error(getItemLoadError(err));
      decryptingItemIds.current.delete(item.id);
    } finally {
      if (currentSelectionRef.current === item.id) {
        setSelectedItemLoading(false);
      }
    }
  }, [updateVaultItem]);

  const handleAddItem = useCallback(async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!cryptoKey) return;
    if (newItem.category === 'login' && newItem.url && !/^https?:\/\//i.exec(newItem.url)) {
      toastService.error('URL must start with http:// or https://');
      return;
    }

    setSavingItem(true);
    try {
      await toastService.withProgress(
        'Saving to vault...',
        async () => {
          const { encrypted_data, payload } = await buildEncryptedPayload(newItem);
          const favicon_url = newItem.url ? tryGetFaviconUrl(newItem.url) : undefined;
          const { data } = await vaultApi.create({
            name: newItem.name,
            category: newItem.category,
            encrypted_data,
            favicon_url,
          });
          applyOptimisticMutation(null, { ...data, decrypted: payload });
          setShowAddModal(false);
          setNewItem({ ...emptyForm });
        },
        'Item added to vault',
        { fallbackError: 'Failed to save item' },
      );
    } finally {
      setSavingItem(false);
    }
  }, [applyOptimisticMutation, buildEncryptedPayload, cryptoKey, newItem]);

  const handleOpenEdit = useCallback((item: VaultItem) => {
    const decrypted = item.decrypted ?? {};
    setEditForm({
      name: item.name,
      category: toItemFormCategory(item.category),
      username: decrypted.username ?? '',
      password: decrypted.password ?? '',
      url: decrypted.url ?? '',
      notes: decrypted.notes ?? '',
      cardNumber: decrypted.cardNumber ?? '',
      cardHolder: decrypted.cardHolder ?? '',
      expiry: decrypted.expiry ?? '',
      cvv: decrypted.cvv ?? '',
      firstName: decrypted.firstName ?? '',
      lastName: decrypted.lastName ?? '',
      phone: decrypted.phone ?? '',
      address: decrypted.address ?? '',
    });
    setHibp({ checking: false, count: null });
    setShowEditModal(true);
  }, []);

  const handleEditItem = useCallback(async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!cryptoKey || !editForm || !selectedItem) return;
    if (editForm.category === 'login' && editForm.url && !/^https?:\/\//i.exec(editForm.url)) {
      toastService.error('URL must start with http:// or https://');
      return;
    }

    setUpdatingItem(true);
    try {
      await toastService.withProgress(
        'Updating item...',
        async () => {
          const previousItem = selectedItem;
          const { payload, encrypted_data } = await buildEncryptedPayload(editForm);
          const favicon_url = editForm.url
            ? (tryGetFaviconUrl(editForm.url) ?? selectedItem.favicon_url)
            : selectedItem.favicon_url;
          const { data } = await vaultApi.update(selectedItem.id, {
            name: editForm.name,
            category: editForm.category,
            encrypted_data,
            favicon_url,
          });
          const updated = { ...data, decrypted: payload };
          updateVaultItem(selectedItem.id, updated);
          if (itemMatchesView(updated, getCurrentView()) && itemMatchesSearch(updated, search.trim().toLowerCase())) {
            setSelectedItem(updated);
          } else {
            setSelectedItem(null);
          }
          applyOptimisticMutation(previousItem, updated);
          setShowEditModal(false);
          setEditForm(null);
        },
        'Item updated',
        { fallbackError: 'Failed to update item' },
      );
    } finally {
      setUpdatingItem(false);
    }
  }, [applyOptimisticMutation, buildEncryptedPayload, cryptoKey, editForm, getCurrentView, search, selectedItem, updateVaultItem]);

  const handleDelete = useCallback(async (id: string, onAfterDelete?: () => void) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await toastService.withProgress(
        'Moving item to trash...',
        async () => {
          const previousItem = getKnownItemById(id);
          await vaultApi.delete(id);
          if (previousItem) {
            applyOptimisticMutation(previousItem, {
              ...previousItem,
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else {
            await refreshCurrentView(page);
          }
          if (selectedItem?.id === id) {
            setSelectedItem(null);
            onAfterDelete?.();
          }
        },
        'Moved item to trash',
        { fallbackError: 'Failed to move item to trash' },
      );
    } finally {
      setDeletingId(null);
    }
  }, [applyOptimisticMutation, deletingId, getKnownItemById, page, refreshCurrentView, selectedItem]);

  const handleToggleFav = useCallback(async (item: VaultItem) => {
    const adding = !item.is_favourite;
    await toastService.withProgress(
      adding ? 'Adding to favourites...' : 'Removing from favourites...',
      async () => {
        const previousItem = selectedItem?.id === item.id ? selectedItem : item;
        await vaultApi.update(item.id, { is_favourite: adding });
        const updated = { ...previousItem, is_favourite: adding, updated_at: new Date().toISOString() };
        updateVaultItem(item.id, updated);
        if (selectedItem?.id === item.id && (!isFavouritesView || adding)) {
          setSelectedItem(updated);
        }
        if (isFavouritesView && !adding && selectedItem?.id === item.id) {
          setSelectedItem(null);
        }
        applyOptimisticMutation(previousItem, updated);
      },
      adding ? 'Added to favourites' : 'Removed from favourites',
      { fallbackError: 'Failed to update favourite' },
    );
  }, [applyOptimisticMutation, isFavouritesView, selectedItem, updateVaultItem]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastService.success(`${label} copied!`);
    } catch {
      toastService.error(`Failed to copy ${label.toLowerCase()}`);
    }
  }, []);

  const handleExport = useCallback(async () => {
    await toastService.withProgress(
      'Exporting vault...',
      async () => {
        const { data } = await vaultApi.export();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'cipheria-export.json';
        anchor.click();
        URL.revokeObjectURL(url);
      },
      'Vault exported',
      { fallbackError: 'Export failed' },
    );
  }, []);

  const handleSaveProfile = useCallback(async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const { data } = await authApi.updateProfile({
        full_name: profileForm.full_name || null,
        master_hint: profileForm.master_hint || null,
      });
      setUser(data);
      emitAuthEvent('user-updated', data);
      toastService.success('Profile updated');
    } catch (err) {
      toastService.error(getSessionAwareError(err, 'Failed to update profile'));
    } finally {
      setProfileSaving(false);
    }
  }, [profileForm, setUser]);

  const handleResendVerification = useCallback(async () => {
    setVerificationSending(true);
    try {
      const { data } = await authApi.requestEmailVerification();
      toastService.success(data.message);
    } catch (err) {
      toastService.error(getSessionAwareError(err, 'Failed to send verification email'));
    } finally {
      setVerificationSending(false);
    }
  }, []);

  const handleChangeMasterPassword = useCallback(async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!cryptoKey || !user) {
      toastService.error('Unlock the vault before changing the master password');
      return;
    }
    if (!masterPasswordForm.password || masterPasswordForm.password !== masterPasswordForm.confirm) {
      toastService.error('Master password confirmation does not match');
      return;
    }

    setMasterPasswordSaving(true);
    try {
      const newSalt = generateSaltHex();
      const nextKey = await deriveKey(masterPasswordForm.password, newSalt);
      const nextVerifier = await deriveMasterPasswordVerifier(masterPasswordForm.password, newSalt);
      const { data } = await vaultApi.export();
      const items = await Promise.all(
        (data.items as Array<{ id: string; encrypted_data: string }>).map(async (item) => {
          const payload = await decryptData(item.encrypted_data, cryptoKey);
          const encrypted_data = await encryptData(payload, nextKey);
          return { id: item.id, encrypted_data };
        }),
      );
      const { data: updatedUser } = await authApi.changeMasterPassword({
        new_vault_salt: newSalt,
        new_master_password_verifier: nextVerifier,
        master_hint: masterPasswordForm.master_hint || null,
        items,
      });
      setUser(updatedUser);
      emitAuthEvent('user-updated', updatedUser);
      setMasterPasswordForm({ password: '', confirm: '', master_hint: updatedUser.master_hint ?? '' });
      lockVault();
      emitAuthEvent('lock');
      setShowSettingsModal(false);
      toastService.success('Master password changed. Unlock with the new password.');
    } catch (err) {
      toastService.error(getSessionAwareError(err, 'Failed to change master password'));
    } finally {
      setMasterPasswordSaving(false);
    }
  }, [cryptoKey, lockVault, masterPasswordForm, setUser, user]);

  const handleDeleteAccount = useCallback(async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!deletePassword) {
      toastService.error('Enter your master password to delete the account');
      return;
    }
    if (!user?.vault_salt) {
      toastService.error('Session error - please sign out and sign in again');
      return;
    }

    setDeletingAccount(true);
    try {
      const verifier = await deriveMasterPasswordVerifier(deletePassword, user.vault_salt);
      await authApi.deleteAccount(verifier);
      emitAuthEvent('logout');
      logout();
      router.replace('/auth');
    } catch (err) {
      toastService.error(getSessionAwareError(err, 'Failed to delete account'));
    } finally {
      setDeletingAccount(false);
    }
  }, [deletePassword, logout, router, user]);

  const handleRestoreItem = useCallback(async (id: string) => {
    await toastService.withProgress(
      'Restoring item...',
      async () => {
        const previousItem = getKnownItemById(id);
        const { data } = await vaultApi.restore(id);
        if (selectedItem?.id === id) {
          setSelectedItem(null);
        }
        if (previousItem) {
          applyOptimisticMutation(previousItem, data);
        } else {
          await refreshCurrentView(page);
        }
      },
      'Restored item',
      { fallbackError: 'Failed to restore item' },
    );
  }, [applyOptimisticMutation, getKnownItemById, page, refreshCurrentView, selectedItem]);

  const handleDeletePermanent = useCallback(async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await toastService.withProgress(
        'Item deleting permanently...',
        async () => {
          const previousItem = getKnownItemById(id);
          await vaultApi.deletePermanent(id);
          if (selectedItem?.id === id) {
            setSelectedItem(null);
          }
          if (previousItem) {
            applyOptimisticMutation(previousItem, null);
          } else {
            await refreshCurrentView(page);
          }
        },
        'Item permanently deleted',
        { fallbackError: 'Failed to permanently delete item' },
      );
    } finally {
      setDeletingId(null);
    }
  }, [applyOptimisticMutation, deletingId, getKnownItemById, page, refreshCurrentView, selectedItem]);

  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), []);
  const handleCloseSettings = useCallback(() => setShowSettingsModal(false), []);

  const filteredItems = searchResults ?? vaultItems;

  if (sessionLoading) return <FullScreenMessage message="Loading..." />;
  if (!isAuthenticated) return <FullScreenMessage message="Redirecting to sign in..." />;

  if (isVaultLocked) {
    return (
      <LockedVaultScreen
        user={user}
        masterPassword={masterPassword}
        onMasterPasswordChange={handleMasterPasswordChange}
        unlocking={unlocking}
        unlockVault={unlockVault}
        handleLogout={handleLogout}
      />
    );
  }

  return (
    <>
      <MainDashboard
        user={user}
        category={category}
        setCategory={handleCategoryChange}
        searchValue={search}
        onSearchChange={handleSearchChange}
        handleExport={handleExport}
        onOpenSettings={handleOpenSettings}
        onToggleFavourites={handleToggleFavourites}
        onToggleTrash={handleToggleTrash}
        isFavouritesView={isFavouritesView}
        isTrashView={isTrashView}
        lockVault={handleLockVault}
        handleLogout={handleLogout}
        vaultItems={vaultItems}
        sidebarCounts={sidebarCounts}
        selectedItem={selectedItem}
        handleSelectItem={handleSelectItem}
        selectedItemLoading={selectedItemLoading}
        handleToggleFav={handleToggleFav}
        handleOpenEdit={handleOpenEdit}
        handleDelete={handleDelete}
        handleRestoreItem={handleRestoreItem}
        handleDeletePermanent={handleDeletePermanent}
        deletingId={deletingId}
        copyToClipboard={copyToClipboard}
        hibp={hibp}
        setHibp={setHibp}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        newItem={newItem}
        setNewItem={setNewItem}
        savingItem={savingItem}
        genOptions={genOptions}
        handleAddItem={handleAddItem}
        showEditModal={showEditModal}
        setShowEditModal={setShowEditModal}
        editForm={editForm}
        setEditForm={setEditForm}
        updatingItem={updatingItem}
        handleEditItem={handleEditItem}
        filteredItems={filteredItems}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isSearchActive={searchResults !== null}
        searchLoading={searchLoading || listLoading}
      />
      {showSettingsModal && (
        <SettingsModal
          user={user}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          masterPasswordForm={masterPasswordForm}
          setMasterPasswordForm={setMasterPasswordForm}
          deletePassword={deletePassword}
          setDeletePassword={setDeletePassword}
          profileSaving={profileSaving}
          verificationSending={verificationSending}
          masterPasswordSaving={masterPasswordSaving}
          deletingAccount={deletingAccount}
          onClose={handleCloseSettings}
          onSaveProfile={handleSaveProfile}
          onResendVerification={handleResendVerification}
          onChangeMasterPassword={handleChangeMasterPassword}
          onDeleteAccount={handleDeleteAccount}
        />
      )}
    </>
  );
}
