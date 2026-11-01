/**
 * server.js
 *
 * Express HTTP API for the Q-Matrix module.
 *
 * Endpoints:
 *   GET  /health           — Basic health check
 *   POST /qmatrix/generate — Validate input and return binary Q-matrix
 *
 * Default port: 3200  (override with PORT env var)
 */

'use strict';

const http = require('http');
const { validateAssessment, validateQMatrix } = require('./validator');
const { generateQMatrix } = require('./qmatrix');
const { generateQMatrixWithBertTiny } = require('./bert-qmatrix');

const PORT = parseInt(process.env.PORT ?? '3200', 10);

/** Minimal JSON body parser (no external dependency). */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || 'null'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, statusCode, body) {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  // ── GET /health ────────────────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  // ── POST /qmatrix/generate ─────────────────────────────────────────
  if (method === 'POST' && url === '/qmatrix/generate') {
    let payload;
    try {
      payload = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }

    // Step 1: validate assessment input
    const inputValidation = validateAssessment(payload);
    if (!inputValidation.valid) {
      return send(res, 400, {
        error: 'Assessment validation failed',
        details: inputValidation.errors,
      });
    }

    // Step 2: generate Q-matrix
    const result = generateQMatrix(payload.questions);

    // Step 3: validate the generated matrix
    const matrixValidation = validateQMatrix(result.qmatrix, payload.questions.length);
    if (!matrixValidation.valid) {
      // This should never happen with correct logic; surface as 500.
      return send(res, 500, {
        error: 'Generated Q-matrix failed internal validation',
        details: matrixValidation.errors,
      });
    }

    return send(res, 200, result);
  }

  // ── POST /qmatrix/bert-tiny/generate ─────────────────────────────────
  // Uses prajjwal1/bert-tiny locally without any Gemini API key
  if (method === 'POST' && url === '/qmatrix/bert-tiny/generate') {
    let payload;
    try {
      payload = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }

    if (!payload || !Array.isArray(payload.questions) || payload.questions.length === 0) {
      return send(res, 400, { error: '"questions" array is required and must not be empty' });
    }

    try {
      const result = generateQMatrixWithBertTiny(payload.questions);
      return send(res, 200, result);
    } catch (err) {
      return send(res, 500, { error: 'BERT-tiny classification failed', details: err.message });
    }
  }

  // ── 404 ────────────────────────────────────────────────────────────
  return send(res, 404, { error: `No route: ${method} ${url}` });
});

server.listen(PORT, () => {
  console.log(`[q-matrix] Server running on http://localhost:${PORT}`);
});

module.exports = server; // for testing

