#!/usr/bin/env node
import { runFullEvaluationSuite } from '../server/evaluationEngine.ts';
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
  console.log('🔬 Ming Phase 8: Multi-Hop Retrieval & Grounded Tutor Suite');
  console.log('================================================================');
  console.log('Operating on isolated test data and verified learner models...\n');

  const startTime = Date.now();
  const report = await runFullEvaluationSuite(searchAdapter, chatAdapter);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n📊 BENCHMARK EVALUATION RESULTS:');
  console.log('----------------------------------------------------------------');
  console.log(`⏱️ Evaluation Timestamp: ${report.evaluationTimestamp}`);
  console.log(`📁 Dataset Items Evaluated: ${report.datasetSize} (Phase 6: 8 -> Phase 7: 52 -> Phase 8: ${report.datasetSize})`);
  console.log(`👥 Simulated Cohort Size: ${report.personalizationMetrics.simulatedStudentsCount}`);
  console.log(`⚡ Execution Duration: ${durationSec}s\n`);

  console.log('📈 PHASE 7 vs PHASE 8 EMPIRICAL COMPARISON:');
  console.log('┌─────────────────────────────┬───────────┬───────────┬──────────┬──────────┬──────────────┐');
  console.log('│ Metric                      │ Phase 7   │ Phase 8   │ Delta    │ Status   │ Benchmark    │');
  console.log('├─────────────────────────────┼───────────┼───────────┼──────────┼──────────┼──────────────┤');

  for (const row of report.phaseComparison) {
    const p7Str = typeof row.phase7Value === 'number' ? `${(row.phase7Value * 100).toFixed(1)}%` : String(row.phase7Value ?? '-');
    const p8Str = typeof row.phase8Value === 'number' ? `${(row.phase8Value * 100).toFixed(1)}%` : String(row.phase8Value ?? '-');
    const deltaStr = (row.delta >= 0 ? `+${(row.delta * 100).toFixed(1)}%` : `${(row.delta * 100).toFixed(1)}%`);
    const status = row.improved ? 'PASSED ✅' : 'ATTN ⚠️ ';

    const pad = (str: string, len: number) => (str + ' '.repeat(len)).slice(0, len);
    console.log(
      `│ ${pad(row.metric, 27)} │ ${pad(p7Str, 9)} │ ${pad(p8Str, 9)} │ ${pad(deltaStr, 8)} │ ${pad(status, 8)} │ ${pad(row.targetBenchmark, 12)} │`
    );
  }
  console.log('└─────────────────────────────┴───────────┴───────────┴──────────┴──────────┴──────────────┘');

  console.log('\n1. RAG & Grounded Tutor Quality (RAGAS-equivalent Metrics):');
  console.log(`   • Faithfulness:       ${(report.ragMetrics.faithfulness * 100).toFixed(1)}%`);
  console.log(`   • Answer Relevancy:   ${(report.ragMetrics.answerRelevancy * 100).toFixed(1)}%`);
  console.log(`   • Context Precision:  ${(report.ragMetrics.contextPrecision * 100).toFixed(1)}% (Baseline was 37.5%)`);
  console.log(`   • Context Recall:     ${(report.ragMetrics.contextRecall * 100).toFixed(1)}%`);

  console.log('\n2. Source Grounding & Safeguards:');
  console.log(`   • Grounding Accuracy: ${(report.groundingMetrics.groundingAccuracy * 100).toFixed(1)}%`);
  console.log(`   • Coordinate Match:   ${(report.groundingMetrics.coordinateAccuracy * 100).toFixed(1)}% (PDF page, slide, video timestamp)`);
  console.log(`   • Refusal Accuracy:   ${(report.groundingMetrics.refusalAccuracy * 100).toFixed(1)}% (Off-material queries refused)`);
  console.log(`   • User Isolation:     ${report.groundingMetrics.userIsolationPreserved ? 'PASSED (0 data leaks)' : 'FAILED'}`);

  console.log('\n3. Personalization & BKT Learner Simulation:');
  console.log(`   • Simulated Cohort:    ${report.personalizationMetrics.simulatedStudentsCount} learners across 7 archetypes`);
  console.log(`   • Avg Mastery Delta:   +${(report.personalizationMetrics.averageMasteryImprovement * 100).toFixed(1)}% improvement`);
  console.log(`   • Recom. Relevance:    ${(report.personalizationMetrics.averageRecommendationRelevance * 100).toFixed(1)}%`);
  console.log(`   • Completion Rate:     ${(report.personalizationMetrics.averageCompletionRate * 100).toFixed(1)}%`);
  console.log(`   • Tasks Completed:     ${report.personalizationMetrics.totalCompletedActivities}`);

  if (report.personalizationMetrics.cohortArchetypeDistribution) {
    console.log('   • Cohort Archetypes:');
    for (const [arch, count] of Object.entries(report.personalizationMetrics.cohortArchetypeDistribution)) {
      console.log(`     - ${arch}: ${count} learners`);
    }
  }

  console.log('\n4. Question Novelty & Deduplication:');
  console.log(`   • Questions Analyzed:  ${report.noveltyMetrics.totalQuestionsAnalyzed}`);
  console.log(`   • Unique Questions:    ${(report.noveltyMetrics.uniqueQuestionPercentage * 100).toFixed(1)}%`);
  console.log(`   • Exact Duplicates:    ${(report.noveltyMetrics.exactDuplicateRate * 100).toFixed(1)}% (Baseline was 80.0%)`);
  console.log(`   • Semantic Duplicates: ${(report.noveltyMetrics.semanticDuplicateRate * 100).toFixed(1)}%`);

  if (report.assessmentMetrics) {
    console.log('\n5. Phase 9 Assessment Intelligence & Misconception Detection:');
    console.log(`   • Assessment Correctness:    ${(report.assessmentMetrics.assessmentCorrectness * 100).toFixed(1)}% (MCQ, numerical, partial answers)`);
    console.log(`   • Feedback Grounding:        ${(report.assessmentMetrics.feedbackGrounding * 100).toFixed(1)}% (Citations & verified coordinates)`);
    console.log(`   • Misconception Precision:   ${(report.assessmentMetrics.misconceptionPrecision * 100).toFixed(1)}% (Deterministic mapping & concept tagging)`);
    console.log(`   • Repeated Mistake Detection:${(report.assessmentMetrics.repeatedMistakeDetection * 100).toFixed(1)}% (Historical tracking across attempts)`);
    console.log(`   • BKT Update Consistency:    ${(report.assessmentMetrics.bktUpdateConsistency * 100).toFixed(1)}% (Strict evidence-derived updates)`);
  }

  if (report.failuresAndErrors.length > 0) {
    console.log('\n⚠️ Failures and Errors Encountered:');
    for (const f of report.failuresAndErrors) {
      console.log(`   - ${f}`);
    }
  } else {
    console.log('\n✅ Zero evaluation failures encountered.');
  }

  console.log('\n💾 Machine-readable reports saved to:');
  console.log('   • benchmarks/results/latest_evaluation.json');
  console.log('   • benchmarks/results/latest_evaluation.csv');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Benchmark execution failed:', err);
  process.exit(1);
});
