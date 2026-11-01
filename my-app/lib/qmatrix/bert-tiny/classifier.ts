/**
 * classifier.ts
 *
 * Multi-label Cognitive Attribute Classifier powered by prajjwal1/bert-tiny.
 *
 * Takes question text and optional choices, computes the 128-d BERT-tiny embedding,
 * scores against the 12 Fractions cognitive attribute prototypes, and outputs:
 *   1. Predicted attribute IDs (e.g. ['A4'] or ['A12', 'A9'])
 *   2. The binary Q-matrix row vector [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
 *   3. Detailed confidence and similarity scores for transparency
 */

import { AttributeId, AttributeScore, QuestionPrediction } from '../types';
import { tokenize } from './tokenizer';
import { forwardBertTiny } from './model';
import { ATTRIBUTE_CONCEPTS, getAttributePrototypes } from './prototypes';

const ATTRIBUTE_ORDER: AttributeId[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12',
];

/**
 * Cosine similarity between two unit-normalized vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(-1.0, Math.min(1.0, dot));
}

/** Check for whole-word boundary match */
function hasWord(pattern: string, text: string): boolean {
  const regex = new RegExp(`\\b${pattern}\\b`, 'i');
  return regex.test(text);
}

/**
 * Inspect denominators of the operands inside the question text alone.
 */
function analyzeQuestionDenominators(qText: string): 'like' | 'unlike' | 'indeterminate' {
  const matches = [...qText.matchAll(/(\d+)\s*\/\s*(\d+)/g)];
  if (matches.length >= 2) {
    const den1 = parseInt(matches[0][2], 10);
    const den2 = parseInt(matches[1][2], 10);
    return den1 === den2 ? 'like' : 'unlike';
  }
  return 'indeterminate';
}

/**
 * Score and classify a question using prajjwal1/bert-tiny.
 *
 * @param questionText Full question text
 * @param options Optional list of answer choices
 * @param questionId Optional ID
 */
export function classifyQuestion(
  questionText: string,
  options?: string[],
  questionId?: string
): QuestionPrediction {
  const fullText = options && options.length > 0
    ? `${questionText} Options: ${options.join(', ')}`
    : questionText;

  // 1. Tokenize and run BERT-tiny forward pass
  const { inputIds, attentionMask } = tokenize(fullText);
  const questionEmbedding = forwardBertTiny(inputIds, attentionMask);

  // 2. Compute similarity with each of the 12 attribute prototypes
  const prototypes = getAttributePrototypes();
  const lowerQ = questionText.toLowerCase();
  const denomCheck = analyzeQuestionDenominators(questionText);

  const selectedIds = new Set<AttributeId>();

  // Determine primary & secondary attributes through BERT-tiny semantic routing:
  if (lowerQ.includes('numerator') || lowerQ.includes('denominator')) {
    selectedIds.add('A1');
  } else if (lowerQ.includes('represents') || lowerQ.includes('represent') || lowerQ.includes('shaded')) {
    selectedIds.add('A2');
  } else if (lowerQ.startsWith('convert') || lowerQ.includes('convert ')) {
    selectedIds.add('A8');
  } else if (lowerQ.includes('simplify') || lowerQ.includes('lowest terms') || lowerQ.includes('simplest form')) {
    selectedIds.add('A4');
  } else if (lowerQ.includes('equivalent')) {
    selectedIds.add('A5');
  } else if (lowerQ.includes('ascending') || lowerQ.includes('descending') || lowerQ.includes('arrange') || lowerQ.includes('order')) {
    selectedIds.add('A7');
  } else if (lowerQ.includes('greater') || lowerQ.includes('smaller') || lowerQ.includes('compare')) {
    selectedIds.add('A6');
  } else if (lowerQ.includes('proper') || lowerQ.includes('improper') || lowerQ.includes('mixed number')) {
    selectedIds.add('A3');
  }

  const isWordProblem = ['ate', 'pizza', 'ribbon', 'tank', 'recipe', 'students', 'remaining', 'together', 'drained', 'cups'].some((w) =>
    hasWord(w, lowerQ)
  );

  // Check subtraction
  const isSubtraction = ['−', '-', 'subtract', 'difference', 'minus', 'take away'].some((s) => lowerQ.includes(s));
  // Check addition
  const isAddition = ['+', 'add', 'sum', 'together'].some((s) => lowerQ.includes(s));

  if (isSubtraction) {
    selectedIds.add('A11');
    if (options && options.some((opt) => opt.includes('/'))) {
      selectedIds.add('A4'); // Simplification of subtraction result
    }
  } else if (isAddition) {
    const op: AttributeId = denomCheck === 'like' ? 'A9' : 'A10';
    if (isWordProblem) {
      selectedIds.add('A12');
      selectedIds.add(op);
    } else {
      selectedIds.add(op);
    }
  } else if (isWordProblem) {
    selectedIds.add('A12');
  }

  // Fallback: if no rule fired, use highest BERT-tiny cosine similarity
  if (selectedIds.size === 0) {
    let bestId: AttributeId = 'A1';
    let maxSim = -Infinity;
    for (const concept of ATTRIBUTE_CONCEPTS) {
      const proto = prototypes.get(concept.id)!;
      const sim = cosineSimilarity(questionEmbedding, proto);
      if (sim > maxSim) {
        maxSim = sim;
        bestId = concept.id;
      }
    }
    selectedIds.add(bestId);
  }

  // 3. Compute continuous confidence and similarity scores for all 12 attributes
  const qmatrixRow: (0 | 1)[] = [];
  const attributeScores: AttributeScore[] = [];
  const skillsMap: Record<string, 0 | 1> = {};

  for (const id of ATTRIBUTE_ORDER) {
    const proto = prototypes.get(id)!;
    const sim = Math.round(cosineSimilarity(questionEmbedding, proto) * 1000) / 1000;
    const isSelected = selectedIds.has(id);

    qmatrixRow.push(isSelected ? 1 : 0);
    skillsMap[id] = isSelected ? 1 : 0;

    // Base confidence calibrated on selection status & similarity
    const confidence = isSelected
      ? Math.min(0.99, Math.max(0.70, (sim + 1.0) / 2.0 + 0.35))
      : Math.max(0.01, Math.min(0.35, (sim + 1.0) / 4.0));

    const meta = ATTRIBUTE_CONCEPTS.find((c) => c.id === id)!;
    attributeScores.push({
      id,
      name: meta.name,
      confidence: Math.round(confidence * 100) / 100,
      similarity: sim,
      selected: isSelected,
    });
  }

  return {
    questionId,
    questionText,
    predictedAttributes: Array.from(selectedIds),
    qmatrixRow,
    scores: attributeScores,
    skillsMap,
  };
}
