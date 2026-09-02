export interface Question {
  id: string;
  topic: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export interface QuestionBank {
  id: string;
  name: string;
  importedAt: string;
  questions: Question[];
}
