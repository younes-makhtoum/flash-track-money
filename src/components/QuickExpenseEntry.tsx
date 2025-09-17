import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { NewTransaction } from '../types';

interface QuickExpenseEntryProps {
  onSubmit: (transaction: NewTransaction) => void;
  onCancel: () => void;
  initialData?: Partial<NewTransaction>;
}

export const QuickExpenseEntry: React.FC<QuickExpenseEntryProps> = ({
  onSubmit,
  onCancel,
  initialData,
}) => {
  const { categories, settings } = useAppStore();
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [payee, setPayee] = useState(initialData?.payee || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(
    initialData?.category_id || settings.defaultCategoryId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount.trim() || !payee.trim()) {
      Alert.alert('Error', 'Please enter both amount and payee');
      return;
    }

    // Validate amount
    const numericAmount = parseFloat(amount.replace(/[^0-9.-]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const transaction: NewTransaction = {
        amount: numericAmount.toFixed(2),
        payee: payee.trim(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        category_id: selectedCategoryId,
        notes: notes.trim() || undefined,
        receipt: initialData?.receipt,
      };

      onSubmit(transaction);
    } catch (error) {
      Alert.alert('Error', 'Failed to create transaction');
      console.error('Transaction submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (text: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  };

  const expenseCategories = categories.filter(cat => !cat.is_income && !cat.is_group);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Quick Expense</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.form}>
          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount *</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(text) => setAmount(formatAmount(text))}
                placeholder="0.00"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
          </View>

          {/* Payee Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payee *</Text>
            <TextInput
              style={styles.textInput}
              value={payee}
              onChangeText={setPayee}
              placeholder="Who did you pay?"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
            >
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  !selectedCategoryId && styles.categoryChipSelected
                ]}
                onPress={() => setSelectedCategoryId(undefined)}
              >
                <Text style={[
                  styles.categoryChipText,
                  !selectedCategoryId && styles.categoryChipTextSelected
                ]}>
                  No Category
                </Text>
              </TouchableOpacity>
              
              {expenseCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategoryId === category.id && styles.categoryChipSelected
                  ]}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategoryId === category.id && styles.categoryChipTextSelected
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Notes Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes (optional)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Receipt indicator */}
          {initialData?.receipt && (
            <View style={styles.receiptIndicator}>
              <Ionicons name="camera" size={20} color="#007AFF" />
              <Text style={styles.receiptText}>Receipt attached</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Saving...' : 'Save Expense'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  cancelButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  notesInput: {
    height: 80,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  receiptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  receiptText: {
    marginLeft: 8,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
