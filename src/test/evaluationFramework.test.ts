import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  computeMRR,
  computeReciprocalRank,
  computePrecisionAtK,
  computeRecallAtK,
  computeNDCG,
  computeBrierScore,
  computeLogLoss,
  computeECE,
  computeWilsonConfidenceInterval,
  computeQueryLevelBootstrapInterval,
  type EvaluationRunContract,
} from '../../server/evaluationContract.ts';
import {
  getCanonicalDatasetFingerprints,
  evaluateMultimodalIngestion,
  evaluateAssessmentQualityTrack,
  evaluateLearnerCalibrationTrack,
  evaluateStudyAgentLoopTrack,
  getReliabilityMetrics,
  generateDeterministicCohort,
  runCanonicalPhase8Evaluation,
} from '../../server/evaluationEngine.ts';

describe('Phase 8: Evaluation Framework & Reproducible Benchmarking Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Dataset Fingerprint Stability & Cryptographic Integrity
  // =========================================================================
  describe('1. Dataset Fingerprint Stability & Cryptographic Integrity', () => {
    it('verifies SHA-256 fingerprints and item counts for all 4 canonical evaluation datasets', async () => {
      const fingerprints = await getCanonicalDatasetFingerprints();
      expect(fingerprints).toHaveLength(4);

      const [ragFp, ingestFp, assessFp, tracesFp] = fingerprints;

      // 1. RAG Grounding dataset
      expect(ragFp.name).toContain('RAG');
      expect(ragFp.itemCount).toBe(70);
      expect(ragFp.sha256).toBe('1152512659dc5730587073089bb2dd5b3d12536de070aa01d90073659e5425ed');
      expect(ragFp.isSynthetic).toBe(false);

      // 2. Multimodal Ingestion dataset
      expect(ingestFp.name).toContain('Multimodal Ingestion');
      expect(ingestFp.itemCount).toBe(12);
      expect(ingestFp.sha256).toBe('5fb5033887ba8f63bad14e3bfe8e167e67bb2986a19fb3682da9d80b58212044');
      expect(ingestFp.isSynthetic).toBe(false);

      // 3. Assessment Quality dataset (20 curated items)
      expect(assessFp.name).toContain('Assessment');
      expect(assessFp.itemCount).toBe(20);
      expect(assessFp.sha256).toBe('8b8d33385d679aa98d1139fcaab2198bd4cbb4bb3af84987f660d2d5d9477375');
      expect(assessFp.isSynthetic).toBe(false);

      // 4. Learner Traces dataset (SYNTHETIC)
      expect(tracesFp.name).toContain('Learner Trace');
      expect(tracesFp.itemCount).toBe(40);
      expect(tracesFp.sha256).toBe('3eb6dd2058ca9b904178d73c16bb37446aaf30cd2eeaa60fd12ceac90730ced9');
      expect(tracesFp.isSynthetic).toBe(true);
      expect(tracesFp.limitations).toContain('CRITICAL');
      expect(tracesFp.limitations).toContain('synthetic');
    });

    it('verifies exact in-domain (64) and out-of-domain refusal (6) split in the canonical RAG dataset', async () => {
      const datasetPath = path.resolve(process.cwd(), 'benchmarks/data/rag_eval_dataset.json');
      const raw = await fs.readFile(datasetPath, 'utf8');
      const dataset = JSON.parse(raw);
      expect(dataset).toHaveLength(70);

      const oodItems = dataset.filter((item: any) => item.off_material === true);
      const inDomainItems = dataset.filter((item: any) => item.off_material === false);

      expect(oodItems).toHaveLength(6);
      expect(inDomainItems).toHaveLength(64);
      expect(oodItems.map((x: any) => x.id)).toEqual([
        'eval_q_41',
        'eval_q_42',
        'eval_q_43',
        'eval_q_44',
        'eval_q_45',
        'eval_q_46',
      ]);
    });
  });

  // =========================================================================
  // 2. Mathematical Metric Formulations & Pure Logic
  // =========================================================================
  describe('2. Mathematical Metric Formulations & Statistical Computations', () => {
    it('computes Reciprocal Rank and Mean Reciprocal Rank (MRR) accurately across varied rank configurations', () => {
      // Reciprocal rank helper for single query
      expect(computeReciprocalRank([true, false, false, false, false], 5)).toBe(1.0);
      expect(computeReciprocalRank([false, true, false, false, false], 5)).toBe(0.5);
      expect(computeReciprocalRank([false, false, false, false, true], 5)).toBe(0.2);
      expect(computeReciprocalRank([false, false, false, false, false], 5)).toBe(0.0);
      expect(computeReciprocalRank([], 5)).toBe(0.0);

      // MRR across queries: ranks = [1, 2, 4, 0 (not found)] -> (1/1 + 1/2 + 1/4 + 0) / 4 = 1.75 / 4 = 0.4375 -> 0.438
      expect(computeMRR([1, 2, 4, 0])).toBe(0.438);
      // Reciprocal scores directly: [1.0, 0.5, 0.25, 0.0] -> 1.75 / 4 = 0.438
      expect(computeMRR([1.0, 0.5, 0.25, 0.0])).toBe(0.438);
      // Perfect first rank retrieval
      expect(computeMRR([1, 1, 1])).toBe(1.0);
      // No relevant items found
      expect(computeMRR([0, 0, 0])).toBe(0.0);
      // Empty input safe handling
      expect(computeMRR([])).toBe(0.0);
    });

    it('computes Precision@k with fixed k denominator and documented missing-slot treatment', () => {
      const retrieved = [true, false, true, false, false];
      // 2 relevant items in top 5 -> 2/5 = 0.4
      expect(computePrecisionAtK(retrieved, 5)).toBe(0.4);
      // Truncated list (only 1 retrieved item, 1 relevant): missing slots treated as non-relevant -> 1/5 = 0.2
      expect(computePrecisionAtK([true], 5)).toBe(0.2);
      // Empty retrieval list
      expect(computePrecisionAtK([], 5)).toBe(0.0);
      // Invalid k
      expect(computePrecisionAtK(retrieved, 0)).toBe(0.0);
    });

    it('verifies MRR and Recall@k independently and proves they can differ', () => {
      // Fixture 1: First relevant result at rank 1, 1 expected item
      const f1 = [true, false, false, false, false];
      expect(computeReciprocalRank(f1, 5)).toBe(1.0);
      expect(computeRecallAtK(f1, 1, 5)).toBe(1.0);

      // Fixture 2: First relevant result at rank 2, 1 expected item
      // PROOF of divergence: RR is 0.5, while Recall@5 is 1.0!
      const f2 = [false, true, false, false, false];
      expect(computeReciprocalRank(f2, 5)).toBe(0.5);
      expect(computeRecallAtK(f2, 1, 5)).toBe(1.0);
      expect(computeReciprocalRank(f2, 5)).not.toBe(computeRecallAtK(f2, 1, 5));

      // Fixture 3: First relevant result at rank 5, 1 expected item
      // PROOF of divergence: RR is 0.2, while Recall@5 is 1.0!
      const f3 = [false, false, false, false, true];
      expect(computeReciprocalRank(f3, 5)).toBe(0.2);
      expect(computeRecallAtK(f3, 1, 5)).toBe(1.0);
      expect(computeReciprocalRank(f3, 5)).not.toBe(computeRecallAtK(f3, 1, 5));

      // Fixture 4: Relevant documents exist but none appear in top k
      const f4 = [false, false, false, false, false];
      expect(computeReciprocalRank(f4, 5)).toBe(0.0);
      expect(computeRecallAtK(f4, 2, 5)).toBe(0.0);

      // Fixture 5: Several relevant documents exist (3 expected) and only some are retrieved (1 at rank 1)
      // PROOF of divergence: RR is 1.0, while Recall@5 is 1/3 = 0.333!
      const f5 = [true, false, false, false, false];
      expect(computeReciprocalRank(f5, 5)).toBe(1.0);
      expect(computeRecallAtK(f5, 3, 5)).toBe(0.333);
      expect(computeReciprocalRank(f5, 5)).not.toBe(computeRecallAtK(f5, 3, 5));

      // Fixture 6: Ground truth contains no relevant documents (totalExpected = 0)
      // Principled policy: cannot recall from empty set -> 0.0
      const f6 = [false, false, false, false, false];
      expect(computeReciprocalRank(f6, 5)).toBe(0.0);
      expect(computeRecallAtK(f6, 0, 5)).toBe(0.0);
    });

    it('computes Normalized Discounted Cumulative Gain (nDCG@k) with ground-truth IDCG and audits edge cases', () => {
      // 1. Relevant document at rank 1: nDCG = 1.0
      expect(computeNDCG([1, 0, 0, 0, 0], [1], 5)).toBe(1.0);

      // 2. Relevant document at rank 2: nDCG = (2^1 - 1)/log2(3) / 1.0 = 0.631
      expect(computeNDCG([0, 1, 0, 0, 0], [1], 5)).toBe(0.631);

      // 3. Relevant document at rank k (rank 5): nDCG = (2^1 - 1)/log2(6) / 1.0 = 0.387
      expect(computeNDCG([0, 0, 0, 0, 1], [1], 5)).toBe(0.387);

      // 4. Relevant documents present in ground truth but COMPLETELY missed by retrieval:
      // MUST NOT receive nDCG = 1.0; MUST be 0.0
      expect(computeNDCG([0, 0, 0, 0, 0], [1], 5)).toBe(0.0);
      expect(computeNDCG([0, 0, 0, 0, 0], [2, 1], 5)).toBe(0.0);
      expect(computeNDCG([0, 0, 0, 0, 0], [1], 5)).not.toBe(1.0);

      // 5. Multiple relevance grades:
      // Retrieved [1, 2, 0, 0, 0] vs ideal [2, 1]
      // DCG = 1/log2(2) + 3/log2(3) = 1 + 1.8928 = 2.8928
      // IDCG = 3/log2(2) + 1/log2(3) = 3 + 0.6309 = 3.6309
      // nDCG = 2.8928 / 3.6309 = 0.7967 -> 0.797
      expect(computeNDCG([1, 2, 0, 0, 0], [2, 1], 5)).toBe(0.797);

      // Perfect ordering with multiple grades:
      expect(computeNDCG([2, 1, 0, 0, 0], [2, 1], 5)).toBe(1.0);

      // 6. No relevant documents in ground truth:
      // Principled policy: Excluded / returns 0.0 (never rewards retrieval failure)
      expect(computeNDCG([0, 0, 0], [], 3)).toBe(0.0);
      expect(computeNDCG([0, 0, 0], [0], 3)).toBe(0.0);

      // 7. Empty retrieved results:
      expect(computeNDCG([], [1], 5)).toBe(0.0);
      expect(computeNDCG([], [], 5)).toBe(0.0);

      // 8. Missing or invalid relevance labels (NaN, negative, null, undefined):
      // Cleaned and clamped: only value 2 at rank 4 contributes to DCG
      // DCG = (2^2 - 1)/log2(5) = 3 / 2.3219 = 1.2920
      // IDCG = (2^2 - 1)/log2(2) = 3 / 1 = 3.0
      // nDCG = 1.2920 / 3.0 = 0.4307 -> 0.431
      const dirtyLabels = [NaN, -1, null as any, 2, undefined as any];
      expect(computeNDCG(dirtyLabels, [2], 5)).toBe(0.431);

      // Cutoff enforcement (k <= 0)
      expect(computeNDCG([1, 2], [2, 1], 0)).toBe(0.0);
    });

    it('computes Brier Score for probabilistic binary predictions', () => {
      // p = [0.8, 0.2], y = [1, 0] -> ((0.8-1)^2 + (0.2-0)^2) / 2 = (0.04 + 0.04) / 2 = 0.04
      expect(computeBrierScore([0.8, 0.2], [1, 0])).toBe(0.04);
      // Perfect calibration: (1-1)^2 + (0-0)^2 = 0
      expect(computeBrierScore([1.0, 0.0], [1, 0])).toBe(0.0);
      // Complete opposite: (0-1)^2 + (1-0)^2 = 1.0
      expect(computeBrierScore([0.0, 1.0], [1, 0])).toBe(1.0);
    });

    it('computes Log Loss (Binary Cross-Entropy) with epsilon protection', () => {
      // p = [0.5, 0.5], y = [1, 0] -> -(1*ln(0.5) + 1*ln(0.5)) / 2 = -ln(0.5) = 0.693
      expect(computeLogLoss([0.5, 0.5], [1, 0])).toBe(0.693);
      // Confident and correct: low loss
      expect(computeLogLoss([0.99, 0.01], [1, 0])).toBeLessThan(0.05);
      // Confident but wrong: high loss (clamped by epsilon 1e-6)
      expect(computeLogLoss([0.01, 0.99], [1, 0])).toBeGreaterThan(4.0);
    });

    it('computes Expected Calibration Error (ECE) across 10 equal bins', () => {
      const preds = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
      const outcomes: (0 | 1)[] = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];

      const { ece, binStats } = computeECE(preds, outcomes, 10);
      expect(binStats).toHaveLength(10);
      expect(ece).toBeGreaterThanOrEqual(0.0);
      expect(ece).toBeLessThanOrEqual(1.0);

      // Verify each bin covers exactly 0.1 width
      for (let i = 0; i < binStats.length; i++) {
        expect(binStats[i].binIndex).toBe(i + 1);
        expect(binStats[i].binRange[1] - binStats[i].binRange[0]).toBeCloseTo(0.1, 1);
      }
    });

    it('computes Wilson Score 95% Confidence Interval for proportions with full audit metadata', () => {
      // 90 successes out of 100 trials
      const ci = computeWilsonConfidenceInterval(90, 100, 0.95, 'items');
      expect(ci.method).toBe('wilson_score');
      expect(ci.estimate).toBe(0.9);
      expect(ci.lower).toBeGreaterThan(0.80);
      expect(ci.upper).toBeLessThan(0.96);
      expect(ci.confidenceLevel).toBe(0.95);
      expect(ci.sampleSize).toBe(100);
      expect(ci.numerator).toBe(90);
      expect(ci.denominator).toBe(100);
      expect(ci.unitOfAnalysis).toBe('items');

      // Zero total items: safe defaults
      const emptyCI = computeWilsonConfidenceInterval(0, 0);
      expect(emptyCI.estimate).toBe(0.0);
      expect(emptyCI.lower).toBe(0.0);
      expect(emptyCI.upper).toBe(0.0);
      expect(emptyCI.denominator).toBe(0);
      expect(emptyCI.numerator).toBe(0);
    });

    it('computes query-level bootstrap confidence interval for non-binary ranking distributions', () => {
      const sample = [1.0, 0.5, 0.25, 0.0];
      const ci = computeQueryLevelBootstrapInterval(sample, 1000, 1790950000, 'queries');
      expect(ci.method).toBe('query_level_bootstrap');
      expect(ci.estimate).toBe(0.438);
      expect(ci.resamples).toBe(1000);
      expect(ci.sampleSize).toBe(4);
      expect(ci.unitOfAnalysis).toBe('queries');
      expect(ci.lower).toBeLessThanOrEqual(ci.estimate);
      expect(ci.upper).toBeGreaterThanOrEqual(ci.estimate);

      // Deterministic reproduction with same seed
      const ci2 = computeQueryLevelBootstrapInterval(sample, 1000, 1790950000, 'queries');
      expect(ci2.lower).toBe(ci.lower);
      expect(ci2.upper).toBe(ci.upper);

      // Edge case: empty distribution
      const emptyCI = computeQueryLevelBootstrapInterval([], 1000, 1790950000, 'queries');
      expect(emptyCI.estimate).toBe(0.0);
      expect(emptyCI.lower).toBe(0.0);
      expect(emptyCI.upper).toBe(0.0);
      expect(emptyCI.sampleSize).toBe(0);

      // Edge case: single item
      const singleCI = computeQueryLevelBootstrapInterval([0.8], 100, 1790950000, 'queries');
      expect(singleCI.estimate).toBe(0.8);
      expect(singleCI.lower).toBe(0.8);
      expect(singleCI.upper).toBe(0.8);
    });

    it('reproduces and mathematically validates MRR vs nDCG@5 bootstrap uncertainty disparity', () => {
      // 1. Exact MRR distribution: 45 rank-1 hits (1.0), 19 misses (0.0)
      const mrrScores = [
        1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1,
        1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0,
      ];
      expect(mrrScores).toHaveLength(64);
      expect(mrrScores.filter((s) => s === 1)).toHaveLength(45);
      expect(mrrScores.filter((s) => s === 0)).toHaveLength(19);

      const mrrCI = computeQueryLevelBootstrapInterval(mrrScores, 1000, 1790950000, 'in_domain_queries');
      expect(mrrCI.estimate).toBe(0.703);
      expect(mrrCI.lower).toBe(0.594);
      expect(mrrCI.upper).toBe(0.813);

      // 2. Exact nDCG@5 distribution: 64 graded ranking scores clustered around the mean
      const ndcgScores = [
        0.553, 0.553, 0.812, 0.812, 0.734, 0.835, 0.835, 0.922, 0.339, 0.339, 0.553, 0.812, 0.606, 0.835,
        0.821, 0.835, 0.606, 0.922, 0.734, 0.835, 0.553, 0.734, 0.734, 0.734, 0.339, 0.553, 0.707, 0.606,
        0.553, 0.812, 0.812, 0.553, 0.553, 0.773, 0.606, 0.821, 0.922, 0.734, 0.553, 0.339, 0.899, 0.821,
        0.922, 0.922, 0.922, 0.922, 0.835, 0.553, 0.922, 0.773, 0.553, 0.734, 0.339, 0.339, 0.423, 0.773,
        0.734, 0.922, 0.922, 0.734, 0.835, 0.553, 0.734, 0.606,
      ];
      expect(ndcgScores).toHaveLength(64);

      const ndcgCI = computeQueryLevelBootstrapInterval(ndcgScores, 1000, 1790950000, 'in_domain_queries');
      expect(ndcgCI.estimate).toBe(0.703);
      expect(ndcgCI.lower).toBe(0.662);
      expect(ndcgCI.upper).toBe(0.745);

      // 3. Mathematical proof of width difference:
      // Both point estimates equal 0.703
      expect(mrrCI.estimate).toBe(ndcgCI.estimate);

      // Compute standard deviations
      const mrrMean = mrrScores.reduce((a, b) => a + b, 0) / 64;
      const mrrVar = mrrScores.reduce((a, b) => a + Math.pow(b - mrrMean, 2), 0) / 63;
      const mrrSD = Math.sqrt(mrrVar);

      const ndcgMean = ndcgScores.reduce((a, b) => a + b, 0) / 64;
      const ndcgVar = ndcgScores.reduce((a, b) => a + Math.pow(b - ndcgMean, 2), 0) / 63;
      const ndcgSD = Math.sqrt(ndcgVar);

      // MRR standard deviation (0.460) is ~2.6x higher than nDCG (0.176) due to extreme bimodal 0/1 values
      expect(mrrSD).toBeCloseTo(0.460, 2);
      expect(ndcgSD).toBeCloseTo(0.176, 2);
      expect(mrrSD / ndcgSD).toBeGreaterThan(2.5);

      // Consequently, nDCG 95% bootstrap interval width (0.083) is ~2.6x narrower than MRR interval (0.219)
      const mrrWidth = mrrCI.upper - mrrCI.lower;
      const ndcgWidth = ndcgCI.upper - ndcgCI.lower;
      expect(mrrWidth).toBeCloseTo(0.219, 2);
      expect(ndcgWidth).toBeCloseTo(0.083, 2);
      expect(mrrWidth / ndcgWidth).toBeGreaterThan(2.5);
    });
  });

  // =========================================================================
  // 3. Track A: Multimodal Ingestion Robustness
  // =========================================================================
  describe('3. Track A: Multimodal Ingestion Evaluation', () => {
    it('evaluates valid formats, rejects spoofed, empty, corrupted, and oversized inputs', async () => {
      const res = await evaluateMultimodalIngestion();
      expect(res.metrics).toBeDefined();
      expect(res.metrics.totalItemsEvaluated).toBe(12);
      expect(res.metrics.processingSuccessRate).toBeGreaterThanOrEqual(0.90);
      expect(res.metrics.extractionAccuracy).toBe(1.0);
      expect(res.metrics.provenanceAccuracy).toBe(1.0);
      expect(res.metrics.malformedRejectionRate).toBe(1.0);
      expect(res.metrics.oversizedRejectionRate).toBe(1.0);

      // Verified supported formats
      expect(res.metrics.formatSupportRates['PDF']).toBe(1.0);
      expect(res.metrics.formatSupportRates['PPTX']).toBe(1.0);
      expect(res.metrics.formatSupportRates['PNG']).toBe(1.0);
      expect(res.metrics.formatSupportRates['JPEG']).toBe(1.0);
      expect(res.metrics.formatSupportRates['WEBP']).toBe(1.0);
      expect(res.metrics.formatSupportRates['MP3']).toBe(1.0);
      expect(res.metrics.formatSupportRates['WAV']).toBe(1.0);
      expect(res.metrics.formatSupportRates['TEXT']).toBe(1.0);
    });
  });

  // =========================================================================
  // 4. Track C: Authoritative Assessment Quality
  // =========================================================================
  describe('4. Track C: Assessment Correctness & Verifier Evaluation', () => {
    it('verifies numerical answers with tolerances, units, scientific notation, and catches invalid questions', async () => {
      const res = await evaluateAssessmentQualityTrack();
      expect(res.metrics).toBeDefined();
      expect(res.metrics.totalQuestionsEvaluated).toBe(20);
      expect(res.metrics.numericalVerificationAccuracy).toBe(1.0);
      expect(res.metrics.toleranceHandlingAccuracy).toBe(1.0);
      expect(res.metrics.unitConversionAccuracy).toBe(1.0);
      expect(res.metrics.mcqGradingAccuracy).toBe(1.0);
      expect(res.metrics.invalidQuestionRejectionRate).toBe(1.0);
      expect(res.metrics.duplicateDetectionRate).toBe(1.0);
      expect(res.metrics.misconceptionClassificationAccuracy).toBe(1.0);

      expect(res.metrics.confidenceIntervals.numericalAccuracy.estimate).toBe(1.0);
      expect(res.metrics.confidenceIntervals.mcqAccuracy.estimate).toBe(1.0);
    });
  });

  // =========================================================================
  // 5. Track D: Learner Calibration & Probabilistic Estimation
  // =========================================================================
  describe('5. Track D: Learner-State Calibration & Probabilistic Accuracy', () => {
    it('evaluates chronological learner traces, computes Brier score, ECE, and enforces synthetic disclaimer', async () => {
      const res = await evaluateLearnerCalibrationTrack();
      expect(res.metrics).toBeDefined();
      expect(res.metrics.totalTracesEvaluated).toBe(40);

      // Probabilistic metrics
      expect(res.metrics.brierScore).toBeGreaterThanOrEqual(0.0);
      expect(res.metrics.brierScore).toBeLessThan(0.30);
      expect(res.metrics.expectedCalibrationError).toBeGreaterThanOrEqual(0.0);
      expect(res.metrics.expectedCalibrationError).toBeLessThan(0.40);

      // Determinism & properties
      expect(res.metrics.recommendationDeterminism).toBe(1.0);
      expect(res.metrics.coldStartPriorApplied).toBe(true);
      expect(res.metrics.positiveEvidenceIncreasesMastery).toBe(true);
      expect(res.metrics.negativeEvidenceDecreasesMastery).toBe(true);
      expect(res.metrics.tenantIsolationPreserved).toBe(true);

      // Mandatory synthetic disclaimer
      expect(res.metrics.syntheticDataNotice).toContain('CRITICAL DATA RESTRICTION');
      expect(res.metrics.syntheticDataNotice).toContain('synthetic learner simulation traces');
    });
  });

  // =========================================================================
  // 6. Track E: AI Study Agent Closed Loop
  // =========================================================================
  describe('6. Track E: End-to-End AI Study Agent Closed Loop Evaluation', () => {
    it('completes the 6-stage lifecycle and verifies retry idempotency across 5 distinct scenarios', async () => {
      const res = await evaluateStudyAgentLoopTrack();
      expect(res.metrics).toBeDefined();
      expect(res.metrics.totalRunsEvaluated).toBe(5);
      expect(res.metrics.fullLoopCompletionRate).toBe(1.0);
      expect(res.metrics.actionSelectionAccuracy).toBe(1.0);
      expect(res.metrics.activityAvailability).toBe(1.0);
      expect(res.metrics.gradingConsistency).toBe(1.0);
      expect(res.metrics.retryIdempotencyPreserved).toBe(true);
      expect(res.metrics.nextActionTransitionRate).toBe(1.0);
      expect(res.metrics.tenantIsolationPreserved).toBe(true);
    });
  });

  // =========================================================================
  // 7. Track F: Reliability & Telemetry
  // =========================================================================
  describe('7. Track F: Reliability & Performance Metrics', () => {
    it('retrieves latency percentiles and capacity constraints', () => {
      const liveMetrics = getReliabilityMetrics([15, 25, 45, 60, 90]);
      expect(liveMetrics.p50LatencyMs).toBe(45);
      expect(liveMetrics.p95LatencyMs).toBeGreaterThan(45);
      expect(liveMetrics.p99LatencyMs).toBeGreaterThanOrEqual(liveMetrics.p95LatencyMs);
      expect(liveMetrics.concurrencyThroughputReqPerSec).toBeGreaterThan(500);
      expect(liveMetrics.concurrencyErrorRate).toBe(0.0);
      expect(liveMetrics.cacheHitRatio).toBeGreaterThanOrEqual(0.80);
      expect(liveMetrics.processLimiterEnforced).toBe(true);
      expect(liveMetrics.configuredLimits.maxConcurrentProcesses).toBe(8);
      expect(liveMetrics.configuredLimits.maxQueueSize).toBe(64);
      expect(liveMetrics.measuredSampleCount).toBe(5);
    });
  });

  // =========================================================================
  // 8. Canonical Phase 8 Full Evaluation Contract & Serialization
  // =========================================================================
  describe('8. Canonical Phase 8 Full Evaluation Contract', () => {
    it('generates a complete EvaluationRunContract with zero data leaks and persisted reports', async () => {
      const mockSearch = vi.fn().mockImplementation(async (query: string, topic?: string, userId?: string) => {
        if (userId === 'unauthorized_stranger_user_999') return { results: [] };
        return {
          results: [
            { source_id: 'src_os_1', page_number: 1, score: 0.88, topic: 'Operating Systems', text: 'Coffman conditions' },
          ],
        };
      });

      const mockChat = vi.fn().mockResolvedValue({
        response: 'According to course materials, Coffman conditions include mutual exclusion, hold and wait, no preemption, and circular wait.',
        citations: [{ page_number: 1, source_id: 'src_os_1', text: 'Coffman conditions' }],
      });

      const { contract, fullReport } = await runCanonicalPhase8Evaluation(mockSearch, mockChat, 3, false);

      expect(contract).toBeDefined();
      expect(contract.runId).toContain('eval_run_');
      expect(contract.gitCommitSha).toBeDefined();
      expect(contract.randomSeed).toBe(1790950000);
      expect(contract.runtime.nodeVersion).toBeDefined();

      // Check all 6 tracks exist on contract
      expect(contract.tracks.trackA_multimodalIngestion).toBeDefined();
      expect(contract.tracks.trackB_retrievalGrounding).toBeDefined();
      expect(contract.tracks.trackC_assessmentQuality).toBeDefined();
      expect(contract.tracks.trackD_learnerCalibration).toBeDefined();
      expect(contract.tracks.trackE_studyAgentLoop).toBeDefined();
      expect(contract.tracks.trackF_reliabilityPerformance).toBeDefined();

      // Exact mathematical 1:1 match between summaryCounts and perExampleClassifications
      expect(contract.summaryCounts.totalEvaluated).toBe(contract.perExampleClassifications.length);
      expect(contract.summaryCounts.totalPassed + contract.summaryCounts.totalFailed).toBe(contract.summaryCounts.totalEvaluated);

      // Verify Query-Level Bootstrap used for ranking & continuous metrics
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.meanReciprocalRank.method).toBe('query_level_bootstrap');
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.ndcgAt5.method).toBe('query_level_bootstrap');
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.contextRecall.method).toBe('query_level_bootstrap');
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.faithfulness.method).toBe('query_level_bootstrap');

      // Verify Wilson Score used for discrete binary proportions
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.groundingAccuracy.method).toBe('wilson_score');
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.refusalAccuracy.method).toBe('wilson_score');

      // Verify exact query inclusion denominators
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.meanReciprocalRank.sampleSize).toBe(64);
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.ndcgAt5.sampleSize).toBe(64);
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.contextRecall.sampleSize).toBe(64);
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.refusalAccuracy.sampleSize).toBe(6);
      expect(contract.tracks.trackB_retrievalGrounding.confidenceIntervals.refusalAccuracy.denominator).toBe(6);

      // Baseline comparability audit: all historical comparisons must be NOT_COMPARABLE
      expect(contract.baselineComparison).toBeDefined();
      expect(contract.baselineComparison.comparabilityStatus).toBe('NOT_COMPARABLE');
      expect(contract.baselineComparison.comparisons.length).toBeGreaterThan(0);
      expect(contract.baselineComparison.comparisons.every((c) => c.status === 'NOT_COMPARABLE')).toBe(true);
      expect(fullReport.phaseComparison.every((c) => c.status === 'NOT_COMPARABLE')).toBe(true);

      // Summary counts: 12 (Ingestion) + 70 (RAG) + 20 (Assess) + 40 (Learner) + 5 (Study Agent) = 147
      expect(contract.summaryCounts.totalEvaluated).toBe(147);
      expect(contract.summaryCounts.totalPassed).toBeGreaterThan(80);
      expect(contract.summaryCounts.totalPassed).toBeLessThanOrEqual(contract.summaryCounts.totalEvaluated);

      // Backward compatible fullReport
      expect(fullReport.ragMetrics).toBeDefined();
      expect(fullReport.groundingMetrics).toBeDefined();
      expect(fullReport.personalizationMetrics).toBeDefined();
      expect(fullReport.noveltyMetrics).toBeDefined();
      expect(fullReport.phaseComparison.length).toBeGreaterThan(5);

      // Verify no secrets or passwords in contract
      const serialized = JSON.stringify(contract);
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('SECRET');
      expect(serialized).not.toContain('API_KEY');
    });
  });
});
