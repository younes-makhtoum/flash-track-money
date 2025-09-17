import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, FlipType, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

interface ReceiptCaptureProps {
  onCapture: (imageUri: string) => void;
  onCancel: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ReceiptCapture: React.FC<ReceiptCaptureProps> = ({ onCapture, onCancel }) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current && !isProcessing) {
      setIsProcessing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });

        if (photo?.uri) {
          setCapturedImage(photo.uri);
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
        console.error('Camera error:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const cropImage = async () => {
    if (!capturedImage) return;

    try {
      setIsProcessing(true);
      
      // Auto-crop to document-like aspect ratio and enhance
      const manipResult = await manipulateAsync(
        capturedImage,
        [
          { resize: { width: 800 } }, // Reduce size for better performance
        ],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      // Save to device storage - simplified for now
      // In a real app, you'd want to use a proper file storage solution
      const fileName = `receipt_${Date.now()}.jpg`;
      
      // For now, just use the manipulated image URI directly
      // Later we can implement proper file storage when testing on device
      const finalUri = manipResult.uri;

      onCapture(finalUri);
    } catch (error) {
      Alert.alert('Error', 'Failed to process image');
      console.error('Image processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        </View>
        
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={retakePicture}>
            <Ionicons name="camera-reverse" size={24} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.primaryButton, isProcessing && styles.disabledButton]} 
            onPress={cropImage}
            disabled={isProcessing}
          >
            <Ionicons name="checkmark" size={24} color="white" />
            <Text style={styles.primaryButtonText}>
              {isProcessing ? 'Processing...' : 'Use Photo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.overlay}>
          {/* Document frame guide */}
          <View style={styles.documentFrame} />
          
          {/* Header controls */}
          <View style={styles.headerControls}>
            <TouchableOpacity style={styles.headerButton} onPress={onCancel}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.headerButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            <View style={styles.captureButtonContainer}>
              <TouchableOpacity 
                style={[styles.captureButton, isProcessing && styles.disabledButton]} 
                onPress={takePicture}
                disabled={isProcessing}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    margin: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  documentFrame: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    height: screenHeight * 0.4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 20,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonInner: {
    backgroundColor: 'white',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  disabledButton: {
    opacity: 0.5,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'black',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
