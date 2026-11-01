/**
 * questions-fractions.ts
 *
 * Offline fractions question bank for Class 6–7.
 * Every question maps to the 12 Fractions cognitive attributes (A1–A12)
 * from the DiagnoMath Q-matrix documentation, enabling DINA diagnosis
 * without any network or server dependency.
 *
 * Skill keys:
 *   A1  — Numerator and denominator identification
 *   A2  — Fraction representation
 *   A3  — Fraction classification (proper/improper/mixed)
 *   A4  — Fraction simplification
 *   A5  — Equivalent fractions
 *   A6  — Fraction comparison
 *   A7  — Fraction ordering
 *   A8  — Mixed/improper conversion
 *   A9  — Like-denominator addition
 *   A10 — Unlike-denominator addition
 *   A11 — Fraction subtraction
 *   A12 — Fraction application / word problems
 */

import { Question } from '@/lib/questions/types';

type FracSkills = {
  A1: 0 | 1; A2: 0 | 1; A3: 0 | 1; A4: 0 | 1;
  A5: 0 | 1; A6: 0 | 1; A7: 0 | 1; A8: 0 | 1;
  A9: 0 | 1; A10: 0 | 1; A11: 0 | 1; A12: 0 | 1;
};

const Z: FracSkills = {
  A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0,
  A7: 0, A8: 0, A9: 0, A10: 0, A11: 0, A12: 0,
};

function fq(
  id: string,
  text: string,
  options: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  skills: FracSkills
): Question {
  return { id, topic: 'Fractions', text, options, correctIndex, skills };
}

export const FRACTIONS_QUESTIONS: Question[] = [

  // ── A1: Numerator and denominator identification ──────────────────────────
  fq('fq001',
    'In the fraction 5/9, which number is the numerator?',
    ['9', '5', '14', '45'],
    1, { ...Z, A1: 1 }),

  fq('fq002',
    'In the fraction 7/12, which number is the denominator?',
    ['7', '19', '12', '5'],
    2, { ...Z, A1: 1 }),

  fq('fq003',
    'A fraction has numerator 4 and denominator 11. What is the fraction?',
    ['11/4', '4/11', '15', '7'],
    1, { ...Z, A1: 1, A2: 1 }),

  // ── A2: Fraction representation ───────────────────────────────────────────
  fq('fq004',
    'Which fraction represents "three out of eight equal parts"?',
    ['8/3', '3/8', '5/8', '3/5'],
    1, { ...Z, A2: 1 }),

  fq('fq005',
    'A pizza is cut into 8 equal slices. You eat 3. What fraction did you eat?',
    ['8/3', '5/8', '3/8', '1/3'],
    2, { ...Z, A2: 1 }),

  // ── A3: Fraction classification ───────────────────────────────────────────
  fq('fq006',
    'Which of the following is a proper fraction?',
    ['9/4', '7/7', '3/8', '11/5'],
    2, { ...Z, A3: 1 }),

  fq('fq007',
    'Which of the following is an improper fraction?',
    ['2/5', '1/3', '7/4', '3/8'],
    2, { ...Z, A3: 1 }),

  fq('fq008',
    'Which of the following is a mixed number?',
    ['3/4', '7/3', '2\u00bd', '8'],
    2, { ...Z, A3: 1 }),

  // ── A4: Fraction simplification ───────────────────────────────────────────
  fq('fq009',
    'Simplify 12/18.',
    ['3/4', '2/3', '4/5', '6/9'],
    1, { ...Z, A4: 1 }),

  fq('fq010',
    'Simplify 16/24.',
    ['4/5', '2/3', '3/4', '4/6'],
    1, { ...Z, A4: 1 }),

  fq('fq011',
    'Simplify 15/25.',
    ['3/5', '5/3', '1/2', '2/5'],
    0, { ...Z, A4: 1 }),

  // ── A5: Equivalent fractions ──────────────────────────────────────────────
  fq('fq012',
    'Which fraction is equivalent to 2/3?',
    ['3/4', '4/5', '6/9', '5/8'],
    2, { ...Z, A5: 1 }),

  fq('fq013',
    'Which of the following is NOT equivalent to 1/2?',
    ['2/4', '3/6', '4/9', '5/10'],
    2, { ...Z, A5: 1 }),

  fq('fq014',
    'Find the missing number: 3/4 = ?/12',
    ['6', '8', '9', '3'],
    2, { ...Z, A5: 1 }),

  // ── A6: Fraction comparison ───────────────────────────────────────────────
  fq('fq015',
    'Which fraction is greater: 3/4 or 5/8?',
    ['5/8', '3/4', 'They are equal', 'Cannot compare'],
    1, { ...Z, A6: 1 }),

  fq('fq016',
    'Which is smaller: 2/3 or 3/5?',
    ['2/3', '3/5', 'They are equal', 'Cannot tell'],
    1, { ...Z, A6: 1 }),

  fq('fq017',
    'Compare 5/6 and 7/9. Which symbol fits: 5/6 ○ 7/9?',
    ['>', '<', '=', '\u2248'],
    0, { ...Z, A6: 1, A5: 1 }),

  // ── A7: Fraction ordering ─────────────────────────────────────────────────
  fq('fq018',
    'Arrange in ascending order: 1/2, 3/8, 5/6',
    ['3/8 < 1/2 < 5/6', '1/2 < 3/8 < 5/6', '5/6 < 1/2 < 3/8', '1/2 < 5/6 < 3/8'],
    0, { ...Z, A7: 1 }),

  fq('fq019',
    'Which correctly orders 2/3, 3/4, 5/8 from greatest to least?',
    ['2/3 > 3/4 > 5/8', '3/4 > 2/3 > 5/8', '5/8 > 2/3 > 3/4', '3/4 > 5/8 > 2/3'],
    1, { ...Z, A7: 1, A6: 1 }),

  // ── A8: Mixed/improper conversion ─────────────────────────────────────────
  fq('fq020',
    'Convert 2\u00be to an improper fraction.',
    ['9/4', '11/4', '8/4', '10/4'],
    1, { ...Z, A8: 1 }),

  fq('fq021',
    'Convert 17/5 to a mixed number.',
    ['3\u2155', '3\u2156', '2\u2157', '4\u2156'],
    1, { ...Z, A8: 1 }),

  fq('fq022',
    'Convert 3\u2154 to an improper fraction.',
    ['9/3', '11/3', '10/3', '12/3'],
    1, { ...Z, A8: 1 }),

  // ── A9: Like-denominator addition ─────────────────────────────────────────
  fq('fq023',
    'What is 3/7 + 2/7?',
    ['5/14', '5/7', '6/7', '1/7'],
    1, { ...Z, A9: 1 }),

  fq('fq024',
    'What is 2/9 + 4/9?',
    ['1/3', '2/3', '3/9', '5/9'],
    1, { ...Z, A9: 1, A4: 1 }),

  fq('fq025',
    'What is 1/5 + 3/5 + 1/5?',
    ['4/5', '1', '3/5', '2/5'],
    1, { ...Z, A9: 1 }),

  // ── A10: Unlike-denominator addition ──────────────────────────────────────
  fq('fq026',
    'What is 1/2 + 1/3?',
    ['2/5', '2/6', '5/6', '3/5'],
    2, { ...Z, A10: 1, A5: 1 }),

  fq('fq027',
    'What is 1/4 + 1/6?',
    ['2/10', '1/5', '5/12', '2/12'],
    2, { ...Z, A10: 1, A5: 1 }),

  fq('fq028',
    'What is 2/3 + 3/4?',
    ['5/7', '5/12', '17/12', '11/12'],
    2, { ...Z, A10: 1, A5: 1, A8: 1 }),

  // ── A11: Fraction subtraction ─────────────────────────────────────────────
  fq('fq029',
    'What is 5/6 \u2212 1/6?',
    ['1/2', '1/3', '3/4', '2/3'],
    3, { ...Z, A11: 1, A4: 1 }),

  fq('fq030',
    'What is 3/4 \u2212 1/3?',
    ['2/1', '5/12', '2/12', '1/2'],
    1, { ...Z, A11: 1, A5: 1 }),

  fq('fq031',
    'What is 1 \u2212 3/8?',
    ['3/8', '5/8', '2/8', '1/4'],
    1, { ...Z, A11: 1, A8: 1 }),

  // ── A12: Word problems (cross-attribute) ──────────────────────────────────
  fq('fq032',
    'Ravi ate 3/8 of a pizza and Meena ate 2/8 of the same pizza. What fraction did they eat together?',
    ['5/16', '5/8', '1/2', '6/8'],
    1, { ...Z, A12: 1, A9: 1 }),

  fq('fq033',
    'A ribbon is 3/4 m long. Another is 5/8 m. How much longer is the first ribbon?',
    ['1/8 m', '1/4 m', '3/8 m', '5/8 m'],
    0, { ...Z, A12: 1, A11: 1, A6: 1 }),

  fq('fq034',
    'A tank is 2/3 full. After draining 1/4, what fraction of water remains?',
    ['1/3', '5/12', '7/12', '1/4'],
    1, { ...Z, A12: 1, A11: 1, A10: 1 }),

  fq('fq035',
    'A class has 30 students. 2/5 are girls. How many are boys?',
    ['12', '18', '15', '20'],
    1, { ...Z, A12: 1 }),

  fq('fq036',
    'Simplify 24/36. What type of fraction is the result?',
    ['3/4 — proper', '2/3 — proper', '3/4 — improper', '2/3 — improper'],
    1, { ...Z, A4: 1, A3: 1 }),
];

