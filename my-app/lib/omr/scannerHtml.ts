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

      function avgDarkness(x, y) {
        var sx = Math.max(0, Math.round(x - radius));
        var sy = Math.max(0, Math.round(y - radius));
        var sw = Math.min(pageWidth - sx, radius * 2);
        var sh = Math.min(pageHeight - sy, radius * 2);
        var data = ctx.getImageData(sx, sy, sw, sh).data;
        var total = 0, count = 0;
        for (var i = 0; i < data.length; i += 4) {
          var lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          total += lum;
          count++;
        }
        return count ? total / count : 255;
      }

      var byQuestion = {};
      positions.forEach(function (p) {
        if (!byQuestion[p.questionIndex]) byQuestion[p.questionIndex] = [];
        byQuestion[p.questionIndex].push({ optionIndex: p.optionIndex, darkness: avgDarkness(p.x, p.y) });
      });

      var DARK_GAP = 35;      // brightest-vs-darkest gap needed to count as "marked"
      var AMBIGUOUS_GAP = 15; // if 2nd-darkest is this close to darkest, flag as multiple marks

      var results = Object.keys(byQuestion).map(function (qi) {
        var opts = byQuestion[qi].slice().sort(function (a, b) { return a.darkness - b.darkness; });
        var darkest = opts[0];
        var secondDarkest = opts[1];
        var brightest = opts[opts.length - 1];

        var selectedOption = null;
        var flag = 'blank';

        if (brightest.darkness - darkest.darkness > DARK_GAP) {
          if (secondDarkest.darkness - darkest.darkness < AMBIGUOUS_GAP) {
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
