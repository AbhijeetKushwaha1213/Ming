#!/usr/bin/env node
import { runFullEvaluationSuite } from '../server/evaluationEngine.ts';
import { runPythonCli } from '../server/ragHandler.ts';

const searchAdapter = async (query: string, topic?: string, userId?: string) => {
  const args = ['search', '--query', query];
  if (topic) args.push('--topic', topic);
  if (userId) args.push('--user-id', userId);
  return runPythonCli(args);
};

const chatAdapter = async (query: string, topic?: string, userId?: string) => {
  const args = ['chat', '--query', query];
  if (topic) args.push('--topic', topic);
  if (userId) args.push('--user-id', userId);
  return runPythonCli(args);
};

async function main() {
  console.log('================================================================');
  console.log('🔬 StudyMate Phase 6: Automated Evaluation & Benchmarking Suite');
  console.log('================================================================');
  console.log('Operating on isolated test data and verified learner models...\n');

  const startTime = Date.now();
  const report = await runFullEvaluationSuite(searchAdapter, chatAdapter);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n📊 BENCHMARK EVALUATION RESULTS:');
  console.log('----------------------------------------------------------------');
  console.log(`⏱️ Evaluation Timestamp: ${report.evaluationTimestamp}`);
  console.log(`📁 Dataset Items Evaluated: ${report.datasetSize}`);
  console.log(`⚡ Execution Duration: ${durationSec}s\n`);

  console.log('1. RAG & Grounded Tutor Quality (RAGAS-equivalent Metrics):');
  console.log(`   • Faithfulness:       ${(report.ragMetrics.faithfulness * 100).toFixed(1)}%`);
  console.log(`   • Answer Relevancy:   ${(report.ragMetrics.answerRelevancy * 100).toFixed(1)}%`);
  console.log(`   • Context Precision:  ${(report.ragMetrics.contextPrecision * 100).toFixed(1)}%`);
  console.log(`   • Context Recall:     ${(report.ragMetrics.contextRecall * 100).toFixed(1)}%`);

  console.log('\n2. Source Grounding & Safeguards:');
  console.log(`   • Grounding Accuracy: ${(report.groundingMetrics.groundingAccuracy * 100).toFixed(1)}%`);
  console.log(`   • Coordinate Match:   ${(report.groundingMetrics.coordinateAccuracy * 100).toFixed(1)}%`);
  console.log(`   • Refusal Accuracy:   ${(report.groundingMetrics.refusalAccuracy * 100).toFixed(1)}% (Off-material queries refused)`);
  console.log(`   • User Isolation:     ${report.groundingMetrics.userIsolationPreserved ? 'PASSED (0 data leaks)' : 'FAILED'}`);

  console.log('\n3. Personalization & BKT Learner Simulation:');
  console.log(`   • Simulated Students:  ${report.personalizationMetrics.simulatedStudentsCount}`);
  console.log(`   • Avg Mastery Delta:   +${(report.personalizationMetrics.averageMasteryImprovement * 100).toFixed(1)}% improvement`);
  console.log(`   • Tasks Completed:     ${report.personalizationMetrics.totalCompletedActivities}`);

  for (const s of report.personalizationMetrics.students) {
    console.log(`     - [${s.profileName}]: ${(s.masteryBefore * 100).toFixed(1)}% -> ${(s.masteryAfter * 100).toFixed(1)}% (+${(s.masteryImprovement * 100).toFixed(1)}%)`);
  }

  console.log('\n4. Question Novelty & Repetition:');
  console.log(`   • Questions Analyzed:  ${report.noveltyMetrics.totalQuestionsAnalyzed}`);
  console.log(`   • Unique Questions:    ${(report.noveltyMetrics.uniqueQuestionPercentage * 100).toFixed(1)}%`);
  console.log(`   • Exact Duplicates:    ${(report.noveltyMetrics.exactDuplicateRate * 100).toFixed(1)}%`);
  console.log(`   • Semantic Duplicates: ${(report.noveltyMetrics.semanticDuplicateRate * 100).toFixed(1)}%`);

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
