export interface Question {
  id: string;
  topic: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /**
   * Q-matrix row: which skills this question requires.
   * Keys are skill names (e.g. "LCD", "NumOp", "Simplify"),
   * values are 0 (not required) or 1 (required).
   * Optional — only present when the imported file contains skill columns.
   */
  skills?: Record<string, 0 | 1>;
}

export interface QuestionBank {
  id: string;
  name: string;
  importedAt: string;
  questions: Question[];
}
