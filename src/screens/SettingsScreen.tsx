import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SecureStorage } from '../utils/storage';

interface Account {
  id: number;
  name: string;
  currency: string;
}

interface SettingsScreenProps {
  onTokenSaved?: () => void;
  accounts?: Account[];
}

export default function SettingsScreen({ onTokenSaved, accounts = [] }: SettingsScreenProps) {
  const [apiToken, setApiToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  useEffect(() => {
    checkExistingToken();
  }, []);

  const checkExistingToken = async () => {
    try {
      const hasToken = await SecureStorage.hasLunchMoneyToken();
      setHasExistingToken(hasToken);
      
      if (hasToken) {
        // Show masked token for security
        setApiToken('••••••••••••••••••••••••••••••••');
      }
    } catch (error) {
      console.error('Error checking existing token:', error);
    }
  };

  const handleSaveToken = async () => {
    if (!apiToken.trim()) {
      Alert.alert('Error', 'Please enter your Lunch Money API token');
      return;
    }

    // Don't save if it's just the masked version
    if (apiToken.includes('•')) {
      Alert.alert('Info', 'Token is already saved. Clear it first to enter a new one.');
      return;
    }

    setIsLoading(true);
    try {
      await SecureStorage.setLunchMoneyToken(apiToken.trim());
      setHasExistingToken(true);
      setApiToken('••••••••••••••••••••••••••••••••');
      
      console.log('Token saved successfully, calling onTokenSaved callback'); // Debug log
      
      // Call the callback immediately after successful save
      if (onTokenSaved) {
        onTokenSaved();
      }
      
      Alert.alert(
        'Success',
        'API token saved successfully!'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save API token. Please try again.');
      console.error('Error saving token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearToken = () => {
    Alert.alert(
      'Clear API Token',
      'Are you sure you want to remove your saved API token? You will need to enter it again to sync with Lunch Money.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearToken },
      ]
    );
  };

  const clearToken = async () => {
    setIsLoading(true);
    try {
      await SecureStorage.removeLunchMoneyToken();
      setHasExistingToken(false);
      setApiToken('');
      Alert.alert('Success', 'API token cleared successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear API token. Please try again.');
      console.error('Error clearing token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Token</Text>
          
          <TextInput
            style={styles.input}
            value={apiToken}
            onChangeText={setApiToken}
            placeholder="Enter your API token"
            secureTextEntry={!apiToken.includes('•')}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSaveToken}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {hasExistingToken ? 'Update Token' : 'Save Token'}
                </Text>
              )}
            </TouchableOpacity>
            
            {hasExistingToken && (
              <TouchableOpacity
                style={[styles.button, styles.clearButton]}
                onPress={handleClearToken}
                disabled={isLoading}
              >
                <Text style={styles.clearButtonText}>Clear Token</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to get your API token:</Text>
          <Text style={styles.instructions}>
            1. Log in to your Lunch Money account{'\n'}
            2. Go to Settings → API{'\n'}
            3. Create a new API token or copy an existing one{'\n'}
            4. Paste it in the field above
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 15,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});