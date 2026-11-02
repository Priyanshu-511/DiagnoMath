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
  '6': 1, // lower loop of 'b'
  ß: 1,

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
  const clean = raw.trim().toLowerCase().replace(/[.,;:!]+$/, '');
  if (OCR_CHAR_MAP[clean] !== undefined) {
    return OCR_CHAR_MAP[clean];
  }
  return null;
}

/**
 * Normalizes text for comparison by keeping only alphanumeric and slash/dot characters.
 */
function cleanNorm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9/.]/g, '');
}

/**
 * Matches written text (e.g. "2/3", "Proper fraction", "0.75") against the expected
 * options of a specific question.
 */
function matchWrittenValueToOption(written: string, options: string[]): 0 | 1 | 2 | 3 | null {
  if (!options || options.length === 0) return null;

  const normW = cleanNorm(written);
  if (!normW) return null;

  // 1. Exact normalized match (e.g. '2/3' === '2/3', 'proper' === 'proper')
  for (let idx = 0; idx < options.length && idx < 4; idx++) {
    if (normW === cleanNorm(options[idx])) {
      return idx as 0 | 1 | 2 | 3;
    }
  }

  // 2. Word-level token match (e.g. written "Proper" matches "Proper fraction")
  const writtenWords = written.toLowerCase().match(/[a-z0-9/.]+/g);
  if (!writtenWords || writtenWords.length === 0) return null;

  const scores = [0, 0, 0, 0];
  for (let idx = 0; idx < options.length && idx < 4; idx++) {
    const optWords = new Set(options[idx].toLowerCase().match(/[a-z0-9/.]+/g) || []);
    for (const w of writtenWords) {
      if (optWords.has(w)) {
        scores[idx]++;
      }
    }
  }

  let maxScore = 0;
  let bestIdx: number | null = null;
  let isTie = false;

  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > maxScore) {
      maxScore = scores[i];
      bestIdx = i;
      isTie = false;
    } else if (scores[i] > 0 && scores[i] === maxScore) {
      isTie = true;
    }
  }

  if (maxScore > 0 && !isTie && bestIdx !== null) {
    return bestIdx as 0 | 1 | 2 | 3;
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
 *   3. Option text value matching:
 *      - 1. 2/3, 2. Proper fraction, 3. 0.75
 *   4. Two-column & multi-column layouts:
 *      - 1. A   6. B
 *        2. B   7. C
 *   5. Inline lists & line-by-line number-letter splits:
 *      - 1.a, 2.b, 3.c, 4.d
 *   6. Bare sequential letter lists:
 *      - A, B, C, D, A, B...
 *   7. Robust OCR misread tolerance:
 *      - 8 → B, 4 → A, ( → C, 0 → D
 *
 * @param rawText Full text from on-device ML Kit text recognition
 * @param questionCount Number of questions on the test
 * @param expectedOptionsByQuestion Optional array of option strings per question for value matching
 * @returns Array of DetectedAnswer objects
 */
export function parseAnswerText(
  rawText: string,
  questionCount: number,
  expectedOptionsByQuestion?: string[][],
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
  // Matches: "1. A", "Q1: B", "Ans 1 - C", "1) D", "1 A", "No 1: B", "1. 2/3", "1. Proper"
  // Lookahead enables parsing two-column / multi-column lines without skipping secondary columns
  const explicitPattern =
    /(?:(?:q(?:uestion)?|ans(?:wer)?|no\.?)\s*)?(\d{1,2})\s*[\.\)\:\-\=\s]+([a-zA-Z0-9^@/\(\[\{][^\n\r,;|\t]*?)(?=(?:\s{2,}|\s*(?:q(?:uestion)?|ans(?:wer)?|no\.?)?\d{1,2}[\.\)\:\-\=]|$))/gi;

  let match: RegExpExecArray | null;
  while ((match = explicitPattern.exec(normalized)) !== null) {
    const qNum = parseInt(match[1], 10);
    const qIdx = qNum - 1;

    if (qIdx >= 0 && qIdx < questionCount) {
      const rest = match[2].trim();
      if (!rest) continue;

      // 1. Check if first token is a single option letter
      const firstTok = rest.split(/\s+/)[0];
      const optFromLetter = tokenToOption(firstTok);
      if (optFromLetter !== null) {
        hitsPerQuestion.get(qIdx)!.push(optFromLetter);
      } else if (expectedOptionsByQuestion && expectedOptionsByQuestion[qIdx]) {
        // 2. Check if the written string matches an option value (e.g. "2/3" or "Proper")
        const optFromValue = matchWrittenValueToOption(rest, expectedOptionsByQuestion[qIdx]);
        if (optFromValue !== null) {
          hitsPerQuestion.get(qIdx)!.push(optFromValue);
        }
      }
    }
  }

  // ── Strategy 2: Line-by-line columnar fallback ────────────────────────────
  // Some OCR layouts split numbers and answers onto adjacent lines
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const lineNumMatch = lines[i].match(/^(?:q)?(\d{1,2})[\.\)\:]?$/i);
    if (lineNumMatch) {
      const qNum = parseInt(lineNumMatch[1], 10);
      const qIdx = qNum - 1;
      if (qIdx >= 0 && qIdx < questionCount && hitsPerQuestion.get(qIdx)!.length === 0) {
        const nextToken = lines[i + 1].trim();
        const optFromLetter = tokenToOption(nextToken.split(/\s+/)[0]);
        if (optFromLetter !== null) {
          hitsPerQuestion.get(qIdx)!.push(optFromLetter);
        } else if (expectedOptionsByQuestion && expectedOptionsByQuestion[qIdx]) {
          const optFromValue = matchWrittenValueToOption(nextToken, expectedOptionsByQuestion[qIdx]);
          if (optFromValue !== null) {
            hitsPerQuestion.get(qIdx)!.push(optFromValue);
          }
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
      // Loose fallback search for this specific question number
      const qNum = i + 1;
      const looseRegex = new RegExp(
        `(?:^|\\b|q)${qNum}\\s*[:.\\-)\\s=]+([a-dA-D048^@oO(\\{\\[\\]]|[^\\s,;|\\n\\r]+)`,
        'i'
      );
      const looseMatch = normalized.match(looseRegex);
      let recovered = false;
      if (looseMatch) {
        const tok = looseMatch[1].trim();
        const optLetter = tokenToOption(tok);
        if (optLetter !== null) {
          answers[i] = { questionIndex: i, selectedOption: optLetter, flag: 'ok', confidence: 80 };
          recovered = true;
        } else if (expectedOptionsByQuestion && expectedOptionsByQuestion[i]) {
          const valOpt = matchWrittenValueToOption(tok, expectedOptionsByQuestion[i]);
          if (valOpt !== null) {
            answers[i] = { questionIndex: i, selectedOption: valOpt, flag: 'ok', confidence: 80 };
            recovered = true;
          }
        }
      }
      if (!recovered) {
        answers[i] = { questionIndex: i, selectedOption: null, flag: 'blank' };
      }
    } else if (hits.length === 1) {
      answers[i] = { questionIndex: i, selectedOption: hits[0], flag: 'ok', confidence: 95 };
    } else {
      // Check if all hits for this question agree on the same letter
      const allSame = hits.every((h) => h === hits[0]);
      if (allSame) {
        answers[i] = { questionIndex: i, selectedOption: hits[0], flag: 'ok', confidence: 90 };
      } else {
        // Vote among candidates to select the most probable option
        const voteCounts = [0, 0, 0, 0];
        hits.forEach((h) => voteCounts[h]++);
        let maxVotes = 0;
        let bestOpt: 0 | 1 | 2 | 3 = hits[0];
        for (let c = 0; c < 4; c++) {
          if (voteCounts[c] > maxVotes) {
            maxVotes = voteCounts[c];
            bestOpt = c as 0 | 1 | 2 | 3;
          }
        }
        answers[i] = { questionIndex: i, selectedOption: bestOpt, flag: 'multiple', confidence: 60 };
      }
    }
  }

  return answers;
}
