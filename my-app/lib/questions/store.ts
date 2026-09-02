import AsyncStorage from '@react-native-async-storage/async-storage';

import { QuestionBank } from './types';

const BANKS_KEY = 'diagnomath:questions:banks:v1';

async function readBanks(): Promise<QuestionBank[]> {
  try {
    const raw = await AsyncStorage.getItem(BANKS_KEY);
    return raw ? (JSON.parse(raw) as QuestionBank[]) : [];
  } catch (err) {
    console.error('Failed to read question banks:', err);
    return [];
  }
}

async function writeBanks(banks: QuestionBank[]): Promise<void> {
  await AsyncStorage.setItem(BANKS_KEY, JSON.stringify(banks));
}

export async function listBanks(): Promise<QuestionBank[]> {
  return readBanks();
}

export async function getBank(id: string): Promise<QuestionBank | null> {
  const banks = await readBanks();
  return banks.find((b) => b.id === id) ?? null;
}

export async function saveBank(bank: QuestionBank): Promise<void> {
  const banks = await readBanks();
  await writeBanks([...banks, bank]);
}

export async function deleteBank(id: string): Promise<void> {
  const banks = await readBanks();
  await writeBanks(banks.filter((b) => b.id !== id));
}
