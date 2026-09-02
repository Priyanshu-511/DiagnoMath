import { QuestionBank } from '@/lib/questions/types';
import { TestTemplate } from '@/lib/tests/types';

import {
  BUBBLE_RADIUS,
  LABEL_X,
  OPTION_LETTERS,
  OPTION_X,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  getRowY,
} from './layout';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The sheet students actually bubble in — numbers + circles only, no question text. */
export function generateAnswerSheetHtml(test: TestTemplate): string {
  const count = test.questionIds.length;

  const rows = Array.from({ length: count }, (_, i) => {
    const y = getRowY(i, count);
    const bubbles = OPTION_X.map(
      (x, optIdx) => `
      <div style="position:absolute;left:${x - BUBBLE_RADIUS}px;top:${y - BUBBLE_RADIUS}px;width:${BUBBLE_RADIUS * 2}px;height:${BUBBLE_RADIUS * 2}px;border:2px solid #000;border-radius:50%;text-align:center;line-height:${BUBBLE_RADIUS * 2}px;font-size:11px;font-family:Arial;">${OPTION_LETTERS[optIdx]}</div>`
    ).join('');
    const label = `<div style="position:absolute;left:${LABEL_X}px;top:${y - 10}px;font-size:14px;font-family:Arial;font-weight:bold;">Q${i + 1}</div>`;
    return label + bubbles;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>@page { size: A4; margin: 0; } body { margin: 0; }</style>
</head>
<body>
  <div style="position:relative;width:${PAGE_WIDTH}px;height:${PAGE_HEIGHT}px;font-family:Arial;">
    <div style="position:absolute;top:30px;left:60px;right:60px;">
      <div style="font-size:20px;font-weight:bold;">${escapeHtml(test.name)} — Answer Sheet</div>
      <div style="margin-top:16px;font-size:13px;">Student Name: ____________________________&nbsp;&nbsp;&nbsp; Date: ______________</div>
      <div style="margin-top:6px;font-size:11px;color:#555;">Fill each bubble completely with a dark pen or pencil. One mark per question.</div>
    </div>
    ${rows}
  </div>
</body></html>`;
}

/** The paper students read from — full question text + options, no bubbles. */
export function generateQuestionPaperHtml(test: TestTemplate, bank: QuestionBank): string {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));

  const items = test.questionIds
    .map((qid, i) => {
      const q = byId.get(qid);
      if (!q) return '';
      const opts = q.options
        .map((opt, idx) => `<div style="margin-left:20px;">${OPTION_LETTERS[idx]}) ${escapeHtml(opt)}</div>`)
        .join('');
      return `<div style="margin-bottom:14px;">
        <div style="font-weight:bold;">${i + 1}. ${escapeHtml(q.text)}</div>
        ${opts}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>@page { size: A4; margin: 40px; } body { font-family: Arial; font-size: 13px; }</style>
</head>
<body>
  <div style="font-size:20px;font-weight:bold;margin-bottom:16px;">${escapeHtml(test.name)} — Question Paper</div>
  ${items}
</body></html>`;
}
