import { LunchMoneyTransaction, LunchMoneyCategory, LunchMoneyTag, LunchMoneyAsset } from '../types';

const LUNCH_MONEY_BASE_URL = 'https://dev-api.lunchmoney.app/v1';

export class LunchMoneyAPI {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${LUNCH_MONEY_BASE_URL}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
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

export const getLunchMoneyAPI = (apiToken?: string): LunchMoneyAPI => {
  if (!apiInstance && !apiToken) {
    throw new Error('Lunch Money API token is required');
  }
  
  if (apiToken && (!apiInstance || apiInstance['apiToken'] !== apiToken)) {
    apiInstance = new LunchMoneyAPI(apiToken);
  }
  
  return apiInstance!;
};
