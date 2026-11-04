import { DetectedAnswer } from '@/lib/omr/types';
import {
  CharClassification,
  classifyToken,
  normalizeQuestionNumber,
} from './neuralCharScorer';

export interface MLKitRecognitionInput {
  text: string;
  blocks?: Array<{
    text: string;
    lines?: Array<{
      text: string;
      elements?: Array<{
        text: string;
        frame?: { left: number; top: number; width: number; height: number };
      }>;
      frame?: { left: number; top: number; width: number; height: number };
    }>;
  }>;
}

interface ParsedHit {
  option: 0 | 1 | 2 | 3 | null;
  isNotAttempt: boolean;
  confidence: number;
}

/**
 * Normalizes text for comparison by keeping only alphanumeric and slash/dot characters.
 */
function cleanNorm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\/.]/g, '');
}

/**
 * Normalizes fraction expressions, e.g. "3 / 4" or "3:4" -> "3/4"
 */
function normalizeFractionStr(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*[\/:]\s*/g, '/')
    .replace(/[^a-z0-9\/.]/g, ' ')
    .trim();
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

  // 2. Fraction normalized match (e.g. '3 / 4' === '3/4')
  const fracW = normalizeFractionStr(written);
  for (let idx = 0; idx < options.length && idx < 4; idx++) {
    if (fracW === normalizeFractionStr(options[idx])) {
      return idx as 0 | 1 | 2 | 3;
    }
  }

  // 3. Word-level token overlap
  const writtenWords = written.toLowerCase().match(/[a-z0-9\/.]+/g);
  if (!writtenWords || writtenWords.length === 0) return null;

  const scores = [0, 0, 0, 0];
  for (let idx = 0; idx < options.length && idx < 4; idx++) {
    const optWords = new Set(options[idx].toLowerCase().match(/[a-z0-9\/.]+/g) || []);
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
 * Extracts candidate text lines from either a raw string or an ML Kit recognition result.
 * When spatial block/line frames are present, elements on the same horizontal row are grouped.
 */
function extractTextLines(input: string | MLKitRecognitionInput): string[] {
  if (typeof input === 'string') {
    return input.replace(/\r/g, '\n').split('\n');
  }

  if (input.blocks && input.blocks.length > 0) {
    const allLines: Array<{ text: string; top: number; left: number }> = [];
    for (const block of input.blocks) {
      if (block.lines && block.lines.length > 0) {
        for (const line of block.lines) {
          const top = line.frame?.top ?? 0;
          const left = line.frame?.left ?? 0;
          allLines.push({ text: line.text, top, left });
        }
      } else if (block.text) {
        allLines.push({ text: block.text, top: 0, left: 0 });
      }
    }

    if (allLines.length > 0) {
      // Sort lines top-to-bottom, left-to-right
      allLines.sort((a, b) => {
        if (Math.abs(a.top - b.top) > 16) {
          return a.top - b.top;
        }
        return a.left - b.left;
      });
      return allLines.map((l) => l.text);
    }
  }

  return (input.text || '').replace(/\r/g, '\n').split('\n');
}

/**
 * High-accuracy handwriting OCR identification engine.
 * Handles:
 *   1. The 5 answer ways:
 *      - Option A (0)
 *      - Option B (1)
 *      - Option C (2)
 *      - Option D (3)
 *      - Not Attempted (null): written as 'e', 'E', 'na', 'skip', '-', 'unattempted', 'blank'
 *   2. The two writing styles:
 *      - Style 1: Direct options without question number:
 *          e.g. a, b, c, d, e (or vertical: a \n b \n c \n d \n e)
 *      - Style 2: With question number before option:
 *          e.g. 1. a, 2. b, 3. c, 4. d, 5. e (or 1 a, 1: a, 1) a, 1 - a, Q1 a)
 *   3. Self-corrections:
 *      - When a student writes "B A" (crossing out B), picks rightmost candidate "A"
 *   4. Monotonic sequence gap alignment for skipped/smudged numbers
 *   5. Written option value matching (e.g. "3/4" or "proper fraction")
 *
 * 100% offline, lightweight, robust against distortions.
 *
 * @param input Raw text string or ML Kit recognition object
 * @param questionCount Total number of questions on the test
 * @param expectedOptionsByQuestion Optional array of options per question for semantic matching
 */
export function parseAnswerText(
  input: string | MLKitRecognitionInput,
  questionCount: number,
  expectedOptionsByQuestion?: string[][],
): DetectedAnswer[] {
  const answers: DetectedAnswer[] = Array.from({ length: questionCount }, (_, i) => ({
    questionIndex: i,
    selectedOption: null,
    flag: 'blank' as const,
  }));

  const rawLines = extractTextLines(input);
  if (!rawLines || rawLines.length === 0) return answers;

  // Track occurrences and confidence per question
  const hitsPerQuestion = new Map<number, ParsedHit[]>();
  for (let i = 0; i < questionCount; i++) {
    hitsPerQuestion.set(i, []);
  }

  // Pre-process lines: circle/bracket unwrapping e.g. (A) -> A, (1) -> 1, [B] -> B, (e) -> e
  const normalizedLines = rawLines
    .map((l) =>
      l
        .replace(/[\u2010-\u2015\u2212]/g, '-') // unicode dashes
        .replace(/[\(\[\{]\s*([a-eA-E048^@oO\d])\s*[\)\]\}]/g, ' $1 ') // unwrap (A) -> A, (e) -> e
        .trim()
    )
    .filter(Boolean);

  const unassignedSegments: string[] = [];

  // ── Strategy 1: Style 2 (Numbered question list e.g. 1. a, 1 a, 1: a, 1) a) ──
  for (const line of normalizedLines) {
    // Split multi-column segments (e.g. "1. a   6. b")
    const segments = line.split(/\s{2,}|\t+/);

    for (const seg of segments) {
      const cleanSeg = seg.trim();
      if (!cleanSeg) continue;

      const tokens = cleanSeg.split(/\s+/);
      if (tokens.length === 0) continue;

      // Check if first token is a question number (or OCR-mangled number)
      const qNum = normalizeQuestionNumber(tokens[0]);
      if (qNum !== null && qNum >= 1 && qNum <= questionCount) {
        const qIdx = qNum - 1;
        const restTokens = tokens.slice(1);

        // Self-correction detection: scan right-to-left to pick final candidate!
        let found = false;
        for (let tIdx = restTokens.length - 1; tIdx >= 0; tIdx--) {
          const tok = restTokens[tIdx];
          const classification = classifyToken(tok);

          if (classification.isNotAttempt) {
            // Student explicitly wrote 'e', 'E', 'na', 'skip', '-', 'unattempted'
            hitsPerQuestion.get(qIdx)!.push({
              option: null,
              isNotAttempt: true,
              confidence: 99,
            });
            found = true;
            break;
          } else if (classification.option !== null) {
            hitsPerQuestion.get(qIdx)!.push({
              option: classification.option,
              isNotAttempt: false,
              confidence: classification.confidence,
            });
            found = true;
            break;
          }
        }

        // Check if student wrote answer value (e.g. "3/4" or "proper fraction")
        if (!found && expectedOptionsByQuestion && expectedOptionsByQuestion[qIdx]) {
          const restText = restTokens.join(' ');
          const valOpt = matchWrittenValueToOption(restText, expectedOptionsByQuestion[qIdx]);
          if (valOpt !== null) {
            hitsPerQuestion.get(qIdx)!.push({ option: valOpt, isNotAttempt: false, confidence: 92 });
            found = true;
          }
        }

        if (!found) {
          unassignedSegments.push(cleanSeg);
        }
      } else {
        unassignedSegments.push(cleanSeg);
      }
    }
  }

  // ── Strategy 2: Style 1 (Direct option list without numbers: a b c d e) ────
  // If no numbered answers were found, or if direct option tokens form a clean sequence:
  const totalNumberedHits = Array.from(hitsPerQuestion.values()).filter((h) => h.length > 0).length;

  if (totalNumberedHits === 0) {
    const directTokens: ParsedHit[] = [];

    for (const line of normalizedLines) {
      const parts = line.split(/[\s,;|]+/);
      for (const p of parts) {
        const cleanP = p.trim();
        if (!cleanP) continue;

        const classification = classifyToken(cleanP);
        if (classification.isNotAttempt) {
          directTokens.push({ option: null, isNotAttempt: true, confidence: 99 });
        } else if (classification.option !== null) {
          directTokens.push({
            option: classification.option,
            isNotAttempt: false,
            confidence: classification.confidence,
          });
        }
      }
    }

    if (directTokens.length >= questionCount) {
      for (let i = 0; i < questionCount; i++) {
        hitsPerQuestion.get(i)!.push(directTokens[i]);
      }
    } else if (directTokens.length > 0) {
      for (let i = 0; i < Math.min(questionCount, directTokens.length); i++) {
        hitsPerQuestion.get(i)!.push(directTokens[i]);
      }
    }
  }

  // ── Strategy 3: Monotonic Sequence Alignment (Gap filling for skipped numbers) ──
  const emptyQuestions = [];
  for (let i = 0; i < questionCount; i++) {
    if (hitsPerQuestion.get(i)!.length === 0) {
      emptyQuestions.push(i);
    }
  }

  if (emptyQuestions.length > 0 && unassignedSegments.length > 0) {
    const unassignedHits: ParsedHit[] = [];

    for (const seg of unassignedSegments) {
      const toks = seg.split(/\s+/);
      for (let tIdx = toks.length - 1; tIdx >= 0; tIdx--) {
        const classification = classifyToken(toks[tIdx]);
        if (classification.isNotAttempt) {
          unassignedHits.push({ option: null, isNotAttempt: true, confidence: 99 });
          break;
        } else if (classification.option !== null) {
          unassignedHits.push({
            option: classification.option,
            isNotAttempt: false,
            confidence: classification.confidence,
          });
          break;
        }
      }
    }

    if (unassignedHits.length === emptyQuestions.length) {
      for (let k = 0; k < emptyQuestions.length; k++) {
        hitsPerQuestion.get(emptyQuestions[k])!.push(unassignedHits[k]);
      }
    } else if (emptyQuestions.length === questionCount && unassignedHits.length >= questionCount) {
      for (let i = 0; i < questionCount; i++) {
        hitsPerQuestion.get(i)!.push(unassignedHits[i]);
      }
    }
  }

  // ── Strategy 4: Two-Block Columnar (1..N followed by answers A..E) ────────
  const currentTotal = Array.from(hitsPerQuestion.values()).filter((h) => h.length > 0).length;
  if (currentTotal === 0 && normalizedLines.length >= questionCount * 2) {
    const topLines = normalizedLines.slice(0, questionCount);
    const bottomLines = normalizedLines.slice(questionCount, questionCount * 2);

    const isSequentialNums = topLines.every((l, idx) => {
      const qNum = normalizeQuestionNumber(l);
      return qNum === idx + 1;
    });

    if (isSequentialNums) {
      for (let i = 0; i < questionCount; i++) {
        const classification = classifyToken(bottomLines[i].split(/\s+/)[0]);
        if (classification.isNotAttempt) {
          hitsPerQuestion.get(i)!.push({ option: null, isNotAttempt: true, confidence: 99 });
        } else if (classification.option !== null) {
          hitsPerQuestion.get(i)!.push({
            option: classification.option,
            isNotAttempt: false,
            confidence: classification.confidence,
          });
        }
      }
    }
  }

  // ── Build Final DetectedAnswer Array ───────────────────────────────────────
  for (let i = 0; i < questionCount; i++) {
    const hits = hitsPerQuestion.get(i)!;

    if (hits.length === 0) {
      answers[i] = {
        questionIndex: i,
        selectedOption: null,
        flag: 'blank',
      };
    } else {
      // Pick the latest candidate on the line (respecting self-corrections)
      const lastHit = hits[hits.length - 1];

      if (lastHit.isNotAttempt || lastHit.option === null) {
        // Explicitly marked as Not Attempted ('e', 'na', 'skip', '-')
        answers[i] = {
          questionIndex: i,
          selectedOption: null,
          flag: 'blank',
          confidence: 99,
        };
      } else {
        const allSame = hits.every((h) => h.option === lastHit.option);
        answers[i] = {
          questionIndex: i,
          selectedOption: lastHit.option,
          flag: 'ok',
          confidence: allSame ? Math.max(90, lastHit.confidence) : 85,
        };
      }
    }
  }

  return answers;
}
