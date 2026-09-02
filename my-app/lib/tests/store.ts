import AsyncStorage from '@react-native-async-storage/async-storage';

import { TestTemplate } from './types';

const TESTS_KEY = 'diagnomath:tests:v1';

async function readTests(): Promise<TestTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(TESTS_KEY);
    return raw ? (JSON.parse(raw) as TestTemplate[]) : [];
  } catch (err) {
    console.error('Failed to read tests:', err);
    return [];
  }
}

async function writeTests(tests: TestTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TESTS_KEY, JSON.stringify(tests));
}

export async function listTests(): Promise<TestTemplate[]> {
  return readTests();
}

export async function getTest(id: string): Promise<TestTemplate | null> {
  const tests = await readTests();
  return tests.find((t) => t.id === id) ?? null;
}

export async function saveTest(test: TestTemplate): Promise<void> {
  const tests = await readTests();
  await writeTests([...tests, test]);
}

export async function deleteTest(id: string): Promise<void> {
  const tests = await readTests();
  await writeTests(tests.filter((t) => t.id !== id));
}
