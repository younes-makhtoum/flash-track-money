import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ReceiptCapture } from '../components/ReceiptCapture';
import { QuickExpenseEntry } from '../components/QuickExpenseEntry';
import SettingsScreen from './SettingsScreen';
import { useAppStore } from '../store/appStore';
import { getLunchMoneyAPI } from '../services/lunchMoneyAPI';
import { NewTransaction } from '../types';

type ScreenMode = 'home' | 'camera' | 'expense' | 'settings';

export const MainHomeScreen: React.FC = () => {
  const [screenMode, setScreenMode] = useState<ScreenMode>('home');
  const [capturedReceipt, setCapturedReceipt] = useState<string | null>(null);
  
  const { 
    syncStatus, 
    offlineTransactions,
    isAuthenticated,
    checkAuthStatus,
    testConnection,
    setAuthenticated,
    addOfflineTransaction,
    setCategories,
    setTags,
    updateSyncStatus,
    setLoading,
    error,
    setError  
  } = useAppStore();

  useEffect(() => {
    // Check authentication status on app start
    console.log('App starting, checking auth status...'); // Debug log
    checkAuthStatus();
  }, []);

  useEffect(() => {
    // Debug log to track authentication state changes
    console.log('isAuthenticated changed to:', isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    // Load data when authenticated
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  const loadInitialData = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      
      // Test connection first
      const connectionTest = await testConnection();
      if (!connectionTest) {
        setError('Unable to connect to Lunch Money. Please check your API token.');
        return;
      }

      const api = getLunchMoneyAPI();
      
      // Load categories and tags with timeout
      const [categories, tags] = await Promise.all([
        api.getCategories().catch(error => {
          console.warn('Failed to load categories:', error);
          return []; // Return empty array on failure
        }),
        api.getTags().catch(error => {
          console.warn('Failed to load tags:', error);
          return []; // Return empty array on failure
        }),
      ]);
      
      setCategories(categories);
      setTags(tags);
      setError(null);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('Failed to sync with Lunch Money. The app will work in offline mode.');
      // Don't throw - allow app to continue in offline mode
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePhoto = (photoUri: string) => {
    setCapturedReceipt(photoUri);
    setScreenMode('expense');
  };

  const handleSaveTransaction = async (transaction: NewTransaction) => {
    try {
      if (isAuthenticated && navigator.onLine) {
        // Try to save online
        const api = getLunchMoneyAPI();
        await api.createTransaction(transaction);
        Alert.alert('Success', 'Expense saved successfully!');
      } else {
        // Save offline
        addOfflineTransaction(transaction);
        Alert.alert('Saved Offline', 'Expense will sync when online');
      }
      
      // Reset state
      setCapturedReceipt(null);
      setScreenMode('home');
    } catch (error) {
      console.error('Failed to save transaction:', error);
      
      // Fall back to offline storage
      addOfflineTransaction(transaction);
      Alert.alert('Saved Offline', 'Failed to sync. Expense will sync when online.');
      
      setCapturedReceipt(null);
      setScreenMode('home');
    }
  };

  const handleSyncOfflineTransactions = async () => {
    if (!isAuthenticated || offlineTransactions.length === 0) {
      return;
    }

    try {
      updateSyncStatus({ isSyncing: true });
      const api = getLunchMoneyAPI();
      
      for (const transaction of offlineTransactions) {
        await api.createTransaction(transaction);
      }
      
      // Clear offline transactions after successful sync
      updateSyncStatus({ 
        isSyncing: false, 
        pendingTransactions: 0 
      });
      
      Alert.alert('Sync Complete', `${offlineTransactions.length} transactions synced`);
    } catch (error) {
      console.error('Sync failed:', error);
      updateSyncStatus({ isSyncing: false });
      Alert.alert('Sync Failed', 'Some transactions could not be synced. Will retry later.');
    }
  };

  // Show settings screen if not authenticated
  if (!isAuthenticated || screenMode === 'settings') {
    return (
      <SafeAreaView style={styles.container}>
        <SettingsScreen 
          onTokenSaved={() => {
            console.log('Token saved callback triggered'); // Debug log
            // Directly set authenticated since we know token was just saved successfully
            setAuthenticated(true);
            setScreenMode('home');
          }} 
        />
      </SafeAreaView>
    );
  }

  if (screenMode === 'camera') {
    return (
      <ReceiptCapture
        onCapture={handleCapturePhoto}
        onCancel={() => setScreenMode('home')}
      />
    );
  }

  if (screenMode === 'expense') {
    return (
      <QuickExpenseEntry
        onSubmit={handleSaveTransaction}
        onCancel={() => {
          setCapturedReceipt(null);
          setScreenMode('home');
        }}
        initialData={capturedReceipt ? {
          receipt: {
            id: Date.now().toString(),
            uri: capturedReceipt,
            createdAt: new Date().toISOString(),
          }
        } : undefined}
      />
    );
  }

  // Main home screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Flash Track Money</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setScreenMode('settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Error Display */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={20} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={loadInitialData}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sync Status */}
        {syncStatus.pendingTransactions > 0 && (
          <View style={styles.syncStatusCard}>
            <View style={styles.syncStatusHeader}>
              <Ionicons name="cloud-upload-outline" size={20} color="#FF9500" />
              <Text style={styles.syncStatusText}>
                {syncStatus.pendingTransactions} transactions pending sync
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.syncButton}
              onPress={handleSyncOfflineTransactions}
              disabled={syncStatus.isSyncing}
            >
              <Text style={styles.syncButtonText}>
                {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, styles.primaryAction]}
            onPress={() => setScreenMode('camera')}
          >
            <Ionicons name="camera" size={32} color="#fff" />
            <Text style={styles.actionTitlePrimary}>Capture Receipt</Text>
            <Text style={styles.actionSubtitlePrimary}>Take a photo and track expense</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => setScreenMode('expense')}
          >
            <Ionicons name="add-circle-outline" size={32} color="#007AFF" />
            <Text style={styles.actionTitle}>Quick Entry</Text>
            <Text style={styles.actionSubtitle}>Add expense manually</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Today's Activity</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>$0.00</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{syncStatus.pendingTransactions}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* Connection Status */}
        <View style={styles.connectionCard}>
          <Ionicons 
            name={isAuthenticated ? "checkmark-circle" : "warning"} 
            size={16} 
            color={isAuthenticated ? "#34C759" : "#FF9500"} 
          />
          <Text style={styles.connectionText}>
            {isAuthenticated ? "Connected to Lunch Money" : "Not connected"}
          </Text>
          {isAuthenticated && (
            <TouchableOpacity onPress={testConnection}>
              <Text style={styles.testConnectionText}>Test</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  syncStatusCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsGrid: {
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryAction: {
    backgroundColor: '#007AFF',
  },
  actionTitlePrimary: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  actionSubtitlePrimary: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  connectionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  testConnectionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#C62828',
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});