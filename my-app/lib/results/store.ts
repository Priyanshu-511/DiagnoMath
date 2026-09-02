import AsyncStorage from '@react-native-async-storage/async-storage';

import { ScanResult } from './types';

const RESULTS_KEY = 'diagnomath:results:v1';

async function readResults(): Promise<ScanResult[]> {
  try {
    const raw = await AsyncStorage.getItem(RESULTS_KEY);
    return raw ? (JSON.parse(raw) as ScanResult[]) : [];
  } catch (err) {
    console.error('Failed to read results:', err);
    return [];
  }
}

async function writeResults(results: ScanResult[]): Promise<void> {
  await AsyncStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

export async function listResults(): Promise<ScanResult[]> {
  return readResults();
}

export async function listResultsForTest(testId: string): Promise<ScanResult[]> {
  const results = await readResults();
  return results.filter((r) => r.testId === testId);
}

export async function getResult(id: string): Promise<ScanResult | null> {
  const results = await readResults();
  return results.find((r) => r.id === id) ?? null;
}

export async function saveResult(result: ScanResult): Promise<void> {
  const results = await readResults();
  await writeResults([...results, result]);
}

export async function deleteResult(id: string): Promise<void> {
  const results = await readResults();
  await writeResults(results.filter((r) => r.id !== id));
}
