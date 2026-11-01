/**
 * validate-output.mjs
 *
 * Validates attribute IDs and generated question JSON.
 * Checks:
 *   - Selected attribute IDs are from A1–A12.
 *   - assessment object exists.
 *   - questions array is present and non-empty, matches requested count.
 *   - Each question has a unique question_id and unique non-empty question text.
 *   - Four populated, unique options (A–D).
 *   - correct_answer is A, B, C, or D.
 *   - attribute_ids: 1–3 valid IDs from A1–A12.
 *   - difficulty is easy | medium | hard.
 */

const VALID_ATTRIBUTE_IDS = new Set([
  'A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12',
]);
const VALID_ANSWERS = new Set(['A','B','C','D']);
const VALID_DIFFICULTIES = new Set(['easy','medium','hard']);
const OPTION_KEYS = ['A','B','C','D'];

/**
 * Validate the list of selected attribute IDs supplied by the teacher.
 *
 * @param {string[]} ids
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateSelectedAttributes(ids) {
  const errors = [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return { valid: false, errors: ['"selected_attributes" must be a non-empty array'] };
  }
  ids.forEach((id) => {
    if (!VALID_ATTRIBUTE_IDS.has(id)) {
      errors.push(`Unknown attribute ID: "${id}" (valid: A1–A12)`);
    }
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Validate generated question JSON returned by Gemini.
 *
 * @param {unknown} output
 * @param {{ expectedCount?: number; selectedAttributes?: string[] }} [opts]
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateQuestionOutput(output, opts = {}) {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return { valid: false, errors: ['Output must be a JSON object'] };
  }

  // assessment
  if (!output.assessment || typeof output.assessment !== 'object') {
    errors.push('Missing or invalid "assessment" object');
  }

  // questions array
  if (!Array.isArray(output.questions)) {
    errors.push('Missing or invalid "questions" array');
    return { valid: false, errors };
  }

  if (output.questions.length === 0) {
    errors.push('"questions" array must not be empty');
    return { valid: false, errors };
  }

  if (opts.expectedCount != null && output.questions.length !== opts.expectedCount) {
    errors.push(
      `Expected ${opts.expectedCount} questions, got ${output.questions.length}`
    );
  }

  const seenIds = new Set();
  const seenTexts = new Set();
  const allowedAttrs = opts.selectedAttributes
    ? new Set(opts.selectedAttributes)
    : VALID_ATTRIBUTE_IDS;

  output.questions.forEach((q, idx) => {
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
    } else {
      const key = q.question.trim().toLowerCase();
      if (seenTexts.has(key)) {
        errors.push(`${label}: duplicate question text`);
      }
      seenTexts.add(key);
    }

    // options
    if (!q.options || typeof q.options !== 'object') {
      errors.push(`${label}: missing or invalid "options"`);
    } else {
      const optionValues = [];
      for (const key of OPTION_KEYS) {
        if (typeof q.options[key] !== 'string' || !q.options[key].trim()) {
          errors.push(`${label}: missing or empty option "${key}"`);
        } else {
          optionValues.push(q.options[key].trim().toLowerCase());
        }
      }
      // Check for duplicate option values
      if (new Set(optionValues).size !== optionValues.length) {
        errors.push(`${label}: options must be unique`);
      }
    }

    // correct_answer
    if (!VALID_ANSWERS.has(q.correct_answer)) {
      errors.push(`${label}: "correct_answer" must be A, B, C, or D`);
    }

    // attribute_ids
    if (!Array.isArray(q.attribute_ids) || q.attribute_ids.length === 0) {
      errors.push(`${label}: "attribute_ids" must be a non-empty array`);
    } else if (q.attribute_ids.length > 3) {
      errors.push(`${label}: "attribute_ids" may have at most 3 entries`);
    } else {
      q.attribute_ids.forEach((id) => {
        if (!VALID_ATTRIBUTE_IDS.has(id)) {
          errors.push(`${label}: unknown attribute_id "${id}"`);
        } else if (!allowedAttrs.has(id)) {
          errors.push(`${label}: attribute_id "${id}" was not in selected attributes`);
        }
      });
    }

    // difficulty
    if (!VALID_DIFFICULTIES.has(q.difficulty)) {
      errors.push(`${label}: "difficulty" must be easy, medium, or hard`);
    }
  });

  return { valid: errors.length === 0, errors };
}

