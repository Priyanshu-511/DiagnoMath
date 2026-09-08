import { BubblePosition } from './layout';

interface ScannerHtmlOptions {
  imageDataUri: string;
  positions: BubblePosition[];
  pageWidth: number;
  pageHeight: number;
  bubbleRadius: number;
}

/**
 * Heuristic OMR: for each bubble, sample a square patch centered on it and
 * compute average grayscale luminance. A filled bubble is noticeably darker
 * than an empty one. Per question, the option whose patch is clearly the
 * darkest of the 4 is "selected"; if none stands out, it's blank; if two
 * are both dark and close together, it's flagged as multiple/ambiguous
 * marks for the teacher to check by hand.
 *
 * This is threshold-based image analysis, not machine learning — it works
 * well with a clean, well-lit, properly-cropped photo but can misread faint
 * pencil marks or heavy shadows. See README "Known limits".
 */
export function buildScannerHtml({
  imageDataUri,
  positions,
  pageWidth,
  pageHeight,
  bubbleRadius,
}: ScannerHtmlOptions): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#fff;">
<canvas id="c" width="${pageWidth}" height="${pageHeight}"></canvas>
<script>
  var positions = ${JSON.stringify(positions)};
  var radius = ${bubbleRadius};
  var pageWidth = ${pageWidth};
  var pageHeight = ${pageHeight};
  var img = new Image();

  img.onload = function () {
    try {
      var canvas = document.getElementById('c');
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, pageWidth, pageHeight);

      // ── Sample only the INNER 60% of each bubble (avoids the border ring) ──
      var innerR = Math.max(3, Math.round(radius * 0.6));

      function avgDarkness(cx, cy) {
        var sx = Math.max(0, Math.round(cx - innerR));
        var sy = Math.max(0, Math.round(cy - innerR));
        var ex = Math.min(pageWidth,  Math.round(cx + innerR));
        var ey = Math.min(pageHeight, Math.round(cy + innerR));
        var sw = ex - sx, sh = ey - sy;
        if (sw <= 0 || sh <= 0) return 255;

        var patch = ctx.getImageData(sx, sy, sw, sh).data;
        var total = 0, count = 0;
        var rSq = innerR * innerR;
        for (var row = 0; row < sh; row++) {
          for (var col = 0; col < sw; col++) {
            var dx = (sx + col) - cx, dy = (sy + row) - cy;
            if (dx*dx + dy*dy <= rSq) {
              var i = (row * sw + col) * 4;
              // On-the-fly grayscale for just this pixel
              var g = 0.299 * patch[i] + 0.587 * patch[i+1] + 0.114 * patch[i+2];
              total += g;
              count++;
            }
          }
        }
        return count ? total / count : 255;
      }

      var byQuestion = {};
      positions.forEach(function (p) {
        if (!byQuestion[p.questionIndex]) byQuestion[p.questionIndex] = [];
        byQuestion[p.questionIndex].push({ optionIndex: p.optionIndex, darkness: avgDarkness(p.x, p.y) });
      });

      // ── Find the option with the most weightage ──
      var results = Object.keys(byQuestion).map(function (qi) {
        var opts = byQuestion[qi].slice().sort(function (a, b) { return a.darkness - b.darkness; });
        var darkest = opts[0];
        var secondDarkest = opts[1];
        var brightest = opts[opts.length - 1];

        var selectedOption = null;
        var flag = 'blank';

        // A very small difference (e.g. 8 out of 255) is enough to distinguish
        // a filled bubble from an empty one, or a single mark from multiple marks.
        var SENSITIVITY_THRESHOLD = 8;

        // Is there any mark at all on this row?
        if (brightest.darkness - darkest.darkness > SENSITIVITY_THRESHOLD) {
          // Does one option stand out clearly from the next darkest?
          if (secondDarkest.darkness - darkest.darkness < SENSITIVITY_THRESHOLD) {
            flag = 'multiple'; // Two options are similarly dark
          } else {
            selectedOption = darkest.optionIndex;
            flag = 'ok';
          }
        }

        return { questionIndex: parseInt(qi, 10), selectedOption: selectedOption, flag: flag };
      });

      results.sort(function (a, b) { return a.questionIndex - b.questionIndex; });
      window.ReactNativeWebView.postMessage(JSON.stringify(results));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: String(err) }));
    }
  };

  img.onerror = function () {
    window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Failed to load the captured image' }));
  };

  img.src = "${imageDataUri}";
</script>
</body>
</html>`;
}
