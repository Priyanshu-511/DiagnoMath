import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

import { Question } from './types';

export interface ParseResult {
  fileName: string;
  questions: Question[];
  errors: string[];
}

/**
 * Expected columns (any case/spacing, order doesn't matter):
 * topic, question, optionA, optionB, optionC, optionD, answer
 * `answer` accepts A/B/C/D, 1-4, or the exact option text.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  topic: ['topic', 'subject', 'category'],
  question: ['question', 'questiontext', 'text', 'q'],
  optionA: ['optiona', 'a', 'choicea'],
  optionB: ['optionb', 'b', 'choiceb'],
  optionC: ['optionc', 'c', 'choicec'],
  optionD: ['optiond', 'd', 'choiced'],
  answer: ['answer', 'correct', 'correctanswer', 'key'],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_]/g, '');
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeKey(h) }));
  const map: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = normalized.find((h) => aliases.includes(h.norm));
    if (match) map[field] = match.raw;
  }
  return map;
}

function parseAnswerToIndex(raw: string, options: string[]): 0 | 1 | 2 | 3 | null {
  const v = raw.trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(v)) return 'ABCD'.indexOf(v) as 0 | 1 | 2 | 3;
  if (['1', '2', '3', '4'].includes(v)) return (parseInt(v, 10) - 1) as 0 | 1 | 2 | 3;
  const idx = options.findIndex((o) => o.trim().toLowerCase() === v.toLowerCase());
  return idx >= 0 ? (idx as 0 | 1 | 2 | 3) : null;
}

function rowsToQuestions(rows: Record<string, string>[]): { questions: Question[]; errors: string[] } {
  if (rows.length === 0) return { questions: [], errors: ['File is empty'] };

  const headerMap = buildHeaderMap(Object.keys(rows[0]));
  const required = ['topic', 'question', 'optionA', 'optionB', 'optionC', 'optionD', 'answer'];
  const missing = required.filter((f) => !headerMap[f]);
  if (missing.length > 0) {
    return { questions: [], errors: [`Missing column(s): ${missing.join(', ')}`] };
  }

  const questions: Question[] = [];
  const errors: string[] = [];

  rows.forEach((row, i) => {
    const topic = String(row[headerMap.topic] ?? '').trim();
    const text = String(row[headerMap.question] ?? '').trim();
    const options: [string, string, string, string] = [
      String(row[headerMap.optionA] ?? '').trim(),
      String(row[headerMap.optionB] ?? '').trim(),
      String(row[headerMap.optionC] ?? '').trim(),
      String(row[headerMap.optionD] ?? '').trim(),
    ];
    const answerRaw = String(row[headerMap.answer] ?? '').trim();

    if (!topic || !text || options.some((o) => !o) || !answerRaw) {
      errors.push(`Row ${i + 2}: missing a required field, skipped`);
      return;
    }

    const correctIndex = parseAnswerToIndex(answerRaw, options);
    if (correctIndex === null) {
      errors.push(`Row ${i + 2}: answer "${answerRaw}" doesn't match any option, skipped`);
      return;
    }

    questions.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      topic,
      text,
      options,
      correctIndex,
    });
  });

  return { questions, errors };
}

/**
 * Read a file as a UTF-8 string — works on both web and native.
 *
 * On web  : fetch() handles blob: and file: URIs from DocumentPicker.
 * On native: expo-file-system is lazily imported so the web bundle
 *            never references the native module at all.
 */
async function readAsText(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.text();
  }
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/**
 * Read a file as a base64-encoded string — works on both web and native.
 *
 * On web  : fetch() → arrayBuffer → btoa().
 * On native: expo-file-system lazy import.
 */
async function readAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function pickAndParseQuestionFile(): Promise<ParseResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: [
      'text/csv',
      'text/comma-separated-values',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    copyToCacheDirectory: true,
  });

  if (picked.canceled) {
    return { fileName: '', questions: [], errors: [] };
  }

  const asset = picked.assets[0];
  const isCsv = asset.name.toLowerCase().endsWith('.csv');

  let rows: Record<string, string>[];
  if (isCsv) {
    const text = await readAsText(asset.uri);
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    rows = parsed.data as Record<string, string>[];
  } else {
    const base64 = await readAsBase64(asset.uri);
    const workbook = XLSX.read(base64, { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as Record<
      string,
      string
    >[];
  }

  const { questions, errors } = rowsToQuestions(rows);
  return { fileName: asset.name, questions, errors };
}
