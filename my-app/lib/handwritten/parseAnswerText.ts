import { DetectedAnswer } from '@/lib/omr/types';

/**
 * Normalize a single OCR character that is commonly misread.
 *   8 → b (round shapes), ( → c (open curve), 0 → o (ambiguous)
 */
function normalizeOcrChar(ch: string): string {
  switch (ch) {
    case '8': return 'b';
    case '(': return 'c';
    case '{': return 'c';
    default:  return ch;
  }
}

/**
 * Maps a single character token to a 0-based option index (A=0 … D=3).
 * Handles both clean input and common OCR misreads.
 */
function letterToOption(raw: string): 0 | 1 | 2 | 3 | null {
  const ch = normalizeOcrChar(raw.trim().toLowerCase());
  switch (ch) {
    case 'a': return 0;
    case 'b': return 1;
    case 'c': return 2;
    case 'd': return 3;
    default:  return null;
  }
}

/**
 * Parse raw OCR text produced by reading a handwritten answer sheet.
 *
 * Accepted formats:
 *   1. a   2. b   3. c   4. d       (inline, any separator)
 *   1. a                             (one per line)
 *   2) B   3:c   4-D   5 a          (flexible separators)
 *   a, b, c, d                      (bare sequential letters)
 *
 * OCR misread tolerance:
 *   8 → B, ( → C, case-insensitive
 *
 * @param rawText      Full text string returned by ML Kit (or typed manually).
 * @param questionCount Number of questions expected on the sheet.
 * @returns            One DetectedAnswer per question (0-based questionIndex).
 */
export function parseAnswerText(
  rawText: string,
  questionCount: number,
): DetectedAnswer[] {
  // Initialise all answers as blank
  const answers: DetectedAnswer[] = Array.from({ length: questionCount }, (_, i) => ({
    questionIndex: i,
    selectedOption: null,
    flag: 'blank' as const,
  }));

  // Clean the OCR text: collapse whitespace, strip noise characters
  const text = rawText
    .replace(/[\u2010-\u2015\u2212]/g, '-')   // normalize unicode dashes
    .replace(/[^\S\n]+/g, ' ')                // collapse horizontal whitespace
    .replace(/[|\\[\]{}]/g, '')               // strip noise characters
    .trim();

  if (!text) return answers;

  // Track hits per question (to detect duplicates → 'multiple')
  const hitCount = new Array<number>(questionCount).fill(0);

  // ── Strategy 1: explicit "number + separator + letter" patterns ──────
  //    Matches: 1. a | 2) B | 3:C | 4-d | 5 a | 10.D | 1.8(→1.B,C)
  const explicitRe = /(\d{1,2})\s*[.):\-\s]\s*([a-dA-D08(])/g;
  let m: RegExpExecArray | null;

  while ((m = explicitRe.exec(text)) !== null) {
    const qNum = parseInt(m[1], 10);
    const qIdx = qNum - 1;
    if (qIdx < 0 || qIdx >= questionCount) continue;

    const option = letterToOption(m[2]);
    if (option === null) continue;

    hitCount[qIdx]++;
    if (hitCount[qIdx] === 1) {
      answers[qIdx] = { questionIndex: qIdx, selectedOption: option, flag: 'ok' };
    } else {
      answers[qIdx] = { questionIndex: qIdx, selectedOption: null, flag: 'multiple' };
    }
  }

  // ── Strategy 2: bare sequential letters (no numbers) ────────────────
  //    Only used when Strategy 1 found nothing at all.
  const hasAnyExplicit = hitCount.some((c) => c > 0);
  if (!hasAnyExplicit) {
    const tokens = text
      .split(/[\n\r,\s]+/)
      .map((t) => t.trim())
      .filter((t) => /^[a-dA-D08(]$/.test(t));

    tokens.slice(0, questionCount).forEach((token, idx) => {
      const option = letterToOption(token);
      if (option === null) return;
      answers[idx] = { questionIndex: idx, selectedOption: option, flag: 'ok' };
    });
  }

  return answers;
}
