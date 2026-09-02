import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { ScanResult } from '@/lib/results/types';
import { listResults } from '@/lib/results/store';

export default function ResultsScreen() {
  const [results, setResults] = useState<ScanResult[]>([]);

  useEffect(() => {
    listResults().then((rs) => setResults(rs.slice().reverse()));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Results</Text>

      {results.length === 0 ? (
        <Text style={styles.hint}>No scans saved yet.</Text>
      ) : (
        results.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.item}
            onPress={() => router.push({ pathname: '/results-detail', params: { id: r.id } })}
          >
            <Text style={styles.itemTitle}>
              {r.studentName} — {r.testName}
            </Text>
            <Text style={styles.itemSub}>
              {r.score}/{r.totalQuestions} ({r.percent}%)
            </Text>
            {r.weakTopics.length > 0 && <Text style={styles.itemWeak}>Weak: {r.weakTopics.join(', ')}</Text>}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 10 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },
  hint: { fontSize: 13, color: '#4B5563' },
  item: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#BEF264',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  itemSub: { fontSize: 13, color: '#166534' },
  itemWeak: { fontSize: 12, color: '#B45309', marginTop: 2 },
});
