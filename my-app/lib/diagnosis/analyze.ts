import { QuestionBank } from '@/lib/questions/types';
import { TestTemplate } from '@/lib/tests/types';
import { DetectedAnswer } from '@/lib/omr/types';

export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface Diagnosis {
  score: number;
  totalQuestions: number;
  percent: number;
  topicBreakdown: TopicBreakdown[];
  weakTopics: string[];
  /** 1-based question numbers the scanner couldn't read confidently */
  flaggedQuestions: number[];
}

const WEAK_THRESHOLD_PERCENT = 60;

export function analyzeScan(
  test: TestTemplate,
  bank: QuestionBank,
  detected: DetectedAnswer[]
): Diagnosis {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const topicMap = new Map<string, { correct: number; total: number }>();
  const flagged: number[] = [];
  let correctCount = 0;

  test.questionIds.forEach((qid, idx) => {
    const q = byId.get(qid);
    if (!q) return;

    const det = detected.find((d) => d.questionIndex === idx);
    if (det && det.flag !== 'ok') flagged.push(idx + 1);

    const isCorrect = det?.selectedOption != null && det.selectedOption === q.correctIndex;
    if (isCorrect) correctCount++;

    const stat = topicMap.get(q.topic) ?? { correct: 0, total: 0 };
    stat.total++;
    if (isCorrect) stat.correct++;
    topicMap.set(q.topic, stat);
  });

  const topicBreakdown: TopicBreakdown[] = Array.from(topicMap.entries()).map(([topic, s]) => ({
    topic,
    correct: s.correct,
    total: s.total,
    percent: Math.round((s.correct / s.total) * 100),
  }));

  const weakTopics = topicBreakdown.filter((t) => t.percent < WEAK_THRESHOLD_PERCENT).map((t) => t.topic);

  return {
    score: correctCount,
    totalQuestions: test.questionIds.length,
    percent: Math.round((correctCount / test.questionIds.length) * 100),
    topicBreakdown,
    weakTopics,
    flaggedQuestions: flagged,
  };
}
