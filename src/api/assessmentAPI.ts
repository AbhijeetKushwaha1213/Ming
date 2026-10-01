export interface AssessmentQuestion {
  question_id: string;
  type: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL';
  topic: string;
  subtopic?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  source_id?: string | null;
  chunk_id?: string | null;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  fingerprint?: string;
}

export interface DiagnosticReport {
  overallScore: string;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  topicPerformance: Record<string, { total: number; correct: number; percentage: number }>;
  difficultyPerformance: Record<string, { total: number; correct: number; percentage: number }>;
  incorrectAnswers: Array<{
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    citationLabel: string;
    location?: any;
  }>;
  likelyMisconceptions: string[];
  recommendedSourceMaterial: Array<{
    topic: string;
    subtopic: string;
    coordinate: string;
    chunkId?: string;
    recommendation: string;
  }>;
}

export interface AssessmentAttemptResult {
  success: boolean;
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  results: Array<{
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    feedback: string;
    explanation: string;
    location?: any;
  }>;
  diagnosticReport: DiagnosticReport;
}

const API_BASE = '/api/rag/assessment';

export async function generateAssessment(params: {
  userId: string;
  topic: string;
  subtopic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
  questionType?: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'MIXED';
  sourceId?: string;
}): Promise<{
  success: boolean;
  topic: string;
  subtopic?: string;
  difficulty: string;
  totalQuestions: number;
  questions: AssessmentQuestion[];
}> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to generate assessment (${res.status})`);
  }

  return res.json();
}

export async function submitAssessment(params: {
  userId: string;
  title: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  questions: AssessmentQuestion[];
  answers: any[];
}): Promise<AssessmentAttemptResult> {
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to submit assessment (${res.status})`);
  }

  return res.json();
}

export async function getAssessmentHistory(userId: string): Promise<{ success: boolean; history: any[] }> {
  const res = await fetch(`${API_BASE}/history?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch assessment history: ${res.statusText}`);
  }
  return res.json();
}
