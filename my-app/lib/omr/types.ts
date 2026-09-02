export interface DetectedAnswer {
  questionIndex: number;
  selectedOption: 0 | 1 | 2 | 3 | null;
  /** 'ok' = one clear mark, 'blank' = no mark detected, 'multiple' = more than one mark — flag for manual check */
  flag: 'ok' | 'blank' | 'multiple';
}
