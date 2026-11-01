/**
 * index.ts
 *
 * Public API for the offline prajjwal1/bert-tiny Q-Matrix Engine.
 *
 * Provides:
 *   - predictQuestionAttributes: classifies a single question into A1–A12 attributes
 *   - generateQMatrixRow: returns the 12-element binary row for a question
 *   - enrichQuestionsWithBertTiny: auto-annotates an entire question bank with cognitive skills
 *   - generateFullQMatrix: builds the complete binary Q-matrix for any assessment
 */

import { Question } from '../questions/types';
import {
  AttributeId,
  QMatrixGenerationResult,
  QuestionPrediction,
} from './types';
import { classifyQuestion } from './bert-tiny/classifier';
import { ATTRIBUTE_LIST } from './bert-tiny/prototypes';

export * from './types';
export { ATTRIBUTE_LIST } from './bert-tiny/prototypes';

const ATTRIBUTE_ORDER: AttributeId[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12',
];

/**
 * Predict cognitive attributes for a single question using prajjwal1/bert-tiny.
 */
export function predictQuestionAttributes(
  questionText: string,
  options?: string[],
  questionId?: string
): QuestionPrediction {
  return classifyQuestion(questionText, options, questionId);
}

/**
 * Generate a 12-element binary Q-matrix row for a single question.
 * Output order corresponds to A1 through A12.
 */
export function generateQMatrixRow(
  questionText: string,
  options?: string[]
): (0 | 1)[] {
  const prediction = classifyQuestion(questionText, options);
  return prediction.qmatrixRow;
}

/**
 * Automatically tag questions with cognitive skills using prajjwal1/bert-tiny.
 *
 * If a question already has skills annotated, it keeps them unless `forceOverwrite` is true.
 * Returns a new array of enriched questions ready for DINA diagnosis or saving.
 */
export function enrichQuestionsWithBertTiny(
  questions: Question[],
  forceOverwrite = false
): { enriched: Question[]; taggedCount: number } {
  let taggedCount = 0;

  const enriched = questions.map((q) => {
    if (!forceOverwrite && q.skills && Object.keys(q.skills).length > 0) {
      return q;
    }

    const prediction = classifyQuestion(q.text, q.options, q.id);
    taggedCount++;

    return {
      ...q,
      skills: prediction.skillsMap,
    };
  });

  return { enriched, taggedCount };
}

/**
 * Generate the full binary Q-Matrix for a list of questions using prajjwal1/bert-tiny.
 */
export function generateFullQMatrix(
  questions: Question[]
): QMatrixGenerationResult {
  const predictions: QuestionPrediction[] = [];
  const matrix: (0 | 1)[][] = [];
  const questionIds: string[] = [];

  const freq: Record<AttributeId, number> = {
    A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0,
    A7: 0, A8: 0, A9: 0, A10: 0, A11: 0, A12: 0,
  };

  let multiSkillCount = 0;

  for (const q of questions) {
    const pred = classifyQuestion(q.text, q.options, q.id);
    predictions.push(pred);
    matrix.push(pred.qmatrixRow);
    questionIds.push(q.id);

    if (pred.predictedAttributes.length > 1) {
      multiSkillCount++;
    }

    for (const attr of pred.predictedAttributes) {
      freq[attr] = (freq[attr] ?? 0) + 1;
    }
  }

  return {
    matrix,
    attributes: [...ATTRIBUTE_ORDER],
    questionIds,
    predictions,
    summary: {
      totalQuestions: questions.length,
      multiSkillCount,
      attributeFrequency: freq,
    },
  };
}

