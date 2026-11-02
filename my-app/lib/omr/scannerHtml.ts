import { BubblePosition } from './layout';

interface ScannerHtmlOptions {
  imageDataUri: string;
  positions: BubblePosition[];
  pageWidth: number;
  pageHeight: number;
  bubbleRadius: number;
}

/**
 * Advanced OMR Scanner Engine:
 *   1. Local Auto-Centering Search (±16px): Locks onto the physical circle even
 *      with minor camera angle, slight tilt, or cropping offsets.
 *   2. Differential Fill Ratio (Anti-Shadow): Compares inner bubble darkness
 *      against the local white-paper ring immediately surrounding that specific bubble.
 *      This neutralizes phone shadows, gradients, and ambient lighting shifts completely!
 *   3. Dynamic Contrast Multi-Mark & Blank Discrimination.
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

      var imgData = ctx.getImageData(0, 0, pageWidth, pageHeight).data;

      // Fast pixel luminance getter: Y = 0.299R + 0.587G + 0.114B
      function getLuma(x, y) {
        if (x < 0 || x >= pageWidth || y < 0 || y >= pageHeight) return 255;
        var idx = (Math.floor(y) * pageWidth + Math.floor(x)) * 4;
        return 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      }

      // Sample average luminance inside a circle centered at (cx, cy)
      function sampleCircleLuma(cx, cy, r) {
        var total = 0, count = 0;
        var rSq = r * r;
        var rInt = Math.ceil(r);
        for (var dy = -rInt; dy <= rInt; dy += 2) {
          for (var dx = -rInt; dx <= rInt; dx += 2) {
            if (dx * dx + dy * dy <= rSq) {
              total += getLuma(cx + dx, cy + dy);
              count++;
            }
          }
        }
        return count > 0 ? total / count : 255;
      }

      // Sample local background paper in a ring just outside the bubble
      function sampleLocalBackground(cx, cy) {
        var rInner = radius * 1.35;
        var rOuter = radius * 1.95;
        var rInnerSq = rInner * rInner;
        var rOuterSq = rOuter * rOuter;
        var total = 0, count = 0;
        var rInt = Math.ceil(rOuter);

        for (var dy = -rInt; dy <= rInt; dy += 3) {
          for (var dx = -rInt; dx <= rInt; dx += 3) {
            var dSq = dx * dx + dy * dy;
            if (dSq >= rInnerSq && dSq <= rOuterSq) {
              total += getLuma(cx + dx, cy + dy);
              count++;
            }
          }
        }
        return count > 0 ? total / count : 240;
      }

      // ── Step 1: Local Auto-Centering Search ──
      // Search ±14px window around (x, y) to find the darkest circular concentration
      function findTrueCenter(x, y) {
        var bestX = x, bestY = y;
        var minLuma = Infinity;
        var searchR = 14;
        var innerR = Math.max(3, Math.round(radius * 0.45));

        for (var dy = -searchR; dy <= searchR; dy += 4) {
          for (var dx = -searchR; dx <= searchR; dx += 4) {
            var candX = x + dx;
            var candY = y + dy;
            var candLuma = sampleCircleLuma(candX, candY, innerR);
            if (candLuma < minLuma) {
              minLuma = candLuma;
              bestX = candX;
              bestY = candY;
            }
          }
        }
        return { x: bestX, y: bestY };
      }

      // ── Step 2: Compute Fill Ratio for each candidate bubble ──
      var innerRadius = Math.max(3, Math.round(radius * 0.55));
      var byQuestion = {};

      positions.forEach(function (p) {
        var center = findTrueCenter(p.x, p.y);
        var innerLuma = sampleCircleLuma(center.x, center.y, innerRadius);
        var bgLuma = sampleLocalBackground(center.x, center.y);

        // Fill ratio: 0.0 (blank paper) to 1.0 (completely black ink)
        var fillRatio = Math.max(0.0, (bgLuma - innerLuma) / Math.max(30, bgLuma));

        if (!byQuestion[p.questionIndex]) byQuestion[p.questionIndex] = [];
        byQuestion[p.questionIndex].push({
          optionIndex: p.optionIndex,
          fillRatio: fillRatio,
          innerLuma: innerLuma,
          bgLuma: bgLuma
        });
      });

      // ── Step 3: Classify each question row ──
      var MIN_FILL_THRESHOLD = 0.20; // At least 20% darker than local paper
      var AMBIGUOUS_MARGIN = 0.12;   // If top two are within 12%, mark as multiple

      var results = Object.keys(byQuestion).map(function (qi) {
        var opts = byQuestion[qi].slice().sort(function (a, b) {
          return b.fillRatio - a.fillRatio; // Descending: darkest fill first
        });

        var top = opts[0];
        var runnerUp = opts[1];

        var selectedOption = null;
        var flag = 'blank';

        if (top.fillRatio >= MIN_FILL_THRESHOLD) {
          // Check if runner-up is also heavily filled
          if (runnerUp.fillRatio >= MIN_FILL_THRESHOLD && (top.fillRatio - runnerUp.fillRatio) < AMBIGUOUS_MARGIN) {
            flag = 'multiple'; // Two bubbles marked
          } else {
            selectedOption = top.optionIndex;
            flag = 'ok';
          }
        }

        return {
          questionIndex: parseInt(qi, 10),
          selectedOption: selectedOption,
          flag: flag
        };
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
