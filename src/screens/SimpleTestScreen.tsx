import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const SimpleTestScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flash Track Money</Text>
      <Text style={styles.subtitle}>Basic Test Screen</Text>
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>This is working!</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});