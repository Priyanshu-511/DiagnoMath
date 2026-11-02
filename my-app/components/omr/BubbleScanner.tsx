import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  /** When provided the scanner auto-opens the specified picker immediately */
  initialMode?: 'camera' | 'gallery';
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function optionLabel(opt: 0 | 1 | 2 | 3 | null): string {
  return opt !== null ? OPTION_LABELS[opt] : '—';
}

export default function BubbleScanner({ questionCount, onScanned, onError, initialMode }: Props) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);

  /** Cycle through A → B → C → D → blank for a given question */
  const cycleOption = (qIdx: number) => {
    if (!answers) return;
    setAnswers((prev) =>
      (prev ?? []).map((a) => {
        if (a.questionIndex !== qIdx) return a;
        const next = a.selectedOption === null ? 0 : (a.selectedOption + 1) % 5;
        const opt = next === 4 ? null : (next as 0 | 1 | 2 | 3);
        return { ...a, selectedOption: opt, flag: 'ok' };
      })
    );
  };

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

      // Fast, 100% offline on-device OMR with auto-centering & shadow removal
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

  // Auto-trigger the picker when initialMode is set
  useEffect(() => {
    if (initialMode === 'camera') capture(true);
    else if (initialMode === 'gallery') capture(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = (event: any) => {
    setProcessing(false);
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (!Array.isArray(parsed)) {
        throw new Error(parsed?.error || 'Scan failed');
      }
      setAnswers(parsed as DetectedAnswer[]);
    } catch (err: any) {
      onError(err?.message ?? 'Could not read the scan results — try again with better lighting');
    }
  };

  const handleConfirm = () => {
    if (answers) {
      onScanned(answers);
    }
  };

  const handleRetake = () => {
    setAnswers(null);
    setImageBase64(null);
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

  // ── Preview / edit table state ──
  if (answers) {
    const blanks = answers.filter((a) => a.flag === 'blank').length;
    const multiples = answers.filter((a) => a.flag === 'multiple').length;

    return (
      <View style={styles.container}>
        <Text style={styles.hint}>
          Scanned bubbles shown below. Tap any question to change or confirm the bubble before grading.
        </Text>

        {(blanks > 0 || multiples > 0) && (
          <Text style={styles.warn}>
            {blanks > 0 ? `${blanks} blank` : ''}
            {blanks > 0 && multiples > 0 ? ', ' : ''}
            {multiples > 0 ? `${multiples} unclear/multiple` : ''} — verify before saving.
          </Text>
        )}

        <ScrollView style={styles.tableScroll} nestedScrollEnabled>
          {answers.map((a) => (
            <TouchableOpacity
              key={a.questionIndex}
              style={[
                styles.row,
                a.flag === 'blank' && styles.rowBlank,
                a.flag === 'multiple' && styles.rowMultiple,
              ]}
              onPress={() => cycleOption(a.questionIndex)}
            >
              <Text style={styles.qNum}>Q{a.questionIndex + 1}</Text>
              <View
                style={[
                  styles.badge,
                  a.selectedOption !== null && styles.badgeFilled,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    a.selectedOption !== null && styles.badgeTextFilled,
                  ]}
                >
                  {optionLabel(a.selectedOption)}
                </Text>
              </View>
              {a.flag !== 'ok' && (
                <Text style={styles.flagLabel}>
                  {a.flag === 'blank' ? '⚠ blank' : '⚠ unclear'}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row2}>
          <TouchableOpacity style={styles.buttonAlt} onPress={handleRetake}>
            <Text style={styles.buttonTextAlt}>↩ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleConfirm}>
            <Text style={styles.buttonText}>✓ Confirm & Grade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Align the sheet inside the camera frame in good even lighting.
      </Text>

      {!imageBase64 && !processing && (
        <View style={styles.row2}>
          <TouchableOpacity style={styles.button} onPress={() => capture(true)} disabled={processing}>
            <Text style={styles.buttonText}>📷 Capture Sheet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonAlt} onPress={() => capture(false)} disabled={processing}>
            <Text style={styles.buttonTextAlt}>🖼️ Pick from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" />
          <Text style={styles.processingText}>Reading bubbles with auto-centering…</Text>
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
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF9C3', padding: 8, borderRadius: 8 },

  row2: { flexDirection: 'row', gap: 10 },
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

  // Preview table
  tableScroll: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
    gap: 10,
  },
  rowBlank: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  rowMultiple: { borderColor: '#FCA5A5', backgroundColor: '#FFF1F2' },
  qNum: { width: 36, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeFilled: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  badgeText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  badgeTextFilled: { color: '#fff' },
  flagLabel: { fontSize: 11, color: '#B45309', marginLeft: 4 },
});
