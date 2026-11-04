/**
 * skillLabels.ts
 *
 * Maps cognitive attribute / skill codes (e.g. A1–A12, NumOp, Frac)
 * to human-readable subtopic names and chapter descriptions.
 * Works 100% offline without external services.
 */

export interface SkillMeta {
  code: string;
  name: string;
  chapter: string;
  description: string;
}

export const SKILL_METADATA: Record<string, SkillMeta> = {
  // ── Fractions Chapter Subtopics (A1–A12) ───────────────────────────
  A1: {
    code: 'A1',
    name: 'Numerator & Denominator Identification',
    chapter: 'Fractions',
    description: 'Identifying top (numerator) and bottom (denominator) numbers and their roles',
  },
  A2: {
    code: 'A2',
    name: 'Fraction Representation',
    chapter: 'Fractions',
    description: 'Visualizing and representing fractions as parts of a whole or set',
  },
  A3: {
    code: 'A3',
    name: 'Fraction Classification (Proper/Improper/Mixed)',
    chapter: 'Fractions',
    description: 'Distinguishing proper fractions, improper fractions, and mixed numbers',
  },
  A4: {
    code: 'A4',
    name: 'Fraction Simplification',
    chapter: 'Fractions',
    description: 'Reducing fractions to simplest form / lowest terms using GCD',
  },
  A5: {
    code: 'A5',
    name: 'Equivalent Fractions',
    chapter: 'Fractions',
    description: 'Finding and verifying fractions that represent the same value',
  },
  A6: {
    code: 'A6',
    name: 'Fraction Comparison',
    chapter: 'Fractions',
    description: 'Comparing fractions with like and unlike denominators',
  },
  A7: {
    code: 'A7',
    name: 'Fraction Ordering',
    chapter: 'Fractions',
    description: 'Arranging multiple fractions in ascending or descending order',
  },
  A8: {
    code: 'A8',
    name: 'Mixed & Improper Conversion',
    chapter: 'Fractions',
    description: 'Converting between mixed numbers and improper fractions',
  },
  A9: {
    code: 'A9',
    name: 'Addition of Fractions (Like Denominators)',
    chapter: 'Fractions',
    description: 'Adding fractions that share the same denominator',
  },
  A10: {
    code: 'A10',
    name: 'Addition of Fractions (Unlike Denominators)',
    chapter: 'Fractions',
    description: 'Adding fractions with different denominators using LCM',
  },
  A11: {
    code: 'A11',
    name: 'Subtraction of Fractions',
    chapter: 'Fractions',
    description: 'Subtracting fractions with like and unlike denominators',
  },
  A12: {
    code: 'A12',
    name: 'Fraction Applications & Word Problems',
    chapter: 'Fractions',
    description: 'Solving real-world contextual problems involving fractions',
  },

  // ── General Mathematics Skills ──────────────────────────────────────
  NumOp: {
    code: 'NumOp',
    name: 'Basic Numerical Operations (+, −, ×, ÷)',
    chapter: 'Whole Numbers',
    description: 'Performing arithmetic operations on integers and whole numbers',
  },
  Frac: {
    code: 'Frac',
    name: 'Fractions & Decimals',
    chapter: 'Fractions',
    description: 'Operations and conversions involving fractional and decimal quantities',
  },
  Ratio: {
    code: 'Ratio',
    name: 'Ratio & Proportion',
    chapter: 'Ratios',
    description: 'Understanding proportional relationships and scaling',
  },
  Geom: {
    code: 'Geom',
    name: 'Geometry & Measurement',
    chapter: 'Geometry',
    description: 'Properties of shapes, angles, perimeter, and area',
  },
  Alg: {
    code: 'Alg',
    name: 'Algebraic Expressions & Equations',
    chapter: 'Algebra',
    description: 'Forming expressions and solving linear equations',
  },
  Data: {
    code: 'Data',
    name: 'Data Handling & Statistics',
    chapter: 'Statistics',
    description: 'Reading graphs, calculating mean, median, mode, and range',
  },
};

/**
 * Returns a human-friendly subtopic name for a given skill code.
 * If code is not found in the dictionary, formats it nicely.
 */
export function getSkillLabel(code: string): string {
  if (SKILL_METADATA[code]) {
    return SKILL_METADATA[code].name;
  }
  // If the skill has underscore or dash, replace with space
  return code
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

/**
 * Returns full metadata including chapter and description.
 */
export function getSkillMeta(code: string): SkillMeta {
  if (SKILL_METADATA[code]) {
    return SKILL_METADATA[code];
  }
  const name = getSkillLabel(code);
  return {
    code,
    name,
    chapter: 'Mathematics',
    description: `Subtopic related to ${name}`,
  };
}

