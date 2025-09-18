import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, FlatList, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lunch Money API configuration
const LUNCH_MONEY_API_URL = 'https://dev.lunchmoney.app/v1';

// Simple API client with better error handling
const callLunchMoneyAPI = async (endpoint: string, token: string) => {
  console.log('Making API call to:', `${LUNCH_MONEY_API_URL}${endpoint}`);
  console.log('Token length:', token.length);
  
  try {
    const response = await fetch(`${LUNCH_MONEY_API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API response data:', data);
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [token, setToken] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add Transaction state
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('0');
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountData, setSelectedAccountData] = useState<any>(null);

  // Keypad functions
  const handleKeypadInput = (input: string) => {
    setAmount(prev => {
      if (prev === '0' && input !== '.') {
        return input;
      }
      if (input === '.' && prev.includes('.')) {
        return prev;
      }
      return prev + input;
    });
  };

  const handleKeypadBackspace = () => {
    setAmount(prev => {
      if (prev.length <= 1) {
        return '0';
      }
      return prev.slice(0, -1);
    });
  };

  // Sample transaction data (will be replaced with API data)
  const sampleTransactions = [
    {
      id: 1,
      date: '2025-09-18',
      payee: 'Starbucks Coffee',
      amount: '4.95',
      currency: 'eur',
      category: 'Food & Dining',
      account: 'Chase Credit Card',
      notes: 'Morning coffee',
      is_income: false
    },
    {
      id: 2,
      date: '2025-09-17',
      payee: 'Shell Gas Station',
      amount: '45.20',
      currency: 'eur',
      category: 'Gas & Fuel',
      account: 'Chase Credit Card',
      notes: 'Weekly fill-up',
      is_income: false
    },
    {
      id: 3,
      date: '2025-09-16',
      payee: 'Salary Deposit',
      amount: '2500.00',
      currency: 'eur',
      category: 'Salary',
      account: 'Bank Account',
      notes: 'Bi-weekly paycheck',
      is_income: true
    }
  ];

  // Load saved token on app start
  useEffect(() => {
    loadSavedToken();
  }, []);

  // Load transactions when token is available
  useEffect(() => {
    if (token && currentScreen === 'transactions') {
      fetchTransactions();
    }
  }, [token, currentScreen]);

  // Load accounts when entering add transaction screen
  useEffect(() => {
    console.log('🔍 useEffect triggered - currentScreen:', currentScreen, 'token:', !!token, 'accounts length:', accounts.length);
    
    if (token && currentScreen === 'addTransaction') {
      console.log('🚀 Triggering account fetch from useEffect');
      fetchAccounts();
    }
  }, [token, currentScreen]);

  const loadSavedToken = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('lunchMoneyToken');
      if (savedToken) {
        setToken(savedToken);
      }
    } catch (error) {
      console.error('Error loading token:', error);
    }
  };

  const processTransferGroups = (transactions: any[], assetMap: { [key: string]: string } = {}) => {
    // First, identify all group transactions (the main transfer entries)
    const groupTransactions = transactions.filter((t: any) => t.is_group);
    const groupIds = new Set(groupTransactions.map((t: any) => t.id));
    
    // Filter out individual transactions that are part of a group
    const filteredTransactions = transactions.filter((t: any) => {
      // Keep the transaction if:
      // 1. It's not part of a group (group_id is null)
      // 2. OR it's the main group transaction itself
      return !t.group_id || groupIds.has(t.id);
    });
    
    console.log(`🔄 Filtered ${transactions.length - filteredTransactions.length} individual transfer transactions`);
    
    // Now process the group transactions to show proper transfer info
    const processedTransactions = filteredTransactions.map((transaction: any) => {
      if (transaction.is_group && transaction.children && transaction.children.length >= 2) {
        // This is a grouped transaction - check what type it actually is
        const children = transaction.children;
        
        // Check if this is actually a transfer by looking at the main transaction category
        const isTransfer = transaction.category_name === 'Transfer' || 
                          transaction.category_name === 'Transfers' ||
                          transaction.category === 'Transfer' ||
                          transaction.category === 'Transfers';
        
        if (isTransfer) {
          // Handle transfer groups
          const debitChild = children.find((c: any) => parseFloat(c.amount || 0) < 0);
          const creditChild = children.find((c: any) => parseFloat(c.amount || 0) > 0);
          
          if (debitChild && creditChild) {
            const transferAmount = Math.abs(parseFloat(debitChild.amount || 0));
            
            // Get account names with better fallback logic
            const fromAccount = assetMap[creditChild.asset_id?.toString()] || 
                              assetMap[`plaid_${creditChild.plaid_account_id}`] ||
                              creditChild.account_display_name || 
                              creditChild.asset_display_name ||
                              creditChild.plaid_account_display_name ||
                              `Account ${creditChild.asset_id}` ||
                              'Unknown Account';
            const toAccount = assetMap[debitChild.asset_id?.toString()] || 
                            assetMap[`plaid_${debitChild.plaid_account_id}`] ||
                            debitChild.account_display_name || 
                            debitChild.asset_display_name ||
                            debitChild.plaid_account_display_name ||
                            `Account ${debitChild.asset_id}` ||
                            'Unknown Account';
            
            console.log(`🔄 Processing transfer: ${transferAmount} ${transaction.currency} from ${fromAccount} (credit: ${creditChild.amount}) to ${toAccount} (debit: ${debitChild.amount})`);
            
            return {
              ...transaction,
              payee: `Transfer: ${fromAccount} → ${toAccount}`,
              amount: transferAmount,
              is_transfer: true,
              from_account: fromAccount,
              to_account: toAccount,
              account_display_name: `${fromAccount} → ${toAccount}`,
              category_name: 'Transfer',
            };
          }
        } else {
          // Handle non-transfer groups (like payment + refund)
          console.log(`📋 Processing non-transfer group: ${transaction.category_name} with ${children.length} children`);
          
          // For non-transfer groups, calculate net amount and collect dates
          const totalAmount = parseFloat(transaction.amount || 0);
          const dates = children.map((c: any) => c.date).filter(Boolean).sort();
          const payees = children.map((c: any) => c.payee).filter(Boolean);
          const mainChild = children.find((c: any) => Math.abs(parseFloat(c.amount || 0)) > Math.abs(totalAmount)) || children[0];
          
          // Get account name for the main transaction
          const accountName = assetMap[mainChild?.asset_id?.toString()] || 
                            assetMap[`plaid_${mainChild?.plaid_account_id}`] ||
                            mainChild?.account_display_name || 
                            mainChild?.asset_display_name ||
                            mainChild?.plaid_account_display_name ||
                            transaction.account_display_name ||
                            'Unknown Account';
          
          return {
            ...transaction,
            account_display_name: accountName,
            payee: transaction.payee || payees[0] || 'Unknown',
            notes: transaction.notes || `Grouped transaction (${children.length} items)`,
            is_grouped_non_transfer: true,
            group_dates: dates,
            group_children: children,
            amount: Math.abs(totalAmount), // Always show positive amount for grouped transactions
          };
        }
      }
      
      return transaction;
    });
    
    return processedTransactions;
  };

  const fetchAccounts = async () => {
    if (!token) {
      console.log('❌ No token available for fetching accounts');
      return;
    }
    
    try {
      console.log('🏦 Fetching accounts for selection...');
      setIsLoading(true);
      const accountsData = await callLunchMoneyAPI('/assets', token);
      console.log('🏦 Raw accounts response:', accountsData);
      
      if (accountsData && accountsData.assets) {
        console.log('🏦 All assets:', accountsData.assets);
        
        // Debug: Log the structure of the first asset to see available fields
        if (accountsData.assets.length > 0) {
          console.log('🔍 First asset structure:', JSON.stringify(accountsData.assets[0], null, 2));
          console.log('🔍 Available fields:', Object.keys(accountsData.assets[0]));
        }
        
        // Filter for physical cash assets that are active (closed_on is null)
        const physicalCashAccounts = accountsData.assets.filter((asset: any) => {
          const isPhysicalCash = asset.subtype_name === "physical cash";
          const isActive = asset.closed_on === null; // Active accounts have closed_on = null
          
          console.log(`Account ${asset.name}: subtype_name="${asset.subtype_name}", physical_cash=${isPhysicalCash}, active=${isActive}, closed_on=${asset.closed_on}`);
          console.log(`🔍 Full asset object:`, asset);
          return isPhysicalCash && isActive;
        });
        
        console.log('� Filtered physical cash accounts:', physicalCashAccounts);
        setAccounts(physicalCashAccounts);
        
        if (physicalCashAccounts.length === 0) {
          console.log('⚠️ No physical cash accounts found after filtering');
        }
      } else {
        console.log('❌ No assets property in response');
      }
    } catch (error) {
      console.log('❌ Error fetching accounts:', error);
      setError('Failed to fetch accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 Fetching all transactions...');
      
      // First, let's fetch accounts to see what's available
      let accountsData;
      let assetMap: { [key: string]: string } = {};
      try {
        accountsData = await callLunchMoneyAPI('/assets', token);
        console.log('🏦 Available assets/accounts:', accountsData);
        
        // Create a mapping of asset_id to display_name and store accounts
        if (accountsData && accountsData.assets) {
          // Filter for non-Plaid accounts only (manual accounts)
          const manualAccounts = accountsData.assets.filter((asset: any) => 
            !asset.plaid_account_id && asset.status === 'active'
          );
          setAccounts(manualAccounts);
          console.log('📱 Manual accounts for selection:', manualAccounts);
          
          accountsData.assets.forEach((asset: any) => {
            assetMap[asset.id.toString()] = asset.display_name || asset.name;
          });
          console.log('🗺️ Asset mapping:', assetMap);
        }
        
        // Also try to get Plaid accounts which might have different IDs
        try {
          const plaidData = await callLunchMoneyAPI('/plaid_accounts', token);
          console.log('🏦 Plaid accounts:', plaidData);
          
          if (plaidData && plaidData.plaid_accounts) {
            plaidData.plaid_accounts.forEach((account: any) => {
              // Map plaid_account_id to display_name for better account resolution
              if (account.id && account.display_name) {
                assetMap[`plaid_${account.id}`] = account.display_name;
              }
            });
            console.log('🗺️ Updated asset mapping with Plaid accounts:', assetMap);
          }
        } catch (plaidError) {
          console.log('ℹ️ Could not fetch Plaid accounts:', plaidError);
        }
      } catch (accountError) {
        console.log('ℹ️ Could not fetch assets:', accountError);
      }
      
      // Fetch more transactions and include all types
      // Get transactions from the last 6 months to ensure we get recent data
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`📅 Date range: ${startDate} to ${endDate}`);
      
      // Fetch regular transactions with no limit to get all transactions
      const transactionData = await callLunchMoneyAPI(
        `/transactions?start_date=${startDate}&end_date=${endDate}&limit=0&debit_as_negative=false`, 
        token
      );
      
      let allTransactions: any[] = [];
      
      // Add regular transactions (which already include executed recurring transactions)
      if (transactionData && transactionData.transactions) {
        console.log(`📊 Found ${transactionData.transactions.length} regular transactions`);
        
        // Log a few sample transactions to understand the transfer structure
        const sampleTransactions = transactionData.transactions.slice(0, 3);
        console.log('📋 Sample transactions structure:', JSON.stringify(sampleTransactions, null, 2));
        
        // Check for transfer-related fields
        const transferTransactions = transactionData.transactions.filter((t: any) => 
          t.category === 'Transfer' || t.category_name === 'Transfer' || t.group_id || t.is_group
        );
        if (transferTransactions.length > 0) {
          console.log('🔄 Transfer transactions found:', JSON.stringify(transferTransactions.slice(0, 2), null, 2));
        }
        
        allTransactions = [...transactionData.transactions];
        
        // Group by account for debugging
        const accountGroups: { [key: string]: number } = {};
        const recurringCount = transactionData.transactions.filter((t: any) => t.recurring_id).length;
        
        transactionData.transactions.forEach((t: any) => {
          const account = t.account_display_name || t.asset_display_name || t.plaid_account_display_name || 'Unknown';
          accountGroups[account] = (accountGroups[account] || 0) + 1;
        });
        
        console.log('🏦 Regular transactions by account:', accountGroups);
        console.log(`🔄 Found ${recurringCount} transactions with recurring_id (recurring transactions)`);
        
        // Process transfer groups to combine grouped transfer transactions
        allTransactions = processTransferGroups(allTransactions, assetMap);
        console.log(`📊 After processing transfers: ${allTransactions.length} transactions`);
      }
      
      // Sort transactions by date (most recent first)
      const sortedTransactions = allTransactions.sort((a: any, b: any) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      console.log(`📊 Total transactions after merging: ${sortedTransactions.length}`);
      
      setTransactions(sortedTransactions);
    } catch (error) {
      console.error('❌ Error fetching transactions:', error);
      setError('Failed to load transactions. Check your API token.');
      // Keep sample data as fallback
      setTransactions(sampleTransactions);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (token.trim()) {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Testing token...');
        // Test the token first
        await callLunchMoneyAPI('/me', token.trim());
        
        // Save token if valid
        await AsyncStorage.setItem('lunchMoneyToken', token.trim());
        Alert.alert('Success!', 'Token saved successfully');
        setCurrentScreen('home');
      } catch (error) {
        console.error('Token validation failed:', error);
        let errorMessage = 'Invalid token. Please check and try again.';
        
        if (error instanceof Error) {
          if (error.message.includes('401')) {
            errorMessage = 'Invalid API token. Please check your token from Lunch Money settings.';
          } else if (error.message.includes('403')) {
            errorMessage = 'Token lacks required permissions.';
          } else if (error.message.includes('Network')) {
            errorMessage = 'Network error. Please check your internet connection.';
          } else {
            errorMessage = `Error: ${error.message}`;
          }
        }
        
        Alert.alert('Error', errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert('Error', 'Please enter a token');
    }
  };

  const renderTransaction = ({ item }: { item: any }) => {
    // Simple currency display - just use the currency code from API
    const currency = item.currency?.toUpperCase() || 'USD';
    
    // Handle transfer transactions differently
    if (item.is_transfer) {
      const amount = parseFloat(item.amount || 0);
      const displayAmount = Math.abs(amount);

      return (
        <View style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <Text style={styles.payee}>{item.payee}</Text>
            <Text style={[styles.amount, styles.transfer]}>
              {currency} {displayAmount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.transactionDetails}>
            <Text style={styles.category}>Transfer</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
          <Text style={styles.account}>{item.from_account} → {item.to_account}</Text>
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          <Text style={styles.transferIndicator}>↔️ Transfer</Text>
        </View>
      );
    }
    
    // Handle grouped non-transfer transactions (like payment + refund)
    if (item.is_grouped_non_transfer) {
      const amount = parseFloat(item.amount || 0);
      const displayAmount = Math.abs(amount);

      return (
        <View style={styles.transactionCard}>
          <View style={styles.transactionHeader}>
            <Text style={styles.payee}>{item.payee}</Text>
            <Text style={[styles.amount, styles.grouped]}>
              {currency} {displayAmount.toFixed(2)}
            </Text>
          </View>
          <View style={styles.transactionDetails}>
            <Text style={styles.category}>{item.category_name || 'Grouped Transaction'}</Text>
            <View style={styles.groupDates}>
              {item.group_dates && item.group_dates.length > 1 && (
                <>
                  <Text style={styles.date}>Payment: {item.group_dates[0]}</Text>
                  <Text style={styles.date}>Refund: {item.group_dates[item.group_dates.length - 1]}</Text>
                </>
              )}
              {(!item.group_dates || item.group_dates.length <= 1) && (
                <Text style={styles.date}>{item.date}</Text>
              )}
            </View>
          </View>
          <Text style={styles.account}>{item.account_display_name || 'Unknown Account'}</Text>
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          <Text style={styles.groupIndicator}>📋 Grouped ({item.group_children?.length || 0} items)</Text>
        </View>
      );
    }
    
    // Regular transaction rendering
    // Use API's is_income field if available, otherwise fall back to amount logic
    // The API provides is_income based on category properties
    const isIncome = item.is_income === true;
    const amount = parseFloat(item.amount || 0);
    const displayAmount = Math.abs(amount);

    // Check if this is a recurring transaction based on recurring_id field
    const isRecurring = Boolean(item.recurring_id);
    const displayPayee = item.payee || 'Unknown';
    const displayNotes = item.notes;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <Text style={styles.payee}>{displayPayee}</Text>
          <Text style={[styles.amount, isIncome ? styles.income : styles.expense]}>
            {!isIncome ? '-' : ''}{currency} {displayAmount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.category}>{item.category_name || item.category || 'Uncategorized'}</Text>
          <Text style={styles.date}>{item.date}</Text>
        </View>
        <Text style={styles.account}>{item.account_display_name || item.asset_display_name || item.plaid_account_display_name || item.account || 'Unknown Account'}</Text>
        {displayNotes && <Text style={styles.notes}>{displayNotes}</Text>}
        {isRecurring && (
          <Text style={styles.recurringIndicator}>🔄 Recurring</Text>
        )}
      </View>
    );
  };

  // Transactions Screen
  if (currentScreen === 'transactions') {
    const dataToShow = transactions.length > 0 ? transactions : sampleTransactions;
    
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={fetchTransactions}>
            <Text style={styles.refreshButton}>↻</Text>
          </TouchableOpacity>
        </View>
        
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : (
          <FlatList
            data={dataToShow}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  // Account Selection Screen
  if (currentScreen === 'selectAccount') {
    return (
      <View style={styles.accountSelectionContainer}>
        {/* Header */}
        <View style={styles.accountSelectionHeader}>
          <TouchableOpacity 
            style={styles.accountBackButton}
            onPress={() => setCurrentScreen('addTransaction')}
          >
            <Text style={styles.accountBackText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.accountSelectionTitle}>Account</Text>
          <TouchableOpacity style={styles.accountSettingsButton}>
            <Text style={styles.accountSettingsText}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Account List */}
        <View style={styles.accountList}>
          {isLoading ? (
            <View style={styles.noAccountsContainer}>
              <Text style={styles.noAccountsText}>Loading accounts...</Text>
            </View>
          ) : accounts.length === 0 ? (
            <View style={styles.noAccountsContainer}>
              <Text style={styles.noAccountsText}>
                {token ? 'No manual accounts found' : 'No API token configured'}
              </Text>
              <Text style={styles.noAccountsText}>
                Check console for debugging info
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.accountCountContainer}>
                <Text style={styles.accountCountText}>
                  {accounts.length} account{accounts.length !== 1 ? 's' : ''} available
                </Text>
              </View>
              {accounts.map((account) => {
                const accountTypeDisplay = account.type_name || 'Cash';
                const accountIcon = account.type_name?.toLowerCase().includes('cash') ? '💵' : '🏦';
                
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={styles.accountItem}
                    onPress={() => {
                      console.log('🏦 Selected account:', account);
                      setSelectedAccount(account.id.toString());
                      setSelectedAccountData(account);
                      setCurrentScreen('addTransaction');
                    }}
                  >
                    <View style={styles.accountIconContainer}>
                      <Text style={styles.accountIcon}>{accountIcon}</Text>
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountName}>
                        {account.display_name || account.name}
                      </Text>
                      <Text style={styles.accountType}>{accountTypeDisplay}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      </View>
    );
  }

  // Add Transaction Screen
  if (currentScreen === 'addTransaction') {
    return (
      <View style={[
        styles.walletContainer,
        transactionType === 'expense' ? styles.expenseBackground : styles.incomeBackground
      ]}>
        {/* Header with back button */}
        <View style={styles.walletHeader}>
          <TouchableOpacity 
            style={styles.walletBackButton}
            onPress={() => setCurrentScreen('home')}
          >
            <Text style={styles.walletBackText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.walletTitle}>Add Transaction</Text>
          <View style={styles.walletBackButton}></View>
        </View>

        {/* Transaction Type Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, transactionType === 'expense' && styles.activeTab]}
            onPress={() => setTransactionType('expense')}
          >
            <Text style={[styles.tabText, transactionType === 'expense' && styles.activeTabText]}>
              EXPENSE
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, transactionType === 'income' && styles.activeTab]}
            onPress={() => setTransactionType('income')}
          >
            <Text style={[styles.tabText, transactionType === 'income' && styles.activeTabText]}>
              INCOME
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Display */}
        <View style={styles.amountSection}>
          <Text style={[styles.signSymbol, transactionType === 'expense' ? styles.negativeSign : styles.positiveSign]}>
            {transactionType === 'expense' ? '-' : '+'}
          </Text>
          <Text style={styles.currencySymbol}>
            {selectedAccountData?.currency === 'eur' ? '€' : 
             selectedAccountData?.currency === 'mad' ? 'MAD' : 
             selectedAccountData?.currency === 'usd' ? '$' : '$'}
          </Text>
          <Text style={styles.amountText}>{amount}</Text>
        </View>

        {/* Account and Category Cards */}
        <View style={styles.cardSection}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => setCurrentScreen('selectAccount')}
          >
            <Text style={styles.cardLabel}>Account</Text>
            <Text style={styles.cardValue}>
              {selectedAccountData ? 
                `${selectedAccountData.display_name || selectedAccountData.name}` : 
                'Select account'
              }
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardLabel}>Category</Text>
            <Text style={styles.cardValue}>
              {selectedCategory || 'Select category'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('1')}>
              <Text style={styles.keypadButtonText}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('2')}>
              <Text style={styles.keypadButtonText}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('3')}>
              <Text style={styles.keypadButtonText}>3</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('4')}>
              <Text style={styles.keypadButtonText}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('5')}>
              <Text style={styles.keypadButtonText}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('6')}>
              <Text style={styles.keypadButtonText}>6</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('7')}>
              <Text style={styles.keypadButtonText}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('8')}>
              <Text style={styles.keypadButtonText}>8</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('9')}>
              <Text style={styles.keypadButtonText}>9</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('.')}>
              <Text style={styles.keypadButtonText}>.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={() => handleKeypadInput('0')}>
              <Text style={styles.keypadButtonText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keypadButton} onPress={handleKeypadBackspace}>
              <Text style={styles.keypadButtonText}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Settings Screen
  if (currentScreen === 'settings') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Settings</Text>
        <Text style={styles.subtitle}>Enter your Lunch Money API Token</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Paste your API token here"
          value={token}
          onChangeText={setToken}
          secureTextEntry
          editable={!isLoading}
        />
        
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleSaveToken}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Save Token</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => setCurrentScreen('home')}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.debugText}>
          Debug: Using {LUNCH_MONEY_API_URL}
        </Text>
      </View>
    );
  }

  // Home Screen
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Flash Track Money</Text>
      <Text style={styles.subtitle}>Ready to track expenses!</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setCurrentScreen('addTransaction')}
      >
        <Text style={styles.buttonText}>Add Transaction</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setCurrentScreen('transactions')}
      >
        <Text style={styles.buttonText}>View Transactions</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]}
        onPress={() => setCurrentScreen('settings')}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Settings</Text>
      </TouchableOpacity>
      
      {token && (
        <Text style={styles.tokenStatus}>
          API Token configured ✓
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 120,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    fontSize: 16,
  },
  tokenStatus: {
    marginTop: 20,
    color: '#34C759',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Transaction List Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  refreshButton: {
    fontSize: 18,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  transactionsList: {
    flex: 1,
    marginTop: 10,
  },
  transactionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  payee: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expense: {
    color: '#FF3B30',
  },
  income: {
    color: '#34C759',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#666',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  account: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  notes: {
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  recurringIndicator: {
    fontSize: 12,
    color: '#6B73FF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  transfer: {
    color: '#007AFF',
    fontWeight: '600',
  },
  transferIndicator: {
    fontSize: 12,
    color: '#FF9500',
    fontStyle: 'italic',
    marginTop: 4,
  },
  groupDates: {
    flexDirection: 'column',
  },
  groupIndicator: {
    fontSize: 12,
    color: '#6B73FF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  grouped: {
    color: '#8E44AD',
    fontWeight: '600',
  },
  
  // Wallet-style Add Transaction styles
  walletContainer: {
    flex: 1,
    backgroundColor: '#2D7D7A', // Default color, will be overridden
    paddingTop: 35, // Reduced from 50
  },
  expenseBackground: {
    backgroundColor: '#FFE5E5', // Light red for expenses
  },
  incomeBackground: {
    backgroundColor: '#E5F5E5', // Light green for income
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 5, // Reduced from 10
  },
  walletBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletBackText: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
  },
  walletTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 20,
    marginTop: 5, // Reduced from default
    marginBottom: 8, // Reduced from 15
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 6, // Reduced from 8
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
  },
  tabText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#333',
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, // Reduced from 15
  },
  signSymbol: {
    fontSize: 40,
    fontWeight: '300',
    marginRight: 8,
  },
  positiveSign: {
    color: '#4CAF50', // Green for income
  },
  negativeSign: {
    color: '#F44336', // Red for expense
  },
  currencySymbol: {
    color: '#333',
    fontSize: 40,
    fontWeight: '300',
    marginRight: 8,
  },
  amountText: {
    color: '#333',
    fontSize: 48,
    fontWeight: '300',
  },
  cardSection: {
    paddingHorizontal: 20,
    marginBottom: 8, // Reduced from 10
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 12, // Reduced from 14
    marginBottom: 6, // Reduced from 8
  },
  cardLabel: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardValue: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  keypad: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8, // Reduced from 12
    paddingHorizontal: 20,
    paddingBottom: 20, // Added bottom padding to ensure visibility
    flex: 1,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6, // Reduced from 8
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  keypadButtonText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333',
  },
  
  // Account Selection Screen styles
  accountSelectionContainer: {
    flex: 1,
    backgroundColor: '#2D7D7A',
  },
  accountSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#2D7D7A',
  },
  accountBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountBackText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  accountSelectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  accountSettingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountSettingsText: {
    color: 'white',
    fontSize: 20,
  },
  accountList: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 0,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  accountIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#2D7D7A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  accountIcon: {
    fontSize: 20,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 14,
    color: '#666',
  },
  noAccountsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  noAccountsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  accountCountContainer: {
    padding: 16,
    backgroundColor: 'rgba(45, 125, 122, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  accountCountText: {
    fontSize: 14,
    color: '#2D7D7A',
    fontWeight: '600',
    textAlign: 'center',
  },
});
