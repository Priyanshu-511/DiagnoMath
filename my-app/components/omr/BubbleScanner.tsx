import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

function optionLabel(opt: 0 | 1 | 2 | 3 | null, confidence?: number): string {
  if (opt !== null) return OPTION_LABELS[opt];
  if (confidence === 99) return 'NA';
  return '—';
}

/**
 * Checks if OMR results look like random noise (i.e. the image is not a bubble sheet).
 */
function isLikelyNotBubbleSheet(results: DetectedAnswer[]): boolean {
  if (results.length === 0) return true;
  const confidences = results.map((r) => r.confidence ?? 25);
  const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const maxConf = Math.max(...confidences);
  const highConfCount = confidences.filter((c) => c >= 75).length;
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
  const [statusText, setStatusText] = useState('Reading answers…');
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);
  const [omrAnswers, setOmrAnswers] = useState<DetectedAnswer[] | null>(null);
  const [ocrAnswers, setOcrAnswers] = useState<DetectedAnswer[] | null>(null);
  const [scanEngine, setScanEngine] = useState<'omr' | 'ocr'>('ocr');

  /**
   * Cycle through:
   * A(0) → B(1) → C(2) → D(3) → Not Attempted(null, conf 99) → Blank(null, conf 0) → A(0)
   */
  const cycleOption = (qIdx: number) => {
    if (!answers) return;
    setAnswers((prev) =>
      (prev ?? []).map((a) => {
        if (a.questionIndex !== qIdx) return a;
        if (a.selectedOption === null) {
          if (a.confidence === 99) {
            // From Not Attempted -> Blank
            return { ...a, selectedOption: null, flag: 'blank', confidence: 0 };
          } else {
            // From Blank -> Option A
            return { ...a, selectedOption: 0, flag: 'ok', confidence: 100 };
          }
        }
        if (a.selectedOption === 0) return { ...a, selectedOption: 1, flag: 'ok', confidence: 100 };
        if (a.selectedOption === 1) return { ...a, selectedOption: 2, flag: 'ok', confidence: 100 };
        if (a.selectedOption === 2) return { ...a, selectedOption: 3, flag: 'ok', confidence: 100 };
        if (a.selectedOption === 3) {
          // To Not Attempted (5th way)
          return { ...a, selectedOption: null, flag: 'blank', confidence: 99 };
        }
        return { ...a, selectedOption: 0, flag: 'ok', confidence: 100 };
      })
    );
  };

  /**
   * Run ML Kit text recognition on the loaded image with 1600px normalization
   */
  const executeOcr = async (uri: string): Promise<DetectedAnswer[]> => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );
    const recognition = await TextRecognition.recognize(manipulated.uri);
    return parseAnswerText(recognition, questionCount, expectedOptionsByQuestion);
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

      const asset = result.assets[0];
      setImageUri(asset.uri);
      setProcessing(true);
      setStatusText('Reading answer sheet with AI OCR…');

      // ── Step 1: Run native Google ML Kit OCR first (super fast: ~200-300ms) ──
      let parsedOcr: DetectedAnswer[] | null = null;
      let ocrConfidentCount = 0;
      try {
        parsedOcr = await executeOcr(asset.uri);
        setOcrAnswers(parsedOcr);
        ocrConfidentCount = parsedOcr.filter(
          (a) => a.selectedOption !== null || a.confidence === 99
        ).length;
      } catch (ocrErr) {
        console.warn('Initial OCR check error:', ocrErr);
      }

      // If OCR identified >= 2 answers or >= 50% of the questions:
      // it is a HANDWRITTEN sheet! Select OCR immediately!
      const minOcrThreshold = Math.min(2, Math.max(1, Math.ceil(questionCount / 2)));
      if (parsedOcr && ocrConfidentCount >= minOcrThreshold) {
        setScanEngine('ocr');
        setAnswers(parsedOcr);
        setProcessing(false);

        // Also prepare OMR base64 in the background in case user wants to toggle
        ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: PAGE_WIDTH } }],
          { base64: true, compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        )
          .then((m) => {
            if (m.base64) setImageBase64(m.base64);
          })
          .catch(() => {});
        return;
      }

      // ── Step 2: If OCR found few/no answers, it's likely a printed OMR bubble sheet ──
      setStatusText('Checking bubble markings…');
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: PAGE_WIDTH } }],
        { base64: true, compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!manipulated.base64) {
        // Fall back to OCR answers if available
        if (parsedOcr) {
          setScanEngine('ocr');
          setAnswers(parsedOcr);
          setProcessing(false);
          return;
        }
        throw new Error('Could not process photo');
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

  const handleMessage = async (event: any) => {
    setProcessing(false);
    try {
      const parsed = JSON.parse(event.nativeEvent.data);
      if (!Array.isArray(parsed)) {
        // If WebView OMR reported an error, gracefully fall back to OCR
        if (imageUri) {
          try {
            const parsedOcr = ocrAnswers ?? (await executeOcr(imageUri));
            setOcrAnswers(parsedOcr);
            setScanEngine('ocr');
            setAnswers(parsedOcr);
            return;
          } catch {}
        }
        throw new Error(parsed?.error || 'Scan failed');
      }

      const rawOmr = parsed as DetectedAnswer[];
      setOmrAnswers(rawOmr);

      // Check if results look like noise (e.g. handwritten paper mistaken for bubble sheet)
      if (isLikelyNotBubbleSheet(rawOmr) && imageUri) {
        try {
          const parsedOcr = ocrAnswers ?? (await executeOcr(imageUri));
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
      if (ocrAnswers) {
        setScanEngine('ocr');
        setAnswers(ocrAnswers);
      } else {
        onError(err?.message ?? 'Could not read scan results. Tap another photo to try again.');
      }
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
        setStatusText('Reading handwritten answers…');
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
      } else if (imageBase64) {
        setProcessing(true);
        setStatusText('Re-analyzing bubbles…');
        // WebView will re-process
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
    setScanEngine('ocr');
  };

  const positions = getBubbleLayout(questionCount);

  // ── Mode 1: Answers are loaded and ready for review ────────────────────────
  if (answers) {
    const blanks = answers.filter((a) => a.flag === 'blank' && a.confidence !== 99).length;
    const notAttempted = answers.filter((a) => a.confidence === 99).length;
    const multiples = answers.filter((a) => a.flag === 'multiple').length;

    return (
      <View style={styles.container}>
        {/* Uploaded Sheet Thumbnail Card */}
        {imageUri && (
          <View style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.imageThumb} resizeMode="cover" />
            <View style={styles.imageCardInfo}>
              <Text style={styles.imageCardTitle}>
                {scanEngine === 'ocr' ? '✏️ Handwritten Sheet' : '⊙ Bubble OMR Sheet'}
              </Text>
              <Text style={styles.imageCardSub}>
                {scanEngine === 'ocr'
                  ? 'Answers recognized via on-device AI OCR'
                  : 'Bubbles measured via optical density'}
              </Text>
            </View>
            <TouchableOpacity style={styles.imageChangeBtn} onPress={() => capture(false)}>
              <Text style={styles.imageChangeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Engine Switcher Bar */}
        <View style={styles.engineBar}>
          <View style={styles.enginePill}>
            <Text style={styles.enginePillText}>
              {scanEngine === 'ocr' ? '✏️ Handwritten OCR (Active)' : '⊙ Bubble OMR (Active)'}
            </Text>
          </View>
          {imageUri && (
            <TouchableOpacity style={styles.engineSwitchBtn} onPress={handleToggleEngine}>
              <Text style={styles.engineSwitchBtnText}>
                {scanEngine === 'omr' ? 'Switch to Handwritten ✏️' : 'Switch to Bubble OMR ⊙'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.hint}>
          {scanEngine === 'ocr'
            ? 'Answers detected from paper. Tap any answer to adjust (cycles A → B → C → D → NA → Blank).'
            : 'Scanned bubbles shown below. Tap any question to change or confirm before grading.'}
        </Text>

        {(blanks > 0 || multiples > 0 || notAttempted > 0) && (
          <View style={styles.warnBox}>
            <Text style={styles.warn}>
              {notAttempted > 0 && `✓ ${notAttempted} not attempted (skipped). `}
              {blanks > 0 && `⚠️ ${blanks} blank. `}
              {multiples > 0 && `⚠️ ${multiples} multiple. `}
              Tap any row to adjust before grading.
            </Text>
          </View>
        )}

        {/* Question Rows */}
        <ScrollView style={styles.grid} nestedScrollEnabled>
          {answers.map((a) => {
            const isNA = a.confidence === 99;
            const isBlank = a.selectedOption === null && !isNA;

            return (
              <TouchableOpacity
                key={a.questionIndex}
                style={[
                  styles.row,
                  isBlank && styles.rowBlank,
                  isNA && styles.rowNotAttempt,
                  a.flag === 'multiple' && styles.rowMultiple,
                ]}
                onPress={() => cycleOption(a.questionIndex)}
              >
                <Text style={styles.qNum}>Q{a.questionIndex + 1}</Text>

                <View
                  style={[
                    styles.optionBadge,
                    isBlank
                      ? styles.optionBadgeBlank
                      : isNA
                      ? styles.optionBadgeNotAttempt
                      : styles.optionBadgeFilled,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionBadgeText,
                      isBlank
                        ? styles.optionBadgeTextBlank
                        : isNA
                        ? styles.optionBadgeTextNotAttempt
                        : styles.optionBadgeTextFilled,
                    ]}
                  >
                    {optionLabel(a.selectedOption, a.confidence)}
                  </Text>
                </View>

                {typeof a.confidence === 'number' && !isNA && (
                  <View style={styles.confidencePill}>
                    <Text style={styles.confidenceText}>{a.confidence}% prob</Text>
                  </View>
                )}

                {isNA && (
                  <View style={styles.notAttemptPill}>
                    <Text style={styles.notAttemptPillText}>Not Attempted (e / skipped)</Text>
                  </View>
                )}

                {isBlank && (
                  <View style={styles.flagBadge}>
                    <Text style={styles.flagLabel}>Blank</Text>
                  </View>
                )}

                {a.flag === 'multiple' && (
                  <View style={styles.multipleBadge}>
                    <Text style={styles.multipleLabel}>Multiple</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.row2}>
          <TouchableOpacity style={[styles.button, styles.retake]} onPress={handleRetake}>
            <Text style={[styles.buttonText, styles.retakeText]}>↩ Retake / Choose</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.confirm]} onPress={handleConfirm}>
            <Text style={styles.buttonText}>✓ Confirm & Grade</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Mode 2: Waiting for user to upload/capture an image ─────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.uploadCard}>
        <Text style={styles.uploadCardTitle}>Submit Answer Sheet</Text>
        <Text style={styles.uploadCardDesc}>
          Upload a handwritten answer sheet (e.g. 1 A, 2 C, 3 B, 4 A) or a printed bubble sheet.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnCamera]}
            onPress={() => capture(true)}
            disabled={processing}
          >
            <Text style={styles.actionBtnIcon}>📷</Text>
            <Text style={styles.actionBtnText}>Scan with Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGallery]}
            onPress={() => capture(false)}
            disabled={processing}
          >
            <Text style={styles.actionBtnIcon}>🖼️</Text>
            <Text style={styles.actionBtnText}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" size="large" />
          <Text style={styles.processingText}>{statusText}</Text>
          <Text style={styles.processingSub}>Identifying handwritten options & bubble markings</Text>
        </View>
      )}

      {imageBase64 && (
        <View style={styles.hiddenWebView}>
          <WebView
            originWhitelist={['*']}
            source={{
              html: buildScannerHtml({
                imageDataUri: imageBase64.startsWith('data:')
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
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
  hint: { fontSize: 12, color: '#4B5563', lineHeight: 18 },

  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  uploadCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  uploadCardDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnCamera: {
    backgroundColor: '#2563EB',
  },
  actionBtnGallery: {
    backgroundColor: '#059669',
  },
  actionBtnIcon: {
    fontSize: 22,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Image Thumbnail Card
  imageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 12,
  },
  imageThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  imageCardInfo: {
    flex: 1,
  },
  imageCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  imageCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  imageChangeBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  // Engine Bar
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

  warnBox: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  warn: {
    fontSize: 12,
    color: '#854D0E',
    fontWeight: '500',
  },

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
  rowNotAttempt: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  rowMultiple: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  qNum: { width: 44, fontWeight: '700', color: '#1E293B', fontSize: 14 },

  optionBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeFilled: { backgroundColor: '#3B82F6' },
  optionBadgeNotAttempt: { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#94A3B8' },
  optionBadgeBlank: { backgroundColor: '#E2E8F0' },
  optionBadgeText: { fontWeight: '700', fontSize: 13 },
  optionBadgeTextFilled: { color: '#FFFFFF' },
  optionBadgeTextNotAttempt: { color: '#475569', fontWeight: '800' },
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
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },

  notAttemptPill: {
    marginLeft: 10,
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  notAttemptPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  flagBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  flagLabel: { fontSize: 11, color: '#B45309', fontWeight: '600' },

  multipleBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  multipleLabel: { fontSize: 11, color: '#B91C1C', fontWeight: '600' },

  row2: { flexDirection: 'row', gap: 10, marginTop: 4 },
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

  processing: { padding: 24, alignItems: 'center', gap: 8 },
  processingText: { fontSize: 14, fontWeight: '600', color: '#1E3A8A' },
  processingSub: { fontSize: 11, color: '#64748B' },
  hiddenWebView: { height: 0, width: 0, opacity: 0 },
});
