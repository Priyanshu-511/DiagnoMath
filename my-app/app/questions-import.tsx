import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickAndParseQuestionFile } from '@/lib/questions/parseImport';
import { saveBank } from '@/lib/questions/store';
import { enrichQuestionsWithBertTiny } from '@/lib/qmatrix';

export default function ImportQuestionsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<null | {
    fileName: string;
    count: number;
    errors: string[];
    taggedCount: number;
  }>(null);

  const handleImport = async () => {
    setError('');
    setSummary(null);
    setLoading(true);
    try {
      const { fileName, questions, errors } = await pickAndParseQuestionFile();
      if (!fileName) return; // user canceled the picker
      if (questions.length === 0) {
        setError(errors[0] ?? 'No valid questions found in the file');
        return;
      }

      // Auto-tag questions with cognitive skills using offline prajjwal1/bert-tiny
      const { enriched, taggedCount } = enrichQuestionsWithBertTiny(questions);

      await saveBank({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: fileName,
        importedAt: new Date().toISOString(),
        questions: enriched,
      });

      setSummary({ fileName, count: enriched.length, errors, taggedCount });
    } catch (err: any) {
      setError(err?.message ?? 'Import failed');
    } finally {
      setLoading(false);
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
      <Text style={styles.heading}>Import Questions</Text>
      <Text style={styles.hint}>
        CSV or Excel with columns: topic, question, optionA, optionB, optionC, optionD, answer
        (A–D, 1-4, or the exact option text).{'\n\n'}
        For DINA diagnosis, add skill columns: skill:LCD, skill:NumOp, skill:Simplify, etc. (1 = required, 0 = not)
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleImport} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Importing…' : 'Pick CSV / Excel File'}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginTop: 16 }} color="#3B82F6" />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {summary && (
        <>
          <Text style={styles.summaryTitle}>Imported "{summary.fileName}"</Text>
          <Text style={styles.summaryText}>{summary.count} questions saved</Text>
          {summary.taggedCount > 0 && (
            <View style={styles.bertBadge}>
              <Text style={styles.bertBadgeText}>
                ⚡ prajjwal1/bert-tiny auto-tagged {summary.taggedCount} questions with A1–A12 cognitive skills for DINA diagnosis
              </Text>
            </View>
          )}
          {summary.errors.length > 0 && (
            <>
              <Text style={styles.warn}>{summary.errors.length} row(s) skipped:</Text>
              {summary.errors.slice(0, 5).map((e, i) => (
                <Text key={i} style={styles.warnItem}>
                  • {e}
                </Text>
              ))}
            </>
          )}
          <TouchableOpacity style={styles.button} onPress={() => router.push('/tests-create')}>
            <Text style={styles.buttonText}>Create a Test from this →</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A' },
  hint: { fontSize: 13, color: '#4B5563' },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  error: { color: '#DC2626', fontSize: 13 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A8A', marginTop: 12 },
  summaryText: { fontSize: 14, color: '#166534' },
  warn: { fontSize: 13, color: '#B45309', marginTop: 8, fontWeight: '600' },
  warnItem: { fontSize: 12, color: '#B45309' },
  bertBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  bertBadgeText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
    lineHeight: 16,
  },
});
