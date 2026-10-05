import { QuestionBank } from '@/lib/questions/types';
import { TestTemplate } from '@/lib/tests/types';
import { DetectedAnswer } from '@/lib/omr/types';
import { DINAResult, QMatrixRow, runDINA } from '@/lib/diagnosis/dina';

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
  /** DINA cognitive diagnosis — present when the question bank has skill annotations. */
  dina?: DINAResult;
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

  // Collect responses for DINA
  const responses: (0 | 1)[] = [];
  const qMatrixRows: QMatrixRow[] = [];
  let hasSkills = false;

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

    // DINA data
    responses.push(isCorrect ? 1 : 0);
    if (q.skills && Object.keys(q.skills).length > 0) {
      hasSkills = true;
      qMatrixRows.push({ questionId: q.id, required: q.skills });
    } else {
      // Placeholder — no skill info for this question
      qMatrixRows.push({ questionId: q.id, required: {} });
    }
  });

  const topicBreakdown: TopicBreakdown[] = Array.from(topicMap.entries()).map(([topic, s]) => ({
    topic,
    correct: s.correct,
    total: s.total,
    percent: Math.round((s.correct / s.total) * 100),
  }));

  const weakTopics = topicBreakdown.filter((t) => t.percent < WEAK_THRESHOLD_PERCENT).map((t) => t.topic);

  // Run DINA if skills are annotated
  let dina: DINAResult | undefined;
  if (hasSkills) {
    // Collect the unique set of skills across all items
    const skillSet = new Set<string>();
    for (const row of qMatrixRows) {
      for (const sk of Object.keys(row.required)) {
        skillSet.add(sk);
      }
    }
    // Limit to max 12 skills to prevent 2^N performance hang (2^12 = 4096 profiles)
    const skills = Array.from(skillSet).sort().slice(0, 12);

    if (skills.length > 0) {
      dina = runDINA({ skills, qMatrix: qMatrixRows, responses });
    }
  }

  return {
    score: correctCount,
    totalQuestions: test.questionIds.length,
    percent: test.questionIds.length > 0 ? Math.round((correctCount / test.questionIds.length) * 100) : 0,
    topicBreakdown,
    weakTopics,
    flaggedQuestions: flagged,
    ...(dina ? { dina } : {}),
  };
}
