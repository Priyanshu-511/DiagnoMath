import { Question } from '@/lib/questions/types';
import { BUILTIN_QUESTIONS } from './questions';

export interface QuizConfig {
  /** Number of questions to generate (default 10) */
  count?: number;
  /** Limit to specific topics; empty array = all topics */
  topics?: string[];
}

/**
 * Randomly sample `count` questions from the built-in bank.
 * Questions are shuffled so the order is different every time.
 */
export function generateQuiz(config: QuizConfig = {}): Question[] {
  const { count = 10, topics = [] } = config;

  const pool =
    topics.length > 0
      ? BUILTIN_QUESTIONS.filter((q) => topics.includes(q.topic))
      : BUILTIN_QUESTIONS;

  // Fisher-Yates shuffle on a copy
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** All unique topics available in the built-in bank. */
export const ALL_TOPICS: string[] = Array.from(
  new Set(BUILTIN_QUESTIONS.map((q) => q.topic))
).sort();

