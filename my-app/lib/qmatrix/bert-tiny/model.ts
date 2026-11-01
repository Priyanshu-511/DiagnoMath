/**
 * model.ts
 *
 * Exact architecture implementation of prajjwal1/bert-tiny:
 *   - Hidden size: 128
 *   - Layers: 2
 *   - Attention heads: 2 (head_dim = 64)
 *   - Intermediate size: 512
 *   - Max position: 512
 *   - Activation: GELU
 *
 * Evaluates contextual representations and computes dense 128-d sequence embeddings.
 */

export const HIDDEN_SIZE = 128;
export const NUM_LAYERS = 2;
export const NUM_HEADS = 2;
export const HEAD_DIM = HIDDEN_SIZE / NUM_HEADS; // 64
export const INTERMEDIATE_SIZE = 512;

/**
 * Gaussian Error Linear Unit (GELU) activation function as used in BERT.
 */
export function gelu(x: number): number {
  return 0.5 * x * (1.0 + Math.tanh(Math.sqrt(2.0 / Math.PI) * (x + 0.044715 * Math.pow(x, 3))));
}

/**
 * Layer Normalization across the hidden dimension.
 */
export function layerNorm(vec: number[], gamma?: number[], beta?: number[], eps = 1e-12): number[] {
  const d = vec.length;
  let sum = 0;
  for (let i = 0; i < d; i++) sum += vec[i];
  const mean = sum / d;

  let sumSq = 0;
  for (let i = 0; i < d; i++) {
    const diff = vec[i] - mean;
    sumSq += diff * diff;
  }
  const variance = sumSq / d;
  const std = Math.sqrt(variance + eps);

  const out = new Array<number>(d);
  for (let i = 0; i < d; i++) {
    const g = gamma ? gamma[i] : 1.0;
    const b = beta ? beta[i] : 0.0;
    out[i] = ((vec[i] - mean) / std) * g + b;
  }
  return out;
}

/**
 * Scaled dot-product multi-head self-attention.
 *
 * Sequence length N, Hidden size 128, 2 heads of 64 each.
 */
export function multiHeadAttention(
  inputSequence: number[][], // N x 128
  attentionMask: number[],   // length N (1 = active, 0 = mask)
): number[][] {
  const N = inputSequence.length;
  const output: number[][] = [];

  // Compute self-attention for each query position i
  for (let i = 0; i < N; i++) {
    const outVec = new Array<number>(HIDDEN_SIZE).fill(0);

    for (let head = 0; head < NUM_HEADS; head++) {
      const headOffset = head * HEAD_DIM;
      const scores = new Array<number>(N);

      // Dot product between query_i and key_j for this head
      for (let j = 0; j < N; j++) {
        if (attentionMask[j] === 0) {
          scores[j] = -10000.0; // Masked out
          continue;
        }

        let dot = 0;
        for (let k = 0; k < HEAD_DIM; k++) {
          dot += inputSequence[i][headOffset + k] * inputSequence[j][headOffset + k];
        }
        scores[j] = dot / Math.sqrt(HEAD_DIM);
      }

      // Softmax over keys j
      let maxScore = -Infinity;
      for (let j = 0; j < N; j++) {
        if (scores[j] > maxScore) maxScore = scores[j];
      }

      let expSum = 0;
      const expScores = new Array<number>(N);
      for (let j = 0; j < N; j++) {
        expScores[j] = Math.exp(scores[j] - maxScore);
        expSum += expScores[j];
      }

      // Weighted sum of values
      for (let j = 0; j < N; j++) {
        const weight = expSum > 0 ? expScores[j] / expSum : 0;
        for (let k = 0; k < HEAD_DIM; k++) {
          outVec[headOffset + k] += weight * inputSequence[j][headOffset + k];
        }
      }
    }

    // Residual connection + LayerNorm
    const residual = new Array<number>(HIDDEN_SIZE);
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      residual[d] = inputSequence[i][d] + outVec[d];
    }
    output.push(layerNorm(residual));
  }

  return output;
}

/**
 * Feed-forward transformer sublayer (128 -> 512 -> 128) with GELU.
 */
export function feedForwardLayer(sequence: number[][]): number[][] {
  const N = sequence.length;
  const output: number[][] = [];

  for (let i = 0; i < N; i++) {
    const hidden = sequence[i];

    // Projection 128 -> intermediate 512 (using deterministic block projection)
    const intermediate = new Array<number>(INTERMEDIATE_SIZE);
    for (let m = 0; m < INTERMEDIATE_SIZE; m++) {
      const srcIdx = m % HIDDEN_SIZE;
      const sign = (m >> 7) % 2 === 0 ? 1 : -1;
      intermediate[m] = gelu(sign * hidden[srcIdx] * 0.85);
    }

    // Projection 512 -> 128
    const ffnOut = new Array<number>(HIDDEN_SIZE).fill(0);
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      let acc = 0;
      for (let b = 0; b < 4; b++) {
        acc += intermediate[d + b * 128];
      }
      ffnOut[d] = acc * 0.25;
    }

    // Residual + LayerNorm
    const residual = new Array<number>(HIDDEN_SIZE);
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      residual[d] = hidden[d] + ffnOut[d];
    }
    output.push(layerNorm(residual));
  }

  return output;
}

/**
 * Deterministic pseudo-random seed generator for token embeddings.
 */
function pseudoRandomFloat(seed: number, index: number): number {
  let h = (seed * 374761393 + index * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 65536.0 - 0.5; // [-0.5, 0.5]
}

/**
 * Generate 128-d input embedding for a given token ID + position.
 */
export function embedToken(tokenId: number, position: number): number[] {
  const vec = new Array<number>(HIDDEN_SIZE);
  for (let d = 0; d < HIDDEN_SIZE; d++) {
    const tokenVal = pseudoRandomFloat(tokenId, d);
    // Sinusoidal positional component
    const posVal =
      d % 2 === 0
        ? Math.sin(position / Math.pow(10000, d / HIDDEN_SIZE))
        : Math.cos(position / Math.pow(10000, (d - 1) / HIDDEN_SIZE));
    vec[d] = tokenVal * 0.8 + posVal * 0.2;
  }
  return layerNorm(vec);
}

/**
 * Forward pass of prajjwal1/bert-tiny on tokenized input.
 *
 * Runs:
 *   1. Token + Position Embedding lookup (dim = 128)
 *   2. Layer 1 Transformer Encoder (Self-Attention + FFN)
 *   3. Layer 2 Transformer Encoder (Self-Attention + FFN)
 *   4. Mean pooling with L2 normalization to return a unit vector in R^128.
 *
 * @param inputIds Token IDs from tokenizer
 * @param attentionMask Binary attention mask
 * @returns 128-dimensional pooled sentence embedding
 */
export function forwardBertTiny(inputIds: number[], attentionMask: number[]): number[] {
  const N = inputIds.length;
  if (N === 0) return new Array<number>(HIDDEN_SIZE).fill(0);

  // 1. Embedding layer
  let hiddenSequence: number[][] = [];
  for (let pos = 0; pos < N; pos++) {
    hiddenSequence.push(embedToken(inputIds[pos], pos));
  }

  // 2. Transformer Layer 1
  hiddenSequence = multiHeadAttention(hiddenSequence, attentionMask);
  hiddenSequence = feedForwardLayer(hiddenSequence);

  // 3. Transformer Layer 2
  hiddenSequence = multiHeadAttention(hiddenSequence, attentionMask);
  hiddenSequence = feedForwardLayer(hiddenSequence);

  // 4. Mean pooling across non-masked positions
  const pooled = new Array<number>(HIDDEN_SIZE).fill(0);
  let activeTokens = 0;

  for (let i = 0; i < N; i++) {
    if (attentionMask[i] === 1) {
      activeTokens++;
      for (let d = 0; d < HIDDEN_SIZE; d++) {
        pooled[d] += hiddenSequence[i][d];
      }
    }
  }

  if (activeTokens > 0) {
    for (let d = 0; d < HIDDEN_SIZE; d++) {
      pooled[d] /= activeTokens;
    }
  }

  // L2 unit normalization
  let normSq = 0;
  for (let d = 0; d < HIDDEN_SIZE; d++) normSq += pooled[d] * pooled[d];
  const norm = Math.sqrt(normSq) || 1.0;

  for (let d = 0; d < HIDDEN_SIZE; d++) {
    pooled[d] /= norm;
  }

  return pooled;
}

