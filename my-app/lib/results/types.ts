import { TopicBreakdown } from '@/lib/diagnosis/analyze';

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
}
