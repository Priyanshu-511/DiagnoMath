import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

interface Props {
  visible: boolean;
  imageUri: string | null;
  initialWidth?: number;
  initialHeight?: number;
  onCropComplete: (croppedUri: string) => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PREVIEW_WIDTH = SCREEN_WIDTH - 32;
const PREVIEW_HEIGHT = Math.min(SCREEN_HEIGHT * 0.55, 420);

export default function ImageCropperModal({
  visible,
  imageUri,
  initialWidth,
  initialHeight,
  onCropComplete,
  onClose,
}: Props) {
  const [origW, setOrigW] = useState(initialWidth ?? 0);
  const [origH, setOrigH] = useState(initialHeight ?? 0);
  const [cropping, setCropping] = useState(false);

  // Normalized crop bounds (values between 0.0 and 1.0)
  const [cropNorm, setCropNorm] = useState({
    left: 0.05,
    top: 0.05,
    right: 0.95,
    bottom: 0.95,
  });

  // Calculate image dimensions to fit within PREVIEW_WIDTH x PREVIEW_HEIGHT
  useEffect(() => {
    if (!imageUri) return;

    if (!initialWidth || !initialHeight) {
      Image.getSize(
        imageUri,
        (w, h) => {
          setOrigW(w);
          setOrigH(h);
        },
        () => {
          setOrigW(1000);
          setOrigH(1000);
        }
      );
    } else {
      setOrigW(initialWidth);
      setOrigH(initialHeight);
    }

    // Default crop box: centered with comfortable margins
    setCropNorm({
      left: 0.05,
      top: 0.05,
      right: 0.95,
      bottom: 0.95,
    });
  }, [imageUri, initialWidth, initialHeight]);

  // Compute fitted dimensions
  const aspectRatio = origW && origH ? origW / origH : 1;
  let fittedW = PREVIEW_WIDTH;
  let fittedH = PREVIEW_WIDTH / aspectRatio;

  if (fittedH > PREVIEW_HEIGHT) {
    fittedH = PREVIEW_HEIGHT;
    fittedW = PREVIEW_HEIGHT * aspectRatio;
  }

  // Pixel positions on the screen
  const boxLeft = cropNorm.left * fittedW;
  const boxTop = cropNorm.top * fittedH;
  const boxWidth = Math.max(30, (cropNorm.right - cropNorm.left) * fittedW);
  const boxHeight = Math.max(30, (cropNorm.bottom - cropNorm.top) * fittedH);

  // Gesture handling for moving the crop box
  const panStartRef = useRef({ left: 0, top: 0, right: 0, bottom: 0 });

  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panStartRef.current = { ...cropNorm };
      },
      onPanResponderMove: (_, gestureState) => {
        const dxNorm = gestureState.dx / fittedW;
        const dyNorm = gestureState.dy / fittedH;
        const widthNorm = panStartRef.current.right - panStartRef.current.left;
        const heightNorm = panStartRef.current.bottom - panStartRef.current.top;

        let newLeft = Math.max(0, Math.min(1 - widthNorm, panStartRef.current.left + dxNorm));
        let newTop = Math.max(0, Math.min(1 - heightNorm, panStartRef.current.top + dyNorm));

        setCropNorm({
          left: newLeft,
          top: newTop,
          right: newLeft + widthNorm,
          bottom: newTop + heightNorm,
        });
      },
    })
  ).current;

  // Preset Handlers
  const handlePreset = (type: 'full' | 'center' | 'topHalf' | 'bottomHalf') => {
    switch (type) {
      case 'full':
        setCropNorm({ left: 0, top: 0, right: 1, bottom: 1 });
        break;
      case 'center':
        setCropNorm({ left: 0.15, top: 0.15, right: 0.85, bottom: 0.85 });
        break;
      case 'topHalf':
        setCropNorm({ left: 0.05, top: 0.02, right: 0.95, bottom: 0.55 });
        break;
      case 'bottomHalf':
        setCropNorm({ left: 0.05, top: 0.45, right: 0.95, bottom: 0.98 });
        break;
    }
  };

  // Fine-tuning adjustments
  const adjustMargin = (edge: 'left' | 'top' | 'right' | 'bottom', delta: number) => {
    setCropNorm((prev) => {
      const next = { ...prev };
      if (edge === 'left') {
        next.left = Math.max(0, Math.min(next.right - 0.1, next.left + delta));
      } else if (edge === 'top') {
        next.top = Math.max(0, Math.min(next.bottom - 0.1, next.top + delta));
      } else if (edge === 'right') {
        next.right = Math.min(1, Math.max(next.left + 0.1, next.right + delta));
      } else if (edge === 'bottom') {
        next.bottom = Math.min(1, Math.max(next.top + 0.1, next.bottom + delta));
      }
      return next;
    });
  };

  // Execute crop
  const handleApplyCrop = async () => {
    if (!imageUri || !origW || !origH) return;
    setCropping(true);

    try {
      const cropX = Math.max(0, Math.floor(cropNorm.left * origW));
      const cropY = Math.max(0, Math.floor(cropNorm.top * origH));
      const cropW = Math.min(origW - cropX, Math.floor((cropNorm.right - cropNorm.left) * origW));
      const cropH = Math.min(origH - cropY, Math.floor((cropNorm.bottom - cropNorm.top) * origH));

      // Minimum 20px crop safeguard
      if (cropW < 20 || cropH < 20) {
        throw new Error('Crop region is too small');
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropW,
              height: cropH,
            },
          },
        ],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCropComplete(manipulated.uri);
      onClose();
    } catch (err: any) {
      console.warn('Crop error:', err?.message);
    } finally {
      setCropping(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>✂️ Crop Answer Sheet</Text>
            <Text style={styles.subtitle}>
              Frame only the written answers or bubble grid for maximum accuracy
            </Text>
          </View>

          {/* Interactive Image Frame */}
          <View style={[styles.previewContainer, { width: fittedW, height: fittedH }]}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: fittedW, height: fittedH }}
              resizeMode="contain"
            />

            {/* Dark Mask Top */}
            <View
              style={[styles.mask, { top: 0, left: 0, right: 0, height: boxTop }]}
              pointerEvents="none"
            />
            {/* Dark Mask Bottom */}
            <View
              style={[
                styles.mask,
                { top: boxTop + boxHeight, left: 0, right: 0, bottom: 0 },
              ]}
              pointerEvents="none"
            />
            {/* Dark Mask Left */}
            <View
              style={[
                styles.mask,
                { top: boxTop, left: 0, width: boxLeft, height: boxHeight },
              ]}
              pointerEvents="none"
            />
            {/* Dark Mask Right */}
            <View
              style={[
                styles.mask,
                {
                  top: boxTop,
                  left: boxLeft + boxWidth,
                  right: 0,
                  height: boxHeight,
                },
              ]}
              pointerEvents="none"
            />

            {/* Draggable Crop Rectangle */}
            <View
              {...moveResponder.panHandlers}
              style={[
                styles.cropBox,
                {
                  left: boxLeft,
                  top: boxTop,
                  width: boxWidth,
                  height: boxHeight,
                },
              ]}
            >
              {/* Grid 3x3 lines inside crop box */}
              <View style={styles.gridLineH1} />
              <View style={styles.gridLineH2} />
              <View style={styles.gridLineV1} />
              <View style={styles.gridLineV2} />

              {/* Corner Handles */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              <View style={styles.dragIndicator}>
                <Text style={styles.dragIndicatorText}>✋ Drag to position</Text>
              </View>
            </View>
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handlePreset('full')}
            >
              <Text style={styles.presetText}>Full Sheet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handlePreset('center')}
            >
              <Text style={styles.presetText}>Center Area</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handlePreset('topHalf')}
            >
              <Text style={styles.presetText}>Top Half</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handlePreset('bottomHalf')}
            >
              <Text style={styles.presetText}>Bottom Half</Text>
            </TouchableOpacity>
          </View>

          {/* Fine Tuning Trim Steppers */}
          <View style={styles.stepperContainer}>
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Trim Top:</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => adjustMargin('top', 0.05)}
              >
                <Text style={styles.stepBtnText}>+ Inward</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => adjustMargin('top', -0.05)}
              >
                <Text style={styles.stepBtnText}>- Outward</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Trim Bottom:</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => adjustMargin('bottom', -0.05)}
              >
                <Text style={styles.stepBtnText}>+ Inward</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => adjustMargin('bottom', 0.05)}
              >
                <Text style={styles.stepBtnText}>- Outward</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
              disabled={cropping}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.applyBtn]}
              onPress={handleApplyCrop}
              disabled={cropping}
            >
              {cropping ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.applyBtnText}>✓ Apply Crop & Scan</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  header: {
    alignItems: 'center',
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },

  previewContainer: {
    position: 'relative',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'transparent',
  },

  // 3x3 Grid
  gridLineH1: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.6%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '33.3%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66.6%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },

  // Corner Handles
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },

  dragIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dragIndicatorText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Presets
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  presetBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },

  // Steppers
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    gap: 8,
  },
  stepperRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  stepBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  stepBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  // Footer Buttons
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  applyBtn: {
    backgroundColor: '#2563EB',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

