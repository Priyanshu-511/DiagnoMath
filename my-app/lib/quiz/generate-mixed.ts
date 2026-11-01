/**
 * generate-mixed.ts
 *
 * Offline mixed-concept quiz generation for DiagnoMath.
 *
 * Goals
 * ─────
 * 1. Fully offline — no network, no server.  Questions come from the two
 *    built-in banks: BUILTIN_QUESTIONS (Class 6–7 general) and
 *    FRACTIONS_QUESTIONS (A1–A12 fractions attributes).
 * 2. Mixed-concept mode — when multiple topics are selected, the generator
 *    prioritises questions whose skill map requires ≥ 2 attributes (cross-
 *    concept items), then fills the rest with proportional stratified
 *    sampling across every selected topic so each topic gets fair coverage.
 * 3. Standard mode — plain random shuffle, same behaviour as the original
 *    generateQuiz() but drawing from the extended pool.
 *
 * The function never modifies either question bank.
 */

import { Question } from '@/lib/questions/types';
import { BUILTIN_QUESTIONS } from './questions';
import { FRACTIONS_QUESTIONS } from './questions-fractions';

// ── Combined offline pool ──────────────────────────────────────────────────

/** Every question available to the offline generator. */
export const OFFLINE_QUESTION_POOL: Question[] = [
  ...BUILTIN_QUESTIONS,
  ...FRACTIONS_QUESTIONS,
];

/** All unique topic labels across the full offline pool. */
export const ALL_TOPICS_OFFLINE: string[] = Array.from(
  new Set(OFFLINE_QUESTION_POOL.map((q) => q.topic))
).sort();

// ── Config ─────────────────────────────────────────────────────────────────

export interface MixedQuizConfig {
  /** Total number of questions to return (default 10). */
  count?: number;
  /**
   * Limit to these topic labels.
   * Empty array / omitted → draw from all topics.
   */
  topics?: string[];
  /**
   * When true (default) the generator prioritises questions that require
   * multiple cognitive skills (multi-attribute / cross-concept items) and
   * uses stratified sampling to keep topic coverage balanced.
   * When false, a plain random shuffle is used.
   */
  mixedConceptsMode?: boolean;
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Fisher-Yates in-place shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Number of skills set to 1 in a question's skill map. */
function skillCount(q: Question): number {
  if (!q.skills) return 0;
  return Object.values(q.skills).reduce<number>((sum, v) => sum + v, 0);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a quiz from the offline question pool.
 *
 * Mixed-concept algorithm (mixedConceptsMode = true):
 *   Phase 1 — Pick up to 50 % of `count` from cross-concept questions
 *             (skillCount > 1), shuffled randomly.
 *   Phase 2 — Fill the remaining slots using round-robin across the
 *             selected topics so no single topic dominates.
 *   Fallback — If the topic buckets are exhausted, borrow from any topic.
 *
 * @returns Shuffled array of Question, length ≤ count.
 */
export function generateMixedQuiz(config: MixedQuizConfig = {}): Question[] {
  const { count = 10, topics = [], mixedConceptsMode = true } = config;

  // Build filtered pool
  const topicSet = new Set(topics);
  const pool =
    topics.length > 0
      ? OFFLINE_QUESTION_POOL.filter((q) => topicSet.has(q.topic))
      : OFFLINE_QUESTION_POOL;

  if (pool.length === 0) return [];

  // Standard mode: plain shuffle
  if (!mixedConceptsMode) {
    return shuffle(pool).slice(0, Math.min(count, pool.length));
  }

  // ── Mixed-concept mode ────────────────────────────────────────────────

  const multiSkillItems = pool.filter((q) => skillCount(q) > 1);
  const singleSkillItems = pool.filter((q) => skillCount(q) <= 1);

  const selected: Question[] = [];
  const usedIds = new Set<string>();

  // Phase 1: up to 50 % cross-concept questions
  const crossConceptTarget = Math.min(
    Math.floor(count * 0.5),
    multiSkillItems.length
  );
  for (const q of shuffle(multiSkillItems)) {
    if (selected.length >= crossConceptTarget) break;
    selected.push(q);
    usedIds.add(q.id);
  }

  // Phase 2: stratified fill across topics
  const remaining = count - selected.length;
  if (remaining <= 0) return shuffle(selected).slice(0, count);

  const available = singleSkillItems.filter((q) => !usedIds.has(q.id));

  const activeTopics =
    topics.length > 0
      ? topics
      : Array.from(new Set(available.map((q) => q.topic)));

  if (activeTopics.length > 1) {
    // Build per-topic shuffled buckets
    const buckets: Question[][] = activeTopics.map((topic) =>
      shuffle(available.filter((q) => q.topic === topic))
    );

    // Round-robin across buckets until we have enough or all buckets empty
    let round = 0;
    let filled = 0;
    while (filled < remaining) {
      let addedThisRound = false;
      for (const bucket of buckets) {
        if (filled >= remaining) break;
        if (round < bucket.length) {
          const q = bucket[round];
          if (!usedIds.has(q.id)) {
            selected.push(q);
            usedIds.add(q.id);
            filled++;
            addedThisRound = true;
          }
        }
      }
      round++;
      if (!addedThisRound) break; // all buckets exhausted
    }

    // Fallback: borrow from any un-used question in the full pool
    if (selected.length < count) {
      for (const q of shuffle(OFFLINE_QUESTION_POOL)) {
        if (selected.length >= count) break;
        if (!usedIds.has(q.id)) {
          selected.push(q);
          usedIds.add(q.id);
        }
      }
    }
  } else {
    // Single topic (or all topics treated as one): just fill from available
    for (const q of shuffle(available)) {
      if (selected.length >= count) break;
      selected.push(q);
    }
  }

  return shuffle(selected).slice(0, count);
}

/**
 * Describe the mix of a generated quiz for display in the UI.
 * e.g. "3 cross-concept, 7 single-skill | Topics: Fractions, Algebra"
 */
export function describeMix(questions: Question[]): string {
  const crossCount = questions.filter((q) => skillCount(q) > 1).length;
  const topics = Array.from(new Set(questions.map((q) => q.topic))).sort();
  const topicStr = topics.length <= 3 ? topics.join(', ') : `${topics.length} topics`;
  const mixStr =
    crossCount > 0
      ? `${crossCount} cross-concept + ${questions.length - crossCount} single-skill`
      : `${questions.length} questions`;
  return `${mixStr} | ${topicStr}`;
}

