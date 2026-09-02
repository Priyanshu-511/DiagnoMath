import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';

import { BUBBLE_RADIUS, PAGE_HEIGHT, PAGE_WIDTH, getBubbleLayout } from '@/lib/omr/layout';
import { buildScannerHtml } from '@/lib/omr/scannerHtml';
import { DetectedAnswer } from '@/lib/omr/types';

interface Props {
  questionCount: number;
  onScanned: (detected: DetectedAnswer[]) => void;
  onError: (message: string) => void;
}

export default function BubbleScanner({ questionCount, onScanned, onError }: Props) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const capture = async (fromCamera: boolean) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError(fromCamera ? 'Camera permission denied' : 'Gallery permission denied');
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [PAGE_WIDTH, PAGE_HEIGHT],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [PAGE_WIDTH, PAGE_HEIGHT],
            quality: 1,
          });

      if (result.canceled) return;

      setProcessing(true);
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: PAGE_WIDTH, height: PAGE_HEIGHT } }],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!manipulated.base64) throw new Error('Could not read the captured image');
      setImageBase64(manipulated.base64);
    } catch (err: any) {
      setProcessing(false);
      onError(err?.message ?? 'Could not capture the answer sheet');
    }
  };

  const handleMessage = (event: any) => {
    setProcessing(false);
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (!Array.isArray(parsed)) {
        throw new Error(parsed?.error || 'Scan failed');
      }
      onScanned(parsed as DetectedAnswer[]);
    } catch (err: any) {
      onError(err?.message ?? 'Could not read the scan results — try again with better lighting');
    }
  };

  const positions = getBubbleLayout(questionCount);
  const html = imageBase64
    ? buildScannerHtml({
        imageDataUri: `data:image/jpeg;base64,${imageBase64}`,
        positions,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
        bubbleRadius: BUBBLE_RADIUS,
      })
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Crop tightly to the sheet's edges in the next screen, in good even light, so the bubbles
        line up with where the app expects them.
      </Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={() => capture(true)} disabled={processing}>
          <Text style={styles.buttonText}>📷 Capture Sheet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonAlt} onPress={() => capture(false)} disabled={processing}>
          <Text style={styles.buttonTextAlt}>🖼️ Pick from Gallery</Text>
        </TouchableOpacity>
      </View>

      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" />
          <Text style={styles.processingText}>Reading bubbles…</Text>
        </View>
      )}

      {html && (
        <WebView
          key={imageBase64}
          source={{ html }}
          onMessage={handleMessage}
          onError={() => onError('Scanner failed to load')}
          style={styles.hiddenWebView}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginVertical: 12 },
  hint: { fontSize: 12, color: '#4B5563' },
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonAlt: {
    flex: 1,
    backgroundColor: '#A3E635',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonTextAlt: { color: '#1E3A8A', fontWeight: '600' },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  processingText: { color: '#4B5563', fontSize: 13 },
  hiddenWebView: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
