import React, { useState } from 'react';
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
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { parseAnswerText } from '@/lib/handwritten/parseAnswerText';
import { DetectedAnswer } from '@/lib/omr/types';
import ImageCropperModal from '@/components/ImageCropperModal';

interface Props {
  questionCount: number;
  expectedOptionsByQuestion?: string[][];
  onScanned: (detected: DetectedAnswer[]) => void;
  onError: (message: string) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/** Convert a 0-based option index to its display letter, or 'NA' or '—'. */
function optionLabel(opt: 0 | 1 | 2 | 3 | null, confidence?: number): string {
  if (opt !== null) return OPTION_LABELS[opt];
  if (confidence === 99) return 'NA';
  return '—';
}

export default function HandwrittenScanner({
  questionCount,
  expectedOptionsByQuestion,
  onScanned,
  onError,
}: Props) {
  const [processing, setProcessing] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [cropModalVisible, setCropModalVisible] = useState(false);

  const [rawText, setRawText] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);

  /** Cycle through A → B → C → D → Not Attempted → blank */
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
      }),
    );
  };

  const processImage = async (uri: string) => {
    setProcessing(true);
    try {
      // 1. High-clarity normalization pass: resizes to optimal OCR resolution (1600px width)
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. On-device Google ML Kit OCR
      const recognition = await TextRecognition.recognize(manipulated.uri);
      const text = recognition.text ?? '';
      setRawText(text);

      // 3. Multi-stage neural & topological identification
      const parsedAnswers = parseAnswerText(recognition, questionCount, expectedOptionsByQuestion);
      setAnswers(parsedAnswers);
    } catch (err: any) {
      onError(err?.message ?? 'Could not recognise the handwritten answers');
    } finally {
      setProcessing(false);
    }
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
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setImageUri(asset.uri);
      setOriginalImageUri(asset.uri);
      setImageDims({
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });

      await processImage(asset.uri);
    } catch (err: any) {
      setProcessing(false);
      onError(err?.message ?? 'Failed to capture or load photo');
    }
  };

  const handleConfirm = () => {
    if (answers) onScanned(answers);
  };

  const handleRetake = () => {
    setAnswers(null);
    setImageUri(null);
    setOriginalImageUri(null);
    setRawText(null);
    setShowRaw(false);
  };

  // ── Preview / edit table ────────────────────────────────────────────────────
  if (answers) {
    const blanks = answers.filter((a) => a.flag === 'blank' && a.confidence !== 99).length;
    const notAttempted = answers.filter((a) => a.confidence === 99).length;
    const multiples = answers.filter((a) => a.flag === 'multiple').length;

    return (
      <View style={styles.container}>
        {/* Uploaded Sheet Thumbnail Card with In-App Crop Button */}
        {imageUri && (
          <View style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.imageThumb} resizeMode="cover" />
            <View style={styles.imageCardInfo}>
              <Text style={styles.imageCardTitle}>✏️ Handwritten Answer Sheet</Text>
              <Text style={styles.imageCardSub}>Answers identified via on-device AI OCR</Text>
            </View>
            <View style={styles.imageCardActions}>
              <TouchableOpacity
                style={styles.imageCropBtn}
                onPress={() => setCropModalVisible(true)}
              >
                <Text style={styles.imageCropBtnText}>✂️ Crop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageChangeBtn} onPress={() => capture(false)}>
                <Text style={styles.imageChangeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.hint}>
          Tap any answer to adjust (cycles A → B → C → D → NA → Blank), or tap ✂️ Crop to zoom in on answers.
        </Text>

        {(blanks > 0 || multiples > 0 || notAttempted > 0) && (
          <Text style={styles.warn}>
            {notAttempted > 0 ? `✓ ${notAttempted} not attempted. ` : ''}
            {blanks > 0 ? `⚠️ ${blanks} blank. ` : ''}
            {multiples > 0 ? `⚠️ ${multiples} unclear. ` : ''}Fix before saving.
          </Text>
        )}

        <ScrollView style={styles.tableScroll} nestedScrollEnabled>
          {answers.map((a) => (
            <TouchableOpacity
              key={a.questionIndex}
              style={[
                styles.row,
                a.flag === 'blank' && a.confidence !== 99 && styles.rowBlank,
                a.confidence === 99 && styles.rowNotAttempt,
                a.flag === 'multiple' && styles.rowMultiple,
              ]}
              onPress={() => cycleOption(a.questionIndex)}
            >
              <Text style={styles.qNum}>Q{a.questionIndex + 1}</Text>
              <View
                style={[
                  styles.badge,
                  a.selectedOption !== null && styles.badgeFilled,
                  a.confidence === 99 && styles.badgeNotAttempt,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    a.selectedOption !== null && styles.badgeTextFilled,
                    a.confidence === 99 && styles.badgeTextNotAttempt,
                  ]}
                >
                  {optionLabel(a.selectedOption, a.confidence)}
                </Text>
              </View>
              {typeof a.confidence === 'number' && a.confidence !== 99 && (
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>{a.confidence}%</Text>
                </View>
              )}
              {a.confidence === 99 && (
                <View style={styles.notAttemptPill}>
                  <Text style={styles.notAttemptPillText}>Not Attempted (e / skipped)</Text>
                </View>
              )}
              {a.flag !== 'ok' && a.confidence !== 99 && (
                <Text style={styles.flagLabel}>
                  {a.flag === 'blank' ? '⚠ blank' : '⚠ unclear'}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Raw OCR text — togglable for debugging */}
        {rawText ? (
          <TouchableOpacity onPress={() => setShowRaw((v) => !v)}>
            <Text style={styles.rawToggle}>
              {showRaw ? '▼ Hide raw OCR text' : '▶ Show raw OCR text'}
            </Text>
          </TouchableOpacity>
        ) : null}
        {showRaw && rawText ? (
          <View style={styles.rawBox}>
            <Text style={styles.rawText}>{rawText}</Text>
          </View>
        ) : null}

        <View style={styles.row2}>
          <TouchableOpacity style={styles.buttonAlt} onPress={handleRetake}>
            <Text style={styles.buttonTextAlt}>↩ Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleConfirm}>
            <Text style={styles.buttonText}>✓ Confirm Answers</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive In-App Cropper Modal */}
        <ImageCropperModal
          visible={cropModalVisible}
          imageUri={originalImageUri || imageUri}
          initialWidth={imageDims.width}
          initialHeight={imageDims.height}
          onCropComplete={async (croppedUri) => {
            setImageUri(croppedUri);
            await processImage(croppedUri);
          }}
          onClose={() => setCropModalVisible(false)}
        />
      </View>
    );
  }

  // ── Capture / processing state ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Student should write answers as a numbered list:{'\n'}
        <Text style={styles.example}>1. a   2. b   3. c   4. d</Text>
        {'\n'}You can crop the photo after taking it to focus strictly on the answers.
      </Text>

      <View style={styles.row2}>
        <TouchableOpacity style={styles.button} onPress={() => capture(true)} disabled={processing}>
          <Text style={styles.buttonText}>📷 Capture & Crop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonAlt} onPress={() => capture(false)} disabled={processing}>
          <Text style={styles.buttonTextAlt}>🖼️ Gallery & Crop</Text>
        </TouchableOpacity>
      </View>

      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" />
          <Text style={styles.processingText}>Reading handwriting…</Text>
        </View>
      )}

      {/* Interactive In-App Cropper Modal */}
      <ImageCropperModal
        visible={cropModalVisible}
        imageUri={originalImageUri || imageUri}
        initialWidth={imageDims.width}
        initialHeight={imageDims.height}
        onCropComplete={async (croppedUri) => {
          setImageUri(croppedUri);
          await processImage(croppedUri);
        }}
        onClose={() => setCropModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginVertical: 12 },
  hint: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  example: { fontFamily: 'monospace', color: '#1E3A8A', fontWeight: '600' },
  warn: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF9C3', padding: 8, borderRadius: 8 },

  // Capture buttons
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
  rowNotAttempt: { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
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
  badgeNotAttempt: { backgroundColor: '#F1F5F9', borderColor: '#94A3B8' },
  badgeText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  badgeTextFilled: { color: '#fff' },
  badgeTextNotAttempt: { color: '#475569', fontWeight: '800' },
  confidencePill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },
  notAttemptPill: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notAttemptPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  flagLabel: { fontSize: 11, color: '#B45309', marginLeft: 4 },
  flagLabelNotAttempt: { color: '#4B5563', fontStyle: 'italic' },

  // Image Card
  imageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
  },
  imageThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  imageCardInfo: { flex: 1 },
  imageCardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  imageCardSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  imageCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  imageCropBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageCropBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  imageChangeBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  imageChangeBtnText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },

  // Raw OCR debug
  rawToggle: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  rawBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
  },
  rawText: { fontSize: 11, color: '#4B5563', fontFamily: 'monospace' },
});
