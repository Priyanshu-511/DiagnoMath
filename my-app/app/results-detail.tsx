import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanResult } from '@/lib/results/types';
import { getResult } from '@/lib/results/store';

export default function ResultDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    if (id) getResult(id).then(setResult);
  }, [id]);

  if (!result) {
    return <Text style={styles.hint}>Loading…</Text>;
  }

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
      <Text style={styles.heading}>{result.studentName}</Text>
      <Text style={styles.sub}>
        {result.testName} · {new Date(result.scannedAt).toLocaleDateString()}
      </Text>
      <Text style={styles.score}>
        {result.score}/{result.totalQuestions} ({result.percent}%)
      </Text>

      {result.flaggedQuestions.length > 0 && (
        <Text style={styles.warn}>
          Check by hand: Q{result.flaggedQuestions.join(', Q')} (blank or unclear mark on the sheet)
        </Text>
      )}

      <Text style={styles.subheading}>Topic Breakdown</Text>
      {result.topicBreakdown.map((t) => (
        <View key={t.topic} style={styles.topicRow}>
          <Text style={t.percent < 60 ? styles.weakText : styles.okText}>
            {t.topic}: {t.correct}/{t.total} ({t.percent}%)
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${t.percent}%`, backgroundColor: t.percent < 60 ? '#DC2626' : '#22C55E' },
              ]}
            />
          </View>
        </View>
      ))}

      {result.weakTopics.length > 0 && (
        <View style={styles.diagnosisBox}>
          <Text style={styles.diagnosisTitle}>Diagnosis</Text>
          <Text style={styles.diagnosisText}>
            {result.studentName} needs more practice in: {result.weakTopics.join(', ')}.
          </Text>
        </View>
      )}

      {/* Question Details Section */}
      {result.questionDetails && result.questionDetails.length > 0 && (
        <View style={styles.qdSection}>
          <Text style={styles.subheading}>Question Details & Answer Review</Text>
          {result.questionDetails.map((qd) => (
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
                    ? '✅ Correct'
                    : qd.isNotAttempt
                    ? '⚪ Not Attempted'
                    : '❌ Incorrect'}
                </Text>
                {qd.subtopic && (
                  <View style={styles.qdSubtopicPill}>
                    <Text style={styles.qdSubtopicPillText}>{qd.subtopic}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.qdText}>{qd.questionText}</Text>

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

              {/* All choices for quick review */}
              {qd.options && qd.options.length > 0 && (
                <View style={styles.qdOptionGrid}>
                  {qd.options.map((optText, optIdx) => {
                    const optLetter = ['A', 'B', 'C', 'D'][optIdx];
                    const isSelected = qd.chosenOption === optIdx;
                    const isTheCorrectOne = qd.correctOption === optIdx;
                    return (
                      <View
                        key={optIdx}
                        style={[
                          styles.qdOptChoice,
                          isTheCorrectOne && styles.qdOptChoiceCorrect,
                          isSelected && !isTheCorrectOne && styles.qdOptChoiceWrong,
                        ]}
                      >
                        <Text
                          style={[
                            styles.qdOptChoiceText,
                            isTheCorrectOne && styles.qdOptChoiceTextCorrect,
                            isSelected && !isTheCorrectOne && styles.qdOptChoiceTextWrong,
                          ]}
                        >
                          {optLetter}. {optText}
                          {isTheCorrectOne ? ' ✓' : isSelected ? ' ✗' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {result.dina && (
        <View style={styles.dinaBox}>
          <Text style={styles.dinaTitle}>🧠 Cognitive Analysis & Subtopic Mastery</Text>
          <Text style={styles.dinaProfile}>{result.dina.profileLabel}</Text>
          <Text style={styles.dinaDetail}>
            Likelihood: {result.dina.likelihood.toFixed(3)} · Margin: ≈
            {result.dina.marginOverRunnerUp === Infinity
              ? '∞'
              : result.dina.marginOverRunnerUp > 1000
              ? '>1000x'
              : `${result.dina.marginOverRunnerUp}x`}{' '}
            more likely than runner-up
          </Text>

          <Text style={styles.dinaSkillHeading}>Chapter Subtopic Mastery</Text>
          <View style={styles.skillBadges}>
            {result.dina.profile.map((sm) => (
              <View key={sm.skill} style={[styles.skillBadge, sm.mastered ? styles.skillBadgeOk : styles.skillBadgeWeak]}>
                <Text style={[styles.skillBadgeText, sm.mastered ? styles.skillBadgeTextOk : styles.skillBadgeTextWeak]}>
                  {sm.mastered ? '✅' : '❌'} {sm.skill}
                </Text>
              </View>
            ))}
          </View>

          {result.dina.weakSkills.length > 0 && (
            <Text style={styles.dinaWeakSummary}>
              Needs practice: {result.dina.weakSkills.join(', ')}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 6 },
  hint: { fontSize: 13, color: '#4B5563', padding: 24 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  sub: { fontSize: 13, color: '#4B5563', marginBottom: 8 },
  score: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },
  warn: { fontSize: 12, color: '#B45309', marginBottom: 8 },
  subheading: { fontSize: 15, fontWeight: '700', color: '#1E3A8A', marginTop: 8, marginBottom: 4 },
  topicRow: { marginBottom: 10 },
  weakText: { fontSize: 13, color: '#DC2626', marginBottom: 4 },
  okText: { fontSize: 13, color: '#166534', marginBottom: 4 },
  barTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  diagnosisBox: {
    marginTop: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
  },
  diagnosisTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  diagnosisText: { fontSize: 13, color: '#92400E' },
  dinaBox: {
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  dinaTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A8A', marginBottom: 4 },
  dinaProfile: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  dinaDetail: { fontSize: 12, color: '#4B5563', marginBottom: 4 },
  dinaSkillHeading: { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginTop: 4 },
  skillBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  skillBadgeOk: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  skillBadgeWeak: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  skillBadgeText: { fontSize: 13, fontWeight: '600' },
  skillBadgeTextOk: { color: '#166534' },
  skillBadgeTextWeak: { color: '#991B1B' },
  dinaWeakSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 8,
  },

  /* Question Details & Review */
  qdSection: { marginTop: 16, gap: 10 },
  qdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 8,
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
  qdNumber: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  qdSubtopicPill: {
    backgroundColor: '#E0E7FF',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  qdSubtopicPillText: { fontSize: 11, fontWeight: '600', color: '#3730A3' },
  qdText: { fontSize: 13, color: '#334155', lineHeight: 19 },
  qdAnswerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  qdAnswerPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qdAnswerPillCorrect: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qdAnswerLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  qdAnswerVal: { fontSize: 12, fontWeight: '700' },
  qdValOk: { color: '#166534' },
  qdValWrong: { color: '#DC2626' },
  qdValNotAttempt: { color: '#6B7280', fontStyle: 'italic' },
  qdValCorrect: { fontSize: 12, fontWeight: '700', color: '#166534' },

  qdOptionGrid: { marginTop: 6, gap: 4 },
  qdOptChoice: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qdOptChoiceCorrect: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  qdOptChoiceWrong: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  qdOptChoiceText: { fontSize: 12, color: '#475569' },
  qdOptChoiceTextCorrect: { fontWeight: '700', color: '#166534' },
  qdOptChoiceTextWrong: { fontWeight: '700', color: '#DC2626' },
});
