import { DetectedAnswer } from '@/lib/omr/types';

/**
 * Common OCR misreads — normalize a single character to the
 * option letter it was most likely meant to be.
 *
 *   Handwriting / OCR confusions:
 *     0 / O → could be D or a stray zero
 *     8     → B (round shapes)
 *     l / I / | / 1 → not an option letter, skip
 *     ( / {  → C (round left bracket misread)
 */
function normalizeOcrChar(ch: string): string {
  switch (ch) {
    // Digits that look like letters
    case '0': return 'o';   // handled below as 'd' candidate or discarded
    case '8': return 'b';
    // Bracket misreads
    case '(': return 'c';
    case '{': return 'c';
    // Otherwise keep as-is
    default: return ch;
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
    // 'o' from OCR is ambiguous — could be misread 'a' or 'd'.
    // Default to null so it gets flagged for manual review.
    default:  return null;
  }
}

/**
 * Pre-clean the raw OCR text to fix the most common scanning artefacts
 * before the regex parser runs.
 *
 *   - Collapse multiple spaces / tabs into one
 *   - Normalize various dash/hyphen unicode characters
 *   - Strip stray punctuation that is clearly noise (e.g. `|`, `\`)
 */
function cleanOcrText(raw: string): string {
  return raw
    // Normalize unicode dashes / hyphens
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    // Collapse whitespace (but keep newlines)
    .replace(/[^\S\n]+/g, ' ')
    // Strip characters that are never meaningful in this context
    .replace(/[|\\[\]{}]/g, '')
    .trim();
}

/**
 * Parse raw OCR text produced by reading a handwritten answer sheet.
 *
 * Accepted student formats:
 *   1. a   2. b   3. c   4. d       (inline, any separator)
 *   1. a                             (one per line)
 *   2) B
 *   3:c
 *   4 D
 *   a, b, c, d                      (bare sequential letters)
 *
 * OCR misread tolerance:
 *   - `8` → B, `(` → C, `0` → flagged for review
 *   - Case-insensitive
 *   - Flexible separators: `.` `)` `:` `-` or whitespace
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

  const text = cleanOcrText(rawText);
  if (!text) return answers;

  // Track hits per question (to detect duplicates → 'multiple')
  const hitCount = new Array<number>(questionCount).fill(0);

  // ── Strategy 1: explicit "number + separator + letter" patterns ──────
  //    Matches: 1. a  |  2) B  |  3:C  |  4-d  |  5 a  |  10.D
  //    Also handles OCR digits that look like letters (8→B, 0→?)
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
  //    Only used when Strategy 1 found nothing at all — e.g. student
  //    just wrote "a b c d a b c a" across the page.
  const hasAnyExplicit = hitCount.some((c) => c > 0);
  if (!hasAnyExplicit) {
    // Split on any whitespace/commas/newlines and keep single option chars
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
