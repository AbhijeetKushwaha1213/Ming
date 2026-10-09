#!/usr/bin/env node
import { runCanonicalPhase8Evaluation } from '../server/evaluationEngine.ts';
import { runPythonCli } from '../server/ragHandler.ts';

const searchAdapter = async (query: string, topic?: string, userId: string = 'default_user') => {
  const args = ['search', '--query', query];
  if (topic) args.push('--topic', topic);
  if (userId) args.push('--user-id', userId);
  return runPythonCli(args);
};

const chatAdapter = async (query: string, topic?: string, userId: string = 'default_user') => {
  const args = ['chat', '--query', query];
  if (topic) args.push('--topic', topic);
  if (userId) args.push('--user-id', userId);
  return runPythonCli(args);
};

async function main() {
  console.log('================================================================');
  console.log('🔬 Ming Canonical Phase 8 — Evaluation & Reproducible Benchmarking');
  console.log('================================================================');
  console.log('Executing reproducible evaluation tracks against fixed datasets...\n');

  const startTime = Date.now();
  const { contract, fullReport } = await runCanonicalPhase8Evaluation(searchAdapter, chatAdapter);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('📋 1. EVALUATION RUN CONTRACT & ENVIRONMENT:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Run ID:             ${contract.runId}`);
  console.log(`   • Timestamp:          ${contract.evaluationTimestamp}`);
  console.log(`   • Git Commit SHA:     ${contract.gitCommitSha} (Clean: ${contract.workingTreeClean ? 'YES' : 'NO (uncommitted working tree)'})`);
  console.log(`   • Controlled Seed:    ${contract.randomSeed}`);
  console.log(`   • Runtime:            Node ${contract.runtime.nodeVersion} (${contract.runtime.platform} ${contract.runtime.arch}, PID ${contract.runtime.pid})`);
  console.log(`   • Total Evaluated:    ${contract.summaryCounts.totalEvaluated} items across 6 tracks (Passed: ${contract.summaryCounts.totalPassed}, Failed: ${contract.summaryCounts.totalFailed})`);
  console.log(`   • Execution Duration: ${durationSec}s\n`);

  console.log('📁 2. DATASET FINGERPRINTS & PROVENANCE:');
  console.log('----------------------------------------------------------------');
  for (const fp of contract.datasetFingerprints) {
    console.log(`   • [${fp.name}]`);
    console.log(`     Items: ${fp.itemCount} | SHA-256: ${fp.sha256.slice(0, 16)}... | Type: ${fp.sourceType} | Synthetic: ${fp.isSynthetic ? 'YES' : 'NO'}`);
    console.log(`     Note:  ${fp.limitations}`);
  }

  const { tracks } = contract;

  console.log('\n📦 3. TRACK A: MULTIMODAL INGESTION ROBUSTNESS:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Processing Success Rate:   ${(tracks.trackA_multimodalIngestion.processingSuccessRate * 100).toFixed(1)}% (Target: >= 95.0%)`);
  console.log(`   • Extraction Accuracy:       ${(tracks.trackA_multimodalIngestion.extractionAccuracy * 100).toFixed(1)}%`);
  console.log(`   • Provenance Accuracy:       ${(tracks.trackA_multimodalIngestion.provenanceAccuracy * 100).toFixed(1)}% (Page/slide/timestamp preserved)`);
  console.log(`   • Malformed Rejection Rate:  ${(tracks.trackA_multimodalIngestion.malformedRejectionRate * 100).toFixed(1)}% (Spoofed, empty, truncated rejected)`);
  console.log(`   • Oversized Rejection Rate:  ${(tracks.trackA_multimodalIngestion.oversizedRejectionRate * 100).toFixed(1)}%`);
  console.log('   • Format Support:');
  for (const [fmt, rate] of Object.entries(tracks.trackA_multimodalIngestion.formatSupportRates)) {
    console.log(`     - ${fmt}: ${(rate * 100).toFixed(0)}%`);
  }

  console.log('\n🔍 4. TRACK B: RETRIEVAL, GROUNDING & INFORMATION RETRIEVAL:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Mean Reciprocal Rank (MRR): ${(tracks.trackB_retrievalGrounding.meanReciprocalRank * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.meanReciprocalRank.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.meanReciprocalRank.upper * 100).toFixed(1)}%]`);
  console.log(`   • Recall@5:                   ${(tracks.trackB_retrievalGrounding.recallAt5 * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.contextRecall.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.contextRecall.upper * 100).toFixed(1)}%]`);
  console.log(`   • Precision@5:                ${(tracks.trackB_retrievalGrounding.precisionAt5 * 100).toFixed(1)}%`);
  console.log(`   • nDCG@5:                     ${(tracks.trackB_retrievalGrounding.ndcgAt5 * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.ndcgAt5.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.ndcgAt5.upper * 100).toFixed(1)}%]`);
  console.log(`   • Faithfulness:               ${(tracks.trackB_retrievalGrounding.faithfulness * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.faithfulness.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.faithfulness.upper * 100).toFixed(1)}%]`);
  console.log(`   • Answer Relevancy:           ${(tracks.trackB_retrievalGrounding.answerRelevancy * 100).toFixed(1)}%`);
  console.log(`   • Grounding Accuracy:         ${(tracks.trackB_retrievalGrounding.groundingAccuracy * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.groundingAccuracy.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.groundingAccuracy.upper * 100).toFixed(1)}%]`);
  console.log(`   • Coordinate Match:           ${(tracks.trackB_retrievalGrounding.coordinateAccuracy * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.coordinateAccuracy.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.coordinateAccuracy.upper * 100).toFixed(1)}%]`);
  console.log(`   • Refusal Accuracy:           ${(tracks.trackB_retrievalGrounding.refusalAccuracy * 100).toFixed(1)}% [95% CI: ${(tracks.trackB_retrievalGrounding.confidenceIntervals.refusalAccuracy.lower * 100).toFixed(1)}% - ${(tracks.trackB_retrievalGrounding.confidenceIntervals.refusalAccuracy.upper * 100).toFixed(1)}%]`);
  console.log(`   • User Isolation Preserved:   ${tracks.trackB_retrievalGrounding.userIsolationPreserved ? 'PASSED (0 leaks)' : 'FAILED'}`);

  console.log('\n📐 5. TRACK C: ASSESSMENT QUALITY & DETERMINISTIC VERIFIERS:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Numerical Verification Acc: ${(tracks.trackC_assessmentQuality.numericalVerificationAccuracy * 100).toFixed(1)}% [95% CI: ${(tracks.trackC_assessmentQuality.confidenceIntervals.numericalAccuracy.lower * 100).toFixed(1)}% - ${(tracks.trackC_assessmentQuality.confidenceIntervals.numericalAccuracy.upper * 100).toFixed(1)}%]`);
  console.log(`   • Tolerance Handling Acc:     ${(tracks.trackC_assessmentQuality.toleranceHandlingAccuracy * 100).toFixed(1)}% (Relative/Absolute bounds)`);
  console.log(`   • Unit Conversion Acc:        ${(tracks.trackC_assessmentQuality.unitConversionAccuracy * 100).toFixed(1)}% (Canonical normalization)`);
  console.log(`   • MCQ Grading Accuracy:       ${(tracks.trackC_assessmentQuality.mcqGradingAccuracy * 100).toFixed(1)}% [95% CI: ${(tracks.trackC_assessmentQuality.confidenceIntervals.mcqAccuracy.lower * 100).toFixed(1)}% - ${(tracks.trackC_assessmentQuality.confidenceIntervals.mcqAccuracy.upper * 100).toFixed(1)}%]`);
  console.log(`   • Invalid Question Rejection: ${(tracks.trackC_assessmentQuality.invalidQuestionRejectionRate * 100).toFixed(1)}% [95% CI: ${(tracks.trackC_assessmentQuality.confidenceIntervals.invalidQuestionRejection.lower * 100).toFixed(1)}% - ${(tracks.trackC_assessmentQuality.confidenceIntervals.invalidQuestionRejection.upper * 100).toFixed(1)}%]`);
  console.log(`   • Misconception Precision:    ${(tracks.trackC_assessmentQuality.misconceptionClassificationAccuracy * 100).toFixed(1)}%`);

  console.log('\n📊 6. TRACK D: LEARNER CALIBRATION & PROBABILISTIC ACCURACY:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Brier Score:                ${tracks.trackD_learnerCalibration.brierScore} (Lower is better, [0, 1])`);
  console.log(`   • Log Loss:                   ${tracks.trackD_learnerCalibration.logLoss}`);
  console.log(`   • Expected Calibration Error: ${tracks.trackD_learnerCalibration.expectedCalibrationError} (10 equal bins)`);
  console.log(`   • Recommendation Determinism: ${(tracks.trackD_learnerCalibration.recommendationDeterminism * 100).toFixed(1)}%`);
  console.log(`   • Cold Start Prior Applied:   ${tracks.trackD_learnerCalibration.coldStartPriorApplied ? 'YES' : 'NO'}`);
  console.log(`   • Directional Evidence BKT:   ${tracks.trackD_learnerCalibration.positiveEvidenceIncreasesMastery && tracks.trackD_learnerCalibration.negativeEvidenceDecreasesMastery ? 'PASSED (monotonic updates)' : 'FAILED'}`);
  console.log(`   ⚠️ Notice: ${tracks.trackD_learnerCalibration.syntheticDataNotice}`);

  console.log('\n🔄 7. TRACK E: AI STUDY AGENT CLOSED LOOP LIFECYCLE:');
  console.log('----------------------------------------------------------------');
  console.log(`   • 6-Stage Lifecycle Complete: ${(tracks.trackE_studyAgentLoop.fullLoopCompletionRate * 100).toFixed(1)}%`);
  console.log(`   • Action Selection Accuracy:  ${(tracks.trackE_studyAgentLoop.actionSelectionAccuracy * 100).toFixed(1)}%`);
  console.log(`   • Activity Availability:      ${(tracks.trackE_studyAgentLoop.activityAvailability * 100).toFixed(1)}%`);
  console.log(`   • Grading Consistency:        ${(tracks.trackE_studyAgentLoop.gradingConsistency * 100).toFixed(1)}%`);
  console.log(`   • Retry Idempotency:          ${tracks.trackE_studyAgentLoop.retryIdempotencyPreserved ? 'PASSED (exactly-once)' : 'FAILED'}`);
  console.log(`   • Tenant Isolation:           ${tracks.trackE_studyAgentLoop.tenantIsolationPreserved ? 'PASSED' : 'FAILED'}`);

  console.log('\n⚡ 8. TRACK F: RELIABILITY & PERFORMANCE:');
  console.log('----------------------------------------------------------------');
  console.log(`   • Latency percentiles:        p50: ${tracks.trackF_reliabilityPerformance.p50LatencyMs}ms | p90: ${tracks.trackF_reliabilityPerformance.p90LatencyMs}ms | p95: ${tracks.trackF_reliabilityPerformance.p95LatencyMs}ms | p99: ${tracks.trackF_reliabilityPerformance.p99LatencyMs}ms`);
  console.log(`   • Latency Source:             ${tracks.trackF_reliabilityPerformance.latencyMeasurementSource || 'Local benchmark'}`);
  console.log(`   • Concurrency Throughput:     ${tracks.trackF_reliabilityPerformance.concurrencyThroughputReqPerSec} req/sec`);
  console.log(`   • Concurrency Error Rate:     ${tracks.trackF_reliabilityPerformance.concurrencyErrorRate}%`);
  console.log(`   • Cache Hit Ratio:            ${(tracks.trackF_reliabilityPerformance.cacheHitRatio * 100).toFixed(1)}%`);
  console.log(`   • Process Limiter Enforced:   ${tracks.trackF_reliabilityPerformance.processLimiterEnforced ? 'YES' : 'NO'}`);

  console.log('\n📈 PHASE 7 vs PHASE 8 COMPARISON MATRIX:');
  console.log('┌─────────────────────────────┬───────────┬───────────┬──────────┬──────────────┬──────────────┐');
  console.log('│ Metric                      │ Phase 7   │ Phase 8   │ Delta    │ Status       │ Benchmark    │');
  console.log('├─────────────────────────────┼───────────┼───────────┼──────────┼──────────────┼──────────────┤');

  for (const row of fullReport.phaseComparison) {
    const p7Str = typeof row.phase7Value === 'number' ? `${(row.phase7Value * 100).toFixed(1)}%` : String(row.phase7Value ?? '-');
    const p8Str = typeof row.phase8Value === 'number' ? `${(row.phase8Value * 100).toFixed(1)}%` : String(row.phase8Value ?? '-');
    const deltaStr = (row.delta >= 0 ? `+${(row.delta * 100).toFixed(1)}%` : `${(row.delta * 100).toFixed(1)}%`);
    const status = row.comparabilityStatus === 'NOT_COMPARABLE' ? 'UNVERIFIED ⚠️' : (row.improved ? 'PASSED ✅' : 'ATTN ⚠️ ');

    const pad = (str: string, len: number) => (str + ' '.repeat(len)).slice(0, len);
    console.log(
      `│ ${pad(row.metric, 27)} │ ${pad(p7Str, 9)} │ ${pad(p8Str, 9)} │ ${pad(deltaStr, 8)} │ ${pad(status, 12)} │ ${pad(row.targetBenchmark, 12)} │`
    );
  }
  console.log('└─────────────────────────────┴───────────┴───────────┴──────────┴──────────────┴──────────────┘');
  console.log('   ⚠️ Comparability Warning: Historical Phase 7 baseline was recorded on an unverified 52-item dataset with differing retrieval configurations; canonical Phase 8 evaluates the 70-item canonical curriculum dataset. Deltas are not verified empirical improvements.');

  if (contract.failuresAndErrors.length > 0) {
    console.log('\n⚠️ Failures and Errors Encountered:');
    for (const f of contract.failuresAndErrors) {
      console.log(`   - ${f}`);
    }
  } else {
    console.log('\n✅ Zero evaluation failures encountered.');
  }

  console.log('\n💾 Machine-readable reports saved:');
  console.log(`   • Versioned Run Contract: benchmarks/results/${contract.runId}.json`);
  console.log('   • Latest JSON Mirror:     benchmarks/results/latest_evaluation.json');
  console.log('   • Latest CSV Export:      benchmarks/results/latest_evaluation.csv');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Benchmark execution failed:', err);
  process.exit(1);
});

