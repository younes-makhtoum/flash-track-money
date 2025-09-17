import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import SettingsScreen from './SettingsScreen';
import { useAppStore } from '../store/appStore';

export const HomeScreen: React.FC = () => {
  const { checkAuthStatus } = useAppStore();

  useEffect(() => {
    // Check authentication status on app start
    checkAuthStatus();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <SettingsScreen 
        onTokenSaved={() => {
          checkAuthStatus();
        }} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});