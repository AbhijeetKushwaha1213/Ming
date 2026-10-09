/**
 * Canonical Phase 5 — Step 2
 * BKT Calibration, Retention & Mastery Reliability Service
 * 
 * 1. Exponential retention / memory decay model (Ebbinghaus decay curve)
 * 2. Separation of underlying latent mastery from current retrieval probability
 * 3. Offline BKT calibration engine with GroupKFold (learner-level) partitioning
 * 4. Rigorous evaluation metrics: Log Loss, Brier Score, Expected Calibration Error (ECE)
 * 5. Temporal leakage prevention (strictly causal step-by-step predictions)
 * 6. Formal dataset audit detecting synthetic benchmark vs human classroom data
 */

import type {
  BKTParameters,
  ConceptRetentionState,
  BKTObservation,
  BKTDatasetSplit,
  BKTModelEvaluation,
} from './learnerTypes.ts';
import {
  calculateBKTUpdate,
  DEFAULT_BKT_PARAMS,
} from './bktService.ts';

// =========================================================================
// 1. Retention & Forgetting Model (Ebbinghaus Decay)
// =========================================================================

export interface CalculateRetentionParams {
  initialMastery: number;
  lastAssessedAt: string | Date | null;
  correctCount?: number;
  now?: Date | string;
  baseHalfLifeDays?: number;
}

/**
 * Calculates current recall probability using the Ebbinghaus exponential decay model:
 * 
 * R(t) = exp(-deltaT / S)
 * p(recall) = pL * R(t)
 * 
 * where stability S scales with retrieval history and initial mastery:
 * S = S0 * (1 + 0.5 * correctCount) * (1 + 1.0 * pL)
 * 
 * Guarantees:
 * - Deterministic, bounded in [0.0, 1.0]
 * - Non-destructive: underlying latent mastery pL is preserved and never destroyed
 * - Memory stability increases with successful retrieval practice
 */
export function calculateConceptRetention(params: CalculateRetentionParams): ConceptRetentionState {
  const pL = Math.max(0.0, Math.min(1.0, Number(params.initialMastery) || 0.0));
  const baseS0 = params.baseHalfLifeDays || 1.0;
  const correctCount = Math.max(0, Number(params.correctCount) || 0);

  // If concept is unassessed or never interacted with
  if (pL <= 0.0 || !params.lastAssessedAt) {
    return {
      initial_mastery: pL,
      current_recall_probability: 0.0,
      retention_factor: 1.0,
      stability_days: baseS0,
      elapsed_days: 0.0,
      last_evaluated_at: params.lastAssessedAt ? new Date(params.lastAssessedAt).toISOString() : null,
      needs_review: false,
    };
  }

  const lastDate = new Date(params.lastAssessedAt);
  const nowDate = params.now ? new Date(params.now) : new Date();

  // Elapsed days (clamped to >= 0 to protect against clock skew)
  const diffMs = Math.max(0, nowDate.getTime() - lastDate.getTime());
  const elapsedDays = Math.round((diffMs / 86400000) * 1000) / 1000;

  // Stability factor in days: S = S0 * (1 + 0.5 * successes) * (1 + 1.0 * pL)
  const stability = Math.max(
    0.5,
    Math.min(365.0, baseS0 * (1.0 + 0.5 * correctCount) * (1.0 + 1.0 * pL))
  );

  // Exponential retention decay: R = exp(-deltaT / S)
  const decayExponent = elapsedDays / stability;
  const retentionFactor = Math.round(Math.exp(-decayExponent) * 10000) / 10000;

  // Effective recall probability: p(recall) = pL * R
  const currentRecall = Math.max(0.0, Math.min(pL, Math.round(pL * retentionFactor * 10000) / 10000));

  // Concept needs review if mastery was developing/proficient (pL >= 0.50) but recall fell below 70% of peak
  const needsReview = pL >= 0.50 && currentRecall < 0.70 * pL;

  return {
    initial_mastery: pL,
    current_recall_probability: currentRecall,
    retention_factor: retentionFactor,
    stability_days: Math.round(stability * 100) / 100,
    elapsed_days: elapsedDays,
    last_evaluated_at: lastDate.toISOString(),
    needs_review: needsReview,
  };
}

// =========================================================================
// 2. Predictive Probability & Scoring Metrics
// =========================================================================

/**
 * Predicts the probability of a correct response on the upcoming trial:
 * P(C) = pL * (1 - pS) + (1 - pL) * pG
 */
export function predictProbabilityCorrect(priorMastery: number, params: BKTParameters): number {
  const pL = Math.max(0.01, Math.min(0.99, priorMastery));
  const pG = Math.max(0.01, Math.min(0.50, params.pG));
  const pS = Math.max(0.01, Math.min(0.50, params.pS));

  const pCorrect = pL * (1.0 - pS) + (1.0 - pL) * pG;
  return Math.max(0.01, Math.min(0.99, pCorrect));
}

/**
 * Binary Log Loss / Cross-Entropy
 */
export function calculateLogLoss(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0 || predictions.length !== actuals.length) return 0.0;
  const eps = 1e-12;
  let totalLoss = 0.0;

  for (let i = 0; i < predictions.length; i++) {
    const p = Math.max(eps, Math.min(1.0 - eps, predictions[i]));
    const y = actuals[i];
    totalLoss += -(y * Math.log(p) + (1.0 - y) * Math.log(1.0 - p));
  }

  return Math.round((totalLoss / predictions.length) * 10000) / 10000;
}

/**
 * Brier Score: Mean squared error of probabilistic predictions
 */
export function calculateBrierScore(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0 || predictions.length !== actuals.length) return 0.0;
  let totalSqErr = 0.0;

  for (let i = 0; i < predictions.length; i++) {
    const diff = predictions[i] - actuals[i];
    totalSqErr += diff * diff;
  }

  return Math.round((totalSqErr / predictions.length) * 10000) / 10000;
}

/**
 * Reliability Curve & Expected Calibration Error (ECE)
 */
export function calculateCalibrationCurve(
  predictions: number[],
  actuals: number[],
  numBins = 10
): {
  calibrationError: number;
  bins: Array<{
    bin_min: number;
    bin_max: number;
    predicted_probability: number;
    observed_frequency: number;
    count: number;
  }>;
} {
  const n = predictions.length;
  if (n === 0) return { calibrationError: 0.0, bins: [] };

  const binStep = 1.0 / numBins;
  const bins: Array<{
    bin_min: number;
    bin_max: number;
    predicted_probability: number;
    observed_frequency: number;
    count: number;
  }> = [];

  let ece = 0.0;

  for (let b = 0; b < numBins; b++) {
    const bMin = b * binStep;
    const bMax = (b + 1) * binStep;

    let sumPred = 0.0;
    let sumAct = 0.0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      const p = predictions[i];
      if ((p >= bMin && p < bMax) || (b === numBins - 1 && p >= bMin && p <= bMax)) {
        sumPred += p;
        sumAct += actuals[i];
        count++;
      }
    }

    if (count > 0) {
      const avgPred = sumPred / count;
      const avgAct = sumAct / count;
      ece += (count / n) * Math.abs(avgPred - avgAct);

      bins.push({
        bin_min: Math.round(bMin * 100) / 100,
        bin_max: Math.round(bMax * 100) / 100,
        predicted_probability: Math.round(avgPred * 1000) / 1000,
        observed_frequency: Math.round(avgAct * 1000) / 1000,
        count,
      });
    } else {
      bins.push({
        bin_min: Math.round(bMin * 100) / 100,
        bin_max: Math.round(bMax * 100) / 100,
        predicted_probability: 0.0,
        observed_frequency: 0.0,
        count: 0,
      });
    }
  }

  return {
    calibrationError: Math.round(ece * 10000) / 10000,
    bins,
  };
}

// =========================================================================
// 3. Chronological Model Evaluation (Zero Temporal Leakage)
// =========================================================================

/**
 * Evaluates a BKT model parameter set on an observation stream.
 * 
 * TEMPORAL LEAKAGE PROTECTION:
 * - For each learner and concept, observations are sorted chronologically.
 * - At step t, prediction is generated using strictly prior knowledge pL_{t-1}.
 * - State updates occur only AFTER prediction is logged.
 */
export function evaluateBKTModel(
  observations: BKTObservation[],
  params: BKTParameters
): BKTModelEvaluation {
  if (observations.length === 0) {
    return {
      log_loss: 0.0,
      brier_score: 0.0,
      accuracy: 0.0,
      observation_count: 0,
      calibration_error: 0.0,
      reliability_bins: [],
    };
  }

  // 1. Group observations by (learner_id, concept_id)
  const sequences = new Map<string, BKTObservation[]>();

  for (const obs of observations) {
    const key = `${obs.learner_id}::${obs.concept_id}`;
    if (!sequences.has(key)) {
      sequences.set(key, []);
    }
    sequences.get(key)!.push(obs);
  }

  const allPreds: number[] = [];
  const allActuals: number[] = [];
  let correctClassifications = 0;

  // 2. Chronological simulation per learner-concept track
  for (const [, items] of sequences) {
    // Sort chronologically
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let pL = params.pL0;

    for (const item of items) {
      // Predict outcome at step t using pL_{t-1}
      const pred = predictProbabilityCorrect(pL, params);
      const actual = item.credit !== undefined ? item.credit : (item.is_correct ? 1.0 : 0.0);

      allPreds.push(pred);
      allActuals.push(actual);

      if ((pred >= 0.5 && actual >= 0.5) || (pred < 0.5 && actual < 0.5)) {
        correctClassifications++;
      }

      // Update state for next opportunity
      const update = calculateBKTUpdate(pL, item.is_correct, params, item.credit);
      pL = update.posterior;
    }
  }

  const logLoss = calculateLogLoss(allPreds, allActuals);
  const brierScore = calculateBrierScore(allPreds, allActuals);
  const accuracy = Math.round((correctClassifications / allPreds.length) * 1000) / 1000;
  const calib = calculateCalibrationCurve(allPreds, allActuals, 10);

  return {
    log_loss: logLoss,
    brier_score: brierScore,
    accuracy,
    observation_count: allPreds.length,
    calibration_error: calib.calibrationError,
    reliability_bins: calib.bins,
  };
}

// =========================================================================
// 4. Dataset Audit & Learner-Level Splitting (GroupKFold)
// =========================================================================

export interface DatasetAuditResult {
  is_statistically_justified: boolean;
  reason: string;
  total_learners: number;
  total_observations: number;
  total_concepts: number;
  mean_observations_per_learner: number;
  synthetic_learners_count: number;
  real_learners_count: number;
  correctness_rate: number;
}

/**
 * Audits whether a response dataset satisfies statistical criteria for empirical calibration.
 */
export function auditCalibrationDataset(observations: BKTObservation[]): DatasetAuditResult {
  const learnerSet = new Set<string>();
  const conceptSet = new Set<string>();
  let syntheticCount = 0;
  let correctSum = 0;

  for (const obs of observations) {
    learnerSet.add(obs.learner_id);
    conceptSet.add(obs.concept_id);
    if (obs.is_correct) correctSum++;
    if (obs.learner_id.startsWith('eval_sim_') || obs.learner_id.startsWith('test_')) {
      syntheticCount++;
    }
  }

  const totalLearners = learnerSet.size;
  const totalObs = observations.length;
  const totalConcepts = conceptSet.size;
  const meanObsPerLearner = totalLearners > 0 ? Math.round((totalObs / totalLearners) * 10) / 10 : 0;
  const correctnessRate = totalObs > 0 ? Math.round((correctSum / totalObs) * 1000) / 1000 : 0;

  // Count unique synthetic vs real learners
  let uniqueSyntheticLearners = 0;
  for (const id of learnerSet) {
    if (id.startsWith('eval_sim_') || id.startsWith('test_')) {
      uniqueSyntheticLearners++;
    }
  }
  const realLearnersCount = totalLearners - uniqueSyntheticLearners;

  // Criteria for genuine empirical calibration:
  // Must have >= 50 real learners and >= 250 real observational responses.
  const isJustified = realLearnersCount >= 50 && (totalObs - syntheticCount) >= 250;

  let reason = '';
  if (!isJustified) {
    if (realLearnersCount === 0 && totalLearners > 0) {
      reason = 'CALIBRATION_NOT_YET_STATISTICALLY_JUSTIFIED: All available historical records originate from synthetic testing/evaluation simulators (eval_sim_ / test_ fixtures). Empirical parameter calibration requires authentic human student response observations.';
    } else {
      reason = `CALIBRATION_NOT_YET_STATISTICALLY_JUSTIFIED: Insufficient real learner observations (found ${realLearnersCount} real learners, required >= 50). Retaining literature baseline parameters.`;
    }
  } else {
    reason = 'CALIBRATION_STATISTICALLY_JUSTIFIED: Dataset meets minimum sample size requirements for parameter calibration.';
  }

  return {
    is_statistically_justified: isJustified,
    reason,
    total_learners: totalLearners,
    total_observations: totalObs,
    total_concepts: totalConcepts,
    mean_observations_per_learner: meanObsPerLearner,
    synthetic_learners_count: uniqueSyntheticLearners,
    real_learners_count: realLearnersCount,
    correctness_rate: correctnessRate,
  };
}

/**
 * Splits observations at the LEARNER level (GroupKFold).
 * Prevents data leakage: no learner's records cross set boundaries.
 */
export function splitDatasetByLearner(
  observations: BKTObservation[],
  trainRatio = 0.6,
  valRatio = 0.2,
  testRatio = 0.2
): BKTDatasetSplit {
  const learnerMap = new Map<string, BKTObservation[]>();

  for (const obs of observations) {
    if (!learnerMap.has(obs.learner_id)) {
      learnerMap.set(obs.learner_id, []);
    }
    learnerMap.get(obs.learner_id)!.push(obs);
  }

  const learners = Array.from(learnerMap.keys()).sort(); // Deterministic sort
  const total = learners.length;

  const trainCount = Math.max(1, Math.floor(total * trainRatio));
  const valCount = Math.max(1, Math.floor(total * valRatio));

  const trainLearners = new Set(learners.slice(0, trainCount));
  const valLearners = new Set(learners.slice(trainCount, trainCount + valCount));
  const testLearners = new Set(learners.slice(trainCount + valCount));

  const train: BKTObservation[] = [];
  const validation: BKTObservation[] = [];
  const test: BKTObservation[] = [];

  for (const obs of observations) {
    if (trainLearners.has(obs.learner_id)) {
      train.push(obs);
    } else if (valLearners.has(obs.learner_id)) {
      validation.push(obs);
    } else {
      test.push(obs);
    }
  }

  return {
    train,
    validation,
    test,
    learner_counts: {
      train: trainLearners.size,
      validation: valLearners.size,
      test: testLearners.size,
    },
    total_observations: observations.length,
  };
}

// =========================================================================
// 5. Offline BKT Calibration Engine
// =========================================================================

export interface CalibrationExecutionResult {
  status: 'CALIBRATED_SUCCESS' | 'CALIBRATION_NOT_YET_STATISTICALLY_JUSTIFIED';
  reason: string;
  selected_model: 'BASELINE' | 'CALIBRATED';
  baseline_parameters: BKTParameters;
  calibrated_parameters: BKTParameters;
  baseline_eval: BKTModelEvaluation;
  calibrated_eval: BKTModelEvaluation;
  held_out_verified: boolean;
}

/**
 * Offline parameter calibration procedure using grid search optimization.
 * 
 * - Evaluates candidates on Validation set.
 * - Confirms winner on untouched Test set.
 * - Retains baseline parameters if calibrated model fails to improve Log Loss on held-out test data.
 */
export function calibrateBKTParameters(
  split: BKTDatasetSplit,
  baseParams: BKTParameters = DEFAULT_BKT_PARAMS
): CalibrationExecutionResult {
  const baselineEval = evaluateBKTModel(split.test, baseParams);

  if (split.train.length === 0 || split.validation.length === 0 || split.test.length === 0) {
    return {
      status: 'CALIBRATION_NOT_YET_STATISTICALLY_JUSTIFIED',
      reason: 'Insufficient observations across train, validation, and test splits.',
      selected_model: 'BASELINE',
      baseline_parameters: baseParams,
      calibrated_parameters: baseParams,
      baseline_eval: baselineEval,
      calibrated_eval: baselineEval,
      held_out_verified: false,
    };
  }

  // Parameter search grid (within realistic pedagogical bounds)
  const pL0_candidates = [0.10, 0.15, 0.20];
  const pT_candidates = [0.08, 0.10, 0.15];
  const pG_candidates = [0.15, 0.20, 0.25];
  const pS_candidates = [0.05, 0.10, 0.15];

  let bestValLoss = Infinity;
  let bestParams: BKTParameters = { ...baseParams };

  for (const pL0 of pL0_candidates) {
    for (const pT of pT_candidates) {
      for (const pG of pG_candidates) {
        for (const pS of pS_candidates) {
          // Identifiability constraint: pG + pS < 0.85
          if (pG + pS >= 0.85) continue;

          const candidate: BKTParameters = { pL0, pT, pG, pS };
          const valEval = evaluateBKTModel(split.validation, candidate);

          if (valEval.log_loss < bestValLoss) {
            bestValLoss = valEval.log_loss;
            bestParams = candidate;
          }
        }
      }
    }
  }

  // Evaluate winning candidate on untouched Test set
  const calibratedEval = evaluateBKTModel(split.test, bestParams);

  // Check if calibrated model legitimately outperforms baseline on held-out test set
  const testImprovement = baselineEval.log_loss - calibratedEval.log_loss;
  const isBetterOnTest = testImprovement > 0.001;

  if (isBetterOnTest) {
    return {
      status: 'CALIBRATED_SUCCESS',
      reason: `Calibrated model demonstrated superior log loss on held-out test set (${calibratedEval.log_loss} vs baseline ${baselineEval.log_loss}, delta: -${Math.round(testImprovement * 1000) / 1000}).`,
      selected_model: 'CALIBRATED',
      baseline_parameters: baseParams,
      calibrated_parameters: bestParams,
      baseline_eval: baselineEval,
      calibrated_eval: calibratedEval,
      held_out_verified: true,
    };
  }

  return {
    status: 'CALIBRATED_SUCCESS',
    reason: `Baseline parameters remain optimal or equivalent on held-out test set (Baseline log loss ${baselineEval.log_loss} <= Calibrated ${calibratedEval.log_loss}). Retaining baseline model.`,
    selected_model: 'BASELINE',
    baseline_parameters: baseParams,
    calibrated_parameters: bestParams,
    baseline_eval: baselineEval,
    calibrated_eval: calibratedEval,
    held_out_verified: true,
  };
}
