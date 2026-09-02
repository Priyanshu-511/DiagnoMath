export interface TestTemplate {
  id: string;
  name: string;
  bankId: string;
  /** Order matters — this is the order questions appear on the printed sheet. */
  questionIds: string[];
  createdAt: string;
}
