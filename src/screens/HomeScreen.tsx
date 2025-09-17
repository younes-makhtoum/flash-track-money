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
import { useAppStore } from '../store/appStore';
import { getLunchMoneyAPI } from '../services/lunchMoneyAPI';
import { NewTransaction } from '../types';

type ScreenMode = 'home' | 'camera' | 'expense';

export const HomeScreen: React.FC = () => {
  const [screenMode, setScreenMode] = useState<ScreenMode>('home');
  const [capturedReceipt, setCapturedReceipt] = useState<string | null>(null);
  
  const { 
    settings, 
    syncStatus, 
    offlineTransactions,
    addOfflineTransaction,
    setCategories,
    setTags,
    updateSyncStatus,
    setLoading,
    setError 
  } = useAppStore();

  useEffect(() => {
    // Initialize app data
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    if (!settings.lunchMoneyApiToken) {
      // Show setup screen or prompt for API token
      return;
    }

    try {
      setLoading(true);
      const api = getLunchMoneyAPI(settings.lunchMoneyApiToken);
      
      // Load categories and tags
      const [categories, tags] = await Promise.all([
        api.getCategories(),
        api.getTags(),
      ]);
      
      setCategories(categories);
      setTags(tags);
      
      updateSyncStatus({ lastSync: new Date().toISOString() });
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setError('Failed to sync with Lunch Money');
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePhoto = (imageUri: string) => {
    setCapturedReceipt(imageUri);
    setScreenMode('expense');
  };

  const handleSaveTransaction = async (transaction: NewTransaction) => {
    try {
      if (settings.lunchMoneyApiToken && navigator.onLine) {
        // Try to save online
        const api = getLunchMoneyAPI(settings.lunchMoneyApiToken);
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

  const syncOfflineTransactions = async () => {
    if (!settings.lunchMoneyApiToken || offlineTransactions.length === 0) {
      return;
    }

    try {
      updateSyncStatus({ isSyncing: true });
      const api = getLunchMoneyAPI(settings.lunchMoneyApiToken);
      
      for (const transaction of offlineTransactions) {
        await api.createTransaction(transaction);
      }
      
      // Clear offline transactions after successful sync
      useAppStore.getState().clearOfflineTransactions();
      updateSyncStatus({ 
        lastSync: new Date().toISOString(),
        isSyncing: false 
      });
      
      Alert.alert('Sync Complete', `${offlineTransactions.length} transactions synced`);
    } catch (error) {
      console.error('Sync failed:', error);
      updateSyncStatus({ isSyncing: false });
      Alert.alert('Sync Failed', 'Some transactions could not be synced');
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Flash Track Money</Text>
        <Text style={styles.subtitle}>Lunch Money Companion</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Sync Status */}
        <View style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <Ionicons 
              name={syncStatus.isOnline ? "cloud" : "cloud-offline"} 
              size={20} 
              color={syncStatus.isOnline ? "#10B981" : "#EF4444"} 
            />
            <Text style={styles.syncTitle}>
              {syncStatus.isOnline ? 'Connected' : 'Offline'}
            </Text>
            {offlineTransactions.length > 0 && (
              <TouchableOpacity 
                style={styles.syncButton}
                onPress={syncOfflineTransactions}
                disabled={syncStatus.isSyncing}
              >
                <Text style={styles.syncButtonText}>
                  {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {offlineTransactions.length > 0 && (
            <Text style={styles.pendingText}>
              {offlineTransactions.length} pending transaction{offlineTransactions.length !== 1 ? 's' : ''}
            </Text>
          )}
          
          {syncStatus.lastSync && (
            <Text style={styles.lastSyncText}>
              Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setScreenMode('camera')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="camera" size={24} color="#007AFF" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Capture Receipt</Text>
              <Text style={styles.actionDescription}>
                Take a photo of your receipt and add expense
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setScreenMode('expense')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="add-circle" size={24} color="#10B981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Quick Expense</Text>
              <Text style={styles.actionDescription}>
                Add an expense without receipt
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        </View>

        {/* API Token Setup */}
        {!settings.lunchMoneyApiToken && (
          <View style={styles.setupCard}>
            <Ionicons name="key" size={24} color="#F59E0B" />
            <Text style={styles.setupTitle}>Setup Required</Text>
            <Text style={styles.setupDescription}>
              Add your Lunch Money API token to sync transactions
            </Text>
            <TouchableOpacity style={styles.setupButton}>
              <Text style={styles.setupButtonText}>Add API Token</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
  },
  subtitle: {
    fontSize: 14,
    color: '#86868B',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  syncCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
    color: '#1D1D1F',
  },
  syncButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    fontSize: 14,
    color: '#F59E0B',
    marginBottom: 4,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#86868B',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#86868B',
  },
  setupCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 8,
    marginBottom: 4,
  },
  setupDescription: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    marginBottom: 16,
  },
  setupButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
