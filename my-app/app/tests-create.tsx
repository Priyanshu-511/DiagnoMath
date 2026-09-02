import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { MAX_QUESTIONS_PER_SHEET } from '@/lib/omr/layout';
import { QuestionBank } from '@/lib/questions/types';
import { listBanks } from '@/lib/questions/store';
import { saveTest } from '@/lib/tests/store';

export default function CreateTestScreen() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [countText, setCountText] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listBanks().then(setBanks);
  }, []);

  const selectedBank = banks.find((b) => b.id === selectedBankId) ?? null;

  const handleCreate = async () => {
    setError('');
    if (!selectedBank) {
      setError('Pick a question bank first');
      return;
    }
    if (!testName.trim()) {
      setError('Give the test a name');
      return;
    }

    const total = selectedBank.questions.length;
    const count = countText.trim() ? parseInt(countText, 10) : Math.min(total, MAX_QUESTIONS_PER_SHEET);

    if (isNaN(count) || count < 1) {
      setError('Enter a valid number of questions');
      return;
    }
    if (count > MAX_QUESTIONS_PER_SHEET) {
      setError(`Max ${MAX_QUESTIONS_PER_SHEET} questions per sheet — make two tests for more`);
      return;
    }
    if (count > total) {
      setError(`This bank only has ${total} questions`);
      return;
    }

    let pool = [...selectedBank.questions];
    if (shuffle) pool = pool.sort(() => Math.random() - 0.5);
    const chosen = pool.slice(0, count);

    await saveTest({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: testName.trim(),
      bankId: selectedBank.id,
      questionIds: chosen.map((q) => q.id),
      createdAt: new Date().toISOString(),
    });

    router.push('/tests-sheet');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Create Test</Text>

      <Text style={styles.label}>Question Bank</Text>
      {banks.length === 0 ? (
        <Text style={styles.hint}>No question banks yet — import one first.</Text>
      ) : (
        banks.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.optionItem, selectedBankId === b.id && styles.optionItemSelected]}
            onPress={() => setSelectedBankId(b.id)}
          >
            <Text style={styles.optionText}>
              {b.name} ({b.questions.length} questions)
            </Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.label}>Test Name</Text>
      <TextInput
        style={styles.input}
        value={testName}
        onChangeText={setTestName}
        placeholder="e.g. Fractions Unit Test"
      />

      <Text style={styles.label}>Number of Questions (max {MAX_QUESTIONS_PER_SHEET})</Text>
      <TextInput
        style={styles.input}
        value={countText}
        onChangeText={setCountText}
        placeholder={`Default: all (up to ${MAX_QUESTIONS_PER_SHEET})`}
        keyboardType="number-pad"
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Shuffle question order</Text>
        <Switch value={shuffle} onValueChange={setShuffle} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Test</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F0FDF4', gap: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1E3A8A', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#1E3A8A', marginTop: 12 },
  hint: { fontSize: 13, color: '#4B5563' },
  optionItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#BEF264',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  optionItemSelected: { borderColor: '#3B82F6', borderWidth: 2 },
  optionText: { fontSize: 14, color: '#1E3A8A' },
  input: {
    borderWidth: 1,
    borderColor: '#BEF264',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    marginTop: 6,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
