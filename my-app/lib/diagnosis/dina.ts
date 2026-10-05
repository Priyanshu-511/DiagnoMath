/**
 * DINA — Deterministic Inputs, Noisy AND gate
 *
 * A cognitive diagnosis model that maps each item (question) to the set of
 * skills it requires (the Q-matrix) and uses two item-level parameters —
 * slip (s) and guess (g) — to compute the probability of a correct response
 * given a hypothesised mastery profile.
 *
 * For each student the engine tries every possible binary profile (2^K)
 * and picks the one with the highest likelihood.
 */

// ─── types ─────────────────────────────────────────────────────────

/** One row of the Q-matrix: which skills an item requires. */
export interface QMatrixRow {
  /** question id */
  questionId: string;
  /** skill-name → 0 | 1 */
  required: Record<string, 0 | 1>;
}

/** A single skill's mastery status within a profile. */
export interface SkillMastery {
  skill: string;
  mastered: boolean;
}

/** The DINA output for one student. */
export interface DINAResult {
  /** Ordered list of all skills and whether the student has mastered each. */
  profile: SkillMastery[];
  /** Raw binary vector matching the skill order (e.g. [1,1,0]). */
  profileVector: number[];
  /** Natural-language label, e.g. "(1,1,0) — Simplify NOT mastered" */
  profileLabel: string;
  /** Likelihood of the best-fit profile (product of item probabilities). */
  likelihood: number;
  /** Ratio best / runner-up — how much more likely the top profile is. */
  marginOverRunnerUp: number;
  /** Names of skills the student has NOT mastered. */
  weakSkills: string[];
}

// ─── helpers ───────────────────────────────────────────────────────

/** Generate all 2^K binary vectors of length K. */
function allProfiles(k: number): number[][] {
  const total = 1 << k;          // 2^K
  const profiles: number[][] = [];
  for (let mask = 0; mask < total; mask++) {
    const vec: number[] = [];
    for (let bit = k - 1; bit >= 0; bit--) {
      vec.push((mask >> bit) & 1);
    }
    profiles.push(vec);
  }
  return profiles;
}

/**
 * η (eta) — the "ideal response" for item j under profile α.
 * η_j = ∏_k  α_k ^ q_jk
 * i.e. 1 iff the student has mastered every skill the item requires.
 */
function eta(profile: number[], qRow: (0 | 1)[]): 0 | 1 {
  for (let k = 0; k < qRow.length; k++) {
    if (qRow[k] === 1 && profile[k] === 0) return 0;
  }
  return 1;
}

/**
 * P(X_j = 1 | α) = (1 − s_j)^η_j  ·  g_j^(1 − η_j)
 *
 * If η = 1 (student has all required skills):
 *   P(correct) = 1 − s   (may still slip)
 * If η = 0:
 *   P(correct) = g        (may still guess correctly)
 */
function pCorrect(etaVal: 0 | 1, slip: number, guess: number): number {
  return etaVal === 1 ? 1 - slip : guess;
}

// ─── public API ────────────────────────────────────────────────────

export interface DINAInput {
  /** The ordered list of skill (attribute) names. */
  skills: string[];
  /**
   * Q-matrix rows, one per item (question) in test order.
   * Each row's `required` map must use the same skill names as `skills`.
   */
  qMatrix: QMatrixRow[];
  /**
   * Student response vector in test order:
   * 1 = correct, 0 = incorrect / unanswered.
   */
  responses: (0 | 1)[];
  /** Slip probability per item (defaults to 0.10 for all items). */
  slips?: number[];
  /** Guess probability per item (defaults to 0.20 for all items). */
  guesses?: number[];
}

/**
 * Run the DINA model.
 *
 * Complexity: O(2^K · J) where K = number of skills, J = number of items.
 * Practical limit: K ≤ ~15 (32 768 profiles).
 */
export function runDINA(input: DINAInput): DINAResult {
  const { skills, qMatrix, responses } = input;
  const J = qMatrix.length;            // number of items
  const K = skills.length;             // number of skills

  // Default slip / guess if not provided
  const slips = input.slips ?? new Array(J).fill(0.10);
  const guesses = input.guesses ?? new Array(J).fill(0.20);

  // Convert Q-matrix rows into an array of (0|1)[] aligned with `skills`.
  const qArrays: (0 | 1)[][] = qMatrix.map((row) =>
    skills.map((sk) => row.required[sk] ?? 0)
  );

  // Enumerate profiles
  const profiles = allProfiles(K);
  let bestIdx = 0;
  let bestLL = -Infinity;
  let secondLL = -Infinity;
  const likelihoods: number[] = [];

  for (let p = 0; p < profiles.length; p++) {
    const profile = profiles[p];
    let logL = 0;

    for (let j = 0; j < J; j++) {
      const etaVal = eta(profile, qArrays[j]);
      const pCorr = pCorrect(etaVal, slips[j], guesses[j]);
      // P(observed response | profile)
      const prob = responses[j] === 1 ? pCorr : 1 - pCorr;
      logL += Math.log(prob + 1e-15);   // tiny epsilon to avoid log(0)
    }

    likelihoods.push(logL);
    if (logL > bestLL) {
      secondLL = bestLL;
      bestLL = logL;
      bestIdx = p;
    } else if (logL > secondLL) {
      secondLL = logL;
    }
  }

  const bestProfile = profiles[bestIdx];
  const profileEntries: SkillMastery[] = skills.map((sk, i) => ({
    skill: sk,
    mastered: bestProfile[i] === 1,
  }));

  const weakSkills = profileEntries
    .filter((e) => !e.mastered)
    .map((e) => e.skill);

  // Build human-readable label
  const vecStr = K > 0 ? `(${bestProfile.join(', ')})` : '';
  const notMasteredParts = weakSkills.map((s) => `${s} NOT mastered`);
  const profileLabel =
    weakSkills.length === 0
      ? `${vecStr ? vecStr + ' — ' : ''}All skills mastered`
      : `${vecStr} — ${notMasteredParts.join(', ')}`;

  // Margin: ratio of best likelihood to runner-up (in natural scale)
  const margin =
    secondLL === -Infinity ? Infinity : Math.exp(bestLL - secondLL);

  return {
    profile: profileEntries,
    profileVector: bestProfile,
    profileLabel,
    likelihood: Math.exp(bestLL),
    marginOverRunnerUp: Math.round(margin * 10) / 10,  // 1 decimal
    weakSkills,
  };
}
