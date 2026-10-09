/**
 * Canonical Phase 8 — Evaluation & Reproducible Benchmarking Contracts
 * 
 * Formal data contracts, metric definitions, and mathematical formulations for:
 * - Track A: Multimodal Ingestion (parsing, formats, provenance, malformed rejection)
 * - Track B: Retrieval & Grounding (Recall@k, Precision@k, MRR, nDCG@k, Citation Precision/Coverage)
 * - Track C: Assessment Correctness & Quality (numerical verification, tolerances, question quality)
 * - Track D: Learner-State Estimation & Calibration (Brier Score, Log Loss, 10-bin ECE)
 * - Track E: End-to-End AI Study Agent Loop (lifecycle completion, action selection, idempotency)
 * - Track F: Reliability & Performance (latency percentiles, concurrency, capacity limits)
 */

// =========================================================================
// 1. Core Run Contract & Metadata
// =========================================================================

export interface EvaluationRuntimeInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
}

export interface EvaluationDatasetFingerprint {
  name: string;
  filePath: string;
  version: string;
  itemCount: number;
  sha256: string;
  sourceType: 'ground_truth_curated' | 'synthetic_benchmark' | 'verified_rubric';
  isSynthetic: boolean;
  limitations: string;
}

export interface ConfidenceInterval {
  estimate: number;
  lower: number;
  upper: number;
  confidenceLevel: number; // e.g. 0.95
  method?: 'wilson_score' | 'query_level_bootstrap';
  sampleSize?: number;
  numerator?: number;
  denominator?: number;
  unitOfAnalysis?: string;
  resamples?: number;
  notes?: string;
}

// =========================================================================
// 2. Track Metrics Contracts
// =========================================================================

export interface TrackAMultimodalIngestionMetrics {
  totalItemsEvaluated: number;
  validItemsPassed: number;
  malformedItemsRejected: number;
  processingSuccessRate: number;
  extractionAccuracy: number;
  provenanceAccuracy: number; // page, slide, timestamp coordinates preserved
  formatSupportRates: Record<string, number>;
  malformedRejectionRate: number; // 1.0 = perfectly rejected all corrupted/invalid files
  oversizedRejectionRate: number;
}

export interface TrackBRetrievalGroundingMetrics {
  totalQueriesEvaluated: number;
  recallAt5: number;
  precisionAt5: number;
  meanReciprocalRank: number; // MRR
  ndcgAt5: number;            // Normalized Discounted Cumulative Gain
  contextPrecision: number;
  contextRecall: number;
  faithfulness: number;
  answerRelevancy: number;
  groundingAccuracy: number;
  coordinateAccuracy: number;
  citationPrecision: number;
  citationCoverage: number;
  refusalAccuracy: number;
  userIsolationPreserved: boolean;
  confidenceIntervals: {
    groundingAccuracy: ConfidenceInterval;   // Wilson score on discrete binary matches
    coordinateAccuracy?: ConfidenceInterval; // Wilson score on coordinate matches
    faithfulness: ConfidenceInterval;        // Query-level bootstrap on continuous scores
    contextRecall: ConfidenceInterval;       // Query-level bootstrap on RAGAS key-phrase recall scores
    recallAt5?: ConfidenceInterval;          // Query-level bootstrap on top-5 retrieval recall
    meanReciprocalRank: ConfidenceInterval;  // Query-level bootstrap on reciprocal ranks
    ndcgAt5: ConfidenceInterval;             // Query-level bootstrap on nDCG scores
    refusalAccuracy: ConfidenceInterval;     // Wilson score on off-material refusals
  };
}

export interface TrackCAssessmentQualityMetrics {
  totalQuestionsEvaluated: number;
  numericalVerificationAccuracy: number;
  toleranceHandlingAccuracy: number;
  unitConversionAccuracy: number;
  mcqGradingAccuracy: number;
  invalidQuestionRejectionRate: number; // quarantined questions correctly caught
  duplicateDetectionRate: number;
  misconceptionClassificationAccuracy: number;
  confidenceIntervals: {
    numericalAccuracy: ConfidenceInterval;         // Wilson score on numerical grading
    mcqAccuracy: ConfidenceInterval;               // Wilson score on MCQ grading
    invalidQuestionRejection: ConfidenceInterval; // Wilson score on quarantine rejections
  };
}

export interface CalibrationBinStats {
  binIndex: number;
  binRange: [number, number];
  itemCount: number;
  avgConfidence: number;
  avgAccuracy: number;
  calibrationError: number;
}

export interface TrackDLearnerCalibrationMetrics {
  totalTracesEvaluated: number;
  brierScore: number;         // (1/N) * sum((p - y)^2), lower is better [0, 1]
  logLoss: number;            // -(1/N) * sum(y*ln(p) + (1-y)*ln(1-p))
  expectedCalibrationError: number; // ECE over 10 bins
  calibrationBins: CalibrationBinStats[];
  predictionCoverage: number;
  recommendationDeterminism: number; // 1.0 = identical recommendation for identical state
  coldStartPriorApplied: boolean;
  positiveEvidenceIncreasesMastery: boolean;
  negativeEvidenceDecreasesMastery: boolean;
  tenantIsolationPreserved: boolean;
  syntheticDataNotice: string;
}

export interface TrackEStudyAgentMetrics {
  totalRunsEvaluated: number;
  fullLoopCompletionRate: number; // 6-stage lifecycle completion
  actionSelectionAccuracy: number;
  activityAvailability: number;
  gradingConsistency: number;
  retryIdempotencyPreserved: boolean;
  nextActionTransitionRate: number;
  tenantIsolationPreserved: boolean;
}

export interface TrackFReliabilityMetrics {
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  measuredSampleCount?: number;
  latencyMeasurementSource?: string;
  concurrencyThroughputReqPerSec: number;
  concurrencyErrorRate: number;
  processLimiterEnforced: boolean;
  cacheHitRatio: number;
  configuredLimits?: {
    maxConcurrentProcesses: number;
    maxQueueSize: number;
    rateLimitBuckets: Record<string, number>;
  };
  referenceLoadTestResults?: {
    source: string;
    concurrencyTiersTested: number[];
    maxThroughputRps: number;
    environmentNotice: string;
  };
}

// =========================================================================
// 3. Consolidated Evaluation Run Contract
// =========================================================================

export interface EvaluationRunContract {
  runId: string;
  evaluationTimestamp: string;
  gitCommitSha: string;
  workingTreeClean: boolean;
  randomSeed: number;
  runtime: EvaluationRuntimeInfo;
  datasetFingerprints: EvaluationDatasetFingerprint[];
  summaryCounts: {
    totalEvaluated: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalInvalid: number;
  };
  tracks: {
    trackA_multimodalIngestion: TrackAMultimodalIngestionMetrics;
    trackB_retrievalGrounding: TrackBRetrievalGroundingMetrics;
    trackC_assessmentQuality: TrackCAssessmentQualityMetrics;
    trackD_learnerCalibration: TrackDLearnerCalibrationMetrics;
    trackE_studyAgentLoop: TrackEStudyAgentMetrics;
    trackF_reliabilityPerformance: TrackFReliabilityMetrics;
  };
  perExampleClassifications: Array<{
    exampleId: string;
    track: string;
    status: 'pass' | 'fail' | 'skipped' | 'invalid';
    details: string;
    score?: number;
  }>;
  dataLimitations: string[];
  failuresAndErrors: string[];
  baselineComparison?: {
    baselineRunId: string;
    comparabilityStatus: 'COMPARABLE' | 'NOT_COMPARABLE' | 'UNVERIFIED';
    comparabilityNotice: string;
    deltas: Record<string, { baseline: number; current: number; delta: number; status: 'PASSED' | 'REGRESSED' | 'ATTENTION' | 'UNVERIFIED' }>;
    comparisons?: Array<{
      track: string;
      metric: string;
      phase7Value: number;
      phase8Value?: number;
      delta: number;
      target: string;
      status: 'PASSED' | 'REGRESSED' | 'ATTENTION' | 'UNVERIFIED' | 'NOT_COMPARABLE';
      notes?: string;
    }>;
  };
}

// =========================================================================
// 4. Mathematical Formulations & Metric Computations
// =========================================================================

/**
 * Computes reciprocal rank for a single query:
 * If a relevant document appears at rank r (1-indexed, 1 <= r <= k), returns 1 / r.
 * If no relevant document is retrieved within top k, returns 0.0.
 */
export function computeReciprocalRank(retrievedFlags: boolean[], k = 5): number {
  if (!retrievedFlags || retrievedFlags.length === 0 || k <= 0) return 0.0;
  const topK = retrievedFlags.slice(0, k);
  const firstIndex = topK.findIndex(Boolean);
  if (firstIndex < 0) return 0.0;
  return Math.round((1 / (firstIndex + 1)) * 1000) / 1000;
}

/**
 * Computes Mean Reciprocal Rank (MRR):
 * MRR = (1 / |Q|) * sum_{q in Q} RR(q)
 * If no relevant chunk was retrieved, rank is considered infinity (1/rank = 0).
 * Accepts either reciprocal ranks in [0, 1] or 1-based rank integers.
 */
export function computeMRR(ranksOrScores: number[]): number {
  if (!ranksOrScores || ranksOrScores.length === 0) return 0.0;
  const reciprocalSum = ranksOrScores.reduce((sum, r) => {
    if (r <= 0 || isNaN(r)) return sum;
    if (r <= 1.0) return sum + r; // already reciprocal rank in [0, 1]
    return sum + 1 / r;           // 1-based rank integer r -> 1/r
  }, 0);
  return Math.round((reciprocalSum / ranksOrScores.length) * 1000) / 1000;
}

/**
 * Computes Precision@k:
 * Precision@k = (number of relevant items in top k) / k
 * Missing result slots are treated as non-relevant (denominator is strictly fixed to k).
 */
export function computePrecisionAtK(retrievedFlags: boolean[], k = 5): number {
  if (k <= 0 || !retrievedFlags || retrievedFlags.length === 0) return 0.0;
  const topK = retrievedFlags.slice(0, k);
  const relevantInTopK = topK.filter(Boolean).length;
  return Math.round((relevantInTopK / k) * 1000) / 1000;
}

/**
 * Computes Recall@k:
 * Recall@k = (number of relevant items in top k) / totalExpectedRelevant
 * 
 * Principled policy for queries with no relevant documents in ground truth:
 * If totalExpectedRelevant <= 0, returns 0.0 (cannot recall from an empty set).
 */
export function computeRecallAtK(retrievedFlags: boolean[], totalExpected = 1, k = 5): number {
  if (totalExpected <= 0) return 0.0;
  if (!retrievedFlags || retrievedFlags.length === 0 || k <= 0) return 0.0;
  const topK = retrievedFlags.slice(0, k);
  const relevantInTopK = topK.filter(Boolean).length;
  return Math.round((Math.min(relevantInTopK / totalExpected, 1.0)) * 1000) / 1000;
}

/**
 * Computes Normalized Discounted Cumulative Gain at rank k (nDCG@k):
 * DCG@k = sum_{i=1}^k (2^{rel_i} - 1) / log2(i + 1)
 * IDCG@k = sum_{i=1}^{min(k, |ideal|)} (2^{ideal_rel_i} - 1) / log2(i + 1)
 * nDCG@k = DCG@k / IDCG@k
 * 
 * Principled policy for queries with no relevant documents in ground truth:
 * When IDCG@k === 0 (meaning ground truth contains 0 relevant documents):
 * - If ground truth has no relevant documents, ranking relevance is undefined.
 * - Such queries are excluded from ranking evaluation (and reported separately under refusal accuracy).
 * - If evaluated directly, returns 0.0, NEVER 1.0 (retrieval failure is never rewarded).
 * 
 * @param retrievedRelevance Graded relevance scores of retrieved items in retrieval order.
 * @param idealRelevance Ground-truth relevance scores of known relevant items, OR fallback sorted retrieved if ideal is omitted.
 * @param k Cutoff rank (default 5).
 */
export function computeNDCG(
  retrievedRelevance: number[],
  idealRelevance?: number[],
  k = 5
): number {
  if (k <= 0) return 0.0;
  if (!retrievedRelevance || retrievedRelevance.length === 0) return 0.0;

  // Clean and clamp relevance scores (missing or invalid labels clamped to 0)
  const cleanRetrieved = retrievedRelevance.slice(0, k).map((r) => (typeof r === 'number' && !isNaN(r) && r > 0 ? r : 0));

  let dcg = 0;
  for (let i = 0; i < cleanRetrieved.length; i++) {
    const rel = cleanRetrieved[i];
    if (rel > 0) {
      dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
    }
  }

  // Determine ideal relevance from ground-truth judgments
  let idealScores: number[];
  if (idealRelevance && idealRelevance.length > 0) {
    idealScores = idealRelevance
      .map((r) => (typeof r === 'number' && !isNaN(r) && r > 0 ? r : 0))
      .filter((r) => r > 0)
      .sort((a, b) => b - a)
      .slice(0, k);
  } else if (idealRelevance !== undefined) {
    // Ground truth was explicitly provided as empty or all zeros -> IDCG is 0
    idealScores = [];
  } else {
    // Fallback if ideal is omitted: sort retrieved
    idealScores = [...cleanRetrieved].filter((r) => r > 0).sort((a, b) => b - a);
  }

  let idcg = 0;
  for (let i = 0; i < idealScores.length; i++) {
    const rel = idealScores[i];
    idcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }

  // If no relevant documents in ground truth (IDCG == 0):
  // Principled policy: Return 0.0 (do not reward retrieval failure with 1.0)
  if (idcg === 0) {
    return 0.0;
  }

  return Math.min(1.0, Math.round((dcg / idcg) * 1000) / 1000);
}

/**
 * Computes Brier Score for probabilistic binary predictions:
 * Brier Score = (1 / N) * sum_{i=1}^N (p_i - y_i)^2
 * Bounded in [0.0, 1.0]. Lower is better. 0.0 = perfect probabilistic calibration.
 */
export function computeBrierScore(predictions: number[], outcomes: (0 | 1)[]): number {
  if (!predictions || predictions.length === 0 || predictions.length !== outcomes.length) {
    return 0.0;
  }
  const sumSquaredErr = predictions.reduce((sum, p, i) => {
    const err = p - outcomes[i];
    return sum + err * err;
  }, 0);
  return Math.round((sumSquaredErr / predictions.length) * 1000) / 1000;
}

/**
 * Computes Log Loss (Binary Cross-Entropy):
 * Log Loss = -(1 / N) * sum_{i=1}^N [ y_i * ln(p_i) + (1 - y_i) * ln(1 - p_i) ]
 * Clamped with epsilon = 1e-6 to avoid infinities.
 */
export function computeLogLoss(predictions: number[], outcomes: (0 | 1)[]): number {
  if (!predictions || predictions.length === 0 || predictions.length !== outcomes.length) {
    return 0.0;
  }
  const eps = 1e-6;
  const totalLoss = predictions.reduce((sum, rawP, i) => {
    const p = Math.max(eps, Math.min(1 - eps, rawP));
    const y = outcomes[i];
    return sum - (y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }, 0);
  return Math.round((totalLoss / predictions.length) * 1000) / 1000;
}

/**
 * Computes Expected Calibration Error (ECE) across M equal bins (default M = 10):
 * ECE = sum_{m=1}^M (|B_m| / N) * |acc(B_m) - conf(B_m)|
 */
export function computeECE(
  predictions: number[],
  outcomes: (0 | 1)[],
  numBins = 10
): { ece: number; binStats: CalibrationBinStats[] } {
  if (!predictions || predictions.length === 0 || predictions.length !== outcomes.length) {
    return { ece: 0.0, binStats: [] };
  }

  const N = predictions.length;
  const binWidth = 1.0 / numBins;
  const binStats: CalibrationBinStats[] = [];
  let weightedErrorSum = 0;

  for (let m = 0; m < numBins; m++) {
    const lower = m * binWidth;
    const upper = (m + 1) * binWidth;

    const binItems: Array<{ p: number; y: number }> = [];
    for (let i = 0; i < N; i++) {
      const p = predictions[i];
      if (m === numBins - 1 ? (p >= lower && p <= upper) : (p >= lower && p < upper)) {
        binItems.push({ p, y: outcomes[i] });
      }
    }

    const count = binItems.length;
    if (count === 0) {
      binStats.push({
        binIndex: m + 1,
        binRange: [Math.round(lower * 10) / 10, Math.round(upper * 10) / 10],
        itemCount: 0,
        avgConfidence: Math.round(((lower + upper) / 2) * 1000) / 1000,
        avgAccuracy: 0.0,
        calibrationError: 0.0,
      });
      continue;
    }

    const sumP = binItems.reduce((acc, item) => acc + item.p, 0);
    const sumY = binItems.reduce((acc, item) => acc + item.y, 0);
    const avgConfidence = sumP / count;
    const avgAccuracy = sumY / count;
    const calErr = Math.abs(avgAccuracy - avgConfidence);

    weightedErrorSum += (count / N) * calErr;

    binStats.push({
      binIndex: m + 1,
      binRange: [Math.round(lower * 10) / 10, Math.round(upper * 10) / 10],
      itemCount: count,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      avgAccuracy: Math.round(avgAccuracy * 1000) / 1000,
      calibrationError: Math.round(calErr * 1000) / 1000,
    });
  }

  return {
    ece: Math.round(weightedErrorSum * 1000) / 1000,
    binStats,
  };
}

/**
 * Computes Wilson Score 95% Confidence Interval for a binomial proportion:
 * Center = (p + z^2 / 2n) / (1 + z^2 / n)
 * Margin = (z / (1 + z^2 / n)) * sqrt(p(1-p)/n + z^2/(4n^2))
 * 
 * Strictly used for discrete binary events (successes / trials).
 */
export function computeWilsonConfidenceInterval(
  successes: number,
  total: number,
  z = 1.96, // 95% confidence
  unitOfAnalysis = 'trials'
): ConfidenceInterval {
  if (total <= 0) {
    return {
      estimate: 0.0,
      lower: 0.0,
      upper: 0.0,
      confidenceLevel: 0.95,
      method: 'wilson_score',
      sampleSize: 0,
      numerator: 0,
      denominator: 0,
      unitOfAnalysis,
      notes: 'Zero denominator; interval undefined.',
    };
  }

  const p = Math.max(0, Math.min(1, successes / total));
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));

  const lower = Math.max(0.0, Math.round((center - margin) * 1000) / 1000);
  const upper = Math.min(1.0, Math.round((center + margin) * 1000) / 1000);

  return {
    estimate: Math.round(p * 1000) / 1000,
    lower,
    upper,
    confidenceLevel: 0.95,
    method: 'wilson_score',
    sampleSize: total,
    numerator: successes,
    denominator: total,
    unitOfAnalysis,
  };
}

/**
 * Linear Congruential Generator (LCG) for deterministic, reproducible bootstrap sampling.
 */
function createSeededRng(seed: number) {
  let s = (seed ^ 0x12345678) >>> 0;
  return function nextFloat(): number {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Computes a query-level bootstrap confidence interval (default 95% CI) for ranking and continuous metrics.
 * Preserves each query's metric value without assuming normality or misapplying binary Wilson intervals.
 * 
 * @param values Array of query-level scores (e.g. reciprocal ranks, nDCG@k, faithfulness).
 * @param numResamples Number of bootstrap resamples (default: 1000).
 * @param seed Random seed for deterministic reproducibility.
 * @param unitOfAnalysis Description of unit (e.g. 'queries').
 */
export function computeQueryLevelBootstrapInterval(
  values: number[],
  numResamples = 1000,
  seed = 1790950000,
  unitOfAnalysis = 'queries'
): ConfidenceInterval {
  if (!values || values.length === 0) {
    return {
      estimate: 0.0,
      lower: 0.0,
      upper: 0.0,
      confidenceLevel: 0.95,
      method: 'query_level_bootstrap',
      sampleSize: 0,
      resamples: numResamples,
      unitOfAnalysis,
      notes: 'Empty input dataset; interval undefined.',
    };
  }

  const N = values.length;
  const originalMean = values.reduce((sum, v) => sum + v, 0) / N;

  if (N === 1) {
    const val = Math.round(originalMean * 1000) / 1000;
    return {
      estimate: val,
      lower: val,
      upper: val,
      confidenceLevel: 0.95,
      method: 'query_level_bootstrap',
      sampleSize: 1,
      resamples: numResamples,
      unitOfAnalysis,
      notes: 'Single-item sample; zero bootstrap variance.',
    };
  }

  const rng = createSeededRng(seed);
  const bootstrapMeans: number[] = new Array(numResamples);

  for (let b = 0; b < numResamples; b++) {
    let sampleSum = 0;
    for (let i = 0; i < N; i++) {
      const idx = Math.floor(rng() * N);
      sampleSum += values[idx];
    }
    bootstrapMeans[b] = sampleSum / N;
  }

  bootstrapMeans.sort((a, b) => a - b);

  // 95% empirical percentile interval: 2.5th and 97.5th percentiles
  const lowerIndex = Math.floor(0.025 * (numResamples - 1));
  const upperIndex = Math.ceil(0.975 * (numResamples - 1));

  const lower = Math.max(0.0, Math.round(bootstrapMeans[lowerIndex] * 1000) / 1000);
  const upper = Math.min(1.0, Math.round(bootstrapMeans[upperIndex] * 1000) / 1000);

  return {
    estimate: Math.round(originalMean * 1000) / 1000,
    lower,
    upper,
    confidenceLevel: 0.95,
    method: 'query_level_bootstrap',
    sampleSize: N,
    resamples: numResamples,
    unitOfAnalysis,
  };
}
