// Lunch Money API Types
export interface LunchMoneyTransaction {
  id?: number;
  date: string;
  amount: string;
  payee: string;
  category_id?: number;
  asset_id?: number;
  recurring_id?: number;
  notes?: string;
  is_group?: boolean;
  group_id?: number;
  tags?: LunchMoneyTag[];
  external_id?: string;
  original_name?: string;
  type?: 'credit' | 'debit';
  subtype?: string;
  fees?: string;
  price?: string;
  quantity?: string;
}

export interface LunchMoneyCategory {
  id: number;
  name: string;
  description?: string;
  is_income: boolean;
  exclude_from_budget: boolean;
  exclude_from_totals: boolean;
  updated_at: string;
  created_at: string;
  is_group: boolean;
  group_id?: number;
}

export interface LunchMoneyTag {
  id: number;
  name: string;
  description?: string;
}

export interface LunchMoneyAsset {
  id: number;
  type_name: string;
  subtype_name?: string;
  name: string;
  display_name?: string;
  balance: string;
  balance_as_of: string;
  currency: string;
  status: string;
  institution_name?: string;
}

// App-specific types
export interface Receipt {
  id: string;
  uri: string;
  transactionId?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  uri: string;
  fileName: string;
  dateAdded: string;
  size?: number;
  transactionId?: string;
}

export interface NewTransaction {
  amount: string;
  payee: string;
  date: string;
  category_id?: number;
  notes?: string;
  receipt?: Receipt;
  offline?: boolean;
}

export interface AppSettings {
  lunchMoneyApiToken?: string;
  defaultCategoryId?: number;
  enableOfflineMode: boolean;
}

export interface SyncStatus {
  lastSync?: string;
  pendingTransactions: number;
  isOnline: boolean;
  isSyncing: boolean;
}
