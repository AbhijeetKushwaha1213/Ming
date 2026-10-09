import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  computeMRR,
  computePrecisionAtK,
  computeRecallAtK,
  computeNDCG,
  computeBrierScore,
  computeLogLoss,
  computeECE,
  computeWilsonConfidenceInterval,
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

      // 3. Assessment Quality dataset
      expect(assessFp.name).toContain('Assessment');
      expect(assessFp.itemCount).toBe(13);
      expect(assessFp.sha256).toBe('5d06ea92ae3525dc5cfcb867166c11bd6d842acd56196b2e5e8965a89a00e4e9');
      expect(assessFp.isSynthetic).toBe(false);

      // 4. Learner Traces dataset (SYNTHETIC)
      expect(tracesFp.name).toContain('Learner Trace');
      expect(tracesFp.itemCount).toBe(40);
      expect(tracesFp.sha256).toBe('3eb6dd2058ca9b904178d73c16bb37446aaf30cd2eeaa60fd12ceac90730ced9');
      expect(tracesFp.isSynthetic).toBe(true);
      expect(tracesFp.limitations).toContain('CRITICAL');
      expect(tracesFp.limitations).toContain('synthetic');
    });
  });

  // =========================================================================
  // 2. Mathematical Metric Formulations & Pure Logic
  // =========================================================================
  describe('2. Mathematical Metric Formulations & Statistical Computations', () => {
    it('computes Mean Reciprocal Rank (MRR) accurately across varied rank configurations', () => {
      // Example: ranks = [1, 2, 4, 0 (not found)] -> (1/1 + 1/2 + 1/4 + 0) / 4 = 1.75 / 4 = 0.4375 -> 0.438
      expect(computeMRR([1, 2, 4, 0])).toBe(0.438);
      // Perfect first rank retrieval
      expect(computeMRR([1, 1, 1])).toBe(1.0);
      // No relevant items found
      expect(computeMRR([0, 0, 0])).toBe(0.0);
      // Empty input safe handling
      expect(computeMRR([])).toBe(0.0);
    });

    it('computes Precision@k and Recall@k with correct denominators', () => {
      const retrieved = [true, false, true, false, false];
      // 2 relevant items in top 5 -> 2/5 = 0.4
      expect(computePrecisionAtK(retrieved, 5)).toBe(0.4);
      // 2 relevant retrieved out of 2 total expected -> 2/2 = 1.0
      expect(computeRecallAtK(retrieved, 2, 5)).toBe(1.0);
      // 2 relevant retrieved out of 4 total expected -> 2/4 = 0.5
      expect(computeRecallAtK(retrieved, 4, 5)).toBe(0.5);

      // Edge cases
      expect(computePrecisionAtK([], 5)).toBe(0.0);
      expect(computeRecallAtK([], 2, 5)).toBe(0.0);
      expect(computeRecallAtK(retrieved, 0, 5)).toBe(1.0); // 0 expected -> 1.0
    });

    it('computes Normalized Discounted Cumulative Gain (nDCG@k)', () => {
      // Ideal ordering has highest relevance first -> nDCG = 1.0
      expect(computeNDCG([3, 2, 1, 0], 4)).toBe(1.0);
      // Suboptimal ordering: lower than 1.0
      const subNDCG = computeNDCG([0, 1, 2, 3], 4);
      expect(subNDCG).toBeLessThan(1.0);
      expect(subNDCG).toBeGreaterThan(0.0);

      // Edge cases
      expect(computeNDCG([], 5)).toBe(0.0);
      expect(computeNDCG([0, 0, 0], 3)).toBe(1.0);
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

    it('computes Wilson Score 95% Confidence Interval for proportions', () => {
      // 90 successes out of 100 trials
      const ci = computeWilsonConfidenceInterval(90, 100);
      expect(ci.estimate).toBe(0.9);
      expect(ci.lower).toBeGreaterThan(0.80);
      expect(ci.upper).toBeLessThan(0.96);
      expect(ci.confidenceLevel).toBe(0.95);

      // Zero total items: safe defaults
      const emptyCI = computeWilsonConfidenceInterval(0, 0);
      expect(emptyCI.estimate).toBe(0.0);
      expect(emptyCI.lower).toBe(0.0);
      expect(emptyCI.upper).toBe(0.0);
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
      expect(res.metrics.totalQuestionsEvaluated).toBe(13);
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
    it('completes the 6-stage lifecycle and verifies retry idempotency', async () => {
      const res = await evaluateStudyAgentLoopTrack();
      expect(res.metrics).toBeDefined();
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
      const metrics = getReliabilityMetrics();
      expect(metrics.p50LatencyMs).toBeGreaterThan(0);
      expect(metrics.p95LatencyMs).toBeGreaterThan(metrics.p50LatencyMs);
      expect(metrics.p99LatencyMs).toBeGreaterThan(metrics.p95LatencyMs);
      expect(metrics.concurrencyThroughputReqPerSec).toBeGreaterThan(500);
      expect(metrics.concurrencyErrorRate).toBe(0.0);
      expect(metrics.cacheHitRatio).toBeGreaterThanOrEqual(0.80);
      expect(metrics.processLimiterEnforced).toBe(true);
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

      const { contract, fullReport } = await runCanonicalPhase8Evaluation(mockSearch, mockChat, 3);

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

      // Summary counts
      expect(contract.summaryCounts.totalEvaluated).toBeGreaterThan(100);
      expect(contract.summaryCounts.totalPassed).toBeGreaterThan(90);

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
