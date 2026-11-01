/**
 * server.mjs
 *
 * Express API server for the LLM Question Generation module.
 *
 * Endpoints:
 *   GET  /health                   — Health check
 *   POST /llm/identify-attributes  — Identify attributes from a PDF
 *   POST /llm/generate-from-pdf    — Generate questions from a PDF
 *   POST /llm/generate-from-text   — Generate questions from plain text
 *
 * API key resolution order:
 *   1. x-llm-api-key request header
 *   2. GEMINI_API_KEY environment variable
 *
 * Default port: 3100 (override with PORT env var)
 */

import express from 'express';
import multer from 'multer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink } from 'node:fs/promises';

import {
  identifyAttributes,
  generateFromPdf,
  generateFromText,
} from './qgen-service.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? '3100', 10);

const app = express();
app.use(express.json());

// Multer: save uploaded PDFs to a temp location
const upload = multer({
  dest: join(__dirname, '..', '.tmp-uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

/** Extract the API key from the request (header → env). */
function resolveApiKey(req) {
  return req.headers['x-llm-api-key'] ?? process.env.GEMINI_API_KEY ?? undefined;
}

/** Standard JSON error response. */
function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({ error: message, ...(details ? { details } : {}) });
}

// ── GET /health ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── POST /llm/identify-attributes ─────────────────────────────────────────

app.post('/llm/identify-attributes', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'A "pdf" file field is required');
  }

  const pdfPath = req.file.path;
  try {
    const result = await identifyAttributes({ pdfPath, apiKey: resolveApiKey(req) });
    return res.json(result);
  } catch (err) {
    const status = err.statusCode ?? 500;
    return sendError(res, status, err.message, err.details);
  } finally {
    // Clean up the temp file
    await unlink(pdfPath).catch(() => {});
  }
});

// ── POST /llm/generate-from-pdf ───────────────────────────────────────────

app.post('/llm/generate-from-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return sendError(res, 400, 'A "pdf" file field is required');
  }

  let selectedAttributes;
  try {
    selectedAttributes = JSON.parse(req.body.selected_attributes ?? '[]');
  } catch {
    return sendError(res, 400, '"selected_attributes" must be a valid JSON array string');
  }

  const numQuestions = parseInt(req.body.num_questions ?? '10', 10) || 10;
  const difficulty = req.body.difficulty ?? 'medium';
  const pdfPath = req.file.path;

  try {
    const result = await generateFromPdf({
      pdfPath,
      selectedAttributes,
      numQuestions,
      difficulty,
      apiKey: resolveApiKey(req),
    });
    return res.json(result);
  } catch (err) {
    const status = err.statusCode ?? 500;
    return sendError(res, status, err.message, err.details);
  } finally {
    await unlink(pdfPath).catch(() => {});
  }
});

// ── POST /llm/generate-from-text ──────────────────────────────────────────

app.post('/llm/generate-from-text', async (req, res) => {
  const { source_text, selected_attributes, num_questions, difficulty } = req.body;

  if (typeof source_text !== 'string' || !source_text.trim()) {
    return sendError(res, 400, '"source_text" is required and must be a non-empty string');
  }

  if (!Array.isArray(selected_attributes) || selected_attributes.length === 0) {
    return sendError(res, 400, '"selected_attributes" must be a non-empty array');
  }

  const numQuestions = Number(num_questions ?? 10) || 10;
  const diff = difficulty ?? 'medium';

  try {
    const result = await generateFromText({
      sourceText: source_text,
      selectedAttributes: selected_attributes,
      numQuestions,
      difficulty: diff,
      apiKey: resolveApiKey(req),
    });
    return res.json(result);
  } catch (err) {
    const status = err.statusCode ?? 500;
    return sendError(res, status, err.message, err.details);
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[llm-qgen] Server running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[llm-qgen] WARNING: GEMINI_API_KEY is not set. Supply it via the x-llm-api-key header or set the env var before starting.');
  }
});

export default app;

