import {
  runFullEvaluationSuite,
  getLatestEvaluationReport,
  loadEvaluationDataset,
  type FullEvaluationReport,
} from './evaluationEngine.ts';
import { runPythonCli } from './ragHandler.ts';

interface SimpleRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | undefined>;
  body?: any;
}

interface SimpleResponse {
  status(code: number): SimpleResponse;
  json(data: any): void;
  setHeader?(name: string, value: string): void;
  end?(body?: string): void;
}

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

export async function evaluationHandler(req: SimpleRequest, res: SimpleResponse): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. GET /api/evaluation/dataset
  if (method === 'GET' && pathname === '/api/evaluation/dataset') {
    try {
      const dataset = await loadEvaluationDataset();
      res.status(200).json({ success: true, count: dataset.length, dataset });
      return;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load evaluation dataset', details: err.message });
      return;
    }
  }

  // 2. GET /api/evaluation/latest
  if (method === 'GET' && pathname === '/api/evaluation/latest') {
    try {
      let report = await getLatestEvaluationReport();
      if (!report) {
        // Run full evaluation suite on demand if no previous run exists
        report = await runFullEvaluationSuite(searchAdapter, chatAdapter);
      }
      res.status(200).json({ success: true, report });
      return;
    } catch (err: any) {
      console.error('Error fetching latest evaluation report:', err);
      res.status(500).json({ error: 'Failed to fetch evaluation report', details: err.message });
      return;
    }
  }

  // 3. POST /api/evaluation/run
  if (method === 'POST' && pathname === '/api/evaluation/run') {
    try {
      console.log('🚀 Running full StudyMate Evaluation Suite on isolated test data...');
      const report = await runFullEvaluationSuite(searchAdapter, chatAdapter);
      res.status(200).json({ success: true, report });
      return;
    } catch (err: any) {
      console.error('Error running evaluation suite:', err);
      res.status(500).json({ error: 'Failed to execute evaluation suite', details: err.message });
      return;
    }
  }

  // 4. GET /api/evaluation/csv
  if (method === 'GET' && pathname === '/api/evaluation/csv') {
    try {
      let report = await getLatestEvaluationReport();
      if (!report) {
        report = await runFullEvaluationSuite(searchAdapter, chatAdapter);
      }

      const csvRows: string[] = [
        'Metric Category,Metric Name,Value,Target Benchmark',
        `RAG,Faithfulness,${report.ragMetrics.faithfulness},>= 0.85`,
        `RAG,Answer Relevancy,${report.ragMetrics.answerRelevancy},>= 0.80`,
        `RAG,Context Precision,${report.ragMetrics.contextPrecision},>= 0.80`,
        `RAG,Context Recall,${report.ragMetrics.contextRecall},>= 0.80`,
        `Grounding,Grounding Accuracy,${report.groundingMetrics.groundingAccuracy},>= 0.85`,
        `Grounding,Coordinate Accuracy,${report.groundingMetrics.coordinateAccuracy},>= 0.85`,
        `Grounding,Refusal Accuracy,${report.groundingMetrics.refusalAccuracy},1.00`,
        `Grounding,User Isolation Preserved,${report.groundingMetrics.userIsolationPreserved ? 'YES' : 'NO'},YES`,
        `Personalization,Average Mastery Improvement,${report.personalizationMetrics.averageMasteryImprovement},> 0.00`,
        `Novelty,Unique Question Percentage,${report.noveltyMetrics.uniqueQuestionPercentage},>= 0.90`,
        `Novelty,Exact Duplicate Rate,${report.noveltyMetrics.exactDuplicateRate},<= 0.05`,
      ];

      if (res.setHeader) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="studymate_benchmark_report.csv"');
      }
      res.status(200).end ? res.end(csvRows.join('\n')) : res.json({ csv: csvRows.join('\n') });
      return;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to export CSV evaluation', details: err.message });
      return;
    }
  }

  res.status(404).json({ error: `Evaluation endpoint not found: ${method} ${pathname}` });
}
