import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import {
  PinchGestureHandler,
  PanGestureHandler,
  TapGestureHandler,
  State,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Attachment } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ReceiptGalleryProps {
  visible: boolean;
  attachments: Attachment[];
  initialIndex: number;
  onClose: () => void;
  onDeleteAttachment?: (attachmentId: string) => void;
}

export default function ReceiptGallery({
  visible,
  attachments,
  initialIndex,
  onClose,
  onDeleteAttachment,
}: ReceiptGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);

  // Animation values for zoom and pan
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;

  // Animation for image swiping
  const swipeTranslateX = useRef(new Animated.Value(0)).current;

  // Reset zoom when image changes
  useEffect(() => {
    resetZoom();
  }, [currentIndex]);

  // Keep track of scale value for logic
  const scaleValue = useRef(1);

  // Pinch gesture handler
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const totalScale = scaleValue.current * event.nativeEvent.scale;
      const newScale = Math.max(0.5, Math.min(totalScale, 5)); // Limit zoom between 0.5x and 5x
      
      scaleValue.current = newScale;
      baseScale.setValue(newScale);
      pinchScale.setValue(1);
      
      // Reset pan if zoomed out completely
      if (newScale <= 1) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Pan gesture handler for moving zoomed image
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Only allow panning if zoomed in
      if (scaleValue.current > 1) {
        // Optional: Add boundaries to prevent panning too far
        const maxTranslation = (screenWidth * (scaleValue.current - 1)) / 2;
        const boundedX = Math.max(-maxTranslation, Math.min(maxTranslation, event.nativeEvent.translationX));
        const boundedY = Math.max(-maxTranslation, Math.min(maxTranslation, event.nativeEvent.translationY));
        
        translateX.setOffset(boundedX);
        translateY.setOffset(boundedY);
        translateX.setValue(0);
        translateY.setValue(0);
      } else {
        // Handle swipe for navigation when not zoomed
        const swipeThreshold = screenWidth * 0.3;
        
        if (event.nativeEvent.translationX > swipeThreshold && currentIndex > 0) {
          goToPrevious();
        } else if (event.nativeEvent.translationX < -swipeThreshold && currentIndex < attachments.length - 1) {
          goToNext();
        }
        
        // Reset position
        translateX.setOffset(0);
        translateY.setOffset(0);
        translateX.setValue(0);
        translateY.setValue(0);
      }
    }
  };

  const goToNext = () => {
    if (currentIndex < attachments.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetZoom();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetZoom();
    }
  };

  const resetZoom = () => {
    scaleValue.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    translateX.setOffset(0);
    translateY.setOffset(0);
  };

  const onDoubleTap = () => {
    if (scaleValue.current > 1) {
      // Zoom out
      scaleValue.current = 1;
      Animated.parallel([
        Animated.spring(baseScale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start(() => {
        translateX.setOffset(0);
        translateY.setOffset(0);
      });
    } else {
      // Zoom in to 2x
      scaleValue.current = 2;
      Animated.spring(baseScale, {
        toValue: 2,
        useNativeDriver: true,
      }).start();
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const handleDelete = () => {
    if (onDeleteAttachment && attachments[currentIndex]) {
      onDeleteAttachment(attachments[currentIndex].id);
      if (attachments.length === 1) {
        onClose();
      } else if (currentIndex === attachments.length - 1) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentAttachment = attachments[currentIndex];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.container}>
        {/* Header */}
        {showControls && (
          <Animated.View style={[styles.header, { opacity: showControls ? 1 : 0 }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
            
            <View style={styles.headerInfo}>
              <Text style={styles.fileName}>Receipt {currentIndex + 1}</Text>
              <Text style={styles.counter}>
                {currentIndex + 1} of {attachments.length}
              </Text>
            </View>

            {onDeleteAttachment && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Image Container */}
        <View style={styles.imageContainer}>
          <PanGestureHandler
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
          >
            <Animated.View style={styles.imageWrapper}>
              <PinchGestureHandler
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
              >
                <Animated.View style={styles.zoomContainer}>
                  <TapGestureHandler
                    numberOfTaps={2}
                    onActivated={onDoubleTap}
                  >
                    <Animated.View
                      style={[
                        styles.imageInnerContainer,
                        {
                          transform: [
                            { translateX },
                            { translateY },
                            { scale: Animated.multiply(baseScale, pinchScale) },
                          ],
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: currentAttachment?.uri }}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  </TapGestureHandler>
                  
                  {/* Single tap for toggling controls */}
                  <TapGestureHandler
                    numberOfTaps={1}
                    onActivated={toggleControls}
                  >
                    <Animated.View style={styles.tapOverlay} />
                  </TapGestureHandler>
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </View>

        {/* Navigation Arrows */}
        {showControls && attachments.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity style={styles.navLeft} onPress={goToPrevious}>
                <Text style={styles.navIcon}>‹</Text>
              </TouchableOpacity>
            )}
            {currentIndex < attachments.length - 1 && (
              <TouchableOpacity style={styles.navRight} onPress={goToNext}>
                <Text style={styles.navIcon}>›</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Footer */}
        {showControls && (
          <Animated.View style={[styles.footer, { opacity: showControls ? 1 : 0 }]}>
            <Text style={styles.dateText}>
              {currentAttachment ? formatDate(currentAttachment.dateAdded) : ''}
            </Text>
            
            {/* Thumbnail strip for multiple images */}
            {attachments.length > 1 && (
              <View style={styles.thumbnailStrip}>
                {attachments.map((attachment, index) => (
                  <TouchableOpacity
                    key={attachment.id}
                    style={[
                      styles.thumbnail,
                      index === currentIndex && styles.activeThumbnail,
                    ]}
                    onPress={() => setCurrentIndex(index)}
                  >
                    <Image
                      source={{ uri: attachment.uri }}
                      style={styles.thumbnailImage}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 15,
  },
  fileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  counter: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 16,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageInnerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  image: {
    width: screenWidth - 40,
    height: screenHeight - 200,
    maxWidth: screenWidth,
    maxHeight: screenHeight,
  },
  navLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  navRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  navIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingBottom: 50,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dateText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  thumbnailStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: '#fff',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
});