/**
 * types.ts
 *
 * Types for the offline BERT-tiny Q-Matrix cognitive classification engine.
 */

export type AttributeId =
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'
  | 'A7'
  | 'A8'
  | 'A9'
  | 'A10'
  | 'A11'
  | 'A12';

export interface AttributeMeta {
  id: AttributeId;
  name: string;
  description: string;
}

export interface AttributeScore {
  id: AttributeId;
  name: string;
  confidence: number; // 0.0 to 1.0
  similarity: number;  // cosine similarity (-1.0 to 1.0)
  selected: boolean;   // whether included in the binary Q-matrix row (1 or 0)
}

export interface QuestionPrediction {
  questionId?: string;
  questionText: string;
  predictedAttributes: AttributeId[];
  qmatrixRow: (0 | 1)[]; // length 12, ordered A1 to A12
  scores: AttributeScore[];
  skillsMap: Record<string, 0 | 1>; // ready to assign to Question.skills
}

export interface QMatrixGenerationResult {
  matrix: (0 | 1)[][]; // J rows x 12 cols
  attributes: AttributeId[];
  questionIds: string[];
  predictions: QuestionPrediction[];
  summary: {
    totalQuestions: number;
    multiSkillCount: number;
    attributeFrequency: Record<AttributeId, number>;
  };
}

