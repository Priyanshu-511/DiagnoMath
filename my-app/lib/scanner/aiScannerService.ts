/**
 * aiScannerService.ts
 *
 * Connector for optional external Hugging Face AI Vision models:
 *   1. ibm-granite/granite-docling-258M (Handwritten & Document OCR)
 *   2. Flova/omr_transformer (Vision Transformer OMR)
 *
 * For a standalone, lightweight offline smartphone APK:
 *   - Remote AI is disabled by default (IS_REMOTE_AI_ENABLED = false).
 *   - All scanning runs 100% on-device (Google ML Kit on-device OCR + local Canvas OMR).
 *   - Set EXPO_PUBLIC_AI_SCANNER_URL only if connecting to an external server.
 */

import { Platform } from 'react-native';
import { DetectedAnswer } from '@/lib/omr/types';

export const AI_SCANNER_URL = process.env.EXPO_PUBLIC_AI_SCANNER_URL || '';
export const IS_REMOTE_AI_ENABLED = Boolean(AI_SCANNER_URL);

/**
 * Scan handwritten answers using ibm-granite/granite-docling-258M if server configured.
 */
export async function scanWithGraniteDocling(
  imageUri: string,
  questionCount: number
): Promise<{ answers: DetectedAnswer[]; rawText: string; model: string }> {
  if (!IS_REMOTE_AI_ENABLED) {
    throw new Error('Remote AI scanner not configured; using on-device engine');
  }

  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    formData.append('image', blob, 'handwriting.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      name: 'handwriting.jpg',
      type: 'image/jpeg',
    } as any);
  }

  formData.append('question_count', String(questionCount));

  const res = await fetch(`${AI_SCANNER_URL}/scan/ocr`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Granite OCR server error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    answers: data.answers as DetectedAnswer[],
    rawText: data.rawText || '',
    model: data.model || 'ibm-granite/granite-docling-258M',
  };
}

/**
 * Scan OMR bubble sheet using Flova/omr_transformer if server configured.
 */
export async function scanWithOmrTransformer(
  imageUri: string,
  questionCount: number
): Promise<{ answers: DetectedAnswer[]; model: string }> {
  if (!IS_REMOTE_AI_ENABLED) {
    throw new Error('Remote AI scanner not configured; using on-device engine');
  }

  const formData = new FormData();

  if (Platform.OS === 'web') {
    const blob = await fetch(imageUri).then((r) => r.blob());
    formData.append('image', blob, 'omr.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      name: 'omr.jpg',
      type: 'image/jpeg',
    } as any);
  }

  formData.append('question_count', String(questionCount));

  const res = await fetch(`${AI_SCANNER_URL}/scan/omr`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OMR Transformer server error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    answers: data.answers as DetectedAnswer[],
    model: data.model || 'Flova/omr_transformer',
  };
}
