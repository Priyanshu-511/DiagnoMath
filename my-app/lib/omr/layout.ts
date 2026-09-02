/**
 * Single source of truth for where bubbles sit on the page. The printed
 * answer sheet and the scanner's bubble-detection grid both derive their
 * coordinates from this file, so they always agree — as long as the
 * captured photo is cropped/resized to exactly PAGE_WIDTH x PAGE_HEIGHT
 * (see components/omr/BubbleScanner.tsx).
 */

export const PAGE_WIDTH = 794; // A4 @ 96dpi
export const PAGE_HEIGHT = 1123;
export const MAX_QUESTIONS_PER_SHEET = 30; // keeps everything on one page — see README
export const BUBBLE_RADIUS = 12;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const MARGIN_TOP = 170;
const MARGIN_BOTTOM = 70;

export const LABEL_X = 70;
export const OPTION_X = [220, 300, 380, 460];

export interface BubblePosition {
  questionIndex: number;
  optionIndex: number;
  x: number;
  y: number;
}

export function getRowY(index: number, questionCount: number): number {
  const usable = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
  const rowHeight = usable / questionCount;
  return MARGIN_TOP + rowHeight * index + rowHeight / 2;
}

export function getBubbleLayout(questionCount: number): BubblePosition[] {
  const positions: BubblePosition[] = [];
  for (let i = 0; i < questionCount; i++) {
    const y = getRowY(i, questionCount);
    OPTION_X.forEach((x, optionIndex) => {
      positions.push({ questionIndex: i, optionIndex, x, y });
    });
  }
  return positions;
}
