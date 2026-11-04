import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HandwrittenScanner from '@/components/handwritten/HandwrittenScanner';
import { Diagnosis, analyzeScan } from '@/lib/diagnosis/analyze';
import { DetectedAnswer } from '@/lib/omr/types';
import { QuestionBank } from '@/lib/questions/types';
import { getBank } from '@/lib/questions/store';
import { saveResult } from '@/lib/results/store';
import { TestTemplate } from '@/lib/tests/types';
import { listTests } from '@/lib/tests/store';

export default function HandwrittenScanScreen() {
  const insets = useSafeAreaInsets();
  const [tests, setTests] = useState<TestTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentBank, setCurrentBank] = useState<QuestionBank | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listTests().then(setTests);
  }, []);

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      getBank(selected.bankId).then((b) => setCurrentBank(b ?? null));
    } else {
      setCurrentBank(null);
    }
  }, [selected]);

  const expectedOptionsByQuestion = selected && currentBank
    ? selected.questionIds.map((qid) => {
        const q = currentBank.questions.find((item) => item.id === qid);
        return q ? q.options : [];
      })
    : undefined;

  const handleScanned = async (detected: DetectedAnswer[]) => {
    if (!selected) return;
    setError('');
    try {
      const bank = await getBank(selected.bankId);
      if (!bank) throw new Error('The question bank for this test was deleted');
      setDiagnosis(analyzeScan(selected, bank, detected));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to grade the answers');
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
        questionDetails: diagnosis.questionDetails,
        scannedAt: new Date().toISOString(),
        ...(diagnosis.dina ? { dina: diagnosis.dina } : {}),
      });
      router.push('/results');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom + 24, 32),
          paddingLeft: Math.max(insets.left, 24),
          paddingRight: Math.max(insets.right, 24),
        },
      ]}
    >
      <Text style={styles.heading}>✏️ Handwritten Answers</Text>
      <Text style={styles.subtitle}>
        For students who wrote answers as a numbered list (e.g. 1. a  2. b  3. c)
      </Text>

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
            placeholderTextColor="#9CA3AF"
            value={studentName}
            onChangeText={setStudentName}
          />

          {!diagnosis && (
            <HandwrittenScanner
              questionCount={selected.questionIds.length}
              expectedOptionsByQuestion={expectedOptionsByQuestion}
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
                  Check by hand: Q{diagnosis.flaggedQuestions.join(', Q')} (blank or unclear)
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

              {/* Question-level Right / Wrong Details */}
              {diagnosis.questionDetails && diagnosis.questionDetails.length > 0 && (
                <View style={styles.qdSection}>
                  <Text style={styles.subheading}>Question-by-Question Breakdown</Text>
                  {diagnosis.questionDetails.map((qd) => (
                    <View
                      key={qd.questionIndex}
                      style={[
                        styles.qdCard,
                        qd.isCorrect
                          ? styles.qdCardOk
                          : qd.isNotAttempt
                          ? styles.qdCardNotAttempt
                          : styles.qdCardWrong,
                      ]}
                    >
                      <View style={styles.qdCardTop}>
                        <Text style={styles.qdNumber}>
                          Q{qd.questionNumber}{' '}
                          {qd.isCorrect
                            ? '✅ Right'
                            : qd.isNotAttempt
                            ? '⚪ Not Attempted'
                            : '❌ Wrong'}
                        </Text>
                        {qd.subtopic && (
                          <View style={styles.qdSubtopicPill}>
                            <Text style={styles.qdSubtopicPillText}>{qd.subtopic}</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.qdText} numberOfLines={2}>
                        {qd.questionText}
                      </Text>

                      <View style={styles.qdAnswerRow}>
                        <View style={styles.qdAnswerPill}>
                          <Text style={styles.qdAnswerLabel}>Chosen:</Text>
                          <Text
                            style={[
                              styles.qdAnswerVal,
                              qd.isCorrect
                                ? styles.qdValOk
                                : qd.isNotAttempt
                                ? styles.qdValNotAttempt
                                : styles.qdValWrong,
                            ]}
                          >
                            {qd.isNotAttempt
                              ? 'Not Attempted (e / skipped)'
                              : `Option ${qd.chosenLabel}${
                                  qd.chosenOption !== null && qd.options[qd.chosenOption]
                                    ? ` (${qd.options[qd.chosenOption]})`
                                    : ''
                                }`}
                          </Text>
                        </View>

                        {!qd.isCorrect && (
                          <View style={styles.qdAnswerPillCorrect}>
                            <Text style={styles.qdAnswerLabel}>Correct:</Text>
                            <Text style={styles.qdValCorrect}>
                              Option {qd.correctLabel}
                              {qd.options[qd.correctOption]
                                ? ` (${qd.options[qd.correctOption]})`
                                : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {diagnosis.dina && (
                <View style={styles.dinaBox}>
                  <Text style={styles.dinaTitle}>🧠 Cognitive Analysis & Subtopic Mastery</Text>
                  <Text style={styles.dinaProfile}>{diagnosis.dina.profileLabel}</Text>
                  <View style={styles.skillBadges}>
                    {diagnosis.dina.profile.map((sm) => (
                      <View
                        key={sm.skill}
                        style={[styles.skillBadge, sm.mastered ? styles.skillBadgeOk : styles.skillBadgeWeak]}
                      >
                        <Text
                          style={[styles.skillBadgeText, sm.mastered ? styles.skillBadgeTextOk : styles.skillBadgeTextWeak]}
                        >
                          {sm.mastered ? '✅' : '❌'} {sm.skill}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save Result'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryButton} onPress={() => setDiagnosis(null)}>
                <Text style={styles.retryText}>Re-enter answers</Text>
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
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#4B5563', marginBottom: 8 },
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
    borderWidth: 1.5,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
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

  /* Question Details Section */
  qdSection: { marginTop: 12, gap: 8 },
  qdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  qdCardOk: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  qdCardWrong: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  qdCardNotAttempt: { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' },
  qdCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  qdNumber: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  qdSubtopicPill: {
    backgroundColor: '#E0E7FF',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  qdSubtopicPillText: { fontSize: 11, fontWeight: '600', color: '#3730A3' },
  qdText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  qdAnswerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  qdAnswerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qdAnswerPillCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qdAnswerLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  qdAnswerVal: { fontSize: 12, fontWeight: '700' },
  qdValOk: { color: '#166534' },
  qdValWrong: { color: '#DC2626' },
  qdValNotAttempt: { color: '#6B7280', fontStyle: 'italic' },
  qdValCorrect: { fontSize: 12, fontWeight: '700', color: '#166534' },

  dinaBox: {
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  dinaTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  dinaProfile: { fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  skillBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  skillBadgeOk: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  skillBadgeWeak: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  skillBadgeText: { fontSize: 12, fontWeight: '600' },
  skillBadgeTextOk: { color: '#166534' },
  skillBadgeTextWeak: { color: '#991B1B' },
});
