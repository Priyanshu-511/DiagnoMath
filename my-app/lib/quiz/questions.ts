/**
 * Built-in question bank for Class 6–7 Mathematics.
 * Every question has 4 options, one correct answer, a topic label,
 * and a skills map for DINA cognitive diagnosis.
 */

import { Question } from '@/lib/questions/types';

// Skill keys used in the Q-matrix
// NumOp  = Basic numerical operations (+,−,×,÷)
// Frac   = Fractions & decimals
// Ratio  = Ratio & proportion
// Geom   = Basic geometry (angles, shapes, perimeter, area)
// Alg    = Elementary algebra (expressions, simple equations)
// Data   = Data handling (mean, median, mode, bar charts)

type Skills = Record<'NumOp' | 'Frac' | 'Ratio' | 'Geom' | 'Alg' | 'Data', 0 | 1>;

function q(
  id: string,
  topic: string,
  text: string,
  options: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  skills: Skills
): Question {
  return { id, topic, text, options, correctIndex, skills };
}

export const BUILTIN_QUESTIONS: Question[] = [
  // ── Whole Numbers & Basic Operations ───────────────────────────────
  q('bq001', 'Whole Numbers', 'What is 347 + 589?',
    ['926', '936', '916', '946'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq002', 'Whole Numbers', 'What is 1000 − 374?',
    ['636', '626', '616', '646'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq003', 'Whole Numbers', 'What is 45 × 12?',
    ['520', '530', '540', '550'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq004', 'Whole Numbers', 'What is 144 ÷ 12?',
    ['10', '11', '12', '13'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq005', 'Whole Numbers', 'Which is the smallest prime number?',
    ['0', '1', '2', '3'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq006', 'Whole Numbers', 'What is the HCF of 24 and 36?',
    ['4', '6', '8', '12'], 3,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq007', 'Whole Numbers', 'What is the LCM of 4 and 6?',
    ['8', '10', '12', '24'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq008', 'Whole Numbers', 'Which of these is divisible by 9?',
    ['123', '135', '144', '152'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  // ── Fractions & Decimals ────────────────────────────────────────────
  q('bq009', 'Fractions', 'What is 1/2 + 1/3?',
    ['2/5', '3/5', '5/6', '2/6'], 2,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq010', 'Fractions', 'What is 3/4 − 1/4?',
    ['1/2', '2/4', '1/4', 'Both A and B'], 3,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq011', 'Fractions', 'What is 2/3 × 3/4?',
    ['6/12', '1/2', '5/7', '1/4'], 1,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq012', 'Fractions', 'Which fraction is the largest? 1/2, 2/3, 3/4, 5/8',
    ['1/2', '2/3', '3/4', '5/8'], 2,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq013', 'Decimals', 'What is 0.5 + 0.75?',
    ['1.00', '1.20', '1.25', '1.30'], 2,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq014', 'Decimals', 'What is 2.4 × 0.5?',
    ['1.0', '1.2', '1.4', '2.0'], 1,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq015', 'Decimals', 'Convert 3/4 to a decimal.',
    ['0.34', '0.43', '0.75', '0.7'], 2,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq016', 'Decimals', 'Which decimal is equal to 25%?',
    ['0.025', '0.25', '2.5', '25.0'], 1,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  // ── Ratio & Proportion ──────────────────────────────────────────────
  q('bq017', 'Ratio & Proportion', 'If the ratio of boys to girls is 3:2 and there are 30 boys, how many girls are there?',
    ['15', '18', '20', '25'], 2,
    { NumOp: 1, Frac: 0, Ratio: 1, Geom: 0, Alg: 0, Data: 0 }),

  q('bq018', 'Ratio & Proportion', 'What is the ratio 15:25 in its simplest form?',
    ['3:4', '3:5', '5:3', '1:2'], 1,
    { NumOp: 1, Frac: 0, Ratio: 1, Geom: 0, Alg: 0, Data: 0 }),

  q('bq019', 'Ratio & Proportion', 'A recipe needs 2 cups of flour for 3 cups of sugar. How many cups of flour for 9 cups of sugar?',
    ['4', '5', '6', '7'], 2,
    { NumOp: 1, Frac: 0, Ratio: 1, Geom: 0, Alg: 1, Data: 0 }),

  q('bq020', 'Ratio & Proportion', 'If 5 pens cost ₹35, what is the cost of 8 pens?',
    ['₹48', '₹52', '₹56', '₹60'], 2,
    { NumOp: 1, Frac: 0, Ratio: 1, Geom: 0, Alg: 0, Data: 0 }),

  q('bq021', 'Percentage', 'What is 20% of 150?',
    ['20', '25', '30', '35'], 2,
    { NumOp: 1, Frac: 1, Ratio: 1, Geom: 0, Alg: 0, Data: 0 }),

  q('bq022', 'Percentage', 'A shirt costs ₹500. After a 10% discount, what is the price?',
    ['₹400', '₹450', '₹480', '₹490'], 1,
    { NumOp: 1, Frac: 1, Ratio: 1, Geom: 0, Alg: 0, Data: 0 }),

  // ── Geometry ────────────────────────────────────────────────────────
  q('bq023', 'Geometry', 'How many degrees are in a straight angle?',
    ['90°', '120°', '180°', '360°'], 2,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq024', 'Geometry', 'What is the sum of angles in a triangle?',
    ['90°', '180°', '270°', '360°'], 1,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq025', 'Geometry', 'A rectangle has length 8 cm and width 5 cm. What is its perimeter?',
    ['13 cm', '26 cm', '40 cm', '80 cm'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq026', 'Geometry', 'What is the area of a triangle with base 6 cm and height 4 cm?',
    ['10 cm²', '12 cm²', '24 cm²', '48 cm²'], 1,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq027', 'Geometry', 'How many sides does a hexagon have?',
    ['4', '5', '6', '8'], 2,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq028', 'Geometry', 'The area of a square with side 7 cm is:',
    ['14 cm²', '28 cm²', '42 cm²', '49 cm²'], 3,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq029', 'Geometry', 'An angle less than 90° is called:',
    ['Obtuse', 'Right', 'Acute', 'Reflex'], 2,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  q('bq030', 'Geometry', 'The circumference of a circle with radius 7 cm is (use π = 22/7):',
    ['22 cm', '44 cm', '66 cm', '88 cm'], 1,
    { NumOp: 1, Frac: 1, Ratio: 0, Geom: 1, Alg: 0, Data: 0 }),

  // ── Algebra ─────────────────────────────────────────────────────────
  q('bq031', 'Algebra', 'If x + 5 = 12, what is x?',
    ['5', '6', '7', '8'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  q('bq032', 'Algebra', 'If 3x = 21, what is x?',
    ['5', '6', '7', '8'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  q('bq033', 'Algebra', 'Simplify: 2a + 3a',
    ['5', '5a', '6a', '2a³'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  q('bq034', 'Algebra', 'What is the value of 4x − 2 when x = 3?',
    ['8', '10', '12', '14'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  q('bq035', 'Algebra', 'If 2x + 3 = 11, what is x?',
    ['3', '4', '5', '6'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  q('bq036', 'Algebra', 'Which expression represents "7 more than a number n"?',
    ['7n', 'n − 7', 'n + 7', '7 − n'], 2,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 0, Alg: 1, Data: 0 }),

  // ── Data Handling ────────────────────────────────────────────────────
  q('bq037', 'Data Handling', 'Find the mean of: 4, 8, 6, 10, 12',
    ['7', '8', '9', '10'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 1 }),

  q('bq038', 'Data Handling', 'Find the median of: 3, 7, 5, 1, 9',
    ['3', '5', '7', '9'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 1 }),

  q('bq039', 'Data Handling', 'Find the mode of: 2, 4, 4, 6, 8, 4, 2',
    ['2', '4', '6', '8'], 1,
    { NumOp: 0, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 1 }),

  q('bq040', 'Data Handling', 'The range of 3, 8, 1, 6, 10 is:',
    ['7', '8', '9', '10'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 1 }),

  q('bq041', 'Data Handling', 'A bar graph shows 20 students like cricket and 15 like football. How many more like cricket?',
    ['3', '4', '5', '6'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 1 }),

  // ── Integers (Class 6–7) ─────────────────────────────────────────────
  q('bq042', 'Integers', 'What is (−5) + (−3)?',
    ['−2', '2', '−8', '8'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq043', 'Integers', 'What is (−6) × (−4)?',
    ['−24', '24', '−10', '10'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq044', 'Integers', 'What is 10 − (−3)?',
    ['7', '13', '−13', '−7'], 1,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),

  q('bq045', 'Integers', 'Which of these is the smallest? −7, −3, 0, 2',
    ['−3', '0', '−7', '2'], 2,
    { NumOp: 1, Frac: 0, Ratio: 0, Geom: 0, Alg: 0, Data: 0 }),
];

