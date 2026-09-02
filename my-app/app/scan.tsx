import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import BubbleScanner from '@/components/omr/BubbleScanner';
import { Diagnosis, analyzeScan } from '@/lib/diagnosis/analyze';
import { DetectedAnswer } from '@/lib/omr/types';
import { getBank } from '@/lib/questions/store';
import { saveResult } from '@/lib/results/store';
import { TestTemplate } from '@/lib/tests/types';
import { listTests } from '@/lib/tests/store';

export default function ScanScreen() {
  const [tests, setTests] = useState<TestTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listTests().then(setTests);
  }, []);

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  const handleScanned = async (detected: DetectedAnswer[]) => {
    if (!selected) return;
    setError('');
    try {
      const bank = await getBank(selected.bankId);
      if (!bank) throw new Error('The question bank for this test was deleted');
      setDiagnosis(analyzeScan(selected, bank, detected));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to grade the scan');
    }
  };

  const handleSave = async () => {
    if (!selected || !diagnosis) return;
    if (!studentName.trim()) {
      setError("Enter the student's name");
      return;
    }
    setSaving(true);
    try {
      await saveResult({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        testId: selected.id,
        testName: selected.name,
        studentName: studentName.trim(),
        score: diagnosis.score,
        totalQuestions: diagnosis.totalQuestions,
        percent: diagnosis.percent,
        topicBreakdown: diagnosis.topicBreakdown,
        weakTopics: diagnosis.weakTopics,
        flaggedQuestions: diagnosis.flaggedQuestions,
        scannedAt: new Date().toISOString(),
      });
      router.push('/results');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Scan Answer Sheet</Text>

      {!selected ? (
        <>
          <Text style={styles.label}>Pick a test</Text>
          {tests.length === 0 ? (
            <Text style={styles.hint}>No tests yet — create one first.</Text>
          ) : (
            tests.map((t) => (
              <TouchableOpacity key={t.id} style={styles.item} onPress={() => setSelectedId(t.id)}>
                <Text style={styles.itemText}>
                  {t.name} ({t.questionIds.length} questions)
                </Text>
              </TouchableOpacity>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={styles.testLabel}>
            {selected.name} · {selected.questionIds.length} questions
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Student name"
            value={studentName}
            onChangeText={setStudentName}
          />

          {!diagnosis && (
            <BubbleScanner
              questionCount={selected.questionIds.length}
              onScanned={handleScanned}
              onError={setError}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {diagnosis && (
            <View style={styles.result}>
              <Text style={styles.resultScore}>
                {diagnosis.score}/{diagnosis.totalQuestions} ({diagnosis.percent}%)
              </Text>

              {diagnosis.flaggedQuestions.length > 0 && (
                <Text style={styles.warn}>
                  Check by hand: Q{diagnosis.flaggedQuestions.join(', Q')} (blank or unclear mark)
                </Text>
              )}

              <Text style={styles.subheading}>Topic breakdown</Text>
              {diagnosis.topicBreakdown.map((t) => (
                <Text key={t.topic} style={t.percent < 60 ? styles.weak : styles.ok}>
                  {t.topic}: {t.correct}/{t.total} ({t.percent}%)
                </Text>
              ))}

              {diagnosis.weakTopics.length > 0 && (
                <Text style={styles.weakSummary}>Weak areas: {diagnosis.weakTopics.join(', ')}</Text>
              )}

              <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Result'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryButton} onPress={() => setDiagnosis(null)}>
                <Text style={styles.retryText}>Rescan</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#1E3A8A' },
  hint: { fontSize: 13, color: '#4B5563' },
  item: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#BEF264',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  itemText: { fontSize: 14, color: '#1E3A8A' },
  testLabel: { fontSize: 16, fontWeight: '700', color: '#1E3A8A' },
  input: {
    borderWidth: 1,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: { color: '#DC2626', fontSize: 13 },
  result: { marginTop: 12, gap: 6 },
  resultScore: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
  subheading: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginTop: 10 },
  weak: { fontSize: 13, color: '#DC2626' },
  ok: { fontSize: 13, color: '#166534' },
  weakSummary: { fontSize: 13, fontWeight: '600', color: '#B45309', marginTop: 8 },
  warn: { fontSize: 12, color: '#B45309' },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  retryButton: { alignItems: 'center', marginTop: 8 },
  retryText: { color: '#3B82F6', fontWeight: '600' },
});
