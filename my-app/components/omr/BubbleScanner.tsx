import React, { useEffect, useRef, useState } from 'react';
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
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { BUBBLE_RADIUS, PAGE_HEIGHT, PAGE_WIDTH, getBubbleLayout } from '@/lib/omr/layout';
import { buildScannerHtml } from '@/lib/omr/scannerHtml';
import { parseAnswerText } from '@/lib/handwritten/parseAnswerText';
import { DetectedAnswer } from '@/lib/omr/types';

interface Props {
  questionCount: number;
  onScanned: (detected: DetectedAnswer[]) => void;
  onError: (message: string) => void;
  /** When provided the scanner auto-opens the specified picker immediately */
  initialMode?: 'camera' | 'gallery';
  /** Optional options per question for handwritten text matching */
  expectedOptionsByQuestion?: string[][];
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function optionLabel(opt: 0 | 1 | 2 | 3 | null): string {
  return opt !== null ? OPTION_LABELS[opt] : '—';
}

/**
 * Checks if OMR results look like random noise (i.e. the image is not a bubble sheet).
 * If average confidence is low and no single answer has high confidence,
 * we should fall back to handwritten OCR.
 */
function isLikelyNotBubbleSheet(results: DetectedAnswer[]): boolean {
  if (results.length === 0) return true;
  const confidences = results.map((r) => r.confidence ?? 25);
  const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const maxConf = Math.max(...confidences);
  const highConfCount = confidences.filter((c) => c >= 75).length;
  // If no bubble has >= 75% confidence or average confidence is below 60%,
  // or fewer than 25% of questions have confident bubbles, it is plain/handwritten paper.
  return maxConf < 75 || highConfCount === 0 || (avgConf < 60 && maxConf < 85);
}

export default function BubbleScanner({
  questionCount,
  onScanned,
  onError,
  initialMode,
  expectedOptionsByQuestion,
}: Props) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);
  const [omrAnswers, setOmrAnswers] = useState<DetectedAnswer[] | null>(null);
  const [ocrAnswers, setOcrAnswers] = useState<DetectedAnswer[] | null>(null);
  const [scanEngine, setScanEngine] = useState<'omr' | 'ocr'>('omr');

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
        onError(
          fromCamera
            ? 'Camera permission is needed to scan sheets'
            : 'Photo library access is needed to upload sheets'
        );
        return;
      }

      const pickerFn = fromCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await pickerFn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) return;

      setProcessing(true);
      const asset = result.assets[0];
      setImageUri(asset.uri);

      // Fast, 100% offline on-device OMR with auto-centering & shadow removal
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: PAGE_WIDTH } }],
        { base64: true, compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!manipulated.base64) {
        throw new Error('Could not process sheet photo');
      }

      setImageBase64(manipulated.base64);
    } catch (err: any) {
      setProcessing(false);
      onError(err?.message ?? 'Failed to capture or load sheet');
    }
  };

  useEffect(() => {
    if (initialMode === 'camera') capture(true);
    else if (initialMode === 'gallery') capture(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Run ML Kit text recognition on the loaded image with neural spatial alignment
   */
  const executeOcr = async (uri: string): Promise<DetectedAnswer[]> => {
    const recognition = await TextRecognition.recognize(uri);
    return parseAnswerText(recognition, questionCount, expectedOptionsByQuestion);
  };

  const handleMessage = async (event: any) => {
    setProcessing(false);
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (!Array.isArray(parsed)) {
        throw new Error(parsed?.error || 'Scan failed');
      }
      const rawOmr = parsed as DetectedAnswer[];
      setOmrAnswers(rawOmr);

      // Check if the scanned image is actually a bubble sheet
      if (isLikelyNotBubbleSheet(rawOmr) && imageUri) {
        try {
          const parsedOcr = await executeOcr(imageUri);
          setOcrAnswers(parsedOcr);
          setScanEngine('ocr');
          setAnswers(parsedOcr);
          return;
        } catch {
          // If OCR also fails, fall back to OMR
        }
      }

      setScanEngine('omr');
      setAnswers(rawOmr);
    } catch (err: any) {
      onError(err?.message ?? 'Could not read the scan results — try again with better lighting');
    }
  };

  const handleToggleEngine = async () => {
    if (scanEngine === 'omr') {
      // Switch to OCR
      if (ocrAnswers) {
        setAnswers(ocrAnswers);
        setScanEngine('ocr');
      } else if (imageUri) {
        setProcessing(true);
        try {
          const parsedOcr = await executeOcr(imageUri);
          setOcrAnswers(parsedOcr);
          setAnswers(parsedOcr);
          setScanEngine('ocr');
        } catch (e: any) {
          onError(e?.message ?? 'Handwritten OCR failed on this image');
        } finally {
          setProcessing(false);
        }
      }
    } else {
      // Switch to OMR
      if (omrAnswers) {
        setAnswers(omrAnswers);
        setScanEngine('omr');
      }
    }
  };

  const handleConfirm = () => {
    if (answers) {
      onScanned(answers);
    }
  };

  const handleRetake = () => {
    setAnswers(null);
    setOmrAnswers(null);
    setOcrAnswers(null);
    setImageBase64(null);
    setImageUri(null);
    setScanEngine('omr');
  };

  const positions = getBubbleLayout(questionCount);

  if (answers) {
    const blanks = answers.filter((a) => a.flag === 'blank').length;
    const multiples = answers.filter((a) => a.flag === 'multiple').length;

    return (
      <View style={styles.container}>
        <View style={styles.engineBar}>
          <View style={styles.enginePill}>
            <Text style={styles.enginePillText}>
              {scanEngine === 'ocr' ? '✏️ Handwritten OCR (auto-detected)' : '⊙ Bubble OMR Scanner'}
            </Text>
          </View>
          {imageUri && (
            <TouchableOpacity style={styles.engineSwitchBtn} onPress={handleToggleEngine}>
              <Text style={styles.engineSwitchBtnText}>
                {scanEngine === 'omr' ? 'Switch to OCR ✏️' : 'Switch to OMR ⊙'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.hint}>
          {scanEngine === 'ocr'
            ? 'Handwritten answers detected. Tap any option if you need to adjust it before grading.'
            : 'Scanned bubbles shown below. Tap any question to change or confirm the bubble before grading.'}
        </Text>

        {(blanks > 0 || multiples > 0) && (
          <Text style={styles.warn}>
            {blanks > 0 && `${blanks} unanswered. `}
            {multiples > 0 && `${multiples} marked as multiple. `}
            Tap any row to adjust.
          </Text>
        )}

        <ScrollView style={styles.grid}>
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
                  styles.optionBadge,
                  a.selectedOption === null ? styles.optionBadgeBlank : styles.optionBadgeFilled,
                ]}
              >
                <Text
                  style={[
                    styles.optionBadgeText,
                    a.selectedOption === null
                      ? styles.optionBadgeTextBlank
                      : styles.optionBadgeTextFilled,
                  ]}
                >
                  {optionLabel(a.selectedOption)}
                </Text>
              </View>
              {typeof a.confidence === 'number' && (
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>{a.confidence}% prob</Text>
                </View>
              )}
              {a.flag !== 'ok' && (
                <View style={styles.flagBadge}>
                  <Text style={styles.flagLabel}>{a.flag === 'blank' ? 'Blank' : 'Multiple'}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row2}>
          <TouchableOpacity style={[styles.button, styles.retake]} onPress={handleRetake}>
            <Text style={[styles.buttonText, styles.retakeText]}>↩ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.confirm]} onPress={handleConfirm}>
            <Text style={styles.buttonText}>✓ Confirm & Grade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" />
          <Text style={styles.processingText}>Reading answers…</Text>
        </View>
      )}

      {imageBase64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={['*']}
            source={{
              html: buildScannerHtml({
                imageBase64,
                questionCount,
                positions,
                pageWidth: PAGE_WIDTH,
                pageHeight: PAGE_HEIGHT,
                bubbleRadius: BUBBLE_RADIUS,
              }),
            }}
            onMessage={handleMessage}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  hint: { fontSize: 12, color: '#4B5563' },
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF9C3', padding: 8, borderRadius: 8 },

  engineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  enginePill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  enginePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  engineSwitchBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  engineSwitchBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },

  row2: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retake: { backgroundColor: '#84CC16' },
  confirm: { backgroundColor: '#3B82F6' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  retakeText: { color: '#1E293B' },

  grid: { maxHeight: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rowBlank: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  rowMultiple: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  qNum: { width: 44, fontWeight: '700', color: '#1E293B', fontSize: 14 },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeFilled: { backgroundColor: '#3B82F6' },
  optionBadgeBlank: { backgroundColor: '#E2E8F0' },
  optionBadgeText: { fontWeight: '700', fontSize: 13 },
  optionBadgeTextFilled: { color: '#FFFFFF' },
  optionBadgeTextBlank: { color: '#94A3B8' },

  confidencePill: {
    marginLeft: 10,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065F46',
  },

  processing: { padding: 24, alignItems: 'center', gap: 8 },
  processingText: { fontSize: 13, color: '#4B5563' },
  hiddenWebView: { height: 0, width: 0, opacity: 0 },
  flagBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagLabel: { fontSize: 11, color: '#B45309', marginLeft: 4 },
});
