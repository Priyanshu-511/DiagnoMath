import { TopicBreakdown } from '@/lib/diagnosis/analyze';
import { DINAResult } from '@/lib/diagnosis/dina';

export interface ScanResult {
  id: string;
  testId: string;
  testName: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percent: number;
  topicBreakdown: TopicBreakdown[];
  weakTopics: string[];
  flaggedQuestions: number[];
  scannedAt: string;
  /** DINA cognitive diagnosis — present when the question bank has skill annotations. */
  dina?: DINAResult;
}
