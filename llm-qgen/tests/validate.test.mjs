/**
 * validate.test.mjs
 *
 * Automated tests for validate-output.mjs using Node.js built-in test runner.
 * Run with: node --test tests/validate.test.mjs
 *
 * These tests cover validation logic only — no live Gemini API calls.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSelectedAttributes,
  validateQuestionOutput,
} from '../src/validate-output.mjs';

// ── validateSelectedAttributes ─────────────────────────────────────────────

test('validateSelectedAttributes: valid known IDs pass', () => {
  const { valid, errors } = validateSelectedAttributes(['A4', 'A6', 'A11']);
  assert.equal(valid, true, `Errors: ${errors.join('; ')}`);
});

test('validateSelectedAttributes: all 12 IDs accepted', () => {
  const all = ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12'];
  const { valid } = validateSelectedAttributes(all);
  assert.equal(valid, true);
});

test('validateSelectedAttributes: unknown ID fails', () => {
  const { valid, errors } = validateSelectedAttributes(['A4', 'A99']);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('A99')));
});

test('validateSelectedAttributes: empty array fails', () => {
  const { valid } = validateSelectedAttributes([]);
  assert.equal(valid, false);
});

test('validateSelectedAttributes: non-array fails', () => {
  const { valid } = validateSelectedAttributes(null);
  assert.equal(valid, false);
});

// ── validateQuestionOutput: acceptance ────────────────────────────────────

const VALID_QUESTION = {
  question_id: 'Q1',
  question: 'Simplify 12/18.',
  options: { A: '2/3', B: '3/4', C: '4/5', D: '6/9' },
  correct_answer: 'A',
  attribute_ids: ['A4'],
  difficulty: 'medium',
};

const VALID_OUTPUT = {
  assessment: { title: 'Fractions Assessment', subject: 'Mathematics', topic: 'Fractions' },
  questions: [VALID_QUESTION],
};

test('validateQuestionOutput: valid output passes', () => {
  const { valid, errors } = validateQuestionOutput(VALID_OUTPUT);
  assert.equal(valid, true, `Errors: ${errors.join('; ')}`);
});

test('validateQuestionOutput: valid output with selectedAttributes check passes', () => {
  const { valid } = validateQuestionOutput(VALID_OUTPUT, { selectedAttributes: ['A4'] });
  assert.equal(valid, true);
});

test('validateQuestionOutput: multiple valid questions pass', () => {
  const output = {
    assessment: VALID_OUTPUT.assessment,
    questions: [
      { ...VALID_QUESTION, question_id: 'Q1', question: 'Simplify 12/18.' },
      { ...VALID_QUESTION, question_id: 'Q2', question: 'Simplify 6/9.', attribute_ids: ['A4'] },
    ],
  };
  const { valid, errors } = validateQuestionOutput(output);
  assert.equal(valid, true, `Errors: ${errors.join('; ')}`);
});

// ── validateQuestionOutput: rejection ─────────────────────────────────────

test('validateQuestionOutput: missing assessment fails', () => {
  const { valid } = validateQuestionOutput({ questions: [VALID_QUESTION] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: empty questions array fails', () => {
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: wrong question count fails', () => {
  const { valid } = validateQuestionOutput(VALID_OUTPUT, { expectedCount: 5 });
  assert.equal(valid, false);
});

test('validateQuestionOutput: duplicate question_id fails', () => {
  const output = {
    assessment: VALID_OUTPUT.assessment,
    questions: [
      { ...VALID_QUESTION, question_id: 'Q1', question: 'Q one?' },
      { ...VALID_QUESTION, question_id: 'Q1', question: 'Q two?' },
    ],
  };
  const { valid } = validateQuestionOutput(output);
  assert.equal(valid, false);
});

test('validateQuestionOutput: duplicate question text fails', () => {
  const output = {
    assessment: VALID_OUTPUT.assessment,
    questions: [
      { ...VALID_QUESTION, question_id: 'Q1', question: 'Same text?' },
      { ...VALID_QUESTION, question_id: 'Q2', question: 'Same text?' },
    ],
  };
  const { valid } = validateQuestionOutput(output);
  assert.equal(valid, false);
});

test('validateQuestionOutput: invalid correct_answer fails', () => {
  const q = { ...VALID_QUESTION, correct_answer: 'E' };
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: unknown attribute_id fails', () => {
  const q = { ...VALID_QUESTION, attribute_ids: ['A99'] };
  const { valid, errors } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('A99')));
});

test('validateQuestionOutput: more than 3 attribute_ids fails', () => {
  const q = { ...VALID_QUESTION, attribute_ids: ['A1','A2','A3','A4'] };
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: attribute not in selectedAttributes fails', () => {
  const { valid, errors } = validateQuestionOutput(VALID_OUTPUT, {
    selectedAttributes: ['A6'],  // Q1 uses A4, not A6
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('A4')));
});

test('validateQuestionOutput: invalid difficulty fails', () => {
  const q = { ...VALID_QUESTION, difficulty: 'extreme' };
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: duplicate options fail', () => {
  const q = {
    ...VALID_QUESTION,
    options: { A: '2/3', B: '2/3', C: '4/5', D: '6/9' }, // A and B are same
  };
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
});

test('validateQuestionOutput: missing option key fails', () => {
  const q = { ...VALID_QUESTION, options: { A: '2/3', B: '3/4', C: '4/5' } }; // missing D
  const { valid } = validateQuestionOutput({ assessment: {}, questions: [q] });
  assert.equal(valid, false);
});

