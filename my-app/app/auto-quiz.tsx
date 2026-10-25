import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Question } from '@/lib/questions/types';
import { generateQuiz, ALL_TOPICS } from '@/lib/quiz/generate';
import { saveBank } from '@/lib/questions/store';
import { saveTest } from '@/lib/tests/store';
import { generateQuestionPaperHtml, generateAnswerSheetHtml } from '@/lib/omr/sheetHtml';
import { TestTemplate } from '@/lib/tests/types';
import { QuestionBank } from '@/lib/questions/types';

const QUESTION_COUNTS = [5, 10, 15, 20];

export default function AutoQuizScreen() {
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [savedTest, setSavedTest] = useState<{ test: TestTemplate; bank: QuestionBank } | null>(null);

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'paper' | 'sheet' | null>(null);
  const [error, setError] = useState('');

  const toggleTopic = (topic: string) =>
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );

  // ── Step 1: generate questions ──────────────────────────────────────
  const handleGenerate = () => {
    setError('');
    setSavedTest(null);
    const qs = generateQuiz({ count: questionCount, topics: selectedTopics });
    if (qs.length === 0) {
      setError('No questions available for the selected topics. Try selecting more topics.');
      return;
    }
    setQuestions(qs);
  };

  // ── Step 2: save as QuestionBank + TestTemplate ─────────────────────
  const handleSave = async () => {
    if (!questions) return;
    setSaving(true);
    setError('');
    try {
      const timestamp = Date.now();
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const bankId = `autoquiz-bank-${timestamp}-${suffix}`;
      const testId = `autoquiz-test-${timestamp}-${suffix}`;
      const testName = `Auto Quiz ${new Date().toLocaleDateString('en-IN')} (${questions.length}Q)`;

      const bank: QuestionBank = {
        id: bankId,
        name: testName,
        importedAt: new Date().toISOString(),
        questions,
      };
      const test: TestTemplate = {
        id: testId,
        name: testName,
        bankId,
        questionIds: questions.map((q) => q.id),
        createdAt: new Date().toISOString(),
      };

      await saveBank(bank);
      await saveTest(test);
      setSavedTest({ test, bank });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 3a: share question paper PDF (questions + options, NO answers) ──
  const shareQuestionPaper = async () => {
    if (!savedTest) return;
    setError('');
    setBusy('paper');
    try {
      const html = generateQuestionPaperHtml(savedTest.test, savedTest.bank);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate PDF');
    } finally {
      setBusy(null);
    }
  };

  // ── Step 3b: share OMR bubble answer sheet PDF ──────────────────────
  const shareAnswerSheet = async () => {
    if (!savedTest) return;
    setError('');
    setBusy('sheet');
    try {
      const html = generateAnswerSheetHtml(savedTest.test);
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate PDF');
    } finally {
      setBusy(null);
    }
  };

  const resetAll = () => {
    setQuestions(null);
    setSavedTest(null);
    setError('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>🎲 Auto Quiz Generator</Text>
      <Text style={styles.subtitle}>Class 6–7 Mathematics</Text>

      {/* ── Step 1: Configure ──────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Number of questions</Text>
      <View style={styles.chipRow}>
        {QUESTION_COUNTS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, n === questionCount && styles.chipActive]}
            onPress={() => setQuestionCount(n)}
          >
            <Text style={[styles.chipText, n === questionCount && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>
        Topics{' '}
        <Text style={styles.sectionHint}>(none selected = all topics mixed)</Text>
      </Text>
      <View style={styles.chipRow}>
        {ALL_TOPICS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, selectedTopics.includes(t) && styles.chipActive]}
            onPress={() => toggleTopic(t)}
          >
            <Text style={[styles.chipText, selectedTopics.includes(t) && styles.chipTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerate}>
        <Text style={styles.primaryBtnText}>Generate Quiz</Text>
      </TouchableOpacity>

      {/* ── Step 2: Save ───────────────────────────────────────────── */}
      {questions && !savedTest && (
        <View style={styles.generatedBox}>
          <Text style={styles.generatedTitle}>
            ✅ {questions.length} questions generated
          </Text>
          <Text style={styles.generatedDesc}>
            Topics covered:{' '}
            {Array.from(new Set(questions.map((q) => q.topic))).join(', ')}
          </Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Save & Prepare for Scanning</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.regenerateBtn} onPress={handleGenerate}>
            <Text style={styles.regenerateBtnText}>🔄 Regenerate different questions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 3: Share PDFs + navigate to scan ──────────────────── */}
      {savedTest && (
        <View style={styles.readyBox}>
          <Text style={styles.readyTitle}>🎉 Quiz ready!</Text>
          <Text style={styles.readyDesc}>
            "{savedTest.test.name}" has been saved. Share the sheets below, then
            scan the student's filled sheet as usual.
          </Text>

          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={shareQuestionPaper}
            disabled={busy !== null}
          >
            {busy === 'paper' ? (
              <ActivityIndicator color="#1E3A8A" />
            ) : (
              <Text style={styles.pdfBtnText}>📄 Share Question Paper</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={shareAnswerSheet}
            disabled={busy !== null}
          >
            {busy === 'sheet' ? (
              <ActivityIndicator color="#1E3A8A" />
            ) : (
              <Text style={styles.pdfBtnText}>⭕ Share OMR Bubble Sheet</Text>
            )}
          </TouchableOpacity>

          <View style={styles.scanRow}>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => router.push('/scan' as any)}
            >
              <Text style={styles.scanBtnText}>⬛ Scan OMR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => router.push('/handwritten-scan' as any)}
            >
              <Text style={styles.scanBtnText}>✏️ Handwritten</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.newQuizBtn} onPress={resetAll}>
            <Text style={styles.newQuizBtnText}>New Quiz</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 10, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { fontSize: 13, color: '#4B5563', marginTop: -4, marginBottom: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1E3A8A', marginTop: 4 },
  sectionHint: { fontWeight: '400', color: '#6B7280' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: '#A3E635', borderColor: '#65A30D' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#1E3A8A' },
  error: { color: '#DC2626', fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  generatedBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#BEF264',
    gap: 10,
    marginTop: 4,
  },
  generatedTitle: { fontSize: 15, fontWeight: '700', color: '#166534' },
  generatedDesc: { fontSize: 12, color: '#4B5563' },
  saveBtn: {
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  regenerateBtn: { alignItems: 'center' },
  regenerateBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 13 },
  readyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    gap: 10,
    marginTop: 4,
  },
  readyTitle: { fontSize: 16, fontWeight: '800', color: '#1E3A8A' },
  readyDesc: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  pdfBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pdfBtnText: { color: '#1E3A8A', fontWeight: '700', fontSize: 14 },
  scanRow: { flexDirection: 'row', gap: 10 },
  scanBtn: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  newQuizBtn: { alignItems: 'center', marginTop: 2 },
  newQuizBtnText: { color: '#3B82F6', fontWeight: '600', fontSize: 13 },
});
