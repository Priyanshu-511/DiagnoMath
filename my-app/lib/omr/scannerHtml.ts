import { BubblePosition } from './layout';

interface ScannerHtmlOptions {
  imageDataUri: string;
  positions: BubblePosition[];
  pageWidth: number;
  pageHeight: number;
  bubbleRadius: number;
}

/**
 * Heuristic OMR scanner.
 *
 * Pipeline (all runs in the WebView canvas — no network):
 *   1. Draw the captured image onto the canvas.
 *   2. Convert every pixel to **grayscale** (weighted luminance).
 *   3. Apply **contrast stretching** (histogram normalization) so that
 *      the darkest 1 % of pixels map to 0 and the brightest 1 % to 255.
 *   4. For each bubble, sample only the **inner 60 %** of the circle
 *      (avoids the printed border ring).
 *   5. Per question-row, pick the bubble whose sample is darkest —
 *      using **adaptive** thresholds derived from the row's own stats
 *      so it copes with uneven lighting and different pens/pencils.
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

      // ────────────────────────────────────────────────────────────────
      // STEP 1: Convert entire image to grayscale
      // ────────────────────────────────────────────────────────────────
      var fullData = ctx.getImageData(0, 0, pageWidth, pageHeight);
      var px = fullData.data;
      for (var i = 0; i < px.length; i += 4) {
        var gray = Math.round(0.299 * px[i] + 0.587 * px[i+1] + 0.114 * px[i+2]);
        px[i] = px[i+1] = px[i+2] = gray;
      }

      // ────────────────────────────────────────────────────────────────
      // STEP 2: Contrast stretching (histogram normalization)
      //   - Build a histogram of all gray values
      //   - Ignore the darkest 1% and brightest 1% as outliers
      //   - Stretch the remaining range to [0, 255]
      // ────────────────────────────────────────────────────────────────
      var hist = new Array(256).fill(0);
      var totalPixels = pageWidth * pageHeight;
      for (var i = 0; i < px.length; i += 4) { hist[px[i]]++; }

      var cutoff = Math.floor(totalPixels * 0.01);
      var minG = 0, maxG = 255, cum = 0;
      for (var v = 0; v < 256; v++) { cum += hist[v]; if (cum > cutoff) { minG = v; break; } }
      cum = 0;
      for (var v = 255; v >= 0; v--) { cum += hist[v]; if (cum > cutoff) { maxG = v; break; } }
      var rangeG = maxG - minG || 1;

      for (var i = 0; i < px.length; i += 4) {
        var stretched = Math.round(((px[i] - minG) / rangeG) * 255);
        stretched = Math.max(0, Math.min(255, stretched));
        px[i] = px[i+1] = px[i+2] = stretched;
      }
      ctx.putImageData(fullData, 0, 0);

      // ────────────────────────────────────────────────────────────────
      // STEP 3: Sample each bubble (inner 60% only, circular mask)
      // ────────────────────────────────────────────────────────────────
      var innerR = Math.max(3, Math.round(radius * 0.6));

      function avgDarkness(cx, cy) {
        var sx = Math.max(0, Math.round(cx - innerR));
        var sy = Math.max(0, Math.round(cy - innerR));
        var ex = Math.min(pageWidth,  Math.round(cx + innerR));
        var ey = Math.min(pageHeight, Math.round(cy + innerR));
        var sw = ex - sx;
        var sh = ey - sy;
        if (sw <= 0 || sh <= 0) return 255;

        var patch = ctx.getImageData(sx, sy, sw, sh).data;
        var total = 0, count = 0;
        var rSq = innerR * innerR;

        for (var row = 0; row < sh; row++) {
          for (var col = 0; col < sw; col++) {
            var dx = (sx + col) - cx;
            var dy = (sy + row) - cy;
            if (dx * dx + dy * dy <= rSq) {
              var idx = (row * sw + col) * 4;
              total += patch[idx];
              count++;
            }
          }
        }
        return count ? total / count : 255;
      }

      // ────────────────────────────────────────────────────────────────
      // STEP 4: Group by question row, detect marks with adaptive thresholds
      // ────────────────────────────────────────────────────────────────
      var byQuestion = {};
      positions.forEach(function (p) {
        if (!byQuestion[p.questionIndex]) byQuestion[p.questionIndex] = [];
        byQuestion[p.questionIndex].push({
          optionIndex: p.optionIndex,
          darkness: avgDarkness(p.x, p.y)
        });
      });

      var results = Object.keys(byQuestion).map(function (qi) {
        var opts = byQuestion[qi].slice().sort(function (a, b) { return a.darkness - b.darkness; });
        var darkest       = opts[0];
        var secondDarkest = opts[1];
        var brightest      = opts[opts.length - 1];

        // Adaptive thresholds per row
        var rowRange  = brightest.darkness - darkest.darkness;
        var rowMean   = opts.reduce(function (s, o) { return s + o.darkness; }, 0) / opts.length;

        var selectedOption = null;
        var flag = 'blank';

        // Primary check: the darkest must be noticeably darker than the brightest
        // Using 15% of the row mean as the minimum gap (adapts to lighting)
        var minGap   = Math.max(15, rowMean * 0.12);
        // Ambiguity check: 2nd darkest must be clearly brighter than the darkest
        var ambigGap = Math.max(8,  rowRange * 0.25);

        if (rowRange > minGap) {
          if (secondDarkest.darkness - darkest.darkness < ambigGap) {
            flag = 'multiple';
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
