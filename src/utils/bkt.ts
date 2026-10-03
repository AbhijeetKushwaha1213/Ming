export interface BKTParameters {
  pL0: number; // Prior probability of mastery (initial learning state)
  pT: number;  // Transition probability (rate of learning between trials)
  pG: number;  // Guess probability (answering correctly without knowing)
  pS: number;  // Slip probability (answering incorrectly despite knowing)
}

export const DEFAULT_BKT_PARAMS: BKTParameters = {
  pL0: 0.15,
  pT: 0.10,
  pG: 0.20,
  pS: 0.10,
};

export type MasteryStatus = 'unassessed' | 'developing' | 'proficient' | 'mastered';

/**
 * Adjust BKT Guess (pG) and Slip (pS) parameters based on question difficulty.
 * - Easy: Easier to guess (higher pG), rare to slip (lower pS).
 * - Hard: Difficult to guess (lower pG), more common to slip (higher pS).
 * - Medium: Standard parameters.
 */
export function getDifficultyBKTParameters(
  difficulty: string = 'medium',
  customParams?: Partial<BKTParameters>
): BKTParameters {
  const base = { ...DEFAULT_BKT_PARAMS, ...customParams };
  const diff = (difficulty || 'medium').toLowerCase();

  if (diff === 'easy') {
    return {
      pL0: base.pL0,
      pT: base.pT,
      pG: 0.25,
      pS: 0.05,
    };
  } else if (diff === 'hard') {
    return {
      pL0: base.pL0,
      pT: base.pT,
      pG: 0.10,
      pS: 0.20,
    };
  }

  // Medium / Default
  return {
    pL0: base.pL0,
    pT: base.pT,
    pG: 0.20,
    pS: 0.10,
  };
}

/**
 * Standard Bayesian Knowledge Tracing Bayes Update Rule
 *
 * 1. P(L_t | obs = 1) = [P(L_{t-1}) * (1 - pS)] / [P(L_{t-1}) * (1 - pS) + (1 - P(L_{t-1})) * pG]
 * 2. P(L_t | obs = 0) = [P(L_{t-1}) * pS] / [P(L_{t-1}) * pS + (1 - P(L_{t-1})) * (1 - pG)]
 * 3. Learning step: P(L_t) = P(L_t | obs) + (1 - P(L_t | obs)) * pT
 */
export function calculateBKTUpdate(
  priorMastery: number,
  isCorrect: boolean,
  params: BKTParameters,
  credit?: number
): { posterior: number; prior: number; parameters: BKTParameters } {
  const pL_prev = Math.max(0.01, Math.min(0.99, priorMastery));
  const { pT, pG, pS } = params;

  // Partial credit calibration
  if (credit !== undefined && credit > 0 && credit < 1) {
    const resCorrect = calculateBKTUpdate(priorMastery, true, params);
    const resIncorrect = calculateBKTUpdate(priorMastery, false, params);
    const interpolated = credit * resCorrect.posterior + (1 - credit) * resIncorrect.posterior;
    return {
      prior: pL_prev,
      posterior: Math.max(0.01, Math.min(0.99, Math.round(interpolated * 1000) / 1000)),
      parameters: params,
    };
  }

  let pL_given_obs: number;

  if (isCorrect) {
    const num = pL_prev * (1 - pS);
    const denom = pL_prev * (1 - pS) + (1 - pL_prev) * pG;
    pL_given_obs = denom > 0 ? num / denom : pL_prev;
  } else {
    const num = pL_prev * pS;
    const denom = pL_prev * pS + (1 - pL_prev) * (1 - pG);
    pL_given_obs = denom > 0 ? num / denom : pL_prev;
  }

  // Learning transition update
  const pL_updated = pL_given_obs + (1 - pL_given_obs) * pT;
  const clampedPosterior = Math.max(0.01, Math.min(0.99, pL_updated));

  return {
    prior: pL_prev,
    posterior: clampedPosterior,
    parameters: params,
  };
}

/**
 * Compute confidence metric based on cumulative evidence/trials.
 * As evidence accumulates, confidence increases asymptotically toward 1.0.
 */
export function calculateConfidence(attempts: number): number {
  if (attempts <= 0) return 0.0;
  // Smooth asymptotic confidence: e.g. 1 attempt -> 0.33, 4 -> 0.67, 8 -> 0.80, 18 -> 0.90
  const conf = attempts / (attempts + 2.0);
  return Math.round(conf * 100) / 100;
}

/**
 * Determine mastery category from attempts count and mastery probability.
 */
export function determineMasteryStatus(attempts: number, masteryProbability: number): MasteryStatus {
  if (attempts === 0) return 'unassessed';
  if (masteryProbability < 0.60) return 'developing';
  if (masteryProbability < 0.85) return 'proficient';
  return 'mastered';
}
