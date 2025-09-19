import AsyncStorage from '@react-native-async-storage/async-storage';

interface TransactionAttachment {
  id: string;
  transactionId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  dateAdded: string;
}

const STORAGE_KEYS = {
  LM_API_TOKEN: '@lunch_money_api_token',
  USER_SETTINGS: '@user_settings',
  CURRENCY_PREFERENCE: '@currency_preference',
  TRANSACTION_ATTACHMENTS: '@transaction_attachments',
} as const;

/**
 * Secure storage utility for sensitive data like API tokens
 */
export class SecureStorage {
  /**
   * Store the Lunch Money API token securely
   */
  static async setLunchMoneyToken(token: string): Promise<void> {
    try {
      // Simple character substitution for basic obfuscation
      // In production, consider using react-native-keychain for true encryption
      const obfuscatedToken = token.split('').map(char => 
        String.fromCharCode(char.charCodeAt(0) + 1)
      ).join('');
      await AsyncStorage.setItem(STORAGE_KEYS.LM_API_TOKEN, obfuscatedToken);
    } catch (error) {
      console.error('Error storing API token:', error);
      throw new Error('Failed to store API token');
    }
  }

  /**
   * Retrieve the Lunch Money API token
   */
  static async getLunchMoneyToken(): Promise<string | null> {
    try {
      const obfuscatedToken = await AsyncStorage.getItem(STORAGE_KEYS.LM_API_TOKEN);
      if (!obfuscatedToken) return null;
      
      // Decode the obfuscated token
      const decodedToken = obfuscatedToken.split('').map(char => 
        String.fromCharCode(char.charCodeAt(0) - 1)
      ).join('');
      return decodedToken;
    } catch (error) {
      console.error('Error retrieving API token:', error);
      return null;
    }
  }

  /**
   * Remove the stored API token
   */
  static async removeLunchMoneyToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LM_API_TOKEN);
    } catch (error) {
      console.error('Error removing API token:', error);
      throw new Error('Failed to remove API token');
    }
  }

  /**
   * Check if API token is stored
   */
  static async hasLunchMoneyToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.LM_API_TOKEN);
      return token !== null;
    } catch (error) {
      console.error('Error checking API token:', error);
      return false;
    }
  }

  /**
   * Store user settings
   */
  static async setUserSettings(settings: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error storing user settings:', error);
      throw new Error('Failed to store user settings');
    }
  }

  /**
   * Retrieve user settings
   */
  static async getUserSettings(): Promise<Record<string, any> | null> {
    try {
      const settings = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      console.error('Error retrieving user settings:', error);
      return null;
    }
  }

  /**
   * Store user's preferred currency
   */
  static async setCurrencyPreference(currency: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENCY_PREFERENCE, currency);
    } catch (error) {
      console.error('Error storing currency preference:', error);
      throw new Error('Failed to store currency preference');
    }
  }

  /**
   * Retrieve user's preferred currency
   */
  static async getCurrencyPreference(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENCY_PREFERENCE);
    } catch (error) {
      console.error('Error retrieving currency preference:', error);
      return null;
    }
  }

  /**
   * Add attachment to a transaction
   */
  static async addTransactionAttachment(attachment: TransactionAttachment): Promise<void> {
    try {
      const existingAttachments = await this.getTransactionAttachments(attachment.transactionId);
      const updatedAttachments = [...existingAttachments, attachment];
      
      const allAttachments = await this.getAllAttachments();
      allAttachments[attachment.transactionId] = updatedAttachments;
      
      await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTION_ATTACHMENTS, JSON.stringify(allAttachments));
    } catch (error) {
      console.error('Error adding transaction attachment:', error);
      throw new Error('Failed to save attachment');
    }
  }

  /**
   * Get all attachments for a specific transaction
   */
  static async getTransactionAttachments(transactionId: string): Promise<TransactionAttachment[]> {
    try {
      const allAttachments = await this.getAllAttachments();
      return allAttachments[transactionId] || [];
    } catch (error) {
      console.error('Error retrieving transaction attachments:', error);
      return [];
    }
  }

  /**
   * Get all attachments grouped by transaction ID
   */
  static async getAllAttachments(): Promise<{ [transactionId: string]: TransactionAttachment[] }> {
    try {
      const attachmentsData = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTION_ATTACHMENTS);
      return attachmentsData ? JSON.parse(attachmentsData) : {};
    } catch (error) {
      console.error('Error retrieving all attachments:', error);
      return {};
    }
  }

  /**
   * Remove an attachment
   */
  static async removeTransactionAttachment(transactionId: string, attachmentId: string): Promise<void> {
    try {
      const allAttachments = await this.getAllAttachments();
      if (allAttachments[transactionId]) {
        allAttachments[transactionId] = allAttachments[transactionId].filter(
          attachment => attachment.id !== attachmentId
        );
        
        // Remove the transaction key if no attachments left
        if (allAttachments[transactionId].length === 0) {
          delete allAttachments[transactionId];
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTION_ATTACHMENTS, JSON.stringify(allAttachments));
      }
    } catch (error) {
      console.error('Error removing transaction attachment:', error);
      throw new Error('Failed to remove attachment');
    }
  }
}