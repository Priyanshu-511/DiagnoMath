/**
 * qmatrix.js
 *
 * Deterministic Q-matrix generation logic.
 * Converts each question's attribute_ids into a binary row whose columns
 * follow the fixed A1–A12 order defined in attributes.js.
 */

'use strict';

const { ATTRIBUTE_ID_ORDER } = require('./attributes');

/**
 * Build a single Q-matrix row (binary vector of length 12) for one question.
 *
 * @param {string[]} attributeIds  - The attribute IDs this question maps to (e.g. ["A4", "A11"]).
 * @returns {number[]}             - Binary row, one entry per attribute in A1–A12 order.
 */
function buildRow(attributeIds) {
  const idSet = new Set(attributeIds);
  return ATTRIBUTE_ID_ORDER.map((id) => (idSet.has(id) ? 1 : 0));
}

/**
 * Generate the full Q-matrix from a list of questions.
 *
 * @param {Array<{ question_id: string; attribute_ids: string[] }>} questions
 * @returns {{
 *   qmatrix: number[][];
 *   attributes: string[];
 *   questionIds: string[];
 *   rows: number;
 *   cols: number;
 * }}
 */
function generateQMatrix(questions) {
  const qmatrix = questions.map((q) => buildRow(q.attribute_ids));
  return {
    qmatrix,
    attributes: [...ATTRIBUTE_ID_ORDER],
    questionIds: questions.map((q) => q.question_id),
    rows: qmatrix.length,
    cols: ATTRIBUTE_ID_ORDER.length,
  };
}

module.exports = { buildRow, generateQMatrix };

