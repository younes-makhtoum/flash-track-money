import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, SyncStatus, NewTransaction, LunchMoneyCategory, LunchMoneyTag } from '../types';
import { SecureStorage } from '../utils/storage';
import { isAPIConfigured, testAPIConnection } from '../services/lunchMoneyAPI';

interface AppState {
  // Authentication
  isAuthenticated: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  checkAuthStatus: () => Promise<void>;
  testConnection: () => Promise<boolean>;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Sync status
  syncStatus: SyncStatus;
  updateSyncStatus: (status: Partial<SyncStatus>) => void;

  // Cached data
  categories: LunchMoneyCategory[];
  tags: LunchMoneyTag[];
  setCategories: (categories: LunchMoneyCategory[]) => void;
  setTags: (tags: LunchMoneyTag[]) => void;

  // Offline transactions
  offlineTransactions: NewTransaction[];
  addOfflineTransaction: (transaction: NewTransaction) => void;
  removeOfflineTransaction: (transactionId: string) => void;
  clearOfflineTransactions: () => void;

  // UI state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Authentication
      isAuthenticated: false,
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      checkAuthStatus: async () => {
        try {
          console.log('Checking auth status...'); // Debug log
          const hasToken = await isAPIConfigured();
          console.log('Has token:', hasToken); // Debug log
          set({ isAuthenticated: hasToken });
        } catch (error) {
          console.error('Error checking auth status:', error);
          set({ isAuthenticated: false });
        }
      },
      testConnection: async () => {
        try {
          const result = await testAPIConnection();
          set({ isAuthenticated: result.success });
          if (!result.success) {
            set({ error: result.error || 'Connection test failed' });
          }
          return result.success;
        } catch (error) {
          console.error('Error testing connection:', error);
          set({ isAuthenticated: false, error: 'Connection test failed' });
          return false;
        }
      },

      // Settings
      settings: {
        enableOfflineMode: true,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Sync status
      syncStatus: {
        pendingTransactions: 0,
        isOnline: true,
        isSyncing: false,
      },
      updateSyncStatus: (status) =>
        set((state) => ({
          syncStatus: { ...state.syncStatus, ...status },
        })),

      // Cached data
      categories: [],
      tags: [],
      setCategories: (categories) => set({ categories }),
      setTags: (tags) => set({ tags }),

      // Offline transactions
      offlineTransactions: [],
      addOfflineTransaction: (transaction) =>
        set((state) => ({
          offlineTransactions: [...state.offlineTransactions, transaction],
          syncStatus: {
            ...state.syncStatus,
            pendingTransactions: state.syncStatus.pendingTransactions + 1,
          },
        })),
      removeOfflineTransaction: (transactionId) =>
        set((state) => ({
          offlineTransactions: state.offlineTransactions.filter(
            (t) => t.receipt?.id !== transactionId
          ),
          syncStatus: {
            ...state.syncStatus,
            pendingTransactions: Math.max(0, state.syncStatus.pendingTransactions - 1),
          },
        })),
      clearOfflineTransactions: () =>
        set((state) => ({
          offlineTransactions: [],
          syncStatus: {
            ...state.syncStatus,
            pendingTransactions: 0,
          },
        })),

      // UI state
      isLoading: false,
      setLoading: (isLoading) => set({ isLoading }),
      error: null,
      setError: (error) => set({ error }),
    }),
    {
      name: 'flash-track-money-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        syncStatus: state.syncStatus,
        categories: state.categories,
        tags: state.tags,
        offlineTransactions: state.offlineTransactions,
        // Note: Don't persist isAuthenticated, check on app start
      }),
    }
  )
);
