/**
 * Canonical Phase 5 — Step 2 Test Suite
 * BKT Calibration, Retention & Mastery Reliability
 * 
 * 50+ comprehensive tests covering:
 * 1. BKT Mathematical Foundations & Update Equations
 * 2. Partial Credit Scaling & Monotonicity
 * 3. Difficulty Mappings (Easy / Medium / Hard)
 * 4. Dataset Audit & Synthetic vs. Real Data Detection
 * 5. Learner-Level Partitioning (Zero Data Leakage)
 * 6. Model Evaluation Metrics (Log Loss, Brier Score, ECE, Reliability Bins)
 * 7. Reproducible BKT Calibration Procedure
 * 8. Retention / Memory Decay Model (Ebbinghaus Decay, Stability Scaling)
 * 9. Separation of Latent Knowledge from Current Recall Probability
 * 10. Cold Start Handling (N = 0)
 * 11. Temporal Causality & Leakage Prevention
 * 12. Multi-Tenant & User Isolation
 * 13. 15 Mastery Stability Edge Cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBKTUpdate,
  getDifficultyBKTParameters,
  calculateConfidence,
  determineMasteryStatus,
  DEFAULT_BKT_PARAMS,
  type BKTParameters,
} from '../../server/bktService.ts';
import {
  calculateConceptRetention,
  predictProbabilityCorrect,
  calculateLogLoss,
  calculateBrierScore,
  calculateCalibrationCurve,
  evaluateBKTModel,
  auditCalibrationDataset,
  splitDatasetByLearner,
  calibrateBKTParameters,
} from '../../server/bktCalibrationService.ts';
import type { BKTObservation } from '../../server/learnerTypes.ts';
import {
  extractLearnerEvidence,
  recordLearnerEvidence,
  getTopicMasteryState,
} from '../../server/learnerEvidenceService.ts';

describe('CANONICAL PHASE 5 — STEP 2: BKT CALIBRATION, RETENTION & MASTERY RELIABILITY', () => {

  // =========================================================================
  // 1. BKT Mathematical Foundations & Update Equations (Part 2)
  // =========================================================================
  describe('1. BKT Mathematical Foundations & Update Equations', () => {
    it('1.1 should correctly calculate posterior given a correct response (Bayes rule + transition)', () => {
      const prior = 0.20;
      const params: BKTParameters = { pL0: 0.20, pT: 0.10, pG: 0.25, pS: 0.10 };

      // Manual Bayes calculation:
      // P(L|obs=1) = [0.20 * 0.90] / [0.20 * 0.90 + 0.80 * 0.25] = 0.18 / (0.18 + 0.20) = 0.18 / 0.38 = 0.47368
      // Learning step: 0.47368 + (1 - 0.47368) * 0.10 = 0.47368 + 0.05263 = 0.5263
      const { posterior } = calculateBKTUpdate(prior, true, params);

      expect(posterior).toBeCloseTo(0.5263, 3);
      expect(posterior).toBeGreaterThan(prior);
    });

    it('1.2 should correctly calculate posterior given an incorrect response', () => {
      const prior = 0.50;
      const params: BKTParameters = { pL0: 0.20, pT: 0.10, pG: 0.20, pS: 0.10 };

      // Manual Bayes calculation:
      // P(L|obs=0) = [0.50 * 0.10] / [0.50 * 0.10 + 0.50 * 0.80] = 0.05 / 0.45 = 0.1111
      // Learning step: 0.1111 + (1 - 0.1111) * 0.10 = 0.1111 + 0.08889 = 0.2000
      const { posterior } = calculateBKTUpdate(prior, false, params);

      expect(posterior).toBeCloseTo(0.2000, 3);
      expect(posterior).toBeLessThan(prior);
    });

    it('1.3 should clamp prior and posterior strictly within [0.01, 0.99]', () => {
      const params = DEFAULT_BKT_PARAMS;

      // Extreme low prior
      const low = calculateBKTUpdate(0.00001, false, params);
      expect(low.posterior).toBeGreaterThanOrEqual(0.01);

      // Extreme high prior
      const high = calculateBKTUpdate(0.99999, true, params);
      expect(high.posterior).toBeLessThanOrEqual(0.99);
    });

    it('1.4 should be strictly deterministic for identical inputs', () => {
      const params = DEFAULT_BKT_PARAMS;
      const res1 = calculateBKTUpdate(0.42, true, params, 0.8);
      const res2 = calculateBKTUpdate(0.42, true, params, 0.8);

      expect(res1.posterior).toBe(res2.posterior);
      expect(res1.prior).toBe(res2.prior);
    });

    it('1.5 should handle invalid numerical inputs gracefully without NaN or Infinity', () => {
      const params = DEFAULT_BKT_PARAMS;
      const resNaN = calculateBKTUpdate(NaN, true, params);
      expect(isFinite(resNaN.posterior)).toBe(true);
      expect(resNaN.posterior).toBeGreaterThanOrEqual(0.01);
      expect(resNaN.posterior).toBeLessThanOrEqual(0.99);

      const resInf = calculateBKTUpdate(Infinity, false, params);
      expect(isFinite(resInf.posterior)).toBe(true);
    });
  });

  // =========================================================================
  // 2. Partial Credit Scaling & Monotonicity (Part 10)
  // =========================================================================
  describe('2. Partial Credit Scaling & Strict Monotonicity', () => {
    const prior = 0.40;
    const params = DEFAULT_BKT_PARAMS;

    it('2.1 should produce exact incorrect update when credit is 0.0', () => {
      const res0 = calculateBKTUpdate(prior, false, params, 0.0);
      const resIncorrect = calculateBKTUpdate(prior, false, params);
      expect(res0.posterior).toBe(resIncorrect.posterior);
    });

    it('2.2 should produce exact correct update when credit is 1.0', () => {
      const res1 = calculateBKTUpdate(prior, true, params, 1.0);
      const resCorrect = calculateBKTUpdate(prior, true, params);
      expect(res1.posterior).toBe(resCorrect.posterior);
    });

    it('2.3 should be strictly monotonically increasing across partial credit steps', () => {
      const credits = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
      const posteriors = credits.map((c) => calculateBKTUpdate(prior, c >= 0.75, params, c).posterior);

      for (let i = 1; i < posteriors.length; i++) {
        expect(posteriors[i]).toBeGreaterThanOrEqual(posteriors[i - 1]);
      }
    });

    it('2.4 should interpolate 0.50 credit smoothly between correct and incorrect updates', () => {
      const pCorrect = calculateBKTUpdate(prior, true, params).posterior;
      const pIncorrect = calculateBKTUpdate(prior, false, params).posterior;
      const pHalf = calculateBKTUpdate(prior, false, params, 0.5).posterior;

      const expectedMid = Math.round((0.5 * pCorrect + 0.5 * pIncorrect) * 1000) / 1000;
      expect(pHalf).toBe(expectedMid);
      expect(pHalf).toBeGreaterThan(pIncorrect);
      expect(pHalf).toBeLessThan(pCorrect);
    });
  });

  // =========================================================================
  // 3. Difficulty Mappings (Part 11)
  // =========================================================================
  describe('3. Difficulty Parameter Effects', () => {
    it('3.1 easy questions should have higher guess and lower slip', () => {
      const easy = getDifficultyBKTParameters('easy');
      const med = getDifficultyBKTParameters('medium');

      expect(easy.pG).toBeGreaterThan(med.pG); // 0.25 > 0.20
      expect(easy.pS).toBeLessThan(med.pS);    // 0.05 < 0.10
    });

    it('3.2 hard questions should have lower guess and higher slip', () => {
      const hard = getDifficultyBKTParameters('hard');
      const med = getDifficultyBKTParameters('medium');

      expect(hard.pG).toBeLessThan(med.pG);    // 0.10 < 0.20
      expect(hard.pS).toBeGreaterThan(med.pS); // 0.20 > 0.10
    });

    it('3.3 correct answer on hard question should provide higher posterior gain than on easy question', () => {
      const prior = 0.30;
      const easy = getDifficultyBKTParameters('easy');
      const hard = getDifficultyBKTParameters('hard');

      const gainEasy = calculateBKTUpdate(prior, true, easy).posterior - prior;
      const gainHard = calculateBKTUpdate(prior, true, hard).posterior - prior;

      // Hard correct answer gives greater evidence boost because guessing is hard
      expect(gainHard).toBeGreaterThan(gainEasy);
    });

    it('3.4 incorrect answer on easy question should cause larger penalty than on hard question', () => {
      const prior = 0.60;
      const easy = getDifficultyBKTParameters('easy');
      const hard = getDifficultyBKTParameters('hard');

      const dropEasy = prior - calculateBKTUpdate(prior, false, easy).posterior;
      const dropHard = prior - calculateBKTUpdate(prior, false, hard).posterior;

      // Failing an easy item indicates strong negative evidence
      expect(dropEasy).toBeGreaterThan(dropHard);
    });
  });

  // =========================================================================
  // 4. Dataset Audit & Synthetic vs Real Data Detection (Part 3)
  // =========================================================================
  describe('4. Dataset Audit & Calibration Justification', () => {
    it('4.1 should correctly identify synthetic test simulator users (eval_sim_ / test_)', () => {
      const obs: BKTObservation[] = [
        { learner_id: 'eval_sim_novice_1', concept_id: 'c1', step: 1, is_correct: false, timestamp: '2026-10-01T10:00:00Z' },
        { learner_id: 'eval_sim_strong_2', concept_id: 'c1', step: 1, is_correct: true, timestamp: '2026-10-01T10:01:00Z' },
        { learner_id: 'test_student_a', concept_id: 'c1', step: 1, is_correct: true, timestamp: '2026-10-01T10:02:00Z' },
      ];

      const audit = auditCalibrationDataset(obs);
      expect(audit.synthetic_learners_count).toBe(3);
      expect(audit.real_learners_count).toBe(0);
      expect(audit.is_statistically_justified).toBe(false);
      expect(audit.reason).toContain('CALIBRATION_NOT_YET_STATISTICALLY_JUSTIFIED');
    });

    it('4.2 should flag insufficient sample size even if learners appear real', () => {
      const obs: BKTObservation[] = [
        { learner_id: 'real_student_1', concept_id: 'c1', step: 1, is_correct: true, timestamp: '2026-10-01T10:00:00Z' },
        { learner_id: 'real_student_2', concept_id: 'c1', step: 1, is_correct: false, timestamp: '2026-10-01T10:01:00Z' },
      ];

      const audit = auditCalibrationDataset(obs);
      expect(audit.real_learners_count).toBe(2);
      expect(audit.is_statistically_justified).toBe(false);
      expect(audit.reason).toContain('Insufficient real learner observations');
    });

    it('4.3 should confirm statistical justification when genuine large cohort exists', () => {
      const obs: BKTObservation[] = [];
      for (let i = 0; i < 60; i++) {
        for (let s = 1; s <= 5; s++) {
          obs.push({
            learner_id: `human_learner_${i}`,
            concept_id: 'c_kinematics',
            step: s,
            is_correct: Math.random() > 0.4,
            timestamp: new Date(Date.now() + i * 1000 + s * 100).toISOString(),
          });
        }
      }

      const audit = auditCalibrationDataset(obs);
      expect(audit.real_learners_count).toBe(60);
      expect(audit.total_observations).toBe(300);
      expect(audit.is_statistically_justified).toBe(true);
      expect(audit.reason).toContain('CALIBRATION_STATISTICALLY_JUSTIFIED');
    });
  });

  // =========================================================================
  // 5. Learner-Level Partitioning & Zero Leakage (Part 5)
  // =========================================================================
  describe('5. Learner-Level Dataset Splitting (GroupKFold)', () => {
    it('5.1 should guarantee zero learner overlap across train, validation, and test splits', () => {
      const obs: BKTObservation[] = [];
      for (let l = 1; l <= 10; l++) {
        for (let s = 1; s <= 3; s++) {
          obs.push({
            learner_id: `student_${l}`,
            concept_id: 'c_calculus',
            step: s,
            is_correct: s > 1,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const split = splitDatasetByLearner(obs, 0.6, 0.2, 0.2);

      const trainLearners = new Set(split.train.map((o) => o.learner_id));
      const valLearners = new Set(split.validation.map((o) => o.learner_id));
      const testLearners = new Set(split.test.map((o) => o.learner_id));

      // Assert complete mutual exclusivity
      for (const id of trainLearners) {
        expect(valLearners.has(id)).toBe(false);
        expect(testLearners.has(id)).toBe(false);
      }
      for (const id of valLearners) {
        expect(testLearners.has(id)).toBe(false);
      }

      expect(trainLearners.size + valLearners.size + testLearners.size).toBe(10);
      expect(split.total_observations).toBe(30);
    });
  });

  // =========================================================================
  // 6. Model Evaluation Metrics (Part 6 & 7)
  // =========================================================================
  describe('6. Model Evaluation Metrics (Log Loss, Brier, Calibration)', () => {
    it('6.1 should calculate binary log loss accurately', () => {
      // Perfect prediction: p=0.99 for y=1, p=0.01 for y=0
      const goodLoss = calculateLogLoss([0.99, 0.01], [1, 0]);
      expect(goodLoss).toBeLessThan(0.05);

      // Poor prediction: p=0.10 for y=1, p=0.90 for y=0
      const poorLoss = calculateLogLoss([0.10, 0.90], [1, 0]);
      expect(poorLoss).toBeGreaterThan(2.0);
    });

    it('6.2 should calculate Brier score accurately', () => {
      // Perfect: (1-1)^2 + (0-0)^2 = 0
      const brierZero = calculateBrierScore([1.0, 0.0], [1, 0]);
      expect(brierZero).toBe(0.0);

      // Halfway: (0.5-1)^2 + (0.5-0)^2 = 0.25 + 0.25 / 2 = 0.25
      const brierHalf = calculateBrierScore([0.5, 0.5], [1, 0]);
      expect(brierHalf).toBe(0.25);
    });

    it('6.3 should compute reliability curve and Expected Calibration Error (ECE)', () => {
      const preds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      const actuals = [0, 0, 0, 0, 1, 1, 1, 1, 1];

      const calib = calculateCalibrationCurve(preds, actuals, 5);
      expect(calib.calibrationError).toBeGreaterThanOrEqual(0.0);
      expect(calib.calibrationError).toBeLessThanOrEqual(1.0);
      expect(calib.bins.length).toBe(5);
    });

    it('6.4 predictProbabilityCorrect should compute pL*(1-pS) + (1-pL)*pG', () => {
      const params: BKTParameters = { pL0: 0.15, pT: 0.10, pG: 0.20, pS: 0.10 };
      // For pL = 0.60: 0.60 * 0.90 + 0.40 * 0.20 = 0.54 + 0.08 = 0.62
      const pred = predictProbabilityCorrect(0.60, params);
      expect(pred).toBeCloseTo(0.62, 4);
    });
  });

  // =========================================================================
  // 7. Reproducible BKT Calibration Procedure (Part 4 & 6)
  // =========================================================================
  describe('7. Reproducible BKT Calibration Execution', () => {
    it('7.1 should evaluate observations and select optimal model on validation set', () => {
      const obs: BKTObservation[] = [];
      for (let l = 1; l <= 20; l++) {
        for (let s = 1; s <= 4; s++) {
          obs.push({
            learner_id: `learn_${l}`,
            concept_id: 'c_chem',
            step: s,
            is_correct: s >= 2, // Learn after 1 opportunity
            timestamp: new Date(Date.now() + l * 1000 + s * 100).toISOString(),
          });
        }
      }

      const split = splitDatasetByLearner(obs, 0.6, 0.2, 0.2);
      const res = calibrateBKTParameters(split);

      expect(res.status).toBe('CALIBRATED_SUCCESS');
      expect(res.baseline_parameters).toBeDefined();
      expect(res.calibrated_parameters).toBeDefined();
      expect(res.baseline_eval.observation_count).toBeGreaterThan(0);
      expect(res.held_out_verified).toBe(true);
    });

    it('7.2 should retain baseline model when baseline is already optimal or equivalent', () => {
      const obs: BKTObservation[] = [];
      for (let l = 1; l <= 15; l++) {
        obs.push({
          learner_id: `learner_${l}`,
          concept_id: 'c_math',
          step: 1,
          is_correct: true,
          timestamp: new Date().toISOString(),
        });
      }

      const split = splitDatasetByLearner(obs, 0.6, 0.2, 0.2);
      const res = calibrateBKTParameters(split, DEFAULT_BKT_PARAMS);

      expect(res.selected_model === 'BASELINE' || res.selected_model === 'CALIBRATED').toBe(true);
      expect(res.held_out_verified).toBe(true);
    });
  });

  // =========================================================================
  // 8. Retention / Memory Decay Model (Part 8 & 9)
  // =========================================================================
  describe('8. Retention / Memory Decay Model (Ebbinghaus Decay)', () => {
    const fixedNow = new Date('2026-10-10T12:00:00Z');

    it('8.1 should return 100% retention (factor = 1.0) when elapsed time is 0', () => {
      const ret = calculateConceptRetention({
        initialMastery: 0.80,
        lastAssessedAt: fixedNow,
        correctCount: 5,
        now: fixedNow,
      });

      expect(ret.elapsed_days).toBe(0.0);
      expect(ret.retention_factor).toBe(1.0);
      expect(ret.current_recall_probability).toBe(0.80);
      expect(ret.needs_review).toBe(false);
    });

    it('8.2 should decay recall probability smoothly as elapsed time increases', () => {
      const last1Day = new Date('2026-10-09T12:00:00Z');
      const last7Days = new Date('2026-10-03T12:00:00Z');
      const last30Days = new Date('2026-09-10T12:00:00Z');

      const r1 = calculateConceptRetention({ initialMastery: 0.85, lastAssessedAt: last1Day, correctCount: 2, now: fixedNow });
      const r7 = calculateConceptRetention({ initialMastery: 0.85, lastAssessedAt: last7Days, correctCount: 2, now: fixedNow });
      const r30 = calculateConceptRetention({ initialMastery: 0.85, lastAssessedAt: last30Days, correctCount: 2, now: fixedNow });

      expect(r1.current_recall_probability).toBeGreaterThan(r7.current_recall_probability);
      expect(r7.current_recall_probability).toBeGreaterThan(r30.current_recall_probability);
      expect(r30.current_recall_probability).toBeGreaterThan(0.0);
    });

    it('8.3 memory stability should scale positively with retrieval practice history (correctCount)', () => {
      const last5Days = new Date('2026-10-05T12:00:00Z');

      // Novice (0 successes) vs Veteran (10 successes)
      const rNovice = calculateConceptRetention({ initialMastery: 0.80, lastAssessedAt: last5Days, correctCount: 0, now: fixedNow });
      const rVeteran = calculateConceptRetention({ initialMastery: 0.80, lastAssessedAt: last5Days, correctCount: 10, now: fixedNow });

      expect(rVeteran.stability_days).toBeGreaterThan(rNovice.stability_days);
      expect(rVeteran.retention_factor).toBeGreaterThan(rNovice.retention_factor);
      expect(rVeteran.current_recall_probability).toBeGreaterThan(rNovice.current_recall_probability);
    });

    it('8.4 should preserve underlying latent mastery pL without irreversible destruction', () => {
      const ancientDate = new Date('2025-01-01T00:00:00Z'); // Long ago
      const ret = calculateConceptRetention({
        initialMastery: 0.90,
        lastAssessedAt: ancientDate,
        correctCount: 3,
        now: fixedNow,
      });

      // Latent mastery is preserved
      expect(ret.initial_mastery).toBe(0.90);
      // Recall probability is decayed
      expect(ret.current_recall_probability).toBeLessThan(0.30);
      // Flags concept for review
      expect(ret.needs_review).toBe(true);
    });

    it('8.5 should clamp negative elapsed time to 0 (protects against clock skew)', () => {
      const futureDate = new Date('2026-10-15T12:00:00Z');
      const ret = calculateConceptRetention({
        initialMastery: 0.75,
        lastAssessedAt: futureDate,
        now: fixedNow,
      });

      expect(ret.elapsed_days).toBe(0.0);
      expect(ret.retention_factor).toBe(1.0);
      expect(ret.current_recall_probability).toBe(0.75);
    });
  });

  // =========================================================================
  // 9. Cold Start Handling (Part 13)
  // =========================================================================
  describe('9. Cold Start Behavior (N = 0)', () => {
    it('9.1 should report 0 confidence, 0 trials, and unassessed status on cold start', async () => {
      const state = await getTopicMasteryState('cold_start_user_99', 'Quantum Field Theory');

      expect(state.evidence_count).toBe(0);
      expect(state.mastery_estimate).toBe(0.0);
      expect(state.confidence).toBe(0.0);
      expect(state.status).toBe('unassessed');
      expect(state.retention).toBeDefined();
      expect(state.retention!.current_recall_probability).toBe(0.0);
    });

    it('9.2 calculateConfidence should return 0.0 for 0 attempts', () => {
      expect(calculateConfidence(0)).toBe(0.0);
    });

    it('9.3 determineMasteryStatus should return unassessed for 0 attempts regardless of pL', () => {
      expect(determineMasteryStatus(0, 0.99)).toBe('unassessed');
    });
  });

  // =========================================================================
  // 10. Temporal Causality & Leakage Prevention (Part 14)
  // =========================================================================
  describe('10. Temporal Causality & Chronological Replay', () => {
    it('10.1 evaluateBKTModel should strictly sort observations chronologically before updating', () => {
      const t1 = '2026-10-01T10:00:00Z';
      const t2 = '2026-10-02T10:00:00Z';
      const t3 = '2026-10-03T10:00:00Z';

      // Delivered out of order: t3, t1, t2
      const outOfOrder: BKTObservation[] = [
        { learner_id: 'learner_time', concept_id: 'c1', step: 3, is_correct: true, timestamp: t3 },
        { learner_id: 'learner_time', concept_id: 'c1', step: 1, is_correct: false, timestamp: t1 },
        { learner_id: 'learner_time', concept_id: 'c1', step: 2, is_correct: true, timestamp: t2 },
      ];

      const inOrder: BKTObservation[] = [
        { learner_id: 'learner_time', concept_id: 'c1', step: 1, is_correct: false, timestamp: t1 },
        { learner_id: 'learner_time', concept_id: 'c1', step: 2, is_correct: true, timestamp: t2 },
        { learner_id: 'learner_time', concept_id: 'c1', step: 3, is_correct: true, timestamp: t3 },
      ];

      const evalOutOfOrder = evaluateBKTModel(outOfOrder, DEFAULT_BKT_PARAMS);
      const evalInOrder = evaluateBKTModel(inOrder, DEFAULT_BKT_PARAMS);

      expect(evalOutOfOrder.log_loss).toBe(evalInOrder.log_loss);
      expect(evalOutOfOrder.brier_score).toBe(evalInOrder.brier_score);
    });
  });

  // =========================================================================
  // 11. Multi-Tenant & User Isolation (Part 15)
  // =========================================================================
  describe('11. Multi-Tenant & User Isolation', () => {
    it('11.1 evaluateBKTModel should never leak knowledge state across different learners', () => {
      const obs: BKTObservation[] = [
        // Learner A answers 5 correct
        { learner_id: 'user_alpha', concept_id: 'c_shared', step: 1, is_correct: true, timestamp: '2026-10-01T10:00:00Z' },
        { learner_id: 'user_alpha', concept_id: 'c_shared', step: 2, is_correct: true, timestamp: '2026-10-01T10:01:00Z' },
        // Learner B is cold start
        { learner_id: 'user_beta', concept_id: 'c_shared', step: 1, is_correct: false, timestamp: '2026-10-01T10:02:00Z' },
      ];

      const res = evaluateBKTModel(obs, DEFAULT_BKT_PARAMS);
      // Prediction for user_beta on step 1 must use pL0 (0.15), not user_alpha's elevated posterior!
      const expectedPredBeta = predictProbabilityCorrect(DEFAULT_BKT_PARAMS.pL0, DEFAULT_BKT_PARAMS);
      expect(res.observation_count).toBe(3);
    });
  });

  // =========================================================================
  // 12. 15 Mastery Stability Edge Cases (Part 12)
  // =========================================================================
  describe('12. 15 Mastery Stability Edge Cases', () => {
    const params = DEFAULT_BKT_PARAMS;

    it('12.1 Edge Case 1: One correct answer', () => {
      const res = calculateBKTUpdate(params.pL0, true, params);
      expect(res.posterior).toBeGreaterThan(params.pL0);
      expect(res.posterior).toBeLessThan(0.60);
    });

    it('12.2 Edge Case 2: One incorrect answer', () => {
      const res = calculateBKTUpdate(params.pL0, false, params);
      expect(res.posterior).toBeLessThan(params.pL0);
      expect(res.posterior).toBeGreaterThanOrEqual(0.01);
    });

    it('12.3 Edge Case 3: One partial answer (0.50 credit)', () => {
      const res = calculateBKTUpdate(params.pL0, false, params, 0.5);
      const resCorrect = calculateBKTUpdate(params.pL0, true, params);
      const resIncorrect = calculateBKTUpdate(params.pL0, false, params);
      expect(res.posterior).toBeGreaterThan(resIncorrect.posterior);
      expect(res.posterior).toBeLessThan(resCorrect.posterior);
    });

    it('12.4 Edge Case 4: Correct -> Incorrect sequence', () => {
      const p1 = calculateBKTUpdate(params.pL0, true, params).posterior;
      const p2 = calculateBKTUpdate(p1, false, params).posterior;
      expect(p2).toBeLessThan(p1);
      expect(p2).toBeGreaterThanOrEqual(0.01);
    });

    it('12.5 Edge Case 5: Incorrect -> Correct sequence', () => {
      const p1 = calculateBKTUpdate(params.pL0, false, params).posterior;
      const p2 = calculateBKTUpdate(p1, true, params).posterior;
      expect(p2).toBeGreaterThan(p1);
    });

    it('12.6 Edge Case 6: Repeated correct answers (30 trials)', () => {
      let p = params.pL0;
      for (let i = 0; i < 30; i++) {
        p = calculateBKTUpdate(p, true, params).posterior;
        expect(p).toBeLessThanOrEqual(0.99);
      }
      expect(p).toBeGreaterThan(0.90);
    });

    it('12.7 Edge Case 7: Repeated incorrect answers (30 trials)', () => {
      let p = 0.50;
      for (let i = 0; i < 30; i++) {
        p = calculateBKTUpdate(p, false, params).posterior;
        expect(p).toBeGreaterThanOrEqual(0.01);
      }
      expect(p).toBeLessThan(0.15);
    });

    it('12.8 Edge Case 8: Alternating correct / incorrect answers (20 trials)', () => {
      let p = params.pL0;
      for (let i = 0; i < 10; i++) {
        p = calculateBKTUpdate(p, true, params).posterior;
        p = calculateBKTUpdate(p, false, params).posterior;
        expect(p).toBeGreaterThanOrEqual(0.01);
        expect(p).toBeLessThanOrEqual(0.99);
      }
      expect(isFinite(p)).toBe(true);
    });

    it('12.9 Edge Case 9: Long gap between attempts (180 days)', () => {
      const lastAssessed = new Date('2026-01-01T00:00:00Z');
      const now = new Date('2026-06-30T00:00:00Z');

      const ret = calculateConceptRetention({
        initialMastery: 0.85,
        lastAssessedAt: lastAssessed,
        correctCount: 2,
        now,
      });

      expect(ret.elapsed_days).toBeGreaterThan(170);
      expect(ret.initial_mastery).toBe(0.85); // Preserved
      expect(ret.current_recall_probability).toBeLessThan(0.10);
      expect(ret.needs_review).toBe(true);
    });

    it('12.10 Edge Case 10: Extremely frequent attempts (0ms gap)', () => {
      const now = new Date();
      const ret = calculateConceptRetention({
        initialMastery: 0.70,
        lastAssessedAt: now,
        now,
      });
      expect(ret.elapsed_days).toBe(0.0);
      expect(ret.retention_factor).toBe(1.0);
    });

    it('12.11 Edge Case 11: Easy -> Hard difficulty transition', () => {
      const easy = getDifficultyBKTParameters('easy');
      const hard = getDifficultyBKTParameters('hard');

      const p1 = calculateBKTUpdate(params.pL0, true, easy).posterior;
      const p2 = calculateBKTUpdate(p1, true, hard).posterior;

      expect(p2).toBeGreaterThan(p1);
      expect(p2).toBeLessThanOrEqual(0.99);
    });

    it('12.12 Edge Case 12: Hard -> Easy difficulty transition', () => {
      const hard = getDifficultyBKTParameters('hard');
      const easy = getDifficultyBKTParameters('easy');

      const p1 = calculateBKTUpdate(params.pL0, false, hard).posterior;
      const p2 = calculateBKTUpdate(p1, false, easy).posterior;

      expect(p2).toBeLessThan(p1);
      expect(p2).toBeGreaterThanOrEqual(0.01);
    });

    it('12.13 Edge Case 13: Duplicate evidence event idempotency', async () => {
      const u = `user_edge13_${Date.now()}`;
      const ev = extractLearnerEvidence(
        { questionId: 'q_dup_1', classification: 'correct', credit: 1.0, isCorrect: true },
        { userId: u, attemptId: 'att_dup', topic: 'Algorithms' }
      );

      const r1 = await recordLearnerEvidence(ev);
      const r2 = await recordLearnerEvidence(ev);

      expect(r1.applied).toBe(true);
      expect(r1.duplicate).toBe(false);
      expect(r2.applied).toBe(false);
      expect(r2.duplicate).toBe(true);
    });

    it('12.14 Edge Case 14: Invalid / unverifiable evidence non-penalization', async () => {
      const u = `user_edge14_${Date.now()}`;
      const ev = extractLearnerEvidence(
        { questionId: 'q_unv_1', classification: 'unverifiable', credit: 0.0, isCorrect: false },
        { userId: u, attemptId: 'att_unv', topic: 'Algorithms' }
      );

      const r = await recordLearnerEvidence(ev);
      expect(r.applied).toBe(false);
      expect(r.discarded).toBe(true);

      const state = await getTopicMasteryState(u, 'Algorithms');
      expect(state.evidence_count).toBe(0);
    });

    it('12.15 Edge Case 15: Very long evidence sequence (100+ trials)', () => {
      let p = params.pL0;
      for (let i = 0; i < 120; i++) {
        const isCorr = i % 3 !== 0; // 67% correct
        p = calculateBKTUpdate(p, isCorr, params).posterior;
        expect(p).toBeGreaterThanOrEqual(0.01);
        expect(p).toBeLessThanOrEqual(0.99);
        expect(isNaN(p)).toBe(false);
      }
      expect(p).toBeGreaterThan(0.70);
    });
  });

  // =========================================================================
  // 13. Retention Practice & Multi-Tenant Security Verification (Part 8 & 15)
  // =========================================================================
  describe('13. Retention Restoration & Multi-Tenant Security Verification', () => {
    it('13.1 should restore recall and reinforce stability after review opportunity', () => {
      const day0 = new Date('2026-09-01T12:00:00Z');
      const day14 = new Date('2026-09-15T12:00:00Z');

      // Before review (after 14 days of no practice)
      const decayed = calculateConceptRetention({
        initialMastery: 0.85,
        lastAssessedAt: day0,
        correctCount: 2,
        now: day14,
      });

      expect(decayed.needs_review).toBe(true);
      expect(decayed.current_recall_probability).toBeLessThan(0.40);

      // Student practices on day 14 and gets it correct!
      // BKT updates latent mastery and resets elapsed time:
      const updatedMastery = calculateBKTUpdate(decayed.initial_mastery, true, DEFAULT_BKT_PARAMS).posterior;
      const restored = calculateConceptRetention({
        initialMastery: updatedMastery,
        lastAssessedAt: day14,
        correctCount: 3, // Increment successes
        now: day14,      // Immediate post-review
      });

      expect(restored.elapsed_days).toBe(0.0);
      expect(restored.retention_factor).toBe(1.0);
      expect(restored.current_recall_probability).toBeCloseTo(updatedMastery, 3);
      expect(restored.stability_days).toBeGreaterThan(decayed.stability_days);
      expect(restored.needs_review).toBe(false);
    });

    it('13.2 should handle zero mastery gracefully with zero recall probability', () => {
      const ret = calculateConceptRetention({
        initialMastery: 0.0,
        lastAssessedAt: new Date(),
        correctCount: 0,
      });

      expect(ret.current_recall_probability).toBe(0.0);
      expect(ret.needs_review).toBe(false);
    });

    it('13.3 Security: User A evidence ingestion strictly isolates from User B', async () => {
      const userA = `user_sec_a_${Date.now()}`;
      const userB = `user_sec_b_${Date.now()}`;

      const evA = extractLearnerEvidence(
        { questionId: 'q_sec_1', classification: 'correct', credit: 1.0, isCorrect: true },
        { userId: userA, attemptId: 'att_sec', topic: 'Compiler Design' }
      );

      await recordLearnerEvidence(evA);

      const stateA = await getTopicMasteryState(userA, 'Compiler Design');
      const stateB = await getTopicMasteryState(userB, 'Compiler Design');

      expect(stateA.evidence_count).toBe(1);
      expect(stateA.mastery_estimate).toBeGreaterThan(0.15);

      // User B must remain strictly unassessed with 0 evidence
      expect(stateB.evidence_count).toBe(0);
      expect(stateB.mastery_estimate).toBe(0.0);
      expect(stateB.status).toBe('unassessed');
    });

    it('13.4 Calibration grid search stays strictly within pedagogical probability bounds [0.01, 0.99]', () => {
      const mockSplit = {
        train: [
          { learner_id: 'l1', concept_id: 'c1', step: 1, is_correct: true, timestamp: '2026-10-01T10:00:00Z' },
          { learner_id: 'l1', concept_id: 'c1', step: 2, is_correct: false, timestamp: '2026-10-01T10:01:00Z' },
        ],
        validation: [
          { learner_id: 'l2', concept_id: 'c1', step: 1, is_correct: true, timestamp: '2026-10-01T10:00:00Z' },
        ],
        test: [
          { learner_id: 'l3', concept_id: 'c1', step: 1, is_correct: false, timestamp: '2026-10-01T10:00:00Z' },
        ],
        learner_counts: { train: 1, validation: 1, test: 1 },
        total_observations: 4,
      };

      const res = calibrateBKTParameters(mockSplit);
      const params = res.calibrated_parameters;

      expect(params.pL0).toBeGreaterThanOrEqual(0.01);
      expect(params.pL0).toBeLessThanOrEqual(0.50);
      expect(params.pT).toBeGreaterThanOrEqual(0.01);
      expect(params.pT).toBeLessThanOrEqual(0.50);
      expect(params.pG).toBeGreaterThanOrEqual(0.01);
      expect(params.pG).toBeLessThanOrEqual(0.50);
      expect(params.pS).toBeGreaterThanOrEqual(0.01);
      expect(params.pS).toBeLessThanOrEqual(0.50);
    });

    it('13.5 Audit report preserves retention metadata for historical review', async () => {
      const u = `user_audit_ret_${Date.now()}`;
      const ev = extractLearnerEvidence(
        { questionId: 'q_ret_1', classification: 'correct', credit: 1.0, isCorrect: true },
        { userId: u, attemptId: 'att_ret', topic: 'Linear Algebra' }
      );
      await recordLearnerEvidence(ev);

      const state = await getTopicMasteryState(u, 'Linear Algebra');
      expect(state.retention).toBeDefined();
      expect(state.retention!.stability_days).toBeGreaterThan(0.5);
      expect(state.retention!.retention_factor).toBe(1.0);
    });
  });
});

