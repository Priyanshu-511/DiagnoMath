/**
 * qgen-service.mjs
 *
 * Orchestrates the question-generation pipeline:
 *   1. Loads prompts and JSON schemas from disk.
 *   2. Validates selected attributes (must be from A1–A12).
 *   3. Builds a question-generation prompt by substituting placeholders.
 *   4. Calls the Gemini provider.
 *   5. Validates the generated question JSON.
 *   6. Returns the validated payload to the caller.
 *
 * This module does NOT handle HTTP concerns; that is server.mjs's job.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  identifyAttributesFromPdf,
  generateQuestionsFromPdf,
  generateQuestionsFromText,
} from './gemini-provider.mjs';

import {
  validateSelectedAttributes,
  validateQuestionOutput,
} from './validate-output.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

/** Read a prompt file by name (without extension). */
async function loadPrompt(name) {
  return readFile(join(PROMPTS_DIR, `${name}.txt`), 'utf8');
}

/**
 * Build the generation prompt by substituting template placeholders.
 *
 * @param {string} template
 * @param {{ selectedAttributes: string[]; numQuestions: number; difficulty: string }} params
 * @returns {string}
 */
function buildGenerationPrompt(template, { selectedAttributes, numQuestions, difficulty }) {
  return template
    .replace('{{NUM_QUESTIONS}}', String(numQuestions))
    .replace('{{SELECTED_ATTRIBUTES}}', selectedAttributes.join(', '))
    .replace('{{DIFFICULTY}}', difficulty);
}

// ── Public service functions ───────────────────────────────────────────────

/**
 * Identify relevant attributes from a PDF using Gemini.
 *
 * @param {{ pdfPath: string; apiKey?: string }} opts
 * @returns {Promise<{ relevant_attributes: string[] }>}
 */
export async function identifyAttributes({ pdfPath, apiKey }) {
  const prompt = await loadPrompt('identify-attributes');
  const result = await identifyAttributesFromPdf({ pdfPath, identifyPrompt: prompt, apiKey });
  return result;
}

/**
 * Generate questions from a PDF.
 *
 * @param {{
 *   pdfPath: string;
 *   selectedAttributes: string[];
 *   numQuestions?: number;
 *   difficulty?: string;
 *   apiKey?: string;
 * }} opts
 * @returns {Promise<object>} Validated assessment JSON
 */
export async function generateFromPdf({
  pdfPath,
  selectedAttributes,
  numQuestions = 10,
  difficulty = 'medium',
  apiKey,
}) {
  // Validate selected attributes
  const attrValidation = validateSelectedAttributes(selectedAttributes);
  if (!attrValidation.valid) {
    throw Object.assign(new Error('Invalid selected_attributes'), {
      details: attrValidation.errors,
      statusCode: 400,
    });
  }

  const template = await loadPrompt('generate-questions');
  const prompt = buildGenerationPrompt(template, { selectedAttributes, numQuestions, difficulty });

  const output = await generateQuestionsFromPdf({ pdfPath, generatePrompt: prompt, apiKey });

  const validation = validateQuestionOutput(output, { expectedCount: numQuestions, selectedAttributes });
  if (!validation.valid) {
    throw Object.assign(new Error('Generated questions failed validation'), {
      details: validation.errors,
      statusCode: 502,
    });
  }

  return output;
}

/**
 * Generate questions from plain text.
 *
 * @param {{
 *   sourceText: string;
 *   selectedAttributes: string[];
 *   numQuestions?: number;
 *   difficulty?: string;
 *   apiKey?: string;
 * }} opts
 * @returns {Promise<object>} Validated assessment JSON
 */
export async function generateFromText({
  sourceText,
  selectedAttributes,
  numQuestions = 10,
  difficulty = 'medium',
  apiKey,
}) {
  const attrValidation = validateSelectedAttributes(selectedAttributes);
  if (!attrValidation.valid) {
    throw Object.assign(new Error('Invalid selected_attributes'), {
      details: attrValidation.errors,
      statusCode: 400,
    });
  }

  const template = await loadPrompt('generate-questions');
  const prompt = buildGenerationPrompt(template, { selectedAttributes, numQuestions, difficulty });

  const output = await generateQuestionsFromText({ sourceText, generatePrompt: prompt, apiKey });

  const validation = validateQuestionOutput(output, { expectedCount: numQuestions, selectedAttributes });
  if (!validation.valid) {
    throw Object.assign(new Error('Generated questions failed validation'), {
      details: validation.errors,
      statusCode: 502,
    });
  }

  return output;
}

