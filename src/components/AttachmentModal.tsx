import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SecureStorage } from '../utils/storage';

interface AttachmentModalProps {
  visible: boolean;
  onClose: () => void;
  onAttachmentAdded: (attachment: any) => void;
  transactionId?: string; // Optional for now, will be set after transaction creation
}

export default function AttachmentModal({
  visible,
  onClose,
  onAttachmentAdded,
  transactionId
}: AttachmentModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    // Request camera permissions
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Request media library permissions
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (mediaPermission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is required to select images. Please enable it in your device settings.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  const generateAttachmentId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const processImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      
      const attachment = {
        id: generateAttachmentId(),
        transactionId: transactionId || 'temp',
        uri: asset.uri,
        fileName: asset.fileName || `receipt_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
        size: asset.fileSize || 0,
        dateAdded: new Date().toISOString(),
      };

      // If we have a transaction ID, save to storage immediately
      if (transactionId) {
        try {
          await SecureStorage.addTransactionAttachment(attachment);
        } catch (error) {
          Alert.alert('Error', 'Failed to save attachment');
          return;
        }
      }

      onAttachmentAdded(attachment);
      onClose();
    }
  };

  const takePhoto = async () => {
    setIsLoading(true);
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enable simple cropping
        quality: 0.8,
        allowsMultipleSelection: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN, // Back to full screen
      });

      await processImageResult(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    setIsLoading(true);
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Enable simple cropping
        quality: 0.8,
        allowsMultipleSelection: false,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN, // Back to full screen
      });

      await processImageResult(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Add Receipt</Text>
          <Text style={styles.subtitle}>Choose how to add your receipt image</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={takePhoto}>
                <Text style={styles.buttonIcon}>📷</Text>
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={pickImage}>
                <Text style={styles.buttonIcon}>🖼️</Text>
                <Text style={styles.buttonText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});