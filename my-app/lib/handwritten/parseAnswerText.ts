import { DetectedAnswer } from '@/lib/omr/types';

/**
 * Character mapping for OCR handwriting misreads.
 * Recovers letters A, B, C, D from digits, curved symbols, and common OCR artifacts.
 */
const OCR_CHAR_MAP: Record<string, 0 | 1 | 2 | 3> = {
  // A variants
  a: 0,
  '4': 0, // '4' resembles handwritten 'A'
  '^': 0,
  '@': 0,
  '/\\': 0,
  h: 0,
  r: 0,

  // B variants
  b: 1,
  '8': 1, // '8' resembles handwritten 'B'
  '13': 1, // '13' resembles 'B'
  '|3': 1,
  '6': 1, // often read when lower loop of 'b' is heavy

  // C variants
  c: 2,
  '(': 2,
  '{': 2,
  '<': 2,
  '[': 2,
  g: 2,

  // D variants
  d: 3,
  '0': 3, // '0' resembles handwritten 'D'
  '|)': 3,
  ']': 3,
  o: 3,
  q: 3,
};

/**
 * Maps a single character token to a 0-based option index (A=0 … D=3).
 */
function tokenToOption(raw: string): 0 | 1 | 2 | 3 | null {
  const clean = raw.trim().toLowerCase();
  if (OCR_CHAR_MAP[clean] !== undefined) {
    return OCR_CHAR_MAP[clean];
  }
  return null;
}

/**
 * Comprehensive parser for raw OCR handwriting text.
 *
 * Handles:
 *   1. Standard numbered formats:
 *      - 1. A, 1) B, 1: C, 1- D, 1= A, 1 A
 *      - Q1. A, Q1: B, Q1 A, Ans 1: C, No. 1 A
 *   2. Bracketed answers:
 *      - 1. (A), 2. (B), 3. [C], 4. {D}
 *   3. Two-column & multi-column layouts:
 *      - 1. A   6. B
 *        2. B   7. C
 *   4. Inline lists:
 *      - 1.a, 2.b, 3.c, 4.d
 *   5. Bare sequential letter lists:
 *      - A, B, C, D, A, B...
 *   6. Robust OCR misread tolerance:
 *      - 8 → B, 4 → A, ( → C, 0 → D
 *
 * @param rawText Full text from on-device ML Kit text recognition
 * @param questionCount Number of questions on the test
 * @returns Array of DetectedAnswer objects
 */
export function parseAnswerText(
  rawText: string,
  questionCount: number,
): DetectedAnswer[] {
  const answers: DetectedAnswer[] = Array.from({ length: questionCount }, (_, i) => ({
    questionIndex: i,
    selectedOption: null,
    flag: 'blank' as const,
  }));

  if (!rawText || !rawText.trim()) return answers;

  // Track occurrences per question (to detect multiple / conflicting answers)
  const hitsPerQuestion = new Map<number, (0 | 1 | 2 | 3)[]>();
  for (let i = 0; i < questionCount; i++) {
    hitsPerQuestion.set(i, []);
  }

  // Pre-clean: strip brackets wrapping single answer tokens e.g. (A) -> A, [B] -> B
  const normalized = rawText
    .replace(/[\u2010-\u2015\u2212]/g, '-') // normalize unicode dashes
    .replace(/[\(\[\{]\s*([a-dA-D048^@oO])\s*[\)\]\}]/g, ' $1 ') // unwrap (A) -> A
    .replace(/\r/g, '\n');

  // ── Strategy 1: Explicit numbered pattern ──────────────────────────────────
  // Matches: "1. A", "Q1: B", "Ans 1 - C", "1) D", "1 A", "No 1: B"
  const explicitPattern = /(?:q(?:uestion)?|ans(?:wer)?|no\.?)?\s*(\d{1,2})\s*[\.\)\:\-\=\s]+\s*([a-dA-D048^@oO(\{\<\]])/gi;

  let match: RegExpExecArray | null;
  while ((match = explicitPattern.exec(normalized)) !== null) {
    const qNum = parseInt(match[1], 10);
    const qIdx = qNum - 1;

    if (qIdx >= 0 && qIdx < questionCount) {
      const opt = tokenToOption(match[2]);
      if (opt !== null) {
        hitsPerQuestion.get(qIdx)!.push(opt);
      }
    }
  }

  // ── Strategy 2: Line-by-line columnar fallback ────────────────────────────
  // Some OCR layouts split numbers and letters onto adjacent lines
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const lineNumMatch = lines[i].match(/^(?:q)?(\d{1,2})[\.\)\:]?$/i);
    if (lineNumMatch) {
      const qNum = parseInt(lineNumMatch[1], 10);
      const qIdx = qNum - 1;
      if (qIdx >= 0 && qIdx < questionCount && hitsPerQuestion.get(qIdx)!.length === 0) {
        const nextToken = lines[i + 1].trim();
        const opt = tokenToOption(nextToken);
        if (opt !== null) {
          hitsPerQuestion.get(qIdx)!.push(opt);
        }
      }
    }
  }

  // ── Strategy 3: Bare letter sequences (when no numbers are present) ────────
  let hasAnyHits = false;
  for (let i = 0; i < questionCount; i++) {
    if (hitsPerQuestion.get(i)!.length > 0) {
      hasAnyHits = true;
      break;
    }
  }

  if (!hasAnyHits) {
    // Student just wrote "A B C D B A C D..."
    const tokens = normalized
      .split(/[\s,;|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length === 1 && tokenToOption(t) !== null);

    tokens.slice(0, questionCount).forEach((tok, idx) => {
      const opt = tokenToOption(tok);
      if (opt !== null) {
        hitsPerQuestion.get(idx)!.push(opt);
      }
    });
  }

  // ── Build final DetectedAnswer array ───────────────────────────────────────
  for (let i = 0; i < questionCount; i++) {
    const hits = hitsPerQuestion.get(i)!;
    if (hits.length === 0) {
      answers[i] = { questionIndex: i, selectedOption: null, flag: 'blank' };
    } else if (hits.length === 1) {
      answers[i] = { questionIndex: i, selectedOption: hits[0], flag: 'ok' };
    } else {
      // Check if all hits for this question agree on the same letter
      const allSame = hits.every((h) => h === hits[0]);
      if (allSame) {
        answers[i] = { questionIndex: i, selectedOption: hits[0], flag: 'ok' };
      } else {
        answers[i] = { questionIndex: i, selectedOption: null, flag: 'multiple' };
      }
    }
  }

  return answers;
}
