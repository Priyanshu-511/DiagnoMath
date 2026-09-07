import { DetectedAnswer } from '@/lib/omr/types';

/**
 * Maps a single letter token (a/b/c/d) to a 0-based option index.
 * Returns null for anything that isn't a recognised option letter.
 */
function letterToOption(token: string): 0 | 1 | 2 | 3 | null {
  switch (token.trim().toLowerCase()) {
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
 * Expected student format:
 *   1. a   2. b   3. c   4. d
 * or on separate lines:
 *   1. a
 *   2. b
 *
 * Tolerates various separators between the question number and the answer
 * letter: `.` `)` `:` or plain whitespace.  Both upper- and lower-case
 * option letters are accepted.
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
    flag: 'blank',
  }));

  if (!rawText.trim()) return answers;

  // Track how many times a question number has been matched (to detect 'multiple')
  const hitCount = new Array<number>(questionCount).fill(0);

  // Strategy 1: explicit "N[.):] X" patterns
  // Matches things like:  1. a   2) B   3:C   4 d
  const explicitRe = /\b(\d+)\s*[.):\s]\s*([a-dA-D])\b/g;
  let m: RegExpExecArray | null;

  while ((m = explicitRe.exec(rawText)) !== null) {
    const qNum = parseInt(m[1], 10);
    const qIdx = qNum - 1; // convert to 0-based
    if (qIdx < 0 || qIdx >= questionCount) continue;

    const option = letterToOption(m[2]);
    if (option === null) continue;

    hitCount[qIdx]++;
    if (hitCount[qIdx] === 1) {
      answers[qIdx] = { questionIndex: qIdx, selectedOption: option, flag: 'ok' };
    } else {
      // Second (or more) detection for the same question => flag it
      answers[qIdx] = { questionIndex: qIdx, selectedOption: null, flag: 'multiple' };
    }
  }

  // Strategy 2: bare sequential letters (one per line, no number prefix)
  // Only used when NO explicit patterns were found at all
  const hasAnyExplicit = hitCount.some((c) => c > 0);
  if (!hasAnyExplicit) {
    const tokens = rawText
      .split(/[\n\r,\s]+/)
      .map((t) => t.trim())
      .filter((t) => /^[a-dA-D]$/.test(t));

    tokens.slice(0, questionCount).forEach((token, idx) => {
      const option = letterToOption(token);
      if (option === null) return;
      answers[idx] = { questionIndex: idx, selectedOption: option, flag: 'ok' };
    });
  }

  return answers;
}
