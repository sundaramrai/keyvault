'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { vaultApi } from '@/lib/api';
import { getSessionAwareError } from '@/lib/errors';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import type { SidebarCounts, VaultItem } from '@/lib/types';
import { decryptData } from '@/lib/crypto';
import type { Category } from '../types';

export const EMPTY_SIDEBAR_COUNTS: SidebarCounts = {
  all: 0,
  login: 0,
  card: 0,
  note: 0,
  identity: 0,
  favourites: 0,
  trash: 0,
};

export const PAGE_SIZE = 50;

type CachedViewKey = 'all' | 'favourites' | 'trash';

export type ViewRequest = {
  category: Category;
  deletedOnly: boolean;
  favouritesOnly: boolean;
};

export type CachedViewState = {
  items: VaultItem[];
  page: number;
  totalPages: number;
  totalItems: number;
};

type UseVaultViewsArgs = {
  isVaultLocked: boolean;
  setVaultItems: (items: VaultItem[]) => void;
  onVisibleItemsReset: () => void;
  onLockReset: () => void;
};

async function decryptSearchItem(item: VaultItem, key: CryptoKey, storeItems: VaultItem[]): Promise<VaultItem> {
  const cached = storeItems.find((vaultItem) => vaultItem.id === item.id);
  if (cached?.decrypted) return cached;
  if (!item.encrypted_data) return item;
  try {
    return { ...item, decrypted: await decryptData(item.encrypted_data, key) };
  } catch {
    return item;
  }
}

function rehydrateListItem(item: VaultItem, storeItems: VaultItem[]): VaultItem {
  const cached = storeItems.find((storeItem) => storeItem.id === item.id);
  return cached?.decrypted ? { ...item, decrypted: cached.decrypted } : item;
}

export function buildViewRequest(category: Category, isFavouritesView: boolean, isTrashView: boolean): ViewRequest {
  if (isTrashView) {
    return { category: 'all', deletedOnly: true, favouritesOnly: false };
  }
  if (isFavouritesView) {
    return { category: 'all', deletedOnly: false, favouritesOnly: true };
  }
  return { category, deletedOnly: false, favouritesOnly: false };
}

export function getViewCacheKey(view: ViewRequest): CachedViewKey | `category:${Exclude<Category, 'all'>}` {
  if (view.deletedOnly) return 'trash';
  if (view.favouritesOnly) return 'favourites';
  return view.category === 'all' ? 'all' : `category:${view.category}`;
}

function sortByUpdatedDesc(items: VaultItem[]): VaultItem[] {
  return [...items].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
}

export function itemMatchesView(item: VaultItem, view: ViewRequest): boolean {
  if (view.deletedOnly) return Boolean(item.is_deleted);
  if (item.is_deleted) return false;
  if (view.favouritesOnly && !item.is_favourite) return false;
  return view.category === 'all' || item.category === view.category;
}

export function itemMatchesSearch(item: VaultItem, term: string): boolean {
  if (!term) return true;
  return item.name.toLowerCase().includes(term.toLowerCase());
}

export function reconcileVisibleItems(
  items: VaultItem[],
  before: VaultItem | null,
  after: VaultItem | null,
  view: ViewRequest,
  searchTerm: string,
  page: number,
): VaultItem[] {
  const existing = items.find((item) => item.id === before?.id || item.id === after?.id);
  let nextItems = before
    ? items.filter((item) => item.id !== before.id)
    : [...items];

  if (
    after &&
    itemMatchesView(after, view) &&
    itemMatchesSearch(after, searchTerm) &&
    (page === 1 || Boolean(existing))
  ) {
    nextItems = sortByUpdatedDesc([after, ...nextItems]);
  }

  return page === 1 ? nextItems.slice(0, PAGE_SIZE) : nextItems;
}

export function computeTotalPages(totalItems: number): number {
  return totalItems === 0 ? 0 : Math.ceil(totalItems / PAGE_SIZE);
}

function getViewTotalCount(view: ViewRequest, counts: SidebarCounts): number {
  if (view.deletedOnly) return counts.trash;
  if (view.favouritesOnly) return counts.favourites;
  if (view.category === 'all') return counts.all;
  return counts[view.category];
}

export function applySidebarDelta(counts: SidebarCounts, before: VaultItem | null, after: VaultItem | null): SidebarCounts {
  const next = { ...counts };

  const applyItem = (item: VaultItem, direction: 1 | -1) => {
    if (item.is_deleted) {
      next.trash += direction;
      return;
    }

    next.all += direction;
    if (item.category === 'login' || item.category === 'card' || item.category === 'note' || item.category === 'identity') {
      next[item.category] += direction;
    }
    if (item.is_favourite) {
      next.favourites += direction;
    }
  };

  if (before) applyItem(before, -1);
  if (after) applyItem(after, 1);

  return {
    all: Math.max(0, next.all),
    login: Math.max(0, next.login),
    card: Math.max(0, next.card),
    note: Math.max(0, next.note),
    identity: Math.max(0, next.identity),
    favourites: Math.max(0, next.favourites),
    trash: Math.max(0, next.trash),
  };
}

export function useVaultViews({
  isVaultLocked,
  setVaultItems,
  onVisibleItemsReset,
  onLockReset,
}: Readonly<UseVaultViewsArgs>) {
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [isFavouritesView, setIsFavouritesView] = useState(false);
  const [isTrashView, setIsTrashView] = useState(false);
  const [searchResults, setSearchResults] = useState<VaultItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | null>(null);
  const [sidebarCounts, setSidebarCounts] = useState<SidebarCounts>(EMPTY_SIDEBAR_COUNTS);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const viewCacheRef = useRef<Record<string, CachedViewState>>({});
  const shouldRestoreActiveViewRef = useRef(false);
  const listRequestIdRef = useRef(0);
  const inFlightViewLoadsRef = useRef<Record<string, Promise<CachedViewState & { sidebarCounts?: SidebarCounts | null }>>>({});

  const setCachedView = useCallback((key: string, items: VaultItem[], currentPage: number, nextTotalPages: number, nextTotalItems: number) => {
    viewCacheRef.current[key] = {
      items,
      page: currentPage,
      totalPages: nextTotalPages,
      totalItems: nextTotalItems,
    };
  }, []);

  const invalidateCachedViews = useCallback((exceptKey?: string) => {
    if (!exceptKey) {
      viewCacheRef.current = {};
      return;
    }

    const preserved = viewCacheRef.current[exceptKey];
    viewCacheRef.current = preserved ? { [exceptKey]: preserved } : {};
  }, []);

  const restoreCachedView = useCallback((key: string) => {
    const cached = viewCacheRef.current[key];
    if (!cached) return false;

    setVaultItems(cached.items);
    setPage(cached.page);
    setTotalPages(cached.totalPages);
    setTotalItems(cached.totalItems);
    onVisibleItemsReset();
    return true;
  }, [onVisibleItemsReset, setVaultItems]);

  const applyResolvedView = useCallback((view: ViewRequest, nextState: CachedViewState) => {
    setVaultItems(nextState.items);
    setPage(nextState.page);
    setTotalPages(nextState.totalPages);
    setTotalItems(nextState.totalItems);
    setCachedView(
      getViewCacheKey(view),
      nextState.items,
      nextState.page,
      nextState.totalPages,
      nextState.totalItems,
    );
    onVisibleItemsReset();
  }, [onVisibleItemsReset, setCachedView, setVaultItems]);

  const getCompleteAllViewItems = useCallback(() => {
    const cachedAllView = viewCacheRef.current.all;
    if (!cachedAllView) return null;
    if (cachedAllView.page !== 1) return null;
    if (cachedAllView.totalItems !== sidebarCounts.all) return null;
    if (cachedAllView.items.length !== cachedAllView.totalItems) return null;
    return cachedAllView.items;
  }, [sidebarCounts.all]);

  const hydrateViewFromLocalData = useCallback((view: ViewRequest) => {
    const totalCount = getViewTotalCount(view, sidebarCounts);
    if (totalCount === 0) {
      applyResolvedView(view, {
        items: [],
        page: 1,
        totalPages: 0,
        totalItems: 0,
      });
      return true;
    }
    if (view.deletedOnly) return false;

    const allItems = getCompleteAllViewItems();
    if (!allItems) return false;

    const matchingItems = sortByUpdatedDesc(allItems.filter((item) => itemMatchesView(item, view)));
    applyResolvedView(view, {
      items: matchingItems.slice(0, PAGE_SIZE),
      page: 1,
      totalPages: computeTotalPages(matchingItems.length),
      totalItems: matchingItems.length,
    });
    return true;
  }, [applyResolvedView, getCompleteAllViewItems, sidebarCounts]);

  const restoreOrHydrateView = useCallback((view: ViewRequest) => {
    const cacheKey = getViewCacheKey(view);
    if (restoreCachedView(cacheKey)) return true;
    return hydrateViewFromLocalData(view);
  }, [hydrateViewFromLocalData, restoreCachedView]);

  const getCurrentView = useCallback(
    (overrides: Partial<ViewRequest> = {}): ViewRequest => ({
      ...buildViewRequest(category, isFavouritesView, isTrashView),
      ...overrides,
    }),
    [category, isFavouritesView, isTrashView],
  );

  const fetchVaultPage = useCallback(async (
    requestedPage: number,
    view: ViewRequest,
  ): Promise<CachedViewState & { sidebarCounts?: SidebarCounts | null }> => {
    const requestKey = `${getViewCacheKey(view)}:${requestedPage}`;
    const existingRequest = inFlightViewLoadsRef.current[requestKey];
    if (existingRequest !== undefined) return await existingRequest;

    const requestPromise = (async () => {
      const params: {
        category?: Exclude<Category, 'all'>;
        deleted_only: boolean;
        favourites_only: boolean;
        page: number;
        page_size: number;
      } = {
        page: requestedPage,
        page_size: PAGE_SIZE,
        deleted_only: view.deletedOnly,
        favourites_only: view.deletedOnly ? false : view.favouritesOnly,
      };
      if (!view.deletedOnly && !view.favouritesOnly && view.category !== 'all') {
        params.category = view.category;
      }

      const { data } = await vaultApi.list(params);
      if (data.total_pages > 0 && requestedPage > data.total_pages) {
        return fetchVaultPage(data.total_pages, view);
      }

      const { vaultItems: storeItems } = useAuthStore.getState();
      return {
        items: data.items.map((item: VaultItem) => rehydrateListItem(item, storeItems)),
        page: data.total_pages > 0 ? requestedPage : 1,
        totalPages: data.total_pages ?? 0,
        totalItems: data.total ?? 0,
        sidebarCounts: data.sidebar_counts,
      };
    })();

    inFlightViewLoadsRef.current[requestKey] = requestPromise;
    try {
      return await requestPromise;
    } finally {
      delete inFlightViewLoadsRef.current[requestKey];
    }
  }, []);

  const loadVaultPage = useCallback(async (
    newPage: number,
    view: ViewRequest = buildViewRequest(category, isFavouritesView, isTrashView),
  ) => {
    const requestId = ++listRequestIdRef.current;
    setListLoading(true);
    try {
      const nextState = await fetchVaultPage(newPage, view);
      if (requestId !== listRequestIdRef.current) return;
      if (nextState.sidebarCounts) {
        setSidebarCounts(nextState.sidebarCounts);
      }
      applyResolvedView(view, nextState);
    } finally {
      if (requestId === listRequestIdRef.current) {
        setListLoading(false);
      }
    }
  }, [applyResolvedView, category, fetchVaultPage, isFavouritesView, isTrashView]);

  useEffect(() => {
    if (isVaultLocked || !shouldRestoreActiveViewRef.current) {
      return;
    }

    shouldRestoreActiveViewRef.current = false;
    const view = getCurrentView();
    if (!view.deletedOnly && !view.favouritesOnly && view.category === 'all') {
      return;
    }

    if (restoreOrHydrateView(view)) {
      return;
    }

    void loadVaultPage(1, view).catch((err) => {
      toastService.error(getSessionAwareError(err, 'Vault is temporarily unavailable'));
      console.error('[unlock-view-restore] Failed to restore active view', err);
    });
  }, [getCurrentView, isVaultLocked, loadVaultPage, restoreOrHydrateView]);

  const runSearch = useCallback(async (
    term: string,
    signal?: AbortSignal,
    view: ViewRequest = buildViewRequest(category, isFavouritesView, isTrashView),
  ) => {
    setSearchLoading(true);
    try {
      const params: {
        category?: Exclude<Category, 'all'>;
        search: string;
        deleted_only: boolean;
        favourites_only: boolean;
      } = {
        search: term,
        deleted_only: view.deletedOnly,
        favourites_only: view.deletedOnly ? false : view.favouritesOnly,
      };
      if (!view.deletedOnly && !view.favouritesOnly && view.category !== 'all') {
        params.category = view.category;
      }

      const { data } = await vaultApi.list(params, signal);
      if (signal?.aborted) return;

      const { cryptoKey, vaultItems: storeItems } = useAuthStore.getState();
      const resultsWithCachedData = data.items.map((item: VaultItem) => rehydrateListItem(item, storeItems));
      const hydratedResults = cryptoKey
        ? await Promise.all(resultsWithCachedData.map((item) => decryptSearchItem(item, cryptoKey, storeItems)))
        : resultsWithCachedData;

      if (!signal?.aborted) {
        setSearchResults(hydratedResults);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; name?: string };
      if (error?.code !== 'ERR_CANCELED' && error?.name !== 'AbortError') {
        console.error('Search error:', err);
      }
    } finally {
      setSearchLoading(false);
    }
  }, [category, isFavouritesView, isTrashView]);

  const refreshCurrentView = useCallback(async (
    targetPage = page,
    view = getCurrentView(),
  ) => {
    if (search.trim()) {
      await runSearch(search, undefined, view);
      return;
    }
    await loadVaultPage(targetPage, view);
  }, [getCurrentView, loadVaultPage, page, runSearch, search]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchAbortRef.current?.abort();

    if (!value) {
      setSearchResults(null);
      setSearchLoading(false);
      const view = getCurrentView();
      if (!restoreOrHydrateView(view)) {
        void loadVaultPage(1, view);
      }
      return;
    }

    if (totalItems === 0) {
      setSearchResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      await runSearch(value, controller.signal);
    }, 300);
  }, [getCurrentView, loadVaultPage, restoreOrHydrateView, runSearch, totalItems]);

  const handlePageChange = useCallback(async (newPage: number) => {
    try {
      await loadVaultPage(newPage);
    } catch (err) {
      console.error('[pagination] Failed to load page', newPage, err);
    }
  }, [loadVaultPage]);

  const handleCategoryChange = useCallback(async (nextCategory: Category) => {
    const previousCategory = category;
    const previousIsFavouritesView = isFavouritesView;
    const previousIsTrashView = isTrashView;
    const nextView = buildViewRequest(nextCategory, false, false);

    setCategory(nextCategory);
    setIsFavouritesView(false);
    setIsTrashView(false);
    setSearch('');
    setSearchResults(null);

    if (restoreCachedView(getViewCacheKey(nextView))) return;

    try {
      await loadVaultPage(1, nextView);
    } catch (err) {
      setCategory(previousCategory);
      setIsFavouritesView(previousIsFavouritesView);
      setIsTrashView(previousIsTrashView);
      toastService.error(getSessionAwareError(err, 'Vault is temporarily unavailable'));
      console.error('[category] Failed to switch view', err);
    }
  }, [category, isFavouritesView, isTrashView, loadVaultPage, restoreCachedView]);

  const handleToggleFavourites = useCallback(async () => {
    const previousIsFavouritesView = isFavouritesView;
    const previousIsTrashView = isTrashView;
    const next = !isFavouritesView;
    const nextView = buildViewRequest(category, next, false);

    setIsFavouritesView(next);
    setIsTrashView(false);
    setSearch('');
    setSearchResults(null);

    if (restoreCachedView(getViewCacheKey(nextView))) return;

    try {
      await loadVaultPage(1, nextView);
    } catch (err) {
      setIsFavouritesView(previousIsFavouritesView);
      setIsTrashView(previousIsTrashView);
      toastService.error(getSessionAwareError(err, 'Vault is temporarily unavailable'));
      console.error('[favourites] Failed to switch view', err);
    }
  }, [category, isFavouritesView, isTrashView, loadVaultPage, restoreCachedView]);

  const handleToggleTrash = useCallback(async () => {
    const previousIsTrashView = isTrashView;
    const previousIsFavouritesView = isFavouritesView;
    const next = !isTrashView;
    const nextView = buildViewRequest(category, false, next);

    setIsTrashView(next);
    setIsFavouritesView(false);
    setSearch('');
    setSearchResults(null);

    if (!next && restoreCachedView(getViewCacheKey(nextView))) return;

    try {
      await loadVaultPage(1, nextView);
    } catch (err) {
      setIsTrashView(previousIsTrashView);
      setIsFavouritesView(previousIsFavouritesView);
      toastService.error(getSessionAwareError(err, 'Vault is temporarily unavailable'));
      console.error('[trash] Failed to switch view', err);
    }
  }, [category, isFavouritesView, isTrashView, loadVaultPage, restoreCachedView]);

  useEffect(() => {
    if (isVaultLocked) {
      shouldRestoreActiveViewRef.current = true;
      listRequestIdRef.current += 1;
      inFlightViewLoadsRef.current = {};
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
      setSearch('');
      setSearchResults(null);
      setListLoading(false);
      setSidebarCounts(EMPTY_SIDEBAR_COUNTS);
      viewCacheRef.current = {};
      onVisibleItemsReset();
      onLockReset();
    }
  }, [isVaultLocked, onLockReset, onVisibleItemsReset]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchAbortRef.current?.abort();
    };
  }, []);

  return {
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
    setSearch,
    setSearchResults,
    setSidebarCounts,
    setTotalPages,
    setTotalItems,
    setPage,
    setCachedView,
    invalidateCachedViews,
    getCurrentView,
    loadVaultPage,
    refreshCurrentView,
    handleSearchChange,
    handlePageChange,
    handleCategoryChange,
    handleToggleFavourites,
    handleToggleTrash,
  };
}
