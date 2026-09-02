import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { pickAndParseQuestionFile } from '@/lib/questions/parseImport';
import { saveBank } from '@/lib/questions/store';

export default function ImportQuestionsScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<null | { fileName: string; count: number; errors: string[] }>(
    null
  );

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

      await saveBank({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: fileName,
        importedAt: new Date().toISOString(),
        questions,
      });

      setSummary({ fileName, count: questions.length, errors });
    } catch (err: any) {
      setError(err?.message ?? 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Import Questions</Text>
      <Text style={styles.hint}>
        CSV or Excel with columns: topic, question, optionA, optionB, optionC, optionD, answer
        (A–D, 1-4, or the exact option text)
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
});
