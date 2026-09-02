import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getBank } from '@/lib/questions/store';
import { generateAnswerSheetHtml, generateQuestionPaperHtml } from '@/lib/omr/sheetHtml';
import { TestTemplate } from '@/lib/tests/types';
import { listTests } from '@/lib/tests/store';

export default function TestsSheetScreen() {
  const [tests, setTests] = useState<TestTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'answer' | 'paper' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listTests().then(setTests);
  }, []);

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  const share = async (kind: 'answer' | 'paper') => {
    if (!selected) return;
    setError('');
    setBusy(kind);
    try {
      const bank = await getBank(selected.bankId);
      if (!bank) throw new Error('The question bank for this test was deleted');

      const html = kind === 'answer' ? generateAnswerSheetHtml(selected) : generateQuestionPaperHtml(selected, bank);
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Print / Share Test Sheets</Text>

      {tests.length === 0 ? (
        <Text style={styles.hint}>No tests yet — create one first.</Text>
      ) : (
        tests.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.item, selectedId === t.id && styles.itemSelected]}
            onPress={() => setSelectedId(t.id)}
          >
            <Text style={styles.itemText}>
              {t.name} ({t.questionIds.length} questions)
            </Text>
          </TouchableOpacity>
        ))
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {selected && (
        <View style={{ marginTop: 20, gap: 12 }}>
          <TouchableOpacity style={styles.button} onPress={() => share('paper')} disabled={busy !== null}>
            <Text style={styles.buttonText}>{busy === 'paper' ? 'Generating…' : '📄 Question Paper'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => share('answer')} disabled={busy !== null}>
            <Text style={styles.buttonText}>{busy === 'answer' ? 'Generating…' : '⭕ Answer / Bubble Sheet'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {busy && <ActivityIndicator style={{ marginTop: 16 }} color="#3B82F6" />}
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
  itemSelected: { borderColor: '#3B82F6', borderWidth: 2 },
  itemText: { fontSize: 14, color: '#1E3A8A' },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
