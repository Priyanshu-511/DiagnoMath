/**
 * prototypes.ts
 *
 * Defines the fixed 12 Fractions cognitive attributes (A1–A12)
 * and computes their 128-dimensional BERT-tiny semantic prototype vectors.
 */

import { AttributeId, AttributeMeta } from '../types';
import { tokenize } from './tokenizer';
import { forwardBertTiny } from './model';

export interface AttributeConcept {
  id: AttributeId;
  name: string;
  description: string;
  anchorText: string;
  keywords: string[];
}

export const ATTRIBUTE_CONCEPTS: AttributeConcept[] = [
  {
    id: 'A1',
    name: 'Numerator and denominator identification',
    description: 'Identifying the numerator (top number) or denominator (bottom number) of a fraction.',
    anchorText: 'in the fraction which number is the numerator or denominator identify top bottom part',
    keywords: ['numerator', 'denominator', 'top number', 'bottom number'],
  },
  {
    id: 'A2',
    name: 'Fraction representation',
    description: 'Representing parts of a whole or set as a fraction, e.g. shaded parts of a shape or diagram.',
    anchorText: 'fraction represents parts of a whole shaded region visual fraction out of equal slices',
    keywords: ['represents', 'represent', 'shaded', 'equal parts', 'out of'],
  },
  {
    id: 'A3',
    name: 'Fraction classification (proper/improper/mixed)',
    description: 'Classifying fractions as proper, improper, or mixed numbers based on numerator and denominator.',
    anchorText: 'which is a proper fraction improper fraction mixed number classification of fraction types',
    keywords: ['proper', 'improper', 'mixed number', 'classification', 'classify'],
  },
  {
    id: 'A4',
    name: 'Fraction simplification',
    description: 'Simplifying a fraction to its lowest terms by dividing numerator and denominator by common factors.',
    anchorText: 'simplify fraction to lowest terms simplest form reduce fraction dividing common factors',
    keywords: ['simplify', 'simplest form', 'lowest terms', 'reduce'],
  },
  {
    id: 'A5',
    name: 'Equivalent fractions',
    description: 'Finding or verifying equivalent fractions by scaling numerator and denominator proportionally.',
    anchorText: 'which fraction is equivalent to same value equal fraction missing numerator or denominator',
    keywords: ['equivalent', 'same value', 'equal to'],
  },
  {
    id: 'A6',
    name: 'Fraction comparison',
    description: 'Comparing two fractions to determine which is greater, smaller, or if they are equal.',
    anchorText: 'which fraction is greater smaller compare two fractions larger less than more than',
    keywords: ['greater', 'smaller', 'larger', 'compare', 'less than', 'more than'],
  },
  {
    id: 'A7',
    name: 'Fraction ordering',
    description: 'Ordering three or more fractions in ascending (least to greatest) or descending order.',
    anchorText: 'arrange in ascending order descending order list fractions from least to greatest',
    keywords: ['ascending', 'descending', 'order', 'arrange', 'least to greatest'],
  },
  {
    id: 'A8',
    name: 'Mixed/improper conversion',
    description: 'Converting between mixed numbers and improper fractions.',
    anchorText: 'convert mixed number to improper fraction convert improper fraction to mixed number',
    keywords: ['convert', 'mixed number to improper', 'improper to mixed'],
  },
  {
    id: 'A9',
    name: 'Like-denominator addition',
    description: 'Adding fractions that share the same denominator by adding the numerators.',
    anchorText: 'add fractions with same denominator like denominator addition sum of fractions',
    keywords: ['add', 'addition', 'sum', 'plus', '+'],
  },
  {
    id: 'A10',
    name: 'Unlike-denominator addition',
    description: 'Adding fractions with different denominators by finding a common denominator (LCM).',
    anchorText: 'add fractions with different unlike denominators find common denominator lcm addition',
    keywords: ['add', 'unlike denominator', 'different denominator', 'lcm', '+'],
  },
  {
    id: 'A11',
    name: 'Fraction subtraction',
    description: 'Subtracting fractions with like or unlike denominators.',
    anchorText: 'subtract fractions difference minus subtraction of fractions',
    keywords: ['subtract', 'subtraction', 'difference', 'minus', '-'],
  },
  {
    id: 'A12',
    name: 'Fraction application / word problems',
    description: 'Real-world application problems involving fractional quantities (sharing, pizza, recipes, tanks).',
    anchorText: 'word problem real world fraction application pizza ate ribbon tank recipe remaining together',
    keywords: ['ate', 'pizza', 'ribbon', 'tank', 'recipe', 'remaining', 'together', 'students', 'how much'],
  },
];

export const ATTRIBUTE_LIST: AttributeMeta[] = ATTRIBUTE_CONCEPTS.map((c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
}));

/**
 * Cache of pre-computed BERT-tiny prototype embeddings (128-d vectors)
 * for each of the 12 cognitive attributes.
 */
let cachedPrototypes: Map<AttributeId, number[]> | null = null;

export function getAttributePrototypes(): Map<AttributeId, number[]> {
  if (cachedPrototypes) return cachedPrototypes;

  const map = new Map<AttributeId, number[]>();

  for (const concept of ATTRIBUTE_CONCEPTS) {
    const { inputIds, attentionMask } = tokenize(concept.anchorText);
    const embedding = forwardBertTiny(inputIds, attentionMask);
    map.set(concept.id, embedding);
  }

  cachedPrototypes = map;
  return map;
}

