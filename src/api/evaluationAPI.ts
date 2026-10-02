export interface RagMetrics {
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
}

export interface GroundingMetrics {
  groundingAccuracy: number;
  coordinateAccuracy: number;
  refusalAccuracy: number;
  userIsolationPreserved: boolean;
}

export interface StudentSimulationStep {
  sessionIndex: number;
  recommendedTopic: string;
  activityType: string;
  reason: string;
  priorMastery: number;
  posteriorMastery?: number;
}

export interface SimulatedStudentResult {
  studentId: string;
  profileName: string;
  initialTopicMasteries: Record<string, number>;
  finalTopicMasteries: Record<string, number>;
  masteryBefore: number;
  masteryAfter: number;
  masteryImprovement: number;
  recommendedTopics: string[];
  recommendedActivities: string[];
  completedTasksCount: number;
  sessionSteps: StudentSimulationStep[];
}

export interface PersonalizationMetrics {
  simulatedStudentsCount: number;
  averageMasteryImprovement: number;
  totalCompletedActivities: number;
  students: SimulatedStudentResult[];
}

export interface NoveltyMetrics {
  totalQuestionsAnalyzed: number;
  exactDuplicatesCount: number;
  semanticDuplicatesCount: number;
  uniqueQuestionsCount: number;
  exactDuplicateRate: number;
  semanticDuplicateRate: number;
  uniqueQuestionPercentage: number;
}

export interface PerQuestionResult {
  itemId: string;
  question: string;
  questionType: string;
  offMaterial: boolean;
  retrievedChunkCount: number;
  topSourceId: string | null;
  topPageNumber: number | null;
  groundingMatched: boolean;
  coordinatesMatched: boolean;
  refusalMatched: boolean;
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
  generatedAnswerPreview: string;
}

export interface EvaluationReport {
  evaluationTimestamp: string;
  datasetSize: number;
  ragMetrics: RagMetrics;
  groundingMetrics: GroundingMetrics;
  personalizationMetrics: PersonalizationMetrics;
  noveltyMetrics: NoveltyMetrics;
  perQuestionResults: PerQuestionResult[];
  failuresAndErrors: string[];
}

export async function getLatestEvaluation(): Promise<{ success: boolean; report: EvaluationReport | null }> {
  const res = await fetch('/api/evaluation/latest');
  if (!res.ok) {
    throw new Error(`Failed to load evaluation metrics (${res.status})`);
  }
  return res.json();
}

export async function runEvaluationSuite(): Promise<{ success: boolean; report: EvaluationReport }> {
  const res = await fetch('/api/evaluation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to run evaluation suite (${res.status})`);
  }
  return res.json();
}

export async function getEvaluationDataset(): Promise<{ success: boolean; count: number; dataset: any[] }> {
  const res = await fetch('/api/evaluation/dataset');
  if (!res.ok) {
    throw new Error(`Failed to load evaluation dataset (${res.status})`);
  }
  return res.json();
}

export function getEvaluationCsvDownloadUrl(): string {
  return '/api/evaluation/csv';
}
