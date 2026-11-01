/**
 * gemini-provider.mjs
 *
 * Gemini-specific integration using @google/genai.
 * Handles:
 *   - PDF upload and inline text submission
 *   - Attribute identification from a PDF
 *   - Question generation from a PDF or plain text
 *
 * The caller must supply an API key either via:
 *   - The GEMINI_API_KEY environment variable, or
 *   - The `apiKey` parameter passed to each function.
 *
 * Do NOT hard-code keys here. Keep them out of version control.
 */

import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';

const MODEL = 'gemini-2.0-flash';

/** @param {string} [apiKey] */
function createClient(apiKey) {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'Gemini API key required. Set GEMINI_API_KEY env var or pass x-llm-api-key header.'
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Upload a PDF buffer to Gemini's File API and return the file URI.
 *
 * @param {GoogleGenAI} client
 * @param {Buffer} pdfBuffer
 * @param {string} displayName
 * @returns {Promise<string>} fileUri
 */
async function uploadPdf(client, pdfBuffer, displayName) {
  const uploadedFile = await client.files.upload({
    file: new Blob([pdfBuffer], { type: 'application/pdf' }),
    config: { displayName },
  });
  return uploadedFile.uri;
}

/**
 * Identify relevant cognitive attributes (A1–A12) from a PDF.
 *
 * @param {{
 *   pdfPath: string;
 *   identifyPrompt: string;
 *   apiKey?: string;
 * }} opts
 * @returns {Promise<{ relevant_attributes: string[] }>}
 */
export async function identifyAttributesFromPdf({ pdfPath, identifyPrompt, apiKey }) {
  const client = createClient(apiKey);
  const pdfBuffer = await readFile(pdfPath);
  const fileUri = await uploadPdf(client, pdfBuffer, 'source-material.pdf');

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { mimeType: 'application/pdf', fileUri } },
          { text: identifyPrompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
}

/**
 * Generate assessment questions from a PDF.
 *
 * @param {{
 *   pdfPath: string;
 *   generatePrompt: string;
 *   apiKey?: string;
 * }} opts
 * @returns {Promise<object>} Parsed question JSON
 */
export async function generateQuestionsFromPdf({ pdfPath, generatePrompt, apiKey }) {
  const client = createClient(apiKey);
  const pdfBuffer = await readFile(pdfPath);
  const fileUri = await uploadPdf(client, pdfBuffer, 'source-material.pdf');

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { mimeType: 'application/pdf', fileUri } },
          { text: generatePrompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
}

/**
 * Generate assessment questions from plain source text.
 *
 * @param {{
 *   sourceText: string;
 *   generatePrompt: string;
 *   apiKey?: string;
 * }} opts
 * @returns {Promise<object>} Parsed question JSON
 */
export async function generateQuestionsFromText({ sourceText, generatePrompt, apiKey }) {
  const client = createClient(apiKey);

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Source material:\n\n${sourceText}\n\n---\n\n${generatePrompt}` },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  return JSON.parse(response.text);
}

