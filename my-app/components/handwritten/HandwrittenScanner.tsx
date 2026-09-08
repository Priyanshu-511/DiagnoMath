import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';

import { parseAnswerText } from '@/lib/handwritten/parseAnswerText';
import { DetectedAnswer } from '@/lib/omr/types';

interface Props {
  questionCount: number;
  onScanned: (detected: DetectedAnswer[]) => void;
  onError: (message: string) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function optionLabel(opt: 0 | 1 | 2 | 3 | null): string {
  return opt !== null ? OPTION_LABELS[opt] : '—';
}

/**
 * Build an HTML page that:
 *   1. Draws the image on a canvas.
 *   2. Converts every pixel to grayscale.
 *   3. Applies contrast stretching (histogram normalization).
 *   4. Posts the enhanced image back as a base64 data-URI.
 */
function buildGrayscaleHtml(base64DataUri: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0"><canvas id="c"></canvas>
<script>
  var img = new Image();
  img.onload = function () {
    var c = document.getElementById('c');
    c.width = img.width;
    c.height = img.height;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Grayscale conversion
    var d = ctx.getImageData(0, 0, c.width, c.height);
    var px = d.data;
    for (var i = 0; i < px.length; i += 4) {
      var g = Math.round(0.299*px[i] + 0.587*px[i+1] + 0.114*px[i+2]);
      px[i] = px[i+1] = px[i+2] = g;
    }

    // Contrast stretching
    var hist = new Array(256).fill(0);
    var total = c.width * c.height;
    for (var i = 0; i < px.length; i += 4) hist[px[i]]++;
    var cut = Math.floor(total * 0.01);
    var lo = 0, hi = 255, cum = 0;
    for (var v = 0; v < 256; v++) { cum += hist[v]; if (cum > cut) { lo = v; break; } }
    cum = 0;
    for (var v = 255; v >= 0; v--) { cum += hist[v]; if (cum > cut) { hi = v; break; } }
    var rng = hi - lo || 1;
    for (var i = 0; i < px.length; i += 4) {
      var s = Math.round(((px[i] - lo) / rng) * 255);
      s = Math.max(0, Math.min(255, s));
      px[i] = px[i+1] = px[i+2] = s;
    }
    ctx.putImageData(d, 0, 0);

    // Return the enhanced image as base64 JPEG
    window.ReactNativeWebView.postMessage(c.toDataURL('image/jpeg', 0.92));
  };
  img.onerror = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Failed to load image' }));
  };
  img.src = "${base64DataUri}";
</script></body></html>`;
}

export default function HandwrittenScanner({ questionCount, onScanned, onError }: Props) {
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [rawText, setRawText] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [answers, setAnswers] = useState<DetectedAnswer[] | null>(null);

  // Grayscale preprocessing state
  const [grayscaleHtml, setGrayscaleHtml] = useState<string | null>(null);
  const pendingResolveRef = useRef<((uri: string) => void) | null>(null);

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

  /** Handle the enhanced image returned from the grayscale WebView */
  const handleGrayscaleResult = (event: any) => {
    try {
      const data = event.nativeEvent.data;
      if (data.startsWith('{')) {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
      }
      if (pendingResolveRef.current) {
        pendingResolveRef.current(data);
        pendingResolveRef.current = null;
      }
    } catch (err: any) {
      onError(err?.message ?? 'Image preprocessing failed');
      setProcessing(false);
    }
    setGrayscaleHtml(null);
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
      setProcessingStep('Converting to grayscale…');

      const uri = result.assets[0].uri;

      // Get base64 of the original image
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { base64: true, format: ImageManipulator.SaveFormat.JPEG }
      );

      if (!manipulated.base64) throw new Error('Could not read image');

      // Convert to grayscale + contrast-enhance via hidden WebView canvas
      const enhancedDataUri = await new Promise<string>((resolve, reject) => {
        pendingResolveRef.current = resolve;
        const html = buildGrayscaleHtml(`data:image/jpeg;base64,${manipulated.base64}`);
        setGrayscaleHtml(html);
        // Safety timeout — if the WebView never responds
        setTimeout(() => {
          if (pendingResolveRef.current) {
            pendingResolveRef.current = null;
            reject(new Error('Image preprocessing timed out'));
          }
        }, 10000);
      });

      setProcessingStep('Reading handwriting…');

      // Save the enhanced image to a temp file for ML Kit
      const TextRecognition = (await import('@react-native-ml-kit/text-recognition')).default;
      const recognition = await TextRecognition.recognize(enhancedDataUri);
      const text = recognition.text ?? '';
      setRawText(text);

      const parsed = parseAnswerText(text, questionCount);
      setAnswers(parsed);
    } catch (err: any) {
      onError(err?.message ?? 'Could not recognise the handwritten answers');
    } finally {
      setProcessing(false);
      setProcessingStep('');
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
          <Text style={styles.processingText}>{processingStep || 'Processing…'}</Text>
        </View>
      )}

      {/* Hidden WebView for grayscale conversion */}
      {grayscaleHtml && (
        <WebView
          key={Date.now()}
          source={{ html: grayscaleHtml }}
          onMessage={handleGrayscaleResult}
          onError={() => {
            onError('Image preprocessing failed');
            setProcessing(false);
            setGrayscaleHtml(null);
          }}
          style={styles.hiddenWebView}
        />
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
