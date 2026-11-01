/**
 * validator.js
 *
 * Validates assessment JSON input and the generated Q-matrix.
 * Checks include:
 *   - Required top-level fields (assessment, questions)
 *   - Each question has question_id, question text, options A–D,
 *     correct_answer (A–D), attribute_ids (1–12 valid IDs), and difficulty.
 *   - Unique question IDs
 *   - All attribute_ids belong to the fixed bank (A1–A12)
 *   - Matrix dimensions match the question count × 12
 *   - All matrix values are binary (0 or 1)
 */

'use strict';

const { ATTRIBUTE_IDS, ATTRIBUTE_ID_ORDER } = require('./attributes');

const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const REQUIRED_OPTION_KEYS = ['A', 'B', 'C', 'D'];

/**
 * Validate the assessment JSON payload.
 *
 * @param {unknown} payload
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateAssessment(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object'] };
  }

  // Top-level structure
  if (!payload.assessment || typeof payload.assessment !== 'object') {
    errors.push('Missing or invalid "assessment" field');
  }

  if (!Array.isArray(payload.questions)) {
    errors.push('Missing or invalid "questions" array');
    return { valid: false, errors };
  }

  if (payload.questions.length === 0) {
    errors.push('"questions" array must not be empty');
    return { valid: false, errors };
  }

  const seenIds = new Set();

  payload.questions.forEach((q, idx) => {
    const label = `Question[${idx}]`;

    if (!q || typeof q !== 'object') {
      errors.push(`${label}: must be an object`);
      return;
    }

    // question_id
    if (typeof q.question_id !== 'string' || !q.question_id.trim()) {
      errors.push(`${label}: missing or empty "question_id"`);
    } else {
      if (seenIds.has(q.question_id)) {
        errors.push(`${label}: duplicate question_id "${q.question_id}"`);
      }
      seenIds.add(q.question_id);
    }

    // question text
    if (typeof q.question !== 'string' || !q.question.trim()) {
      errors.push(`${label}: missing or empty "question" text`);
    }

    // options
    if (!q.options || typeof q.options !== 'object') {
      errors.push(`${label}: missing or invalid "options"`);
    } else {
      for (const key of REQUIRED_OPTION_KEYS) {
        if (typeof q.options[key] !== 'string' || !q.options[key].trim()) {
          errors.push(`${label}: missing or empty option "${key}"`);
        }
      }
    }

    // correct_answer
    if (!VALID_ANSWERS.has(q.correct_answer)) {
      errors.push(`${label}: "correct_answer" must be one of A, B, C, D`);
    }

    // attribute_ids
    if (!Array.isArray(q.attribute_ids) || q.attribute_ids.length === 0) {
      errors.push(`${label}: "attribute_ids" must be a non-empty array`);
    } else {
      q.attribute_ids.forEach((id) => {
        if (!ATTRIBUTE_IDS.has(id)) {
          errors.push(`${label}: unknown attribute_id "${id}" (valid: A1–A12)`);
        }
      });
    }

    // difficulty
    if (!VALID_DIFFICULTIES.has(q.difficulty)) {
      errors.push(`${label}: "difficulty" must be one of easy, medium, hard`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the generated Q-matrix.
 *
 * @param {number[][]} qmatrix     - The binary matrix to validate.
 * @param {number}     numQuestions - Expected number of rows.
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateQMatrix(qmatrix, numQuestions) {
  const errors = [];
  const expectedCols = ATTRIBUTE_ID_ORDER.length; // 12

  if (!Array.isArray(qmatrix)) {
    return { valid: false, errors: ['Q-matrix must be an array'] };
  }

  if (qmatrix.length !== numQuestions) {
    errors.push(
      `Q-matrix row count (${qmatrix.length}) does not match question count (${numQuestions})`
    );
  }

  qmatrix.forEach((row, r) => {
    if (!Array.isArray(row)) {
      errors.push(`Row ${r}: must be an array`);
      return;
    }
    if (row.length !== expectedCols) {
      errors.push(`Row ${r}: has ${row.length} columns, expected ${expectedCols}`);
    }
    row.forEach((val, c) => {
      if (val !== 0 && val !== 1) {
        errors.push(`Row ${r}, Col ${c}: value must be 0 or 1, got ${val}`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateAssessment, validateQMatrix };

