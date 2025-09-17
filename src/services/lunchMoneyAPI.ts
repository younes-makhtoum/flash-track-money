import { LunchMoneyTransaction, LunchMoneyCategory, LunchMoneyTag, LunchMoneyAsset } from '../types';
import { SecureStorage } from '../utils/storage';

const LUNCH_MONEY_BASE_URL = 'https://dev-api.lunchmoney.app/v1';

export class LunchMoneyAPI {
  private apiToken: string | null = null;

  constructor(apiToken?: string) {
    if (apiToken) {
      this.apiToken = apiToken;
    }
  }

  private async getApiToken(): Promise<string> {
    if (this.apiToken) {
      return this.apiToken;
    }

    const storedToken = await SecureStorage.getLunchMoneyToken();
    if (!storedToken) {
      throw new Error('No Lunch Money API token found. Please configure your token in settings.');
    }

    this.apiToken = storedToken;
    return this.apiToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${LUNCH_MONEY_BASE_URL}${endpoint}`;
    const apiToken = await this.getApiToken();
    
    console.log('Making API request to:', url); // Debug log
    
    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('API response status:', response.status); // Debug log

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('API Error:', response.status, errorText); // Debug log
      throw new Error(`Lunch Money API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Transactions
  async getTransactions(params?: {
    start_date?: string;
    end_date?: string;
    tag_id?: number;
    recurring_id?: number;
    plaid_account_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<LunchMoneyTransaction[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<{ transactions: LunchMoneyTransaction[] }>(endpoint);
    return response.transactions;
  }

  async createTransaction(transaction: Omit<LunchMoneyTransaction, 'id'>): Promise<LunchMoneyTransaction> {
    const response = await this.request<{ transaction_id: number }>('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        transactions: [transaction],
        apply_rules: true,
        skip_duplicates: false,
        check_for_recurring: true,
        debit_as_negative: true,
      }),
    });

    // Return the created transaction with the ID
    return { ...transaction, id: response.transaction_id };
  }

  async updateTransaction(id: number, transaction: Partial<LunchMoneyTransaction>): Promise<boolean> {
    await this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ transaction }),
    });
    return true;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    await this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  // Categories
  async getCategories(): Promise<LunchMoneyCategory[]> {
    const response = await this.request<{ categories: LunchMoneyCategory[] }>('/categories');
    return response.categories;
  }

  // Tags
  async getTags(): Promise<LunchMoneyTag[]> {
    const response = await this.request<{ tags: LunchMoneyTag[] }>('/tags');
    return response.tags;
  }

  // Assets (accounts)
  async getAssets(): Promise<LunchMoneyAsset[]> {
    const response = await this.request<{ assets: LunchMoneyAsset[] }>('/assets');
    return response.assets;
  }

  // User info / validation
  async validateToken(): Promise<boolean> {
    try {
      await this.request('/me');
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let apiInstance: LunchMoneyAPI | null = null;

export const getLunchMoneyAPI = (): LunchMoneyAPI => {
  if (!apiInstance) {
    apiInstance = new LunchMoneyAPI();
  }
  return apiInstance;
};

// Utility function to check if API is configured
export const isAPIConfigured = async (): Promise<boolean> => {
  try {
    return await SecureStorage.hasLunchMoneyToken();
  } catch {
    return false;
  }
};

// Utility function to test API connection
export const testAPIConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const api = getLunchMoneyAPI();
    const isValid = await api.validateToken();
    return { success: isValid, error: isValid ? undefined : 'Invalid API token' };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};
