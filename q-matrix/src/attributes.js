/**
 * attributes.js
 *
 * Defines the fixed bank of 12 Fractions-related cognitive attributes.
 * This file is the code-side source of truth for the attribute bank.
 * Keep in sync with data/attributes.json.
 */

'use strict';

/** @type {Array<{ id: string; name: string }>} */
const ATTRIBUTES = [
  { id: 'A1',  name: 'Numerator and denominator identification' },
  { id: 'A2',  name: 'Fraction representation' },
  { id: 'A3',  name: 'Fraction classification (proper/improper/mixed)' },
  { id: 'A4',  name: 'Fraction simplification' },
  { id: 'A5',  name: 'Equivalent fractions' },
  { id: 'A6',  name: 'Fraction comparison' },
  { id: 'A7',  name: 'Fraction ordering' },
  { id: 'A8',  name: 'Mixed/improper conversion' },
  { id: 'A9',  name: 'Like-denominator addition' },
  { id: 'A10', name: 'Unlike-denominator addition' },
  { id: 'A11', name: 'Fraction subtraction' },
  { id: 'A12', name: 'Fraction application / word problems' },
];

/** Set of valid attribute IDs for O(1) lookup. */
const ATTRIBUTE_IDS = new Set(ATTRIBUTES.map((a) => a.id));

/** Ordered list of IDs — A1 through A12. Used as the column order. */
const ATTRIBUTE_ID_ORDER = ATTRIBUTES.map((a) => a.id);

module.exports = { ATTRIBUTES, ATTRIBUTE_IDS, ATTRIBUTE_ID_ORDER };

