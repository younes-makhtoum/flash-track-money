import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, FlatList, ActivityIndicator, ScrollView, Modal, Platform, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import SettingsScreen from './src/screens/SettingsScreen';
import AttachmentModal from './src/components/AttachmentModal';
import ReceiptGallery from './src/components/ReceiptGallery';
import { SecureStorage } from './src/utils/storage';

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
  const [currentScreen, setCurrentScreen] = useState('transactions');
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
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedAccountData, setSelectedAccountData] = useState<any>(null);
  const [selectedCategoryData, setSelectedCategoryData] = useState<any>(null);
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<any>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [originalTransactionType, setOriginalTransactionType] = useState<'expense' | 'income' | null>(null);
  
  // Category section expanded state
  const [expensesExpanded, setExpensesExpanded] = useState(true);
  const [incomesExpanded, setIncomesExpanded] = useState(false);
  
  // Tag-related state
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [isTagSearching, setIsTagSearching] = useState(false);
  
  // Transaction detail fields
  const [transactionNote, setTransactionNote] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');
  const [transactionTags, setTransactionTags] = useState<string[]>([]);
  const [transactionPayee, setTransactionPayee] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [hasReceipt, setHasReceipt] = useState(false);
  
  // Edit Transaction state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Attachment-related state
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [transactionAttachments, setTransactionAttachments] = useState<any[]>([]);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  
  // Receipt gallery state
  const [showReceiptGallery, setShowReceiptGallery] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  // Helper functions for date formatting
  // Helper function to determine if an account can be edited for new transactions
  const isAccountEditable = (account: any) => {
    return account.subtype_name === "physical cash";
  };

  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatTimeForDisplay = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDateToISO8601 = (date: Date) => {
    return date.toISOString();
  };

  // Attachment handling functions
  const handleAttachmentAdded = (attachment: any) => {
    setTransactionAttachments(prev => [...prev, attachment]);
    setHasReceipt(true);
  };

  const removeAttachment = async (attachmentId: string) => {
    if (currentTransactionId) {
      try {
        await SecureStorage.removeTransactionAttachment(currentTransactionId, attachmentId);
      } catch (error) {
        Alert.alert('Error', 'Failed to remove attachment');
        return;
      }
    }
    setTransactionAttachments(prev => prev.filter(att => att.id !== attachmentId));
    
    // Update hasReceipt based on remaining attachments
    setHasReceipt(transactionAttachments.length > 1);
  };

  const openReceiptGallery = (index: number) => {
    setGalleryInitialIndex(index);
    setShowReceiptGallery(true);
  };

  const handleDeleteFromGallery = async (attachmentId: string) => {
    await removeAttachment(attachmentId);
    
    // Close gallery if no more attachments
    if (transactionAttachments.length <= 1) {
      setShowReceiptGallery(false);
    }
  };

  const linkAttachmentsToTransaction = async (transactionId: string) => {
    // Update any temporary attachments with the real transaction ID
    for (const attachment of transactionAttachments) {
      if (attachment.transactionId === 'temp') {
        const updatedAttachment = { ...attachment, transactionId };
        try {
          await SecureStorage.addTransactionAttachment(updatedAttachment);
        } catch (error) {
          console.error('Failed to link attachment to transaction:', error);
        }
      }
    }
    setCurrentTransactionId(transactionId);
  };

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
      // Only fetch if data is not already loaded or if explicitly needed
      if (accounts.length === 0) {
        console.log('🚀 Fetching accounts (not loaded yet)');
        fetchAccounts();
      }
      
      if (categories.length === 0) {
        console.log('🚀 Fetching categories (not loaded yet)');
        fetchCategories();
      }
      
      if (availableTags.length === 0) {
        console.log('🚀 Fetching tags (not loaded yet)');
        fetchTags();
      }
    }
  }, [token, currentScreen]);

  const loadSavedToken = async () => {
    try {
      const savedToken = await SecureStorage.getLunchMoneyToken();
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
        
        // Filter for ONLY physical cash assets that are active (closed_on is null)
        const physicalCashAccounts = accountsData.assets.filter((asset: any) => {
          const isCash = asset.type_name === "cash";
          const isPhysicalCash = asset.subtype_name === "physical cash";
          const isActive = asset.closed_on === null; // Active accounts have closed_on = null
          
          console.log(`Account ${asset.name}: type_name="${asset.type_name}", subtype_name="${asset.subtype_name}", cash=${isCash}, physical_cash=${isPhysicalCash}, active=${isActive}, closed_on=${asset.closed_on}`);
          console.log(`🔍 Full asset object:`, asset);
          return isCash && isPhysicalCash && isActive;
        });
        
        console.log('🏦 Filtered physical cash accounts only:', physicalCashAccounts);
        setAccounts(physicalCashAccounts);
        
        if (physicalCashAccounts.length === 0) {
          console.log('⚠️ No physical cash accounts found after filtering');
        } else {
          // Auto-select preferred account only if no account is currently selected
          if (!selectedAccount) {
            console.log('🎯 No account selected, running auto-selection');
            setTimeout(() => autoSelectPreferredAccount(), 100);
          } else {
            console.log('✅ Account already selected, keeping current selection:', selectedAccount);
          }
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

  const fetchCategories = async () => {
    if (!token) {
      console.log('❌ No token available for fetching categories');
      return;
    }
    
    try {
      console.log('📂 Fetching categories for selection...');
      const categoriesData = await callLunchMoneyAPI('/categories', token);
      console.log('📂 Raw categories response:', categoriesData);
      
      if (categoriesData && categoriesData.categories) {
        console.log('📂 All categories:', categoriesData.categories);
        
        // Debug: Log the structure of the first category to see available fields
        if (categoriesData.categories.length > 0) {
          console.log('🔍 First category structure:', JSON.stringify(categoriesData.categories[0], null, 2));
          console.log('🔍 Available category fields:', Object.keys(categoriesData.categories[0]));
        }
        
        // Filter for active categories (not archived)
        const activeCategories = categoriesData.categories.filter((category: any) => {
          // Most categories should be active by default, but let's check for archived flag
          const isActive = !category.archived;
          console.log(`Category ${category.name}: active=${isActive}, archived=${category.archived}`);
          return isActive;
        });
        
        console.log('📂 Filtered active categories:', activeCategories);
        setCategories(activeCategories);
        
        if (activeCategories.length === 0) {
          console.log('⚠️ No active categories found after filtering');
        }
      } else {
        console.log('❌ No categories property in response');
      }
    } catch (error) {
      console.log('❌ Error fetching categories:', error);
      setError('Failed to fetch categories');
    }
  };

  // Fetch tags from Lunch Money API
  const fetchTags = async () => {
    if (!token) {
      console.log('❌ No token available for fetching tags');
      return;
    }
    
    try {
      console.log('🏷️ Fetching tags...');
      const tagsData = await callLunchMoneyAPI('/tags', token);
      console.log('🏷️ Raw tags response:', tagsData);
      
      if (tagsData && Array.isArray(tagsData)) {
        // Extract tag names from the response
        const tagNames = tagsData.map((tag: any) => {
          // Tags might be objects with name property or just strings
          return typeof tag === 'string' ? tag : tag.name || tag.tag || '';
        }).filter((name: string) => name.trim() !== '');
        
        // Remove duplicates and sort
        const uniqueTags = [...new Set(tagNames)].sort();
        console.log('🏷️ Processed tags:', uniqueTags);
        setAvailableTags(uniqueTags);
      } else {
        console.log('🏷️ No tags found or unexpected format');
        setAvailableTags([]);
      }
    } catch (error) {
      console.log('❌ Error fetching tags:', error);
      // Don't set error for tags as they're optional
      setAvailableTags([]);
    }
  };

  // Transaction validation function
  const validateTransaction = () => {
    const errors: string[] = [];
    
    // Validate amount
    const numericAmount = parseFloat(amount);
    if (!amount || amount === '0' || isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    // Validate account selection
    if (!selectedAccount || !selectedAccountData) {
      errors.push('Please select an account');
    }
    
    // Validate category selection
    if (!selectedCategory || !selectedCategoryData) {
      errors.push('Please select a category');
    }
    
    // Validate payee (if required by user preference)
    if (!transactionPayee.trim()) {
      // Note: Payee is optional, but you can uncomment this if you want to make it required
      // errors.push('Please enter a payee');
    }
    
    // Validate date
    if (!transactionDate || isNaN(transactionDate.getTime())) {
      errors.push('Please select a valid date');
    }
    
    // Check if date is not in the future (optional validation)
    if (transactionDate > new Date()) {
      errors.push('Transaction date cannot be in the future');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Save transaction function
  const saveTransaction = async () => {
    const validation = validateTransaction();
    
    if (!validation.isValid) {
      Alert.alert(
        'Validation Error',
        validation.errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!token) {
      Alert.alert('Error', 'No API token found. Please set up your token in settings.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Prepare transaction data for Lunch Money API
      const isIncomeTransaction = selectedCategoryData?.is_income || false;
      const transactionAmount = parseFloat(amount);
      
      const transactionData: any = {
        date: transactionDate.toISOString().split('T')[0], // YYYY-MM-DD format (required)
        amount: transactionAmount, // Always positive amount - let category determine income/expense
        payee: transactionPayee.trim() || undefined,
        notes: transactionNote.trim() || undefined,
        category_id: parseInt(selectedCategory!),
        status: 'cleared', // Set status to cleared as requested
        tags: transactionTags.length > 0 ? transactionTags.map((tag: any) => typeof tag === 'object' ? tag.id : tag) : undefined,
      };

      // Add account information - either asset_id OR plaid_account_id, not both
      const accountInfo = accounts.find(acc => acc.id.toString() === selectedAccount);
      
      if (accountInfo) {
        // Add currency from account
        if (accountInfo.currency) {
          transactionData.currency = accountInfo.currency;
          console.log('💰 Setting currency from account:', accountInfo.currency);
        }
        
        // Add account ID - prefer asset_id over plaid_account_id
        if (accountInfo.id) {
          transactionData.asset_id = accountInfo.id;
          console.log('🏦 Setting asset_id:', accountInfo.id);
        } else if (accountInfo.plaid_account_id) {
          transactionData.plaid_account_id = accountInfo.plaid_account_id;
          console.log('🏦 Setting plaid_account_id:', accountInfo.plaid_account_id);
        }
      } else {
        console.log('⚠️ Warning: No account info found for selected account:', selectedAccount);
      }

      // Remove undefined values to keep request clean
      const cleanTransactionData = Object.fromEntries(
        Object.entries(transactionData).filter(([_, v]) => v !== undefined)
      );
      
      console.log('💾 Saving transaction:', cleanTransactionData);
      
      // Format request body according to API documentation
      const requestBody = {
        transactions: [cleanTransactionData], // API expects array of transactions
        apply_rules: false,
        skip_duplicates: false,
        check_for_recurring: false,
        debit_as_negative: false, // We send positive amounts, let category determine type
        skip_balance_update: true
      };
      
      // Call Lunch Money API to create transaction
      const response = await fetch(`${LUNCH_MONEY_API_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.log('❌ API Error Response:', errorData);
        
        // Handle API error format according to documentation
        const errorMessage = errorData.error || 
                            (errorData.errors && Array.isArray(errorData.errors) ? errorData.errors.join(', ') : 'Unknown error');
        
        throw new Error(`Failed to save transaction: ${errorMessage}`);
      }
      
      const result = await response.json();
      console.log('✅ Transaction saved successfully:', result);
      
      // Check if we got transaction IDs back (indicates success)
      if (!result.ids || !Array.isArray(result.ids) || result.ids.length === 0) {
        throw new Error('Transaction was not created - no IDs returned');
      }

      // Link attachments to the created transaction
      const createdTransactionId = result.ids[0].toString();
      if (transactionAttachments.length > 0) {
        await linkAttachmentsToTransaction(createdTransactionId);
      }
      
      // Reset form and navigate back to transactions
      resetTransactionForm();
      setCurrentScreen('transactions');
      // Refresh transactions to show the new one
      if (token) {
        fetchTransactions();
      }
      
    } catch (error) {
      console.log('❌ Error saving transaction:', error);
      Alert.alert(
        'Error',
        `Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-select account based on currency preference
  const autoSelectPreferredAccount = async () => {
    try {
      // First check if user has a specific account preference (account ID)
      const preferredAccountId = await SecureStorage.getAccountPreference();
      if (preferredAccountId && accounts.length > 0) {
        const preferredAccount = accounts.find(account => 
          account.id.toString() === preferredAccountId
        );
        
        if (preferredAccount) {
          console.log('🎯 Using preferred account:', preferredAccount.display_name);
          setSelectedAccount(preferredAccount.id.toString());
          setSelectedAccountData(preferredAccount);
          return;
        }
      }

      // Fallback to currency preference if no specific account preference
      const preferredCurrency = await SecureStorage.getCurrencyPreference();
      if (preferredCurrency && accounts.length > 0) {
        // Find the first account with the preferred currency
        const preferredAccount = accounts.find(account => 
          account.currency?.toLowerCase() === preferredCurrency.toLowerCase()
        );
        
        if (preferredAccount) {
          console.log('💰 Using currency-based account:', preferredAccount.display_name);
          setSelectedAccount(preferredAccount.id.toString());
          setSelectedAccountData(preferredAccount);
          return;
        }
      }
      
      // Fallback: select first account if no preference or no matching account
      if (accounts.length > 0) {
        console.log('🔄 Using first available account:', accounts[0].display_name);
        setSelectedAccount(accounts[0].id.toString());
        setSelectedAccountData(accounts[0]);
      }
    } catch (error) {
      console.error('Error auto-selecting account:', error);
      // Fallback to first account on error
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0].id.toString());
        setSelectedAccountData(accounts[0]);
      }
    }
  };

  // Reset transaction form
  const resetTransactionForm = () => {
    setAmount('0');
    setSelectedAccount(null);
    setSelectedCategory(null);
    setSelectedAccountData(null);
    setSelectedCategoryData(null);
    setSelectedCategoryGroup(null);
    setTransactionNote('');
    setTransactionPayee('');
    setTransactionTags([]);
    setTransactionDate(new Date());
    setCategorySearchQuery('');
    setTagSearchQuery('');
    setTransactionType('expense'); // Reset to default
    setOriginalTransactionType(null); // Reset original transaction type
    
    // Reset attachment state
    setTransactionAttachments([]);
    setHasReceipt(false);
    setCurrentTransactionId(null);
    
    // Auto-select preferred account after reset (only if accounts exist)
    if (accounts.length > 0) {
      setTimeout(() => autoSelectPreferredAccount(), 50);
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
        await SecureStorage.setLunchMoneyToken(token.trim());
        setCurrentScreen('transactions');
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

  // Helper function to format dates in a user-friendly way
  const formatTransactionDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Format as "Sept. 22, 2025"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).replace(',', '.');
  };

  // Helper function to format amounts with spaces for thousands and comma for decimals
  const formatAmount = (amount: number): string => {
    // Convert to absolute value
    const absoluteAmount = Math.abs(amount);
    
    // Check if the number has meaningful decimals
    const hasDecimals = absoluteAmount % 1 !== 0;
    
    let formattedNumber: string;
    if (hasDecimals) {
      // Show 2 decimal places if there are decimals
      formattedNumber = absoluteAmount.toFixed(2);
    } else {
      // Show whole number if no decimals
      formattedNumber = absoluteAmount.toString();
    }
    
    // Split into integer and decimal parts
    const parts = formattedNumber.split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Add spaces every 3 digits for thousands separator
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    // Return with comma as decimal separator if decimals exist
    if (decimalPart) {
      return `${formattedInteger},${decimalPart}`;
    } else {
      return formattedInteger;
    }
  };

  // Function to populate form fields with transaction data
  const populateEditForm = (transaction: any) => {
    console.log('🔄 Populating edit form with transaction:', transaction);
    console.log('🏦 Available accounts:', accounts.length);
    
    // Basic transaction details
    setAmount(Math.abs(parseFloat(transaction.amount || 0)).toString());
    setTransactionPayee(transaction.payee || '');
    setTransactionNote(transaction.notes || '');
    // Ensure tags are always strings, not objects
    const processedTags = (transaction.tags || []).map((tag: any) => 
      typeof tag === 'object' ? (tag.name || tag.tag || tag.id || '') : tag
    );
    setTransactionTags(processedTags);
    
    // Set transaction date
    if (transaction.date) {
      setTransactionDate(new Date(transaction.date));
    }
    
    // Find and set account
    if (transaction.account_id || transaction.plaid_account_id || transaction.asset_id) {
      // Use the most reliable account identifier available
      const accountId = transaction.account_id || transaction.plaid_account_id || transaction.asset_id;
      console.log('🏦 Looking for account ID:', accountId, 'from transaction data:', {
        account_id: transaction.account_id,
        plaid_account_id: transaction.plaid_account_id,
        asset_id: transaction.asset_id
      });
      
      setSelectedAccount(accountId.toString());
      const accountData = accounts.find(acc => acc.id === accountId);
      if (accountData) {
        console.log('✅ Found account in physical cash accounts:', accountData.display_name);
        setSelectedAccountData(accountData);
      } else {
        console.log('⚠️ Account not found in physical cash accounts, determining account type');
        
        // Determine if this is a physical cash account that wasn't loaded or a different type
        const isPlaidAccount = !!transaction.plaid_account_id;
        const isCashAccount = transaction.asset_institution_name === 'Cash' || 
                             transaction.account_display_name?.includes('Cash') ||
                             (!transaction.institution_name && !transaction.plaid_account_id);
        
        console.log('🔍 Account type analysis:', {
          isPlaidAccount,
          isCashAccount,
          institution_name: transaction.institution_name,
          asset_institution_name: transaction.asset_institution_name,
          account_display_name: transaction.account_display_name
        });
        
        // Create display account data with proper editability flags
        const tempAccountData = {
          id: accountId,
          display_name: transaction.account_display_name || 
                       transaction.plaid_account_display_name || 
                       transaction.asset_display_name || 
                       transaction.account || 
                       'Unknown Account',
          name: transaction.account_display_name || 
                transaction.plaid_account_display_name || 
                transaction.asset_display_name || 
                transaction.account || 
                'Unknown Account',
          currency: transaction.currency || 'usd',
          type_name: isPlaidAccount ? 'bank' : 'cash',
          subtype_name: isCashAccount ? 'physical cash' : 'bank_account',
          closed_on: null,
          institution_name: transaction.institution_name || null,
          asset_id: transaction.asset_id || null,
          asset_display_name: transaction.asset_display_name || null,
          asset_institution_name: transaction.asset_institution_name || null,
          asset_name: transaction.asset_name || null,
          plaid_account_id: transaction.plaid_account_id || null,
          isTemporary: true,
          isPlaidAccount: isPlaidAccount,
          // Physical cash accounts are editable, Plaid accounts are not
          isEditable: isCashAccount && !isPlaidAccount
        };
        console.log('🔧 Temp account data for display:', tempAccountData);
        setSelectedAccountData(tempAccountData);
      }
    }
    
    // Find and set category
    if (transaction.category_id) {
      setSelectedCategory(transaction.category_id.toString());
      const categoryData = categories.find(cat => cat.id === transaction.category_id);
      if (categoryData) {
        setSelectedCategoryData(categoryData);
      }
    }
    
    // Set transaction type based on category or amount
    // Use the same logic as transaction list display for consistency
    let originalType: 'expense' | 'income';
    const amount = parseFloat(transaction.amount || 0);
    
    // Check if transaction is categorized (has a category_id or category_name)
    const isCategorized = transaction.category_id || transaction.category_name;
    
    if (isCategorized && transaction.is_income !== undefined && transaction.is_income !== null) {
      // Use the explicit is_income field when available (for categorized transactions)
      originalType = transaction.is_income ? 'income' : 'expense';
    } else {
      // For uncategorized transactions, check if we have plaid_metadata with credit/debit info
      let plaidMetadata = null;
      let hasPlaidDebitCredit = false;
      
      if (transaction.plaid_metadata) {
        try {
          // Parse the JSON string to get the metadata object
          plaidMetadata = JSON.parse(transaction.plaid_metadata);
          hasPlaidDebitCredit = plaidMetadata && plaidMetadata.category && 
            Array.isArray(plaidMetadata.category) && 
            (plaidMetadata.category.includes('Credit') || plaidMetadata.category.includes('Debit'));
        } catch (e) {
          console.warn('Failed to parse plaid_metadata in populateEditForm:', e);
        }
      }
      
      if (hasPlaidDebitCredit) {
        // Use Plaid's credit/debit classification
        // Credit = inflow/income, Debit = outflow/expense
        originalType = plaidMetadata.category.includes('Credit') ? 'income' : 'expense';
      } else {
        // Fallback: For Plaid transactions without metadata, use inverted amount logic
        // This handles the counter-intuitive Plaid amount system
        const isPlaidTransaction = transaction.plaid_account_id || transaction.plaid_account_display_name;
        if (isPlaidTransaction) {
          // For Plaid: negative amounts should be treated as income, positive as expense
          originalType = amount < 0 ? 'income' : 'expense';
        } else {
          // Standard logic for non-Plaid transactions
          originalType = amount >= 0 ? 'income' : 'expense';
        }
      }
    }
    
    setTransactionType(originalType);
    // Store the original type for Plaid account restrictions
    setOriginalTransactionType(originalType);
  };

  // Function to save transaction changes
  const saveTransactionChanges = async () => {
    if (!editingTransaction || !token) {
      console.error('No transaction to edit or token missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare transaction data for update
      const updateData: any = {
        payee: transactionPayee,
        notes: transactionNote,
        date: transactionDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        amount: Math.abs(parseFloat(amount)), // Always positive - category determines if income/expense
        category_id: selectedCategory ? parseInt(selectedCategory) : null,
        tags: transactionTags,
      };

      // Add account information - use asset_id for physical cash accounts, account_id for others
      if (selectedAccount) {
        const accountInfo = accounts.find(acc => acc.id.toString() === selectedAccount);
        if (accountInfo) {
          // Update currency to match the selected account
          if (accountInfo.currency) {
            updateData.currency = accountInfo.currency;
            console.log('💰 Setting currency from account:', accountInfo.currency);
          }
          
          if (accountInfo.subtype_name === 'physical cash') {
            updateData.asset_id = parseInt(selectedAccount);
            console.log('🏦 Setting asset_id for physical cash account:', selectedAccount);
          } else {
            updateData.account_id = parseInt(selectedAccount);
            console.log('🏦 Setting account_id for non-cash account:', selectedAccount);
          }
        }
      }

      // Make PUT request to update transaction
      const response = await fetch(`${LUNCH_MONEY_API_URL}/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transaction: updateData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log('✅ Transaction updated successfully');
      
      // Refresh transactions list
      await fetchTransactions();
      
      // Return to transactions screen and clear form
      resetTransactionForm();
      setIsEditMode(false);
      setEditingTransaction(null);
      setCurrentScreen('transactions');
      
    } catch (error) {
      console.error('❌ Failed to update transaction:', error);
      setError(error instanceof Error ? error.message : 'Failed to update transaction');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle transaction press for editing
  const handleTransactionPress = async (transaction: any) => {
    console.log('📝 Transaction tapped for editing:', transaction);
    setEditingTransaction(transaction);
    setIsEditMode(true);
    
    // Load accounts and categories if not already loaded
    if (accounts.length === 0 && token) {
      await fetchAccounts();
    }
    if (categories.length === 0 && token) {
      await fetchCategories();
    }
    
    populateEditForm(transaction);
    setCurrentScreen('editTransaction');
  };

  const renderTransaction = ({ item }: { item: any }) => {
    // Simple currency display - just use the currency code from API
    const currency = item.currency?.toUpperCase() || 'USD';
    
    // Handle transfer transactions differently
    if (item.is_transfer) {
      const amount = parseFloat(item.amount || 0);
      const displayAmount = Math.abs(amount);

      return (
        <TouchableOpacity onPress={() => handleTransactionPress(item)}>
          <View style={styles.transactionCard}>
          {/* First line: Amount (left) and Date (right) */}
          <View style={styles.transactionHeader}>
            <Text style={[styles.amount, styles.transfer]}>
              {currency} {formatAmount(displayAmount)}
            </Text>
            <Text style={styles.date}>{formatTransactionDate(item.date)}</Text>
          </View>
          
          {/* Second line: Payee */}
          <Text style={styles.payee}>{item.payee}</Text>
          
          {/* Third line: Notes (if available) */}
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          
          {/* Bottom line: Icons (left) and Account (right) */}
          <View style={styles.bottomLine}>
            <View style={styles.leftIcons}>
              {(item.has_attachment || item.attachments?.length > 0) && (
                <Text style={[styles.receiptIcon, styles.iconSpacing]}>📎</Text>
              )}
              <Text style={styles.receiptIcon}>↔️</Text>
            </View>
            <Text style={styles.account}>{item.from_account} → {item.to_account}</Text>
          </View>
        </View>
        </TouchableOpacity>
      );
    }
    
    // Handle grouped non-transfer transactions (like payment + refund)
    if (item.is_grouped_non_transfer) {
      const amount = parseFloat(item.amount || 0);
      const displayAmount = Math.abs(amount);

      return (
        <TouchableOpacity onPress={() => handleTransactionPress(item)}>
          <View style={styles.transactionCard}>
          {/* First line: Amount (left) and Date (right) */}
          <View style={styles.transactionHeader}>
            <Text style={[styles.amount, styles.grouped]}>
              {currency} {formatAmount(displayAmount)}
            </Text>
            <Text style={styles.date}>{formatTransactionDate(item.date)}</Text>
          </View>
          
          {/* Second line: Payee */}
          <Text style={styles.payee}>{item.payee}</Text>
          
          {/* Third line: Notes (if available) */}
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          
          {/* Bottom line: Icons (left) and Account (right) */}
          <View style={styles.bottomLine}>
            <View style={styles.leftIcons}>
              {(item.has_attachment || item.attachments?.length > 0) && (
                <Text style={[styles.receiptIcon, styles.iconSpacing]}>📎</Text>
              )}
              <Text style={styles.receiptIcon}>📋</Text>
            </View>
            <Text style={styles.account}>
              {item.account_display_name || 'Unknown Account'}
            </Text>
          </View>
        </View>
        </TouchableOpacity>
      );
    }
    
    // Regular transaction rendering
    // Use API's is_income field if available, otherwise fall back to amount logic
    // The API provides is_income based on category properties
    const amount = parseFloat(item.amount || 0);
    const displayAmount = Math.abs(amount);
    
    // Determine if transaction should display as income (green/positive) or expense (red/negative)
    let isIncome;
    
    // Check if transaction is categorized (has a category_id or category_name)
    const isCategorized = item.category_id || item.category_name;
    
    if (isCategorized && item.is_income !== undefined && item.is_income !== null) {
      // Use the explicit is_income field when available (for categorized transactions)
      isIncome = item.is_income === true;
    } else {
      // For uncategorized transactions, check if we have plaid_metadata with credit/debit info
      let plaidMetadata = null;
      let hasPlaidDebitCredit = false;
      
      if (item.plaid_metadata) {
        try {
          // Parse the JSON string to get the metadata object
          plaidMetadata = JSON.parse(item.plaid_metadata);
          hasPlaidDebitCredit = plaidMetadata && plaidMetadata.category && 
            Array.isArray(plaidMetadata.category) && 
            (plaidMetadata.category.includes('Credit') || plaidMetadata.category.includes('Debit'));
        } catch (e) {
          console.warn('Failed to parse plaid_metadata:', e);
        }
      }
      
      if (hasPlaidDebitCredit) {
        // Use Plaid's credit/debit classification
        // Credit = inflow/income (should display positive/green)
        // Debit = outflow/expense (should display negative/red)
        isIncome = plaidMetadata.category.includes('Credit');
      } else {
        // Fallback: For Plaid transactions without metadata, use inverted amount logic
        // This handles the counter-intuitive Plaid amount system
        const isPlaidTransaction = item.plaid_account_id || item.plaid_account_display_name;
        if (isPlaidTransaction) {
          // For Plaid: negative amounts should display as income, positive as expense
          isIncome = amount < 0;
        } else {
          // Standard logic for non-Plaid transactions
          isIncome = amount >= 0;
        }
      }


    }
    


    // Check if this is a recurring transaction based on recurring_id field
    const isRecurring = Boolean(item.recurring_id);
    const displayPayee = item.payee || 'Unknown';
    const displayNotes = item.notes;

    return (
      <TouchableOpacity onPress={() => handleTransactionPress(item)}>
        <View style={styles.transactionCard}>
        {/* First line: Amount (left) and Date (right) */}
        <View style={styles.transactionHeader}>
          <Text style={[styles.amount, isIncome ? styles.income : styles.expense]}>
            {!isIncome ? '-' : ''}{currency} {formatAmount(displayAmount)}
          </Text>
          <Text style={styles.date}>{formatTransactionDate(item.date)}</Text>
        </View>
        
        {/* Second line: Payee */}
        <Text style={styles.payee}>{displayPayee}</Text>
        
        {/* Third line: Notes (if available) */}
        {displayNotes && <Text style={styles.notes}>{displayNotes}</Text>}
        
        {/* Bottom line: Icons (left) and Account (right) */}
        <View style={styles.bottomLine}>
          <View style={styles.leftIcons}>
            {(item.has_attachment || item.attachments?.length > 0) && (
              <Text style={[styles.receiptIcon, styles.iconSpacing]}>📎</Text>
            )}
            {isRecurring && (
              <Text style={styles.receiptIcon}>🔄</Text>
            )}
          </View>
          <Text style={styles.account}>
            {item.account_display_name || item.asset_display_name || item.plaid_account_display_name || item.account || 'Unknown Account'}
          </Text>
        </View>
      </View>
      </TouchableOpacity>
    );
  };

  // Transactions Screen
  if (currentScreen === 'transactions') {
    return (
      <View style={styles.container}>
        {/* Fixed Top Banner */}
        <View style={styles.topBanner}>
          <Text style={styles.appName}>⚡Flash Track Money</Text>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen('settings')}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {!token ? (
          // Placeholder when no token
          <View style={styles.placeholderContainer}>
            <View style={styles.placeholderContent}>
              <Text style={styles.placeholderIcon}>💳</Text>
              <Text style={styles.placeholderTitle}>Welcome to Flash Track Money!</Text>
              <Text style={styles.placeholderDescription}>
                Connect your Lunch Money account to start tracking expenses and managing your finances on the go.
              </Text>
              
              <View style={styles.placeholderButtons}>
                <TouchableOpacity 
                  style={styles.placeholderPrimaryButton}
                  onPress={() => setCurrentScreen('settings')}
                >
                  <Text style={styles.placeholderPrimaryButtonText}>Connect Lunch Money</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          // Regular transactions view when token exists
          <>
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
              <>
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Recent Transactions</Text>
                  {!token && (
                    <View style={styles.tokenWarning}>
                      <Text style={styles.tokenWarningText}>⚠️ Token missing - no sync active</Text>
                    </View>
                  )}
                </View>
                <FlatList
                  data={transactions.length > 0 ? transactions : sampleTransactions}
                  renderItem={renderTransaction}
                  keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                  style={styles.mainTransactionsList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.transactionsListContent}
                />
              </>
            )}
          </>
        )}

        {/* Floating Action Button - Only show when token exists */}
        {token && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => {
              resetTransactionForm();
              setCurrentScreen('addTransaction');
            }}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Account Selection Screen
  if (currentScreen === 'selectAccount') {
    return (
      <View style={styles.container}>
        {/* Fixed Top Banner - Same as main screen */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>👛</Text>
            <Text style={styles.appName}>Pick account</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen(isEditMode ? 'editTransaction' : 'addTransaction')}
          >
            <Text style={styles.closeIcon}>✕</Text>
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
                  {accounts.length} physical cash account{accounts.length !== 1 ? 's' : ''} available
                </Text>
              </View>
              {accounts.map((account) => {
                const accountTypeDisplay = account.type_name || 'Cash';
                const accountIcon = account.type_name?.toLowerCase().includes('cash') ? '💵' : '🏦';
                
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={styles.accountItem}
                    onPress={async () => {
                      console.log('🏦 Selected account:', account);
                      setSelectedAccount(account.id.toString());
                      setSelectedAccountData(account);
                      
                      // Update both account and currency preferences
                      try {
                        await SecureStorage.setAccountPreference(account.id.toString());
                        console.log('🎯 Updated account preference to:', account.display_name);
                        
                        if (account.currency) {
                          await SecureStorage.setCurrencyPreference(account.currency);
                          console.log('💰 Updated currency preference to:', account.currency);
                        }
                      } catch (error) {
                        console.error('Error updating preferences:', error);
                      }
                      
                      setCurrentScreen(isEditMode ? 'editTransaction' : 'addTransaction');
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

  // Category Selection Screen (Groups)
  if (currentScreen === 'selectCategory') {
    const categoryGroups = categories.filter(cat => cat.is_group === true);
    
    // Filter categories based on search query
    const filteredCategoryGroups = categorySearchQuery.trim() === '' 
      ? categoryGroups 
      : categoryGroups.filter(cat => 
          cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(categorySearchQuery.toLowerCase()))
        );

    return (
      <View style={styles.categorySelectionContainer}>
        {/* Header */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>🔀</Text>
            <Text style={styles.appName}>Pick category</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen(isEditMode ? 'editTransaction' : 'addTransaction')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search Section */}
        <View style={styles.searchBanner}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={categorySearchQuery}
            onChangeText={setCategorySearchQuery}
            placeholderTextColor="#666"
          />
        </View>

        <ScrollView style={styles.categoryContent}>
          {/* Expense Categories Section */}
          <View style={[styles.categorySection, styles.expenseCategorySection]}>
            <TouchableOpacity 
              style={styles.collapsibleHeader}
              onPress={() => setExpensesExpanded(!expensesExpanded)}
            >
              <Text style={styles.categorySectionTitle}>EXPENSES</Text>
              <Text style={styles.expandIcon}>{expensesExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {expensesExpanded && (
              <View>
                {filteredCategoryGroups
                  .filter(cat => !cat.is_income) // Expense categories
                  .map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.categoryItem}
                      onPress={() => {
                        setSelectedCategoryGroup(category);
                        setCurrentScreen('selectSubcategory');
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: category.color || '#4A90E2' }]}>
                        <Text style={styles.categoryIconText}>
                          {category.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>

          {/* Income Categories Section */}
          <View style={[styles.categorySection, styles.incomeCategorySection]}>
            <TouchableOpacity 
              style={styles.collapsibleHeader}
              onPress={() => setIncomesExpanded(!incomesExpanded)}
            >
              <Text style={styles.categorySectionTitle}>INCOMES</Text>
              <Text style={styles.expandIcon}>{incomesExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {incomesExpanded && (
              <View>
                {filteredCategoryGroups
                  .filter(cat => cat.is_income) // Income categories
                  .map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.categoryItem}
                      onPress={() => {
                        setSelectedCategoryGroup(category);
                        setCurrentScreen('selectSubcategory');
                      }}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: category.color || '#4A90E2' }]}>
                        <Text style={styles.categoryIconText}>
                          {category.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.categoryName}>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Category Subcategory Selection Screen
  if (currentScreen === 'selectSubcategory' && selectedCategoryGroup) {
    const subcategories = categories.filter(cat => 
      cat.group_id === selectedCategoryGroup.id && !cat.is_group
    );
    
    // Filter subcategories based on search query
    const filteredSubcategories = categorySearchQuery.trim() === '' 
      ? subcategories 
      : subcategories.filter(cat => 
          cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(categorySearchQuery.toLowerCase()))
        );

    return (
      <View style={styles.categorySelectionContainer}>
        {/* Header */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>📂</Text>
            <Text style={styles.appName}>{selectedCategoryGroup.name}</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen('selectCategory')}
          >
            <Text style={styles.closeIcon}>←</Text>
          </TouchableOpacity>
        </View>

        {/* Search Section */}
        <View style={styles.searchBanner}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={categorySearchQuery}
            onChangeText={setCategorySearchQuery}
            placeholderTextColor="#666"
          />
        </View>

        <ScrollView style={styles.categoryContent}>
          {/* Only show subcategories - no category group selection allowed */}
          {filteredSubcategories.length > 0 ? (
            <View style={styles.categorySection}>
              {filteredSubcategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryItem}
                  onPress={() => {
                    console.log(`📂 Selected subcategory: ${category.name}, is_income: ${category.is_income}`);
                    
                    // Check if this is a Plaid account with a type conflict
                    if (selectedAccountData?.isPlaidAccount && isEditMode && editingTransaction) {
                      const newTransactionType = category.is_income ? 'income' : 'expense';
                      
                      // Determine original transaction type from Plaid metadata if available
                      let originalPlaidType = null;
                      if (editingTransaction.plaid_metadata) {
                        try {
                          const plaidMetadata = JSON.parse(editingTransaction.plaid_metadata);
                          let hasPlaidDebitCredit = false;
                          
                          if (plaidMetadata.category && Array.isArray(plaidMetadata.category)) {
                            hasPlaidDebitCredit = plaidMetadata.category.includes('Credit') || plaidMetadata.category.includes('Debit');
                            
                            if (hasPlaidDebitCredit) {
                              originalPlaidType = plaidMetadata.category.includes('Credit') ? 'income' : 'expense';
                            }
                          }
                          
                          // Fallback: If no Credit/Debit classification, use amount-based logic
                          if (!hasPlaidDebitCredit) {
                            const amount = parseFloat(editingTransaction.amount) || 0;
                            // For Plaid: negative amounts = income, positive = expense
                            originalPlaidType = amount < 0 ? 'income' : 'expense';

                          }
                        } catch (e) {
                          console.warn('Failed to parse plaid_metadata for conflict check:', e);
                        }
                      }
                      
                      // For Plaid transactions, ALWAYS use the immutable Plaid metadata type
                      // Don't use originalTransactionType as it can change when user modifies categories
                      const originalType = originalPlaidType;
                      
                      if (originalType && newTransactionType !== originalType) {
                        Alert.alert(
                          'Category Type Conflict',
                          `This is a bank account transaction synced from your bank as ${originalType === 'income' ? 'an income' : 'an expense'}. You cannot assign ${newTransactionType === 'income' ? 'an income' : 'an expense'} category to it.`,
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                    }
                    
                    setSelectedCategory(category.id.toString());
                    setSelectedCategoryData(category);
                    // Switch transaction type based on category's is_income property
                    const newTransactionType = category.is_income ? 'income' : 'expense';
                    setTransactionType(newTransactionType);
                    console.log(`💰 Transaction type switched to: ${newTransactionType}`);
                    setCurrentScreen(isEditMode ? 'editTransaction' : 'addTransaction');
                  }}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: category.color || selectedCategoryGroup.color || '#4A90E2' }]}>
                    <Text style={styles.categoryIconText}>
                      {category.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    {category.description && (
                      <Text style={styles.categoryDescription}>{category.description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.categorySection}>
              <Text style={styles.categorySectionTitle}>No subcategories available</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Category Search Screen
  if (currentScreen === 'searchCategory') {
    const allSearchableCategories = categories.filter(cat => !cat.is_group);
    const filteredCategories = categorySearchQuery.trim() === '' 
      ? allSearchableCategories
      : allSearchableCategories.filter(cat =>
          cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(categorySearchQuery.toLowerCase()))
        );

    return (
      <View style={styles.categorySelectionContainer}>
        {/* Header with Search */}
        <View style={styles.categorySearchHeader}>
          <TouchableOpacity 
            style={styles.categoryBackButton}
            onPress={() => {
              setCurrentScreen('selectCategory');
              setCategorySearchQuery('');
              setIsSearching(false);
            }}
          >
            <Text style={styles.categoryBackText}>←</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.categorySearchInput}
            placeholder="Search for category..."
            placeholderTextColor="#A0A0A0"
            value={categorySearchQuery}
            onChangeText={setCategorySearchQuery}
            autoFocus={true}
          />
          <TouchableOpacity 
            style={styles.categoryCloseButton}
            onPress={() => {
              setCurrentScreen('selectCategory');
              setCategorySearchQuery('');
              setIsSearching(false);
            }}
          >
            <Text style={styles.categoryCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.categoryContent}>
          {filteredCategories.map((category) => {
            const parentGroup = categories.find(cat => cat.id === category.group_id);
            return (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryItem}
                onPress={() => {
                  console.log(`📂 Selected category: ${category.name}, is_income: ${category.is_income}`);
                  
                  // Check if this is a Plaid account with a type conflict
                  if (selectedAccountData?.isPlaidAccount && isEditMode && editingTransaction) {
                    const newTransactionType = category.is_income ? 'income' : 'expense';
                    
                    // Determine original transaction type from Plaid metadata if available
                    let originalPlaidType = null;
                    if (editingTransaction.plaid_metadata) {
                      try {
                        const plaidMetadata = JSON.parse(editingTransaction.plaid_metadata);
                        let hasPlaidDebitCredit = false;
                        
                        if (plaidMetadata.category && Array.isArray(plaidMetadata.category)) {
                          hasPlaidDebitCredit = plaidMetadata.category.includes('Credit') || plaidMetadata.category.includes('Debit');
                          
                          if (hasPlaidDebitCredit) {
                            originalPlaidType = plaidMetadata.category.includes('Credit') ? 'income' : 'expense';
                          }
                        }
                        
                        // Fallback: If no Credit/Debit classification, use amount-based logic
                        if (!hasPlaidDebitCredit) {
                          const amount = parseFloat(editingTransaction.amount) || 0;
                          // For Plaid: negative amounts = income, positive = expense
                          originalPlaidType = amount < 0 ? 'income' : 'expense';

                        }
                      } catch (e) {
                        console.warn('Failed to parse plaid_metadata for conflict check:', e);
                      }
                    }
                    
                    // For Plaid transactions, ALWAYS use the immutable Plaid metadata type
                    // Don't use originalTransactionType as it can change when user modifies categories
                    const originalType = originalPlaidType;
                    

                    
                    if (originalType && newTransactionType !== originalType) {
                      Alert.alert(
                        'Category Type Conflict',
                        `This is a bank account transaction synced from your bank as ${originalType === 'income' ? 'an income' : 'an expense'}. You cannot assign ${newTransactionType === 'income' ? 'an income' : 'an expense'} category to it.`,
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                  }
                  
                  setSelectedCategory(category.id.toString());
                  setSelectedCategoryData(category);
                  // Switch transaction type based on category's is_income property
                  const newTransactionType = category.is_income ? 'income' : 'expense';
                  setTransactionType(newTransactionType);
                  console.log(`💰 Transaction type switched to: ${newTransactionType}`);
                  setCurrentScreen(isEditMode ? 'editTransaction' : 'addTransaction');
                  setCategorySearchQuery('');
                  setIsSearching(false);
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color || parentGroup?.color || '#4A90E2' }]}>
                  <Text style={styles.categoryIconText}>
                    {category.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  {parentGroup && (
                    <Text style={styles.categoryDescription}>{parentGroup.name}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Tags Selection Screen
  if (currentScreen === 'selectTags') {
    const filteredTags = tagSearchQuery
      ? availableTags.filter(tag => 
          tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
        )
      : availableTags;

    return (
      <View style={styles.categorySelectionContainer}>
        <View style={styles.categorySelectionHeader}>
          <TouchableOpacity 
            style={styles.categoryBackButton}
            onPress={() => setCurrentScreen(isEditMode ? 'editTransaction' : 'transactionDetails')}
          >
            <Text style={styles.categoryBackText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.categorySelectionTitle}>Select Tags</Text>
          <View style={styles.categoryBackButton}></View>
        </View>

        {/* Search */}
        <View style={styles.categorySearchHeader}>
          <View style={styles.categoryBackButton}></View>
          <TextInput
            style={styles.categorySearchInput}
            placeholder="Search tags..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={tagSearchQuery}
            onChangeText={setTagSearchQuery}
            autoFocus={false}
          />
          <View style={styles.categoryBackButton}></View>
        </View>

        {/* Selected Tags Display */}
        {transactionTags.length > 0 && (
          <View style={styles.selectedTagsContainer}>
            <Text style={styles.selectedTagsLabel}>Selected Tags:</Text>
            <View style={styles.selectedTagsList}>
              {transactionTags.map((tag, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.selectedTag}
                  onPress={() => {
                    const newTags = transactionTags.filter(t => t !== tag);
                    setTransactionTags(newTags);
                  }}
                >
                  <Text style={styles.selectedTagText}>{tag}</Text>
                  <Text style={styles.selectedTagRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Available Tags List */}
        <ScrollView style={styles.categoryContent}>
          {filteredTags.map((tag, index) => {
            const isSelected = transactionTags.includes(tag);
            
            return (
              <TouchableOpacity
                key={index}
                style={[styles.categoryItem, isSelected && styles.selectedCategoryItem]}
                onPress={() => {
                  if (isSelected) {
                    // Remove tag
                    const newTags = transactionTags.filter(t => t !== tag);
                    setTransactionTags(newTags);
                  } else {
                    // Add tag
                    setTransactionTags([...transactionTags, tag]);
                  }
                }}
              >
                <View style={[styles.categoryIcon, { backgroundColor: '#4A90E2' }]}>
                  <Text style={styles.categoryIconText}>#</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={[styles.categoryName, isSelected && styles.selectedCategoryName]}>
                    {tag}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.categoryCheckmark}>
                    <Text style={styles.categoryCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          
          {/* Add New Tag Option */}
          {tagSearchQuery && !availableTags.some(tag => tag.toLowerCase() === tagSearchQuery.toLowerCase()) && (
            <TouchableOpacity
              style={styles.categoryItem}
              onPress={() => {
                const newTag = tagSearchQuery.trim();
                if (newTag && !transactionTags.includes(newTag)) {
                  setTransactionTags([...transactionTags, newTag]);
                  setAvailableTags([...availableTags, newTag]);
                  setTagSearchQuery('');
                }
              }}
            >
              <View style={[styles.categoryIcon, { backgroundColor: '#4CAF50' }]}>
                <Text style={styles.categoryIconText}>+</Text>
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>
                  Create "{tagSearchQuery}"
                </Text>
                <Text style={styles.categoryDescription}>Add new tag</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {filteredTags.length === 0 && !tagSearchQuery && (
            <View style={styles.categoryEmptyState}>
              <Text style={styles.categoryEmptyText}>No tags available</Text>
              <Text style={styles.categoryEmptySubtext}>Start typing to create a new tag</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Transaction Details Screen
  if (currentScreen === 'transactionDetails') {
    return (
      <View style={[
        styles.transactionDetailsContainer,
        selectedCategoryData?.is_income ? styles.incomeBackground : styles.expenseBackground
      ]}>
        {/* Header */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>ℹ️</Text>
            <Text style={styles.appName}>Transaction details</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen('addTransaction')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.transactionDetailsContent}>
            {/* Note Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>NOTES</Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Description"
                placeholderTextColor="#A0A0A0"
                value={transactionNote}
                onChangeText={setTransactionNote}
                multiline={true}
                numberOfLines={3}
              />
            </View>

            {/* Payee Section */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>PAYEE</Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Enter payee name"
                placeholderTextColor="#A0A0A0"
                value={transactionPayee}
                onChangeText={setTransactionPayee}
              />
            </View>

            {/* Date and Time Section */}
            <View style={styles.detailsRow}>
              <View style={styles.detailsHalfSection}>
                <Text style={styles.detailsLabel}>DATE</Text>
                <TouchableOpacity 
                  style={styles.detailsDateButton}
                  onPress={() => {
                    if (selectedAccountData?.isPlaidAccount) {
                      Alert.alert(
                        'Date Not Editable',
                        'This is a bank account transaction synced from your bank. Account, date and time cannot be changed.',
                        [{ text: 'OK' }]
                      );
                    } else {
                      setShowDatePicker(true);
                    }
                  }}
                >
                  <Text style={[styles.detailsDateText, selectedAccountData?.isPlaidAccount && styles.inputDisabled]}>
                    {formatDateForDisplay(transactionDate)}
                  </Text>
                  <Text style={styles.detailsDropdownIcon}>▼</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.detailsHalfSection}>
                <Text style={styles.detailsLabel}>TIME</Text>
                <TouchableOpacity 
                  style={styles.detailsDateButton}
                  onPress={() => {
                    if (selectedAccountData?.isPlaidAccount) {
                      Alert.alert(
                        'Time Not Editable',
                        'This is a bank account transaction synced from your bank. Account, date and time cannot be changed.',
                        [{ text: 'OK' }]
                      );
                    } else {
                      setShowTimePicker(true);
                    }
                  }}
                >
                  <Text style={[styles.detailsDateText, selectedAccountData?.isPlaidAccount && styles.inputDisabled]}>
                    {formatTimeForDisplay(transactionDate)}
                  </Text>
                  <Text style={styles.detailsDropdownIcon}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Tags Section - Moved here */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>TAGS</Text>
            {transactionTags.length > 0 ? (
              <View>
                <View style={styles.selectedTagsList}>
                  {transactionTags.map((tag, index) => (
                    <View key={index} style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={styles.addTagButton}
                  onPress={() => setCurrentScreen('selectTags')}
                >
                  <Text style={styles.addTagText}>ADD TAG</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addTagButton}
                onPress={() => setCurrentScreen('selectTags')}
              >
                <Text style={styles.addTagText}>ADD TAG</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Receipt Section */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>ATTACHMENTS</Text>
            
            {/* Display existing attachments */}
            {transactionAttachments.length > 0 && (
              <View style={styles.attachmentsList}>
                {transactionAttachments.map((attachment, index) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    <TouchableOpacity 
                      onPress={() => openReceiptGallery(index)}
                      style={styles.thumbnailContainer}
                    >
                      <Image source={{ uri: attachment.uri }} style={styles.attachmentThumbnail} />
                      <View style={styles.thumbnailOverlay}>
                        <Text style={styles.thumbnailIcon}>👁️</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        Receipt {index + 1}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {attachment.size ? `${Math.round(attachment.size / 1024)}KB` : 'Image file'}
                      </Text>
                      <Text style={styles.attachmentHint}>Tap to view</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeAttachmentButton}
                      onPress={() => removeAttachment(attachment.id)}
                    >
                      <Text style={styles.removeAttachmentText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.addReceiptButton}
              onPress={() => setShowAttachmentModal(true)}
            >
              <Text style={styles.addReceiptText}>ADD RECEIPT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        {Platform.OS === 'ios' ? (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={transactionDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTransactionDate(selectedDate);
                    }
                  }}
                  style={styles.dateTimePicker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          showDatePicker && (
            <DateTimePicker
              value={transactionDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setTransactionDate(selectedDate);
                }
              }}
            />
          )
        )}

        {/* Time Picker Modal */}
        {Platform.OS === 'ios' ? (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showTimePicker}
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.modalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={transactionDate}
                  mode="time"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTransactionDate(selectedDate);
                    }
                  }}
                  style={styles.dateTimePicker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          showTimePicker && (
            <DateTimePicker
              value={transactionDate}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) {
                  setTransactionDate(selectedDate);
                }
              }}
            />
          )
        )}

        {/* Attachment Modal */}
        <AttachmentModal
          visible={showAttachmentModal}
          onClose={() => setShowAttachmentModal(false)}
          onAttachmentAdded={handleAttachmentAdded}
          transactionId={currentTransactionId || undefined}
        />

        {/* Receipt Gallery */}
        <ReceiptGallery
          visible={showReceiptGallery}
          attachments={transactionAttachments}
          initialIndex={galleryInitialIndex}
          onClose={() => setShowReceiptGallery(false)}
          onDeleteAttachment={handleDeleteFromGallery}
        />
      </View>
    );
  }

  // Edit Transaction Screen
  if (currentScreen === 'editTransaction') {
    return (
      <View style={[
        styles.transactionDetailsContainer,
        selectedCategoryData?.is_income ? styles.incomeBackground : styles.expenseBackground
      ]}>
        {/* Header */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>✏️</Text>
            <Text style={styles.appName}>Edit Transaction</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              resetTransactionForm();
              setIsEditMode(false);
              setEditingTransaction(null);
              setCurrentScreen('transactions');
            }}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.transactionDetailsContent}>
          {/* Date and Time Section - Field 1 */}
          <View style={styles.detailsRow}>
            <View style={styles.detailsHalfSection}>
              <Text style={styles.detailsLabel}>DATE</Text>
              <TouchableOpacity 
                style={styles.detailsDateButton}
                onPress={() => {
                  if (selectedAccountData?.isPlaidAccount) {
                    Alert.alert(
                      'Date Not Editable',
                      'This is a bank account transaction synced from your bank. Account, date and time cannot be changed.',
                      [{ text: 'OK' }]
                    );
                  } else {
                    setShowDatePicker(true);
                  }
                }}
              >
                <Text style={[styles.detailsDateText, selectedAccountData?.isPlaidAccount && styles.inputDisabled]}>
                  {formatDateForDisplay(transactionDate)}
                </Text>
                <Text style={styles.detailsDropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailsHalfSection}>
              <Text style={styles.detailsLabel}>TIME</Text>
              <TouchableOpacity 
                style={styles.detailsDateButton}
                onPress={() => {
                  if (selectedAccountData?.isPlaidAccount) {
                    Alert.alert(
                      'Time Not Editable',
                      'This is a bank account transaction synced from your bank. Account, date and time cannot be changed.',
                      [{ text: 'OK' }]
                    );
                  } else {
                    setShowTimePicker(true);
                  }
                }}
              >
                <Text style={[styles.detailsDateText, selectedAccountData?.isPlaidAccount && styles.inputDisabled]}>
                  {formatTimeForDisplay(transactionDate)}
                </Text>
                <Text style={styles.detailsDropdownIcon}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount Section - Field 2 (only in edit mode) */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>AMOUNT</Text>
            <View style={styles.amountInputContainer}>
              <Text style={[styles.amountSign, transactionType === 'income' ? styles.positiveSign : styles.negativeSign]}>
                {transactionType === 'income' ? '+' : '-'}
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  selectedAccountData?.isPlaidAccount && styles.inputDisabled
                ]}
                placeholder="0.00"
                placeholderTextColor="#A0A0A0"
                value={amount}
                onChangeText={selectedAccountData?.isPlaidAccount ? undefined : setAmount}
                keyboardType="numeric"
                editable={!selectedAccountData?.isPlaidAccount}
                onFocus={() => {
                  if (selectedAccountData?.isPlaidAccount) {
                    Alert.alert(
                      'Field Not Editable',
                      'Amount cannot be edited for bank transactions synced from your bank.',
                      [{ text: 'OK' }]
                    );
                  }
                }}
              />
              <Text style={styles.currencyDisplay}>
                {selectedAccountData?.currency?.toUpperCase() || 'USD'}
              </Text>
            </View>
          </View>

          {/* Account Section - Field 3 (only in edit mode) */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>ACCOUNT</Text>
            <TouchableOpacity 
              style={[
                styles.detailsInput,
                selectedAccountData?.isEditable === false && styles.detailsInputDisabled
              ]}
              onPress={() => {
                if (selectedAccountData?.isEditable === false) {
                  // Determine the type of restriction
                  const isPhysicalCash = selectedAccountData.subtype_name === 'physical cash';
                  const isPlaidAccount = selectedAccountData.isPlaidAccount;
                  
                  let message = '';
                  if (isPlaidAccount) {
                    message = 'This is a bank account transaction synced from your bank. Account, date and time cannot be changed.';
                  } else if (isPhysicalCash) {
                    message = 'This physical cash account is not available in the current account list. Please check your account settings.';
                  } else {
                    message = 'This transaction is from a non-physical cash account and cannot be moved to a different account.';
                  }
                  
                  Alert.alert('Account Not Editable', message, [{ text: 'OK' }]);
                  return;
                }
                setCurrentScreen('selectAccount');
              }}
            >
              <Text style={selectedAccount ? styles.detailsInputText : styles.detailsPlaceholder}>
                {selectedAccountData ? selectedAccountData.display_name : 'Select Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payee Section - Field 4 */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>PAYEE</Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Enter payee name"
              placeholderTextColor="#A0A0A0"
              value={transactionPayee}
              onChangeText={setTransactionPayee}
            />
          </View>

          {/* Notes Section - Field 5 */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>NOTES</Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Description"
              placeholderTextColor="#A0A0A0"
              value={transactionNote}
              onChangeText={setTransactionNote}
              multiline={true}
              numberOfLines={3}
            />
          </View>

          {/* Category Section - Field 6 (only in edit mode) */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>CATEGORY</Text>
            <TouchableOpacity 
              style={styles.detailsInput}
              onPress={() => setCurrentScreen('selectCategory')}
            >
              <Text style={selectedCategory ? styles.detailsInputText : styles.detailsPlaceholder}>
                {selectedCategoryData ? selectedCategoryData.name : 'Select Category'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tags Section - Field 7 */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>TAGS</Text>
            {transactionTags.length > 0 ? (
              <View>
                <View style={styles.selectedTagsList}>
                  {transactionTags.map((tag, index) => (
                    <View key={index} style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity 
                  style={styles.addTagButton}
                  onPress={() => setCurrentScreen('selectTags')}
                >
                  <Text style={styles.addTagText}>ADD TAG</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addTagButton}
                onPress={() => setCurrentScreen('selectTags')}
              >
                <Text style={styles.addTagText}>ADD TAG</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Attachments Section - Field 8 */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>ATTACHMENTS</Text>
            
            {/* Display existing attachments */}
            {transactionAttachments.length > 0 && (
              <View style={styles.attachmentsList}>
                {transactionAttachments.map((attachment, index) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    <TouchableOpacity 
                      onPress={() => openReceiptGallery(index)}
                      style={styles.thumbnailContainer}
                    >
                      <Image source={{ uri: attachment.uri }} style={styles.attachmentThumbnail} />
                      <View style={styles.thumbnailOverlay}>
                        <Text style={styles.thumbnailIcon}>👁️</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        Receipt {index + 1}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {attachment.size ? `${Math.round(attachment.size / 1024)}KB` : 'Image file'}
                      </Text>
                      <Text style={styles.attachmentHint}>Tap to view</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => removeAttachment(attachment.id)}
                      style={styles.removeAttachmentButton}
                    >
                      <Text style={styles.removeAttachmentText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            
            {/* Add attachment button */}
            <TouchableOpacity 
              style={styles.addReceiptButton}
              onPress={() => setShowAttachmentModal(true)}
            >
              <Text style={styles.receiptIcon}>📎</Text>
              <Text style={styles.addReceiptText}>ADD ATTACHMENT</Text>
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <View style={styles.detailsSection}>
            <TouchableOpacity 
              style={[
                styles.editSaveButton,
                (!amount || amount === '0' || !selectedAccount || !selectedCategory) && styles.editSaveButtonDisabled
              ]}
              onPress={saveTransactionChanges}
              disabled={!amount || amount === '0' || !selectedAccount || !selectedCategory}
            >
              <Text style={[
                styles.editSaveButtonText,
                (!amount || amount === '0' || !selectedAccount || !selectedCategory) && styles.editSaveButtonTextDisabled
              ]}>
                SAVE CHANGES
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Date and Time Pickers */}
        {Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker || showTimePicker}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}>
                    <Text style={styles.modalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={transactionDate}
                  mode={showDatePicker ? "date" : "time"}
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTransactionDate(selectedDate);
                    }
                  }}
                  style={styles.dateTimePicker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          showDatePicker && (
            <DateTimePicker
              value={transactionDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setTransactionDate(selectedDate);
                }
              }}
            />
          )
        )}

        {Platform.OS === 'ios' ? null : (
          showTimePicker && (
            <DateTimePicker
              value={transactionDate}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) {
                  setTransactionDate(selectedDate);
                }
              }}
            />
          )
        )}

        {/* Attachment Modal */}
        <AttachmentModal
          visible={showAttachmentModal}
          onClose={() => setShowAttachmentModal(false)}
          onAttachmentAdded={handleAttachmentAdded}
          transactionId={currentTransactionId || undefined}
        />

        {/* Receipt Gallery */}
        <ReceiptGallery
          visible={showReceiptGallery}
          attachments={transactionAttachments}
          initialIndex={galleryInitialIndex}
          onClose={() => setShowReceiptGallery(false)}
          onDeleteAttachment={handleDeleteFromGallery}
        />
      </View>
    );
  }

  // Add Transaction Screen
  if (currentScreen === 'addTransaction') {
    return (
      <View style={styles.container}>
        {/* Fixed Top Banner - Same as main screen */}
        <View style={styles.topBanner}>
          <View style={styles.addTransactionHeaderLeft}>
            <Text style={styles.addTransactionIcon}>➕</Text>
            <Text style={styles.appName}>Add Transaction</Text>
            <TouchableOpacity 
              style={[
                styles.addTransactionSaveButton,
                (!amount || amount === '0' || !selectedAccount || !selectedCategory) && styles.addTransactionSaveButtonDisabled
              ]}
              onPress={saveTransaction}
              disabled={isLoading || !amount || amount === '0' || !selectedAccount || !selectedCategory}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={[
                  styles.addTransactionSaveText,
                  (!amount || amount === '0' || !selectedAccount || !selectedCategory) && styles.addTransactionSaveTextDisabled
                ]}>✓</Text>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen('transactions')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content Area with Dynamic Background */}
        <View style={[
          styles.addTransactionContent,
          selectedCategoryData?.is_income ? styles.incomeBackground : styles.expenseBackground
        ]}>
          {/* Transaction Type Banner */}
          <View style={[
            styles.transactionTypeBanner,
            selectedCategoryData?.is_income ? styles.incomeBanner : styles.expenseBanner
          ]}>
            <Text style={styles.transactionTypeBannerText}>
              {selectedCategoryData?.is_income ? 'INCOME' : 'EXPENSE'}
            </Text>
          </View>

          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={[styles.signSymbol, selectedCategoryData?.is_income ? styles.positiveSign : styles.negativeSign]}>
              {selectedCategoryData?.is_income ? '+' : '-'}
            </Text>
            <Text style={styles.currencySymbol}>
              {selectedAccountData?.currency === 'eur' ? '€' : 
               selectedAccountData?.currency === 'mad' ? 'MAD' : 
               selectedAccountData?.currency === 'usd' ? '$' : '$'}
            </Text>
            <Text style={styles.amountText}>{amount}</Text>
            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={() => setCurrentScreen('transactionDetails')}
            >
              <Text style={styles.detailsButtonText}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Account and Category Cards */}
          <View style={styles.cardSection}>
            <TouchableOpacity 
              style={[
                styles.card,
                !selectedAccount && styles.cardRequired
              ]}
              onPress={() => setCurrentScreen('selectAccount')}
            >
              <Text style={[
                styles.cardValue,
                !selectedAccount && styles.cardValueRequired,
                { textAlign: 'center' }
              ]}>
                {selectedAccountData ? 
                  `${selectedAccountData.display_name || selectedAccountData.name}` : 
                  '👛 Pick account'
                }
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.card,
                !selectedCategory && styles.cardRequired
              ]}
              onPress={() => setCurrentScreen('selectCategory')}
            >
              <Text style={[
                styles.cardValue,
                !selectedCategory && styles.cardValueRequired,
                { textAlign: 'center' }
              ]}>
                {selectedCategoryData ? selectedCategoryData.name : '🔀 Pick category'}
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
      </View>
    );
  }

  // Settings Screen
  if (currentScreen === 'settings') {
    return (
      <View style={styles.container}>
        {/* Fixed Top Banner - Same as main screen */}
        <View style={styles.topBanner}>
          <View style={styles.settingsHeaderLeft}>
            <Text style={styles.settingsIcon}>⚙️</Text>
            <Text style={styles.appName}>Settings</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setCurrentScreen('transactions')}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <SettingsScreen
          onTokenSaved={() => {
            // Refresh token and accounts when a new token is saved
            loadSavedToken();
            fetchAccounts();
            fetchCategories();
            // Redirect to transactions screen
            setCurrentScreen('transactions');
          }}
          accounts={accounts}
        />
      </View>
    );
  }

  // Home Screen
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.text}>Flash Track Money</Text>
        <Text style={styles.subtitle}>Ready to track expenses!</Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => {
            resetTransactionForm();
            setCurrentScreen('addTransaction');
          }}
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // Top Banner Styles
  topBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1000,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  
  // Placeholder Styles
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  placeholderDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  placeholderButtons: {
    width: '100%',
    gap: 12,
  },
  placeholderPrimaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeholderPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSecondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  placeholderSecondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Section Title
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenWarning: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  tokenWarningText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '500',
  },
  
  // Transactions List Styles
  mainTransactionsList: {
    flex: 1,
  },
  transactionsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for FAB
  },
  
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 80, // Moved higher to avoid OS navigation
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
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
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
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
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  account: {
    fontSize: 14,
    color: '#333',
  },
  notes: {
    fontSize: 15,
    color: '#777',
    fontStyle: 'italic',
    marginBottom: 4,
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
  walletSaveButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2D7D7A',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletSaveButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  walletSaveText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  walletSaveTextDisabled: {
    color: '#E0E0E0',
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
  transactionTypeBanner: {
    marginHorizontal: 20,
    marginTop: 5,
    marginBottom: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  expenseBanner: {
    backgroundColor: '#FFF5F5', // Light red background
  },
  incomeBanner: {
    backgroundColor: '#F0FFF4', // Light green background
  },
  transactionTypeBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textTransform: 'uppercase',
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
    fontSize: 18,
    fontWeight: '500',
  },
  keypad: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40, // Add space above OS navigation
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  keypadButton: {
    flex: 1,
    height: 60, // Fixed height instead of aspect ratio
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
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
  accountItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  accountNameDisabled: {
    color: '#999',
  },
  accountTypeDisabled: {
    color: '#999',
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
  
  // Category Selection Styles
  categorySelectionContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  categorySelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#2D7D7A',
  },
  categoryBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBackText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  categorySelectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  searchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#666',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  categoryContent: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 20,
  },
  categorySectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F0F0F0',
    textTransform: 'uppercase',
  },
  expenseCategorySection: {
    backgroundColor: '#FFF5F5', // Light red background
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  incomeCategorySection: {
    backgroundColor: '#F0FFF4', // Light green background
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  expandIcon: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: 'bold',
  },
  mostFrequentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  mostFrequentItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 15,
  },
  mostFrequentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mostFrequentIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  mostFrequentName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  categoryIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  categorySearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#2D7D7A',
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 18,
    color: 'white',
    marginHorizontal: 15,
    paddingVertical: 5,
  },
  categoryCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCloseText: {
    fontSize: 20,
    color: 'white',
  },
  
  // Transaction Details Button
  detailsButton: {
    width: 40,
    height: 40,
    backgroundColor: 'white',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsButtonText: {
    fontSize: 18,
    color: '#2D7D7A',
    fontWeight: 'bold',
  },
  
  // Transaction Details Screen Styles
  transactionDetailsContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  transactionDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#2D7D7A',
  },
  detailsBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsBackText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  transactionDetailsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  detailsSaveButton: {
    width: 40,
    height: 40,
    backgroundColor: '#2D7D7A',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsSaveButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  detailsSaveText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  detailsHeaderSpacer: {
    width: 40,
  },
  transactionDetailsContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  detailsSection: {
    backgroundColor: 'white',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  detailsLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailsInput: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
    minHeight: 40,
  },
  detailsInputDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.7,
  },
  addTagButton: {
    alignSelf: 'flex-start',
  },
  addTagText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginBottom: 20,
  },
  detailsHalfSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  detailsDateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailsDateText: {
    fontSize: 16,
    color: '#333',
  },
  detailsDropdownIcon: {
    fontSize: 12,
    color: '#8E8E93',
  },
  addReceiptButton: {
    alignSelf: 'flex-start',
  },
  addReceiptText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  
  // Date and Time Picker Styles
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  datePickerContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 20,
    maxWidth: 320,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  datePickerHeader: {
    backgroundColor: '#2D7D7A',
    padding: 20,
    alignItems: 'center',
  },
  datePickerDayName: {
    fontSize: 14,
    color: 'white',
    opacity: 0.8,
  },
  datePickerMonth: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginTop: 8,
  },
  datePickerDay: {
    fontSize: 60,
    color: 'white',
    fontWeight: '300',
    marginTop: 8,
  },
  datePickerYear: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginTop: 8,
  },
  calendarContainer: {
    padding: 20,
  },
  calendarMonthYear: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  calendarDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%', // 7 days per week
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  calendarSelectedDay: {
    backgroundColor: '#2D7D7A',
    borderRadius: 20,
  },
  calendarDayText: {
    fontSize: 14,
    color: '#333',
  },
  calendarSelectedDayText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timePickerContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    margin: 20,
    width: 300,
    height: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  timePickerHeader: {
    backgroundColor: '#2D7D7A',
    padding: 20,
    alignItems: 'center',
  },
  timePickerDisplay: {
    fontSize: 48,
    color: 'white',
    fontWeight: '300',
  },
  timeCircleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  timeMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  selectedTimeMarker: {
    backgroundColor: '#2D7D7A',
  },
  timeMarkerText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  selectedTimeMarkerText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeIndicatorLine: {
    position: 'absolute',
    width: 80,
    height: 2,
    backgroundColor: '#2D7D7A',
    transformOrigin: '0 50%',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  pickerCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 16,
  },
  pickerCancelText: {
    fontSize: 14,
    color: '#2D7D7A',
    fontWeight: '500',
  },
  pickerOkButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerOkText: {
    fontSize: 14,
    color: '#2D7D7A',
    fontWeight: '500',
  },
  
  // Modal Styles for Date/Time Pickers
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalDoneText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  dateTimePicker: {
    height: 200,
    backgroundColor: 'white',
  },
  
  // Tag-specific styles
  selectedTagsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedTagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  selectedTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTagText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  selectedTagRemove: {
    fontSize: 16,
    color: 'white',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  selectedCategoryItem: {
    backgroundColor: '#E3F2FD',
  },
  selectedCategoryName: {
    color: '#1976D2',
    fontWeight: '600',
  },
  categoryCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCheckmarkText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  categoryEmptyState: {
    padding: 40,
    alignItems: 'center',
  },
  categoryEmptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryEmptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Validation Styles
  cardRequired: {
    borderColor: '#FF3B30',
    borderWidth: 2,
  },
  cardValueRequired: {
    color: '#FF3B30',
  },

  // Attachment Styles
  attachmentsList: {
    marginBottom: 12,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  thumbnailContainer: {
    position: 'relative',
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 2,
    right: 12,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailIcon: {
    fontSize: 10,
    color: '#fff',
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#666',
  },
  attachmentHint: {
    fontSize: 11,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  removeAttachmentButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Settings Screen Header Styles
  settingsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  closeIcon: {
    fontSize: 20,
    color: '#333',
  },
  
  // Add Transaction Header Styles
  addTransactionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTransactionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  addTransactionSaveButton: {
    width: 32,
    height: 32,
    backgroundColor: '#2D7D7A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addTransactionSaveButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  addTransactionSaveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addTransactionSaveTextDisabled: {
    color: '#E0E0E0',
  },
  
  // Add Transaction Content Area
  addTransactionContent: {
    flex: 1,
  },

  // Currency Picker Styles
  currencyPickerContent: {
    maxHeight: 300,
  },
  currencyPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  currencyPickerItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  currencyPickerText: {
    fontSize: 16,
    color: '#333',
  },
  currencyPickerCheck: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  
  // Attachment icon styles
  attachmentContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  receiptIcon: {
    fontSize: 16,
    color: '#666',
  },
  
  // Bottom line layout
  bottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  leftIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSpacing: {
    marginRight: 8,
  },

  // Edit Transaction Styles
  editSaveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  editSaveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  editSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  editSaveButtonTextDisabled: {
    color: '#666666',
  },
  detailsInputText: {
    color: '#000000',
    fontSize: 16,
  },
  detailsPlaceholder: {
    color: '#A0A0A0',
    fontSize: 16,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  amountSign: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    padding: 0,
  },
  currencyDisplay: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  inputDisabled: {
    color: '#9e9e9e',
    opacity: 0.6,
  },
});
