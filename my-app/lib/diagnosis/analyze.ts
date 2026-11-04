import { QuestionBank } from '@/lib/questions/types';
import { TestTemplate } from '@/lib/tests/types';
import { DetectedAnswer } from '@/lib/omr/types';
import { DINAResult, QMatrixRow, runDINA } from '@/lib/diagnosis/dina';
import { getSkillLabel } from '@/lib/diagnosis/skillLabels';

export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

export interface QuestionDetail {
  questionIndex: number;
  questionNumber: number;
  questionText: string;
  topic: string;
  options: string[];
  chosenOption: number | null;
  chosenLabel: string;
  correctOption: number;
  correctLabel: string;
  isCorrect: boolean;
  isNotAttempt?: boolean;
  subtopic?: string;
}

export interface Diagnosis {
  score: number;
  totalQuestions: number;
  percent: number;
  topicBreakdown: TopicBreakdown[];
  weakTopics: string[];
  /** 1-based question numbers the scanner couldn't read confidently */
  flaggedQuestions: number[];
  /** Detailed breakdown per question showing chosen and correct options */
  questionDetails: QuestionDetail[];
  /** DINA cognitive diagnosis — present when the question bank has skill annotations. */
  dina?: DINAResult;
}

const WEAK_THRESHOLD_PERCENT = 60;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function analyzeScan(
  test: TestTemplate,
  bank: QuestionBank,
  detected: DetectedAnswer[]
): Diagnosis {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  const topicMap = new Map<string, { correct: number; total: number }>();
  const flagged: number[] = [];
  const questionDetails: QuestionDetail[] = [];
  let correctCount = 0;

  // Collect responses for DINA
  const responses: (0 | 1)[] = [];
  const qMatrixRows: QMatrixRow[] = [];
  let hasSkills = false;

  test.questionIds.forEach((qid, idx) => {
    const q = byId.get(qid);
    if (!q) return;

    const det = detected.find((d) => d.questionIndex === idx);
    const isExplicitNotAttempt = det?.selectedOption === null && det?.confidence === 99;

    // Only flag for manual verification if mark is ambiguous, not when deliberately unattempted
    if (det && det.flag !== 'ok' && !isExplicitNotAttempt) {
      flagged.push(idx + 1);
    }

    const chosenOpt = det?.selectedOption ?? null;
    const isCorrect = chosenOpt !== null && chosenOpt === q.correctIndex;
    if (isCorrect) correctCount++;

    const chosenLbl =
      chosenOpt !== null
        ? OPTION_LABELS[chosenOpt] ?? '—'
        : isExplicitNotAttempt
        ? 'Not Attempted'
        : '—';
    const correctLbl = OPTION_LABELS[q.correctIndex] ?? '—';

    // Find human-readable subtopic from question skill annotations
    let subtopic: string | undefined;
    if (q.skills) {
      const active = Object.entries(q.skills)
        .filter(([_, v]) => v === 1)
        .map(([k]) => getSkillLabel(k));
      if (active.length > 0) {
        subtopic = active.join(', ');
      }
    }

    questionDetails.push({
      questionIndex: idx,
      questionNumber: idx + 1,
      questionText: q.text,
      topic: q.topic,
      options: q.options,
      chosenOption: chosenOpt,
      chosenLabel: chosenLbl,
      correctOption: q.correctIndex,
      correctLabel: correctLbl,
      isCorrect,
      isNotAttempt: isExplicitNotAttempt,
      subtopic,
    });

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
    questionDetails,
    ...(dina ? { dina } : {}),
  };
}
