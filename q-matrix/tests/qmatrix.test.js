/**
 * qmatrix.test.js
 *
 * Automated tests for the Q-matrix logic using Node.js built-in test runner.
 * Run with: node --test tests/qmatrix.test.js
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ATTRIBUTES, ATTRIBUTE_IDS, ATTRIBUTE_ID_ORDER } = require('../src/attributes');
const { buildRow, generateQMatrix } = require('../src/qmatrix');
const { validateAssessment, validateQMatrix } = require('../src/validator');
const sampleData = require('../data/fractions_questions.json');

// ── Attribute bank tests ───────────────────────────────────────────────────

test('ATTRIBUTES has exactly 12 entries', () => {
  assert.equal(ATTRIBUTES.length, 12);
});

test('ATTRIBUTE_ID_ORDER contains A1 through A12 in correct order', () => {
  const expected = ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12'];
  assert.deepEqual(ATTRIBUTE_ID_ORDER, expected);
});

test('ATTRIBUTE_IDS set contains all 12 valid IDs', () => {
  assert.equal(ATTRIBUTE_IDS.size, 12);
  assert.ok(ATTRIBUTE_IDS.has('A1'));
  assert.ok(ATTRIBUTE_IDS.has('A12'));
  assert.ok(!ATTRIBUTE_IDS.has('A0'));
  assert.ok(!ATTRIBUTE_IDS.has('A13'));
});

// ── buildRow tests ─────────────────────────────────────────────────────────

test('buildRow: Q1 → A1 produces correct binary row', () => {
  const row = buildRow(['A1']);
  assert.equal(row.length, 12);
  assert.equal(row[0], 1);   // A1 column
  for (let i = 1; i < 12; i++) assert.equal(row[i], 0);
});

test('buildRow: Q4 → A4 produces 1 at index 3', () => {
  const row = buildRow(['A4']);
  assert.equal(row[3], 1);   // A4 is index 3
  assert.equal(row[0], 0);
  assert.equal(row[11], 0);
});

test('buildRow: Q11 → A11,A4 produces 1 at indices 10 and 3', () => {
  const row = buildRow(['A11', 'A4']);
  assert.equal(row[10], 1);  // A11
  assert.equal(row[3], 1);   // A4
  assert.equal(row[0], 0);
  assert.equal(row.length, 12);
});

test('buildRow: Q12 → A12,A9 produces 1 at indices 11 and 8', () => {
  const row = buildRow(['A12', 'A9']);
  assert.equal(row[11], 1);  // A12
  assert.equal(row[8], 1);   // A9
  assert.equal(row[0], 0);
});

test('buildRow: empty attribute list produces all-zero row', () => {
  const row = buildRow([]);
  assert.ok(row.every((v) => v === 0));
  assert.equal(row.length, 12);
});

// ── generateQMatrix tests ──────────────────────────────────────────────────

test('generateQMatrix: sample data produces 12 rows and 12 columns', () => {
  const result = generateQMatrix(sampleData.questions);
  assert.equal(result.rows, 12);
  assert.equal(result.cols, 12);
  assert.equal(result.qmatrix.length, 12);
  result.qmatrix.forEach((row) => assert.equal(row.length, 12));
});

test('generateQMatrix: all values are 0 or 1', () => {
  const result = generateQMatrix(sampleData.questions);
  result.qmatrix.forEach((row, r) => {
    row.forEach((val, c) => {
      assert.ok(val === 0 || val === 1, `Row ${r} Col ${c} is ${val}`);
    });
  });
});

test('generateQMatrix: Q1 (A1 only) has 1 only in column 0', () => {
  const result = generateQMatrix(sampleData.questions);
  const row = result.qmatrix[0]; // Q1
  assert.equal(row[0], 1);  // A1
  for (let c = 1; c < 12; c++) assert.equal(row[c], 0);
});

test('generateQMatrix: Q6 (A6) has 1 only in column 5', () => {
  const result = generateQMatrix(sampleData.questions);
  const row = result.qmatrix[5]; // Q6
  assert.equal(row[5], 1);  // A6
  for (let c = 0; c < 12; c++) {
    if (c !== 5) assert.equal(row[c], 0);
  }
});

test('generateQMatrix: Q12 (A12, A9) has 1 in columns 11 and 8', () => {
  const result = generateQMatrix(sampleData.questions);
  const row = result.qmatrix[11]; // Q12
  assert.equal(row[11], 1); // A12
  assert.equal(row[8], 1);  // A9
});

test('generateQMatrix: attributes array matches A1–A12 order', () => {
  const result = generateQMatrix(sampleData.questions);
  assert.deepEqual(result.attributes, ATTRIBUTE_ID_ORDER);
});

// ── validateAssessment tests ───────────────────────────────────────────────

test('validateAssessment: valid sample data passes', () => {
  const { valid, errors } = validateAssessment(sampleData);
  assert.equal(valid, true, `Errors: ${errors.join('; ')}`);
});

test('validateAssessment: missing questions array fails', () => {
  const { valid } = validateAssessment({ assessment: {} });
  assert.equal(valid, false);
});

test('validateAssessment: empty questions array fails', () => {
  const { valid } = validateAssessment({ assessment: {}, questions: [] });
  assert.equal(valid, false);
});

test('validateAssessment: unknown attribute_id fails', () => {
  const bad = {
    assessment: { title: 'T', subject: 'M', topic: 'F' },
    questions: [{
      question_id: 'Q1', question: 'Q?',
      options: { A: 'a', B: 'b', C: 'c', D: 'd' },
      correct_answer: 'A', attribute_ids: ['A99'], difficulty: 'easy'
    }]
  };
  const { valid, errors } = validateAssessment(bad);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('A99')));
});

test('validateAssessment: duplicate question_id fails', () => {
  const bad = {
    assessment: {},
    questions: [
      { question_id: 'Q1', question: 'Q?', options: { A:'a',B:'b',C:'c',D:'d' }, correct_answer:'A', attribute_ids:['A1'], difficulty:'easy' },
      { question_id: 'Q1', question: 'Q2?', options: { A:'a',B:'b',C:'c',D:'d' }, correct_answer:'B', attribute_ids:['A2'], difficulty:'easy' },
    ]
  };
  const { valid } = validateAssessment(bad);
  assert.equal(valid, false);
});

// ── validateQMatrix tests ──────────────────────────────────────────────────

test('validateQMatrix: valid 3×12 matrix passes', () => {
  const mat = [
    [0,0,0,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1],
  ];
  const { valid } = validateQMatrix(mat, 3);
  assert.equal(valid, true);
});

test('validateQMatrix: wrong row count fails', () => {
  const mat = [[1,0,0,0,0,0,0,0,0,0,0,0]];
  const { valid } = validateQMatrix(mat, 2);
  assert.equal(valid, false);
});

test('validateQMatrix: non-binary value fails', () => {
  const mat = [[2,0,0,0,0,0,0,0,0,0,0,0]];
  const { valid } = validateQMatrix(mat, 1);
  assert.equal(valid, false);
});

