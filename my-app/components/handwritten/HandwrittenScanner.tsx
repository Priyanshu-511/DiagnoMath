import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { parseAnswerText } from '@/lib/handwritten/parseAnswerText';
import { DetectedAnswer } from '@/lib/omr/types';

interface Props {
  questionCount: number;
  onScanned: (detected: DetectedAnswer[]) => void;
  onError: (message: string) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/** Convert a 0-based option index to its display letter, or '—' for null. */
function optionLabel(opt: 0 | 1 | 2 | 3 | null): string {
  return opt !== null ? OPTION_LABELS[opt] : '—';
}

export default function HandwrittenScanner({ questionCount, onScanned, onError }: Props) {
  const [processing, setProcessing] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);

  /** Cycle through A → B → C → D → blank for a given row */
  const cycleOption = (qIdx: number) => {
    if (!answers) return;
    setAnswers((prev) =>
      (prev ?? []).map((a) => {
        if (a.questionIndex !== qIdx) return a;
        const next = a.selectedOption === null ? 0 : ((a.selectedOption + 1) % 5);
        const opt = next === 4 ? null : (next as 0 | 1 | 2 | 3);
        return { ...a, selectedOption: opt, flag: 'ok' };
      }),
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
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 1 });

      if (result.canceled) return;

      setProcessing(true);
      const uri = result.assets[0].uri;

      // On-device OCR — no network required
      const recognition = await TextRecognition.recognize(uri);
      const text = recognition.text ?? '';
      setRawText(text);

      const parsed = parseAnswerText(text, questionCount);
      setAnswers(parsed);
    } catch (err: any) {
      onError(err?.message ?? 'Could not recognise the handwritten answers');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (answers) onScanned(answers);
  };

  const handleRetake = () => {
    setAnswers(null);
    setRawText(null);
    setShowRaw(false);
  };

  // ── Preview / edit table ────────────────────────────────────────────────────
  if (answers) {
    const blanks = answers.filter((a) => a.flag === 'blank').length;
    const multiples = answers.filter((a) => a.flag === 'multiple').length;

    return (
      <View style={styles.container}>
        <Text style={styles.hint}>
          Tap any answer to cycle through A → B → C → D → blank.
        </Text>

        {(blanks > 0 || multiples > 0) && (
          <Text style={styles.warn}>
            {blanks > 0 ? `${blanks} blank` : ''}
            {blanks > 0 && multiples > 0 ? ', ' : ''}
            {multiples > 0 ? `${multiples} unclear` : ''} — fix before saving.
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
      </View>
    );
  }

  // ── Capture / processing state ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Student should write answers as a numbered list:{'\n'}
        <Text style={styles.example}>1. a   2. b   3. c   4. d</Text>
        {'\n'}Photograph the paper in good, even light.
      </Text>

      <View style={styles.row2}>
        <TouchableOpacity style={styles.button} onPress={() => capture(true)} disabled={processing}>
          <Text style={styles.buttonText}>📷 Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonAlt} onPress={() => capture(false)} disabled={processing}>
          <Text style={styles.buttonTextAlt}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {processing && (
        <View style={styles.processing}>
          <ActivityIndicator color="#3B82F6" />
          <Text style={styles.processingText}>Reading handwriting…</Text>
        </View>
      )}
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
