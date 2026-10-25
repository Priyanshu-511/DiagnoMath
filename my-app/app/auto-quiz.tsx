import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Question } from '@/lib/questions/types';
import { generateQuiz, ALL_TOPICS } from '@/lib/quiz/generate';
import { saveResult } from '@/lib/results/store';
import { runDINA, QMatrixRow } from '@/lib/diagnosis/dina';
import { TopicBreakdown } from '@/lib/diagnosis/analyze';

// ─── types ──────────────────────────────────────────────────────────────
type Phase = 'setup' | 'quiz' | 'result';

const QUESTION_COUNTS = [5, 10, 15, 20];

// ─── helpers ────────────────────────────────────────────────────────────
function gradeQuiz(
  questions: Question[],
  answers: (number | null)[]
): {
  score: number;
  percent: number;
  topicBreakdown: TopicBreakdown[];
  weakTopics: string[];
  flaggedQuestions: number[];
  dina?: ReturnType<typeof runDINA>;
} {
  const topicMap = new Map<string, { correct: number; total: number }>();
  const flagged: number[] = [];
  let correct = 0;

  const responses: (0 | 1)[] = [];
  const qMatrixRows: QMatrixRow[] = [];
  let hasSkills = false;

  questions.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === null) flagged.push(idx + 1);

    const isCorrect = chosen !== null && chosen === q.correctIndex;
    if (isCorrect) correct++;

    const stat = topicMap.get(q.topic) ?? { correct: 0, total: 0 };
    stat.total++;
    if (isCorrect) stat.correct++;
    topicMap.set(q.topic, stat);

    responses.push(isCorrect ? 1 : 0);
    if (q.skills && Object.keys(q.skills).length > 0) {
      hasSkills = true;
      qMatrixRows.push({ questionId: q.id, required: q.skills as Record<string, 0 | 1> });
    } else {
      qMatrixRows.push({ questionId: q.id, required: {} });
    }
  });

  const topicBreakdown: TopicBreakdown[] = Array.from(topicMap.entries()).map(
    ([topic, s]) => ({
      topic,
      correct: s.correct,
      total: s.total,
      percent: Math.round((s.correct / s.total) * 100),
    })
  );

  const weakTopics = topicBreakdown.filter((t) => t.percent < 60).map((t) => t.topic);

  let dina: ReturnType<typeof runDINA> | undefined;
  if (hasSkills) {
    const skillSet = new Set<string>();
    for (const row of qMatrixRows) {
      for (const sk of Object.keys(row.required)) skillSet.add(sk);
    }
    const skills = Array.from(skillSet).sort().slice(0, 12);
    if (skills.length > 0) dina = runDINA({ skills, qMatrix: qMatrixRows, responses });
  }

  return {
    score: correct,
    percent: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
    topicBreakdown,
    weakTopics,
    flaggedQuestions: flagged,
    dina,
  };
}

// ─── screen ─────────────────────────────────────────────────────────────
export default function AutoQuizScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [studentName, setStudentName] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<ReturnType<typeof gradeQuiz> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── setup ──────────────────────────────────────────────────────────
  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const startQuiz = () => {
    if (!studentName.trim()) {
      setError("Enter the student's name");
      return;
    }
    setError('');
    const qs = generateQuiz({ count: questionCount, topics: selectedTopics });
    if (qs.length === 0) {
      setError('No questions available for the selected topics. Try selecting more.');
      return;
    }
    setQuestions(qs);
    setAnswers(new Array(qs.length).fill(null));
    setPhase('quiz');
  };

  // ── quiz ───────────────────────────────────────────────────────────
  const choose = (qIdx: number, optIdx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
  };

  const submitQuiz = () => {
    const graded = gradeQuiz(questions, answers);
    setResult(graded);
    setPhase('result');
  };

  // ── result ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveResult({
        id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        testId: 'auto-quiz',
        testName: `Auto Quiz (${questionCount}Q)`,
        studentName: studentName.trim(),
        score: result.score,
        totalQuestions: questions.length,
        percent: result.percent,
        topicBreakdown: result.topicBreakdown,
        weakTopics: result.weakTopics,
        flaggedQuestions: result.flaggedQuestions,
        scannedAt: new Date().toISOString(),
        ...(result.dina ? { dina: result.dina } : {}),
      });
      router.push('/results');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save result');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setPhase('setup');
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setError('');
  };

  // ── render ─────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>🎲 Auto Quiz Generator</Text>
      <Text style={styles.subtitle}>Class 6–7 Mathematics</Text>

      {/* ── SETUP ───────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Student name"
            value={studentName}
            onChangeText={setStudentName}
          />

          {/* Question count */}
          <Text style={styles.sectionLabel}>Number of questions</Text>
          <View style={styles.chipRow}>
            {QUESTION_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, n === questionCount && styles.chipActive]}
                onPress={() => setQuestionCount(n)}
              >
                <Text style={[styles.chipText, n === questionCount && styles.chipTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Topic filter */}
          <Text style={styles.sectionLabel}>
            Topics{' '}
            <Text style={styles.sectionHint}>(leave all unselected for mixed)</Text>
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

          <TouchableOpacity style={styles.primaryBtn} onPress={startQuiz}>
            <Text style={styles.primaryBtnText}>Start Quiz ▶</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── QUIZ ────────────────────────────────────────────────────── */}
      {phase === 'quiz' && (
        <>
          <Text style={styles.quizMeta}>
            {studentName} · {questions.length} questions
          </Text>
          <Text style={styles.quizProgress}>
            Answered: {answers.filter((a) => a !== null).length}/{questions.length}
          </Text>

          {questions.map((q, qi) => (
            <View key={q.id} style={styles.qCard}>
              <Text style={styles.qNumber}>Q{qi + 1}</Text>
              <Text style={styles.qTopic}>{q.topic}</Text>
              <Text style={styles.qText}>{q.text}</Text>
              <View style={styles.optionsCol}>
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                      onPress={() => choose(qi, oi)}
                    >
                      <View style={[styles.optionCircle, selected && styles.optionCircleSelected]}>
                        <Text style={[styles.optionLetter, selected && styles.optionLetterSelected]}>
                          {String.fromCharCode(65 + oi)}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.primaryBtn} onPress={submitQuiz}>
            <Text style={styles.primaryBtnText}>Submit & See Results ✓</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── RESULT ──────────────────────────────────────────────────── */}
      {phase === 'result' && result && (
        <>
          {/* Score card */}
          <View style={styles.scoreCard}>
            <Text style={styles.scoreName}>{studentName}</Text>
            <Text style={styles.scoreMain}>
              {result.score}/{questions.length}
            </Text>
            <Text style={styles.scorePercent}>{result.percent}%</Text>
            <Text style={[styles.scoreGrade, result.percent >= 60 ? styles.pass : styles.fail]}>
              {result.percent >= 80
                ? '🌟 Excellent'
                : result.percent >= 60
                ? '✅ Pass'
                : '⚠️ Needs Improvement'}
            </Text>
          </View>

          {/* Question-by-question review */}
          <Text style={styles.sectionLabel}>Review</Text>
          {questions.map((q, qi) => {
            const chosen = answers[qi];
            const correct = q.correctIndex;
            const isCorrect = chosen === correct;
            return (
              <View
                key={q.id}
                style={[styles.reviewCard, isCorrect ? styles.reviewOk : styles.reviewWrong]}
              >
                <Text style={styles.reviewQ}>
                  Q{qi + 1}: {q.text}
                </Text>
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const isAns = correct === oi;
                  return (
                    <Text
                      key={oi}
                      style={[
                        styles.reviewOpt,
                        isAns && styles.reviewCorrectOpt,
                        isChosen && !isAns && styles.reviewWrongOpt,
                      ]}
                    >
                      {String.fromCharCode(65 + oi)}. {opt}
                      {isAns ? ' ✓' : ''}
                      {isChosen && !isAns ? ' ✗' : ''}
                    </Text>
                  );
                })}
              </View>
            );
          })}

          {/* Topic breakdown */}
          <Text style={styles.sectionLabel}>Topic Breakdown</Text>
          {result.topicBreakdown.map((t) => (
            <Text key={t.topic} style={t.percent < 60 ? styles.weak : styles.ok}>
              {t.topic}: {t.correct}/{t.total} ({t.percent}%)
            </Text>
          ))}

          {result.weakTopics.length > 0 && (
            <Text style={styles.weakSummary}>
              Weak areas: {result.weakTopics.join(', ')}
            </Text>
          )}

          {/* DINA */}
          {result.dina && (
            <View style={styles.dinaBox}>
              <Text style={styles.dinaTitle}>🧠 DINA Cognitive Diagnosis</Text>
              <Text style={styles.dinaProfile}>{result.dina.profileLabel}</Text>
              <Text style={styles.dinaDetail}>
                Likelihood: {result.dina.likelihood.toFixed(3)} · Margin: ≈
                {result.dina.marginOverRunnerUp === Infinity
                  ? '∞'
                  : result.dina.marginOverRunnerUp > 1000
                  ? '>1000x'
                  : `${result.dina.marginOverRunnerUp}x`}{' '}
                more likely
              </Text>
              <View style={styles.skillBadges}>
                {result.dina.profile.map((sm) => (
                  <View
                    key={sm.skill}
                    style={[styles.skillBadge, sm.mastered ? styles.skillBadgeOk : styles.skillBadgeWeak]}
                  >
                    <Text
                      style={[
                        styles.skillBadgeText,
                        sm.mastered ? styles.skillBadgeTextOk : styles.skillBadgeTextWeak,
                      ]}
                    >
                      {sm.mastered ? '✅' : '❌'} {sm.skill}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save Result'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={resetAll}>
            <Text style={styles.secondaryBtnText}>New Quiz</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 10, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  subtitle: { fontSize: 13, color: '#4B5563', marginTop: -4, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#1E3A8A', marginTop: 6 },
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
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { alignItems: 'center', marginTop: 6 },
  secondaryBtnText: { color: '#3B82F6', fontWeight: '600', fontSize: 14 },
  /* Quiz */
  quizMeta: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  quizProgress: { fontSize: 12, color: '#6B7280' },
  qCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  qNumber: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  qTopic: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qText: { fontSize: 14, color: '#111827', lineHeight: 20, fontWeight: '500' },
  optionsCol: { gap: 8 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  optionBtnSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  optionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCircleSelected: { backgroundColor: '#3B82F6' },
  optionLetter: { fontSize: 13, fontWeight: '700', color: '#374151' },
  optionLetterSelected: { color: '#ffffff' },
  optionText: { fontSize: 13, color: '#374151', flex: 1 },
  optionTextSelected: { color: '#1E40AF', fontWeight: '600' },
  /* Result */
  scoreCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  scoreName: { fontSize: 14, color: '#93C5FD', fontWeight: '600' },
  scoreMain: { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  scorePercent: { fontSize: 18, color: '#BEF264', fontWeight: '700' },
  scoreGrade: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  pass: { color: '#A3E635' },
  fail: { color: '#FCA5A5' },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
    gap: 4,
  },
  reviewOk: { borderLeftColor: '#22C55E' },
  reviewWrong: { borderLeftColor: '#EF4444' },
  reviewQ: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4 },
  reviewOpt: { fontSize: 12, color: '#6B7280' },
  reviewCorrectOpt: { color: '#166534', fontWeight: '700' },
  reviewWrongOpt: { color: '#DC2626', fontWeight: '600' },
  weak: { fontSize: 13, color: '#DC2626' },
  ok: { fontSize: 13, color: '#166534' },
  weakSummary: { fontSize: 13, fontWeight: '600', color: '#B45309', marginTop: 4 },
  dinaBox: {
    marginTop: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  dinaTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 4 },
  dinaProfile: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  dinaDetail: { fontSize: 12, color: '#4B5563' },
  skillBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  skillBadgeOk: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  skillBadgeWeak: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  skillBadgeText: { fontSize: 13, fontWeight: '600' },
  skillBadgeTextOk: { color: '#166534' },
  skillBadgeTextWeak: { color: '#991B1B' },
});

