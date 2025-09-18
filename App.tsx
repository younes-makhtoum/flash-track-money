import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, FlatList } from 'react-native';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [token, setToken] = useState('');

  // Sample transaction data (will be replaced with API data)
  const sampleTransactions = [
    {
      id: 1,
      date: '2025-09-18',
      payee: 'Starbucks Coffee',
      amount: -4.95,
      category: 'Food & Dining',
      account: 'Chase Credit Card',
      notes: 'Morning coffee'
    },
    {
      id: 2,
      date: '2025-09-17',
      payee: 'Shell Gas Station',
      amount: -45.20,
      category: 'Gas & Fuel',
      account: 'Chase Credit Card',
      notes: 'Weekly fill-up'
    },
    {
      id: 3,
      date: '2025-09-16',
      payee: 'Salary Deposit',
      amount: 2500.00,
      category: 'Salary',
      account: 'Bank Account',
      notes: 'Bi-weekly paycheck'
    }
  ];

  const handleSaveToken = () => {
    if (token.trim()) {
      Alert.alert('Success!', 'Token saved successfully');
      setCurrentScreen('home');
    } else {
      Alert.alert('Error', 'Please enter a token');
    }
  };

  const renderTransaction = ({ item }: { item: any }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <Text style={styles.payee}>{item.payee}</Text>
        <Text style={[styles.amount, item.amount < 0 ? styles.expense : styles.income]}>
          ${Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      <Text style={styles.account}>{item.account}</Text>
      {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
    </View>
  );

  // Transactions Screen
  if (currentScreen === 'transactions') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recent Transactions</Text>
          <View style={styles.placeholder} />
        </View>
        
        <FlatList
          data={sampleTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id.toString()}
          style={styles.transactionsList}
          showsVerticalScrollIndicator={false}
        />
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
        />
        
        <TouchableOpacity style={styles.button} onPress={handleSaveToken}>
          <Text style={styles.buttonText}>Save Token</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back</Text>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
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
});
