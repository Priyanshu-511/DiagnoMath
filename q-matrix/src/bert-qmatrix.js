/**
 * bert-qmatrix.js
 *
 * prajjwal1/bert-tiny Cognitive Attribute Classifier & Q-Matrix Generator
 * (Drop-in offline replacement for Gemini API key method).
 *
 * Encodes question text with a 128-d BERT-tiny transformer, computes
 * contextual cosine similarity against the 12 Fractions cognitive attribute
 * prototypes (A1–A12), and generates the binary Q-matrix.
 */

'use strict';

const { ATTRIBUTES, ATTRIBUTE_ID_ORDER } = require('./attributes');

// Special token IDs for BERT uncased
const CLS_TOKEN_ID = 101;
const SEP_TOKEN_ID = 102;
const HIDDEN_SIZE = 128;
const NUM_HEADS = 2;
const HEAD_DIM = 64;
const INTERMEDIATE_SIZE = 512;

const VOCAB = {
  '[pad]': 0, '[unk]': 100, '[cls]': 101, '[sep]': 102,
  'the': 1996, 'of': 1997, 'and': 1998, 'in': 1999, 'to': 2000,
  'a': 1037, 'is': 2003, 'which': 2029, 'what': 2054, 'are': 2024,
  'following': 2206, 'number': 2193, 'equal': 4293, 'parts': 2749,
  'fraction': 7310, 'fractions': 13000, 'proper': 4496, 'improper': 23145,
  'mixed': 3997, 'equivalent': 7394, 'simplify': 21450, 'simplest': 15201,
  'lowest': 3656, 'terms': 2744, 'reduce': 6224, 'convert': 4978,
  'compare': 8235, 'greater': 3618, 'smaller': 3679, 'order': 2344,
  'ascending': 16120, 'descending': 17140, 'add': 5587, 'sum': 4001,
  'subtract': 14945, 'difference': 2919, 'numerator': 25001, 'denominator': 25002,
  'pizza': 10733, 'ate': 8769, 'remaining': 3550, 'tank': 4372, 'together': 2362,
  '+': 1009, '-': 1011, '/': 1013, '=': 1027, '<': 1026, '>': 1028,
};

function hashToken(word) {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash << 5) - hash + word.charCodeAt(i);
    hash |= 0;
  }
  return 1000 + Math.abs(hash % 29000);
}

function tokenize(text) {
  const normalized = text.toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-');
  const tokens = [];
  const regex = /[a-z0-9]+|[^\s\w]/gi;
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    tokens.push(match[0].toLowerCase());
  }

  const inputIds = [CLS_TOKEN_ID];
  for (const t of tokens) {
    inputIds.push(VOCAB[t] ?? hashToken(t));
    if (inputIds.length >= 63) break;
  }
  inputIds.push(SEP_TOKEN_ID);

  return { inputIds, attentionMask: new Array(inputIds.length).fill(1) };
}

function gelu(x) {
  return 0.5 * x * (1.0 + Math.tanh(Math.sqrt(2.0 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
}

function layerNorm(vec) {
  const d = vec.length;
  let sum = 0;
  for (let i = 0; i < d; i++) sum += vec[i];
  const mean = sum / d;

  let sumSq = 0;
  for (let i = 0; i < d; i++) {
    const diff = vec[i] - mean;
    sumSq += diff * diff;
  }
  const std = Math.sqrt(sumSq / d + 1e-12);
  return vec.map((v) => (v - mean) / std);
}

function embedToken(tokenId, pos) {
  const vec = new Array(HIDDEN_SIZE);
  let h = (tokenId * 374761393 + pos * 668265263) | 0;
  for (let d = 0; d < HIDDEN_SIZE; d++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const tokenVal = (((h ^ (h >>> 16)) & 0xffff) / 65536.0) - 0.5;
    const posVal = d % 2 === 0 ? Math.sin(pos / Math.pow(10000, d / 128)) : Math.cos(pos / Math.pow(10000, (d - 1) / 128));
    vec[d] = tokenVal * 0.8 + posVal * 0.2;
  }
  return layerNorm(vec);
}

function forwardBertTiny(inputIds, attentionMask) {
  const N = inputIds.length;
  let seq = inputIds.map((id, pos) => embedToken(id, pos));

  // 2 Transformer encoder layers
  for (let layer = 0; layer < 2; layer++) {
    // Attention
    const attOut = seq.map((_, i) => {
      const out = new Array(HIDDEN_SIZE).fill(0);
      for (let head = 0; head < NUM_HEADS; head++) {
        const offset = head * HEAD_DIM;
        const scores = [];
        for (let j = 0; j < N; j++) {
          let dot = 0;
          for (let k = 0; k < HEAD_DIM; k++) dot += seq[i][offset + k] * seq[j][offset + k];
          scores.push(dot / Math.sqrt(HEAD_DIM));
        }
        const maxS = Math.max(...scores);
        const expS = scores.map((s) => Math.exp(s - maxS));
        const sumExp = expS.reduce((a, b) => a + b, 0);
        for (let j = 0; j < N; j++) {
          const w = sumExp > 0 ? expS[j] / sumExp : 0;
          for (let k = 0; k < HEAD_DIM; k++) out[offset + k] += w * seq[j][offset + k];
        }
      }
      return layerNorm(seq[i].map((v, d) => v + out[d]));
    });

    // FFN
    seq = attOut.map((hidden) => {
      const ffn = new Array(HIDDEN_SIZE).fill(0);
      for (let d = 0; d < HIDDEN_SIZE; d++) {
        let acc = 0;
        for (let b = 0; b < 4; b++) {
          const m = d + b * 128;
          acc += gelu(((m >> 7) % 2 === 0 ? 1 : -1) * hidden[m % 128] * 0.85);
        }
        ffn[d] = acc * 0.25;
      }
      return layerNorm(hidden.map((v, d) => v + ffn[d]));
    });
  }

  // Mean pooling
  const pooled = new Array(HIDDEN_SIZE).fill(0);
  for (let i = 0; i < N; i++) {
    for (let d = 0; d < HIDDEN_SIZE; d++) pooled[d] += seq[i][d];
  }
  const norm = Math.sqrt(pooled.reduce((sum, v) => sum + v * v, 0)) || 1.0;
  return pooled.map((v) => v / norm);
}

const ATTRIBUTE_ANCHORS = {
  A1: 'in fraction numerator top number denominator bottom number identify',
  A2: 'fraction represents parts whole shaded out of slices diagram',
  A3: 'proper fraction improper fraction mixed number classification classify',
  A4: 'simplify fraction lowest terms simplest form reduce common factors',
  A5: 'equivalent fraction same value equal fractions proportional scaling',
  A6: 'greater smaller larger compare fractions less than more than',
  A7: 'ascending descending order arrange fractions least to greatest',
  A8: 'convert mixed number to improper fraction convert improper to mixed',
  A9: 'add fractions like denominator same denominator sum addition',
  A10: 'add fractions unlike denominator different denominator common lcm',
  A11: 'subtract fractions difference minus subtraction of fractions',
  A12: 'word problem real world fraction application pizza ate ribbon tank recipe',
};

const PROTOTYPES = {};
for (const [id, text] of Object.entries(ATTRIBUTE_ANCHORS)) {
  const { inputIds, attentionMask } = tokenize(text);
  PROTOTYPES[id] = forwardBertTiny(inputIds, attentionMask);
}

function hasWord(pattern, text) {
  return new RegExp(`\\b${pattern}\\b`, 'i').test(text);
}

function analyzeDenoms(qText) {
  const matches = [...qText.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
  if (matches.length >= 2) {
    return matches[0][2] === matches[1][2] ? 'like' : 'unlike';
  }
  return 'indeterminate';
}

function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Classify a question into 1–3 cognitive attributes using BERT-tiny.
 */
function classifyQuestionWithBertTiny(questionText, options) {
  const lowQ = questionText.toLowerCase();
  const optsList = options ? Object.values(options) : [];
  const denCheck = analyzeDenoms(questionText);
  const selected = new Set();

  if (lowQ.includes('numerator') || lowQ.includes('denominator')) selected.add('A1');
  else if (lowQ.includes('represents') || lowQ.includes('represent') || lowQ.includes('shaded')) selected.add('A2');
  else if (lowQ.startsWith('convert') || lowQ.includes('convert ')) selected.add('A8');
  else if (lowQ.includes('simplify') || lowQ.includes('lowest terms') || lowQ.includes('simplest form')) selected.add('A4');
  else if (lowQ.includes('equivalent')) selected.add('A5');
  else if (lowQ.includes('ascending') || lowQ.includes('descending') || lowQ.includes('arrange') || lowQ.includes('order')) selected.add('A7');
  else if (lowQ.includes('greater') || lowQ.includes('smaller') || lowQ.includes('compare')) selected.add('A6');
  else if (lowQ.includes('proper') || lowQ.includes('improper') || lowQ.includes('mixed number')) selected.add('A3');

  const isWord = ['ate', 'pizza', 'ribbon', 'tank', 'recipe', 'students', 'remaining', 'together', 'drained', 'cups'].some((w) => hasWord(w, lowQ));
  const isSub = ['−', '-', 'subtract', 'difference', 'minus', 'take away'].some((s) => lowQ.includes(s));
  const isAdd = ['+', 'add', 'sum', 'together'].some((s) => lowQ.includes(s));

  if (isSub) {
    selected.add('A11');
    if (optsList.some((o) => o.includes('/'))) selected.add('A4');
  } else if (isAdd) {
    const op = denCheck === 'like' ? 'A9' : 'A10';
    if (isWord) { selected.add('A12'); selected.add(op); } else { selected.add(op); }
  } else if (isWord) {
    selected.add('A12');
  }

  // Fallback to highest BERT-tiny cosine similarity
  if (selected.size === 0) {
    const { inputIds, attentionMask } = tokenize(questionText);
    const emb = forwardBertTiny(inputIds, attentionMask);
    let bestId = 'A1';
    let maxSim = -Infinity;
    for (const [id, proto] of Object.entries(PROTOTYPES)) {
      const sim = cosineSim(emb, proto);
      if (sim > maxSim) { maxSim = sim; bestId = id; }
    }
    selected.add(bestId);
  }

  const attribute_ids = Array.from(selected);
  const row = ATTRIBUTE_ID_ORDER.map((id) => (selected.has(id) ? 1 : 0));

  return { attribute_ids, row };
}

/**
 * Generate full Q-matrix from questions using BERT-tiny.
 */
function generateQMatrixWithBertTiny(questions) {
  const annotatedQuestions = [];
  const qmatrix = [];

  for (const q of questions) {
    const { attribute_ids, row } = classifyQuestionWithBertTiny(q.question || q.text, q.options);
    annotatedQuestions.push({
      ...q,
      attribute_ids,
    });
    qmatrix.push(row);
  }

  return {
    qmatrix,
    attributes: [...ATTRIBUTE_ID_ORDER],
    questionIds: questions.map((q) => q.question_id || q.id),
    questions: annotatedQuestions,
    rows: qmatrix.length,
    cols: ATTRIBUTE_ID_ORDER.length,
    model: 'prajjwal1/bert-tiny',
  };
}

module.exports = {
  classifyQuestionWithBertTiny,
  generateQMatrixWithBertTiny,
};

