import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ScanResult } from '@/lib/results/types';
import { getResult } from '@/lib/results/store';

export default function ResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    if (id) getResult(id).then(setResult);
  }, [id]);

  if (!result) {
    return <Text style={styles.hint}>Loading…</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
});
