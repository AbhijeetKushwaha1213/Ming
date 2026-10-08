import { prisma, ensureAssessmentSchema, ensureLearnerSchema } from './prisma.ts';
import { updateMasteryFromEvidence, getTopicLearnerMastery, type BKTParameters } from './bktService.ts';
import { gradeNumericalAnswer, parseStudentAnswer } from './numericalVerifier.ts';
import type { NumericalQuestion, NumericalAnswerSubmission } from './assessmentTypes.ts';
import { DEFAULT_TOLERANCE } from './assessmentTypes.ts';

export type AnswerClassification = 'correct' | 'partially_correct' | 'incorrect';

export interface AnswerEvaluationInput {
  questionId: string;
  type: string; // 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL'
  question: string;
  userAnswer: string;
  correctAnswer: string;
  options?: string[];
  explanation?: string;
  topic?: string;
  subtopic?: string | null;
  difficulty?: string;
  sourceId?: string | null;
  chunkId?: string | null;
  pageNumber?: number | null;
  slideNumber?: number | null;
  timestampStart?: number | null;
  timestampEnd?: number | null;
}

export interface EvaluatedAnswerResult {
  questionId: string;
  question: string;
  questionType: string;
  userAnswer: string;
  correctAnswer: string;
  classification: AnswerClassification;
  credit: number; // 1.0 for correct, 0.5 for partially_correct, 0.0 for incorrect
  isCorrect: boolean;
  isPartial: boolean;
  feedback: string;
  explanation: string;
  sourceCitation: string;
  citationLabel: string;
  location: {
    sourceId?: string | null;
    chunkId?: string | null;
    page_number?: number | null;
    slide_number?: number | null;
    timestamp_start?: number | null;
    timestamp_end?: number | null;
    source_type?: string;
  };
  detectedMisconception?: DetectedMisconception | null;
}

export interface DetectedMisconception {
  topic: string;
  subtopic: string;
  concept: string;
  misconceptionType: 'CONCEPT_CONFUSION' | 'MECHANISM_INVERSION' | 'CALCULATION_ERROR' | 'PARTIAL_DEFINITION' | 'TERMINOLOGY_SWAP';
  description: string;
  evidenceQuote: string;
  sourceCoordinate: string;
  sourceId?: string | null;
  chunkId?: string | null;
  severity: 'high' | 'medium' | 'low';
}

export interface RepeatedMistake {
  topic: string;
  subtopic: string;
  concept: string;
  frequency: number;
  firstEncounteredAt: string;
  lastEncounteredAt: string;
  patternSummary: string;
  previousAttemptIds: string[];
}

export interface DiagnosticReportResult {
  overallScore: string;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  topicWiseMastery: Record<string, {
    topic: string;
    priorMastery: number;
    posteriorMastery: number;
    masteryDelta: number;
    correctCount: number;
    totalCount: number;
    status: string;
  }>;
  weakConcepts: string[];
  repeatedMistakes: RepeatedMistake[];
  likelyMisconceptions: DetectedMisconception[];
  confidenceAndMasteryChanges: Array<{
    topic: string;
    subtopic?: string | null;
    priorMastery: number;
    posteriorMastery: number;
    delta: number;
    confidence: number;
  }>;
  recommendedNextActions: Array<{
    priority: number;
    actionType: 'REVIEW_SOURCE' | 'PRACTICE_TARGETED' | 'RESOLVE_MISCONCEPTION';
    title: string;
    topic: string;
    subtopic?: string | null;
    sourceCoordinate?: string | null;
    reason: string;
    expectedOutcome: string;
  }>;
  incorrectAnswers: Array<EvaluatedAnswerResult & { citationLabel?: string }>;
  topicPerformance?: Record<string, { total: number; correct: number; percentage: number }>;
  difficultyPerformance?: Record<string, { total: number; correct: number; percentage: number }>;
  recommendedSourceMaterial?: Array<{
    topic: string;
    subtopic: string;
    coordinate: string;
    chunkId?: string | null;
    recommendation: string;
  }>;
}

// =========================================================================
// 1. Core Answer Evaluation (MCQ, Short Answer, Numerical)
// =========================================================================

function tokenizeWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function evaluateSingleAnswer(input: AnswerEvaluationInput): EvaluatedAnswerResult {
  const qType = (input.type || 'MCQ').toUpperCase();
  const userRaw = String(input.userAnswer ?? '').trim();
  const correctRaw = String(input.correctAnswer ?? '').trim();
  const userLower = userRaw.toLowerCase();
  const correctLower = correctRaw.toLowerCase();

  let classification: AnswerClassification = 'incorrect';
  let credit = 0.0;
  let feedback = '';

  const coordLabel = input.pageNumber
    ? `Page ${input.pageNumber}`
    : input.slideNumber
    ? `Slide ${input.slideNumber}`
    : input.timestampStart !== null && input.timestampStart !== undefined
    ? `${Math.floor(input.timestampStart / 60)}m${Math.floor(input.timestampStart % 60)}s`
    : 'Course Material Excerpt';

  if (qType === 'MCQ') {
    // 1. Exact text match
    if (userLower === correctLower) {
      classification = 'correct';
      credit = 1.0;
      feedback = `Correct! Verified in ${coordLabel}: ${correctRaw}`;
    }
    // 2. Index match if user answered 0, 1, 2, 3
    else if (!isNaN(Number(userRaw)) && Array.isArray(input.options)) {
      const idx = Number(userRaw);
      const chosen = input.options[idx];
      if (chosen && String(chosen).trim().toLowerCase() === correctLower) {
        classification = 'correct';
        credit = 1.0;
        feedback = `Correct! Option ${idx + 1} (${chosen}) matches ${coordLabel}.`;
      } else {
        classification = 'incorrect';
        credit = 0.0;
        feedback = `Incorrect. You chose option ${idx + 1}${chosen ? ` ("${chosen}")` : ''}. Correct answer is "${correctRaw}" as stated in ${coordLabel}.`;
      }
    } else {
      classification = 'incorrect';
      credit = 0.0;
      feedback = `Incorrect. You answered "${userRaw}". Verified answer in ${coordLabel} is "${correctRaw}".`;
    }
  } else if (qType === 'NUMERICAL') {
    // Phase 4: Delegate to the canonical deterministic numerical verifier
    const correctVal = parseFloat(correctRaw.replace(/[^\d.\-]/g, ''));
    if (isNaN(correctVal)) {
      classification = 'incorrect';
      credit = 0.0;
      feedback = `Invalid numerical format for correct answer. Expected numerical value.`;
    } else {
      const numericalQuestion: NumericalQuestion = {
        question_id: input.questionId,
        type: 'NUMERICAL',
        topic: input.topic || 'General',
        subtopic: input.subtopic,
        difficulty: (input.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        source_id: input.sourceId,
        chunk_id: input.chunkId,
        page_number: input.pageNumber,
        slide_number: input.slideNumber,
        timestamp_start: input.timestampStart,
        timestamp_end: input.timestampEnd,
        question: input.question,
        correct_answer: correctVal,
        correct_answer_raw: correctRaw,
        tolerance: DEFAULT_TOLERANCE,
        verifiability: 'VERIFIED',
        explanation: input.explanation || '',
      };

      const numericalSubmission: NumericalAnswerSubmission = {
        question_id: input.questionId,
        raw_answer: userRaw,
      };

      const gradingResult = gradeNumericalAnswer(numericalSubmission, numericalQuestion);

      if (gradingResult.classification === 'invalid_format') {
        classification = 'incorrect';
        credit = 0.0;
      } else {
        classification = gradingResult.classification as AnswerClassification;
        credit = gradingResult.credit;
      }
      feedback = gradingResult.feedback;
    }
  } else {
    // SHORT_ANSWER
    const userTokens = tokenizeWords(userRaw);
    const correctTokens = tokenizeWords(correctRaw);

    if (userTokens.length === 0 || correctTokens.length === 0) {
      classification = 'incorrect';
      credit = 0.0;
      feedback = `Incomplete answer. Missing key conceptual components from ${coordLabel}.`;
    } else {
      let matchedCount = 0;
      for (const ct of correctTokens) {
        if (userTokens.includes(ct) || userLower.includes(ct)) {
          matchedCount++;
        }
      }
      const overlapRatio = matchedCount / correctTokens.length;

      if (overlapRatio >= 0.75 || userLower === correctLower) {
        classification = 'correct';
        credit = 1.0;
        feedback = `Correct! Your response accurately captures the core principles verified in ${coordLabel}.`;
      } else if (overlapRatio >= 0.35 || userLower.includes(correctLower) || correctLower.includes(userLower)) {
        classification = 'partially_correct';
        credit = 0.5;
        const missing = correctTokens.filter((ct) => !userTokens.includes(ct) && !userLower.includes(ct));
        feedback = `Partially correct. You identified key concepts (${Math.round(overlapRatio * 100)}% coverage), but missed critical details: ${missing.slice(0, 3).join(', ')}. Review ${coordLabel}.`;
      } else {
        classification = 'incorrect';
        credit = 0.0;
        feedback = `Incorrect. Your response does not reflect the course principles verified in ${coordLabel}: "${correctRaw}".`;
      }
    }
  }

  // Detect likely misconceptions for incorrect and partial answers
  let detectedMisconception: DetectedMisconception | null = null;
  if (classification !== 'correct') {
    detectedMisconception = detectDeterministicMisconception(input, classification);
  }

  return {
    questionId: input.questionId,
    question: input.question,
    questionType: qType,
    userAnswer: userRaw,
    correctAnswer: correctRaw,
    classification,
    credit,
    isCorrect: classification === 'correct',
    isPartial: classification === 'partially_correct',
    feedback,
    explanation: input.explanation || '',
    sourceCitation: coordLabel,
    citationLabel: coordLabel,
    location: {
      sourceId: input.sourceId,
      chunkId: input.chunkId,
      page_number: input.pageNumber,
      slide_number: input.slideNumber,
      timestamp_start: input.timestampStart,
      timestamp_end: input.timestampEnd,
    },
    detectedMisconception,
  };
}

// =========================================================================
// 2. Deterministic Misconception Detection Engine
// =========================================================================

export function detectDeterministicMisconception(
  input: AnswerEvaluationInput,
  classification: AnswerClassification
): DetectedMisconception {
  const qLower = (input.question || '').toLowerCase();
  const ansLower = (input.userAnswer || '').toLowerCase();
  const correctLower = (input.correctAnswer || '').toLowerCase();
  const topic = input.topic || 'General';
  const subtopic = input.subtopic || 'Core Concept';

  const coordLabel = input.pageNumber
    ? `Page ${input.pageNumber}`
    : input.slideNumber
    ? `Slide ${input.slideNumber}`
    : input.timestampStart !== null && input.timestampStart !== undefined
    ? `${Math.floor(input.timestampStart / 60)}m${Math.floor(input.timestampStart % 60)}s`
    : 'Course Material Excerpt';

  // Rule 1: Operating Systems - Deadlock Avoidance vs Deadlock Prevention
  if (
    (qLower.includes('avoidance') || qLower.includes('banker') || qLower.includes('deadlock')) &&
    (ansLower.includes('coffman') || ansLower.includes('eliminat') || ansLower.includes('prevention') || ansLower.includes('circular wait order'))
  ) {
    return {
      topic: 'Operating Systems',
      subtopic: 'Deadlocks',
      concept: 'Deadlock Avoidance vs Prevention',
      misconceptionType: 'CONCEPT_CONFUSION',
      description: 'Confused Deadlock Prevention (statically eliminating Coffman conditions before execution) with Deadlock Avoidance (dynamically monitoring safe states using the Banker algorithm).',
      evidenceQuote: 'Deadlock prevention functions by eliminating at least one Coffman condition statically, whereas avoidance dynamically monitors requests.',
      sourceCoordinate: coordLabel,
      sourceId: input.sourceId,
      chunkId: input.chunkId,
      severity: 'high',
    };
  }

  // Rule 2: Operating Systems - Paging vs Virtual Memory & Page Faults
  if (
    (qLower.includes('paging') || qLower.includes('frames') || qLower.includes('page fault')) &&
    (ansLower.includes('cpu scheduling') || ansLower.includes('ready queue') || ansLower.includes('process control block'))
  ) {
    return {
      topic: 'Operating Systems',
      subtopic: 'Memory Management',
      concept: 'Paging vs Process Scheduling',
      misconceptionType: 'TERMINOLOGY_SWAP',
      description: 'Confused memory paging and frame allocation with CPU process scheduling mechanisms.',
      evidenceQuote: 'Paging divides physical memory into frames and logical memory into pages to eliminate contiguous allocation requirements.',
      sourceCoordinate: coordLabel,
      sourceId: input.sourceId,
      chunkId: input.chunkId,
      severity: 'medium',
    };
  }

  // Rule 3: Operating Systems - Replacement Algorithms (LRU vs FIFO vs Optimal)
  if (qLower.includes('replacement') || qLower.includes('lru') || qLower.includes('fifo')) {
    if (ansLower.includes('fifo') && correctLower.includes('lru')) {
      return {
        topic: 'Operating Systems',
        subtopic: 'Virtual Memory',
        concept: 'Page Replacement Policies (FIFO vs LRU)',
        misconceptionType: 'CONCEPT_CONFUSION',
        description: 'Selected First-In First-Out (FIFO) instead of Least Recently Used (LRU) which replaces the page unused for the longest period.',
        evidenceQuote: 'Least Recently Used (LRU) replaces the page that has not been used for the longest period of time.',
        sourceCoordinate: coordLabel,
        sourceId: input.sourceId,
        chunkId: input.chunkId,
        severity: 'medium',
      };
    }
  }

  // Rule 4: Computer Networks - Flow Control vs Congestion Control
  if (
    (qLower.includes('flow control') || qLower.includes('sliding window') || qLower.includes('congestion')) &&
    (ansLower.includes('router') || ansLower.includes('traffic collapse') || ansLower.includes('slow start')) &&
    correctLower.includes('receive window')
  ) {
    return {
      topic: 'Computer Networks',
      subtopic: 'Transport Layer',
      concept: 'Flow Control vs Congestion Control',
      misconceptionType: 'MECHANISM_INVERSION',
      description: 'Confused flow control (receiver buffer capacity advertised via rwnd) with congestion control (preventing router traffic collapse via cwnd).',
      evidenceQuote: 'Flow control prevents a fast sender from overwhelming a slow receiver using rwnd, while congestion control protects network routers.',
      sourceCoordinate: coordLabel,
      sourceId: input.sourceId,
      chunkId: input.chunkId,
      severity: 'high',
    };
  }

  // Rule 5: Computer Networks - TCP vs UDP Protocol Properties
  if (qLower.includes('tcp') || qLower.includes('udp')) {
    if (ansLower.includes('udp') && (correctLower.includes('tcp') || correctLower.includes('reliable'))) {
      return {
        topic: 'Computer Networks',
        subtopic: 'Transport Layer Protocols',
        concept: 'TCP vs UDP Reliability',
        misconceptionType: 'CONCEPT_CONFUSION',
        description: 'Attributed connection-oriented reliable byte-stream guarantees to UDP instead of TCP.',
        evidenceQuote: 'TCP is connection-oriented, reliable, and byte-stream oriented, whereas UDP is connectionless and unreliable.',
        sourceCoordinate: coordLabel,
        sourceId: input.sourceId,
        chunkId: input.chunkId,
        severity: 'high',
      };
    }
  }

  // Rule 6: Database Systems - ACID Atomicity vs Durability or Isolation
  if (qLower.includes('atomicity') || qLower.includes('acid') || qLower.includes('transaction')) {
    if (ansLower.includes('isolation') || ansLower.includes('locking') || ansLower.includes('serializability')) {
      return {
        topic: 'Database Systems',
        subtopic: 'Transaction Processing',
        concept: 'Atomicity vs Isolation',
        misconceptionType: 'CONCEPT_CONFUSION',
        description: 'Confused Atomicity (all-or-nothing execution backed by write-ahead logging) with Isolation (concurrency control without interference).',
        evidenceQuote: 'Atomicity requires all-or-nothing execution guaranteed by write-ahead logging.',
        sourceCoordinate: coordLabel,
        sourceId: input.sourceId,
        chunkId: input.chunkId,
        severity: 'medium',
      };
    }
  }

  // Rule 7: Database Systems - B+ Tree Structure (Leaf vs Internal Nodes)
  if (qLower.includes('b+ tree') || qLower.includes('indexing')) {
    if (ansLower.includes('internal') && correctLower.includes('leaf')) {
      return {
        topic: 'Database Systems',
        subtopic: 'Indexing',
        concept: 'B+ Tree Node Layout',
        misconceptionType: 'MECHANISM_INVERSION',
        description: 'Assumed data records are stored in internal nodes rather than exclusively in leaf nodes of a B+ Tree.',
        evidenceQuote: 'In a B+ Tree, all data records or pointers reside exclusively in the leaf nodes, while internal nodes store only routing search keys.',
        sourceCoordinate: coordLabel,
        sourceId: input.sourceId,
        chunkId: input.chunkId,
        severity: 'medium',
      };
    }
  }

  // Rule 8: Algorithms - Dynamic Programming vs Divide and Conquer
  if (qLower.includes('dynamic programming') || qLower.includes('memoization') || qLower.includes('tabulation')) {
    if (ansLower.includes('independent') || ansLower.includes('divide and conquer')) {
      return {
        topic: 'Algorithms & Data Structures',
        subtopic: 'Dynamic Programming',
        concept: 'Overlapping Subproblems vs Independent Subproblems',
        misconceptionType: 'CONCEPT_CONFUSION',
        description: 'Confused dynamic programming (overlapping subproblems solved via memoization/tabulation) with divide-and-conquer (independent subproblems).',
        evidenceQuote: 'Dynamic programming solves problems by breaking them into overlapping subproblems with optimal substructure.',
        sourceCoordinate: coordLabel,
        sourceId: input.sourceId,
        chunkId: input.chunkId,
        severity: 'medium',
      };
    }
  }

  // Rule 9: Numerical Precision or Sign Errors
  if (input.type?.toUpperCase() === 'NUMERICAL') {
    return {
      topic,
      subtopic,
      concept: 'Numerical Computation',
      misconceptionType: 'CALCULATION_ERROR',
      description: `Calculation error: Student provided "${input.userAnswer}", expected "${input.correctAnswer}". Check formula constants and unit conversions at ${coordLabel}.`,
      evidenceQuote: `Verified reference value: ${input.correctAnswer}`,
      sourceCoordinate: coordLabel,
      sourceId: input.sourceId,
      chunkId: input.chunkId,
      severity: classification === 'partially_correct' ? 'low' : 'medium',
    };
  }

  // Default Fallback Misconception
  return {
    topic,
    subtopic,
    concept: subtopic || topic,
    misconceptionType: classification === 'partially_correct' ? 'PARTIAL_DEFINITION' : 'CONCEPT_CONFUSION',
    description: classification === 'partially_correct'
      ? `Partial mastery of ${subtopic}: student identified some concepts but omitted verified course requirements at ${coordLabel}.`
      : `Conceptual gap in ${subtopic}: student answered "${input.userAnswer.slice(0, 60)}", conflicting with verified evidence "${input.correctAnswer.slice(0, 60)}".`,
    evidenceQuote: input.correctAnswer,
    sourceCoordinate: coordLabel,
    sourceId: input.sourceId,
    chunkId: input.chunkId,
    severity: 'medium',
  };
}

// =========================================================================
// 3. Repeated Mistake Detection Across Historical Assessments
// =========================================================================

export async function detectRepeatedMistakes(
  userId: string,
  currentMisconceptions: DetectedMisconception[]
): Promise<RepeatedMistake[]> {
  await ensureAssessmentSchema();

  if (!currentMisconceptions.length) return [];

  const repeated: RepeatedMistake[] = [];

  try {
    // Query historical misconceptions for this user from previous assessment submissions
    const historicalRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT m.topic, m.subtopic, m.concept, m.description, m.createdAt, m.attemptId
       FROM assessment_misconceptions m
       WHERE m.userId = ?
       ORDER BY m.createdAt DESC LIMIT 100`,
      userId
    );

    for (const cur of currentMisconceptions) {
      const matchingPast = historicalRows.filter(
        (h: any) =>
          h.concept.toLowerCase() === cur.concept.toLowerCase() ||
          (h.topic.toLowerCase() === cur.topic.toLowerCase() && h.subtopic.toLowerCase() === cur.subtopic.toLowerCase())
      );

      if (matchingPast.length > 0) {
        const earliest = matchingPast[matchingPast.length - 1];
        const latest = matchingPast[0];
        const attemptIds = Array.from(new Set(matchingPast.map((h: any) => h.attemptId).filter(Boolean)));

        repeated.push({
          topic: cur.topic,
          subtopic: cur.subtopic,
          concept: cur.concept,
          frequency: matchingPast.length + 1, // Past occurrences + current
          firstEncounteredAt: earliest.createdAt ? new Date(earliest.createdAt).toISOString() : new Date().toISOString(),
          lastEncounteredAt: new Date().toISOString(),
          patternSummary: `Persistent difficulty with "${cur.concept}": encountered ${matchingPast.length + 1} times across assessments.`,
          previousAttemptIds: attemptIds as string[],
        });
      }
    }
  } catch (err: any) {
    console.warn('Could not query historical misconceptions for repeated mistake detection:', err.message);
  }

  return repeated;
}

// =========================================================================
// 4. Assessment Intelligence Pipeline & Diagnostic Generator
// =========================================================================

export async function processAssessmentIntelligence(params: {
  userId: string;
  title: string;
  topic: string;
  subtopic?: string | null;
  difficulty?: string;
  questions: any[];
  answers: any[];
  attemptId: string;
}): Promise<{
  results: EvaluatedAnswerResult[];
  diagnosticReport: DiagnosticReportResult;
}> {
  await ensureAssessmentSchema();
  await ensureLearnerSchema();

  const { userId, title, topic, subtopic, difficulty = 'medium', questions, answers, attemptId } = params;

  // 1. Evaluate every question
  const evaluatedResults: EvaluatedAnswerResult[] = questions.map((q, idx) => {
    return evaluateSingleAnswer({
      questionId: q.question_id || q.id || `q_${idx}`,
      type: q.type || 'MCQ',
      question: q.question,
      userAnswer: answers[idx],
      correctAnswer: q.correct_answer || q.correctAnswer || '',
      options: q.options || q.optionsJson ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [],
      explanation: q.explanation,
      topic: q.topic || topic,
      subtopic: q.subtopic || subtopic,
      difficulty: q.difficulty || difficulty,
      sourceId: q.source_id || q.sourceId,
      chunkId: q.chunk_id || q.chunkId,
      pageNumber: q.page_number ?? q.pageNumber,
      slideNumber: q.slide_number ?? q.slideNumber,
      timestampStart: q.timestamp_start ?? q.timestampStart,
      timestampEnd: q.timestamp_end ?? q.timestampEnd,
    });
  });

  // 2. Tally metrics
  const totalQuestions = evaluatedResults.length;
  const correctCount = evaluatedResults.filter((r) => r.classification === 'correct').length;
  const partialCount = evaluatedResults.filter((r) => r.classification === 'partially_correct').length;
  const incorrectCount = evaluatedResults.filter((r) => r.classification === 'incorrect').length;

  const totalCredit = evaluatedResults.reduce((sum, r) => sum + r.credit, 0);
  const percentage = Math.round((totalCredit / Math.max(1, totalQuestions)) * 100);

  // 3. Extract active misconceptions
  const currentMisconceptions: DetectedMisconception[] = [];
  evaluatedResults.forEach((r) => {
    if (r.detectedMisconception) {
      currentMisconceptions.push(r.detectedMisconception);
    }
  });

  // 4. Detect repeated mistakes across historical assessments
  const repeatedMistakes = await detectRepeatedMistakes(userId, currentMisconceptions);

  // 5. Update BKT Learner Model using actual assessment evidence
  const topicWiseMastery: DiagnosticReportResult['topicWiseMastery'] = {};
  const confidenceAndMasteryChanges: DiagnosticReportResult['confidenceAndMasteryChanges'] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ev = evaluatedResults[i];
    const qTopic = q.topic || topic;
    const qSubtopic = q.subtopic || subtopic || null;

    try {
      // Prior mastery before update
      const priorState = await getTopicLearnerMastery(userId, qTopic, qSubtopic || undefined);
      const priorMastery = priorState ? priorState.masteryProbability : 0.15;

      // Update BKT: for partially_correct, we update with 0.50 scaled observation
      const bktResult = await updateMasteryFromEvidence({
        userId,
        topic: qTopic,
        subtopic: qSubtopic,
        isCorrect: ev.isCorrect,
        credit: ev.credit,
        difficulty: q.difficulty || difficulty,
        sourceId: attemptId,
        eventType: 'ASSESSMENT_ANSWER',
        evidenceDetails: `Phase 9 Assessment: "${q.question?.slice(0, 50)}..." [${ev.classification.toUpperCase()}, credit=${ev.credit}]`,
      });

      const posteriorMastery = bktResult.posteriorMastery;
      const delta = Math.round((posteriorMastery - priorMastery) * 1000) / 1000;

      confidenceAndMasteryChanges.push({
        topic: qTopic,
        subtopic: qSubtopic,
        priorMastery: Math.round(priorMastery * 1000) / 1000,
        posteriorMastery: Math.round(posteriorMastery * 1000) / 1000,
        delta,
        confidence: Math.round(bktResult.confidence * 1000) / 1000,
      });

      if (!topicWiseMastery[qTopic]) {
        topicWiseMastery[qTopic] = {
          topic: qTopic,
          priorMastery: Math.round(priorMastery * 100) / 100,
          posteriorMastery: Math.round(posteriorMastery * 100) / 100,
          masteryDelta: delta,
          correctCount: 0,
          totalCount: 0,
          status: bktResult.status,
        };
      }
      topicWiseMastery[qTopic].totalCount++;
      if (ev.isCorrect) topicWiseMastery[qTopic].correctCount++;
      topicWiseMastery[qTopic].posteriorMastery = Math.round(posteriorMastery * 100) / 100;
      topicWiseMastery[qTopic].status = bktResult.status;
    } catch (err: any) {
      console.warn('Could not update BKT mastery for question:', err.message);
    }
  }

  // 6. Identify Weak Concepts
  const weakConcepts = Array.from(
    new Set(
      evaluatedResults
        .filter((r) => r.classification !== 'correct')
        .map((r) => r.detectedMisconception?.concept || r.question)
    )
  );

  // 7. Recommended Next Actions
  const recommendedNextActions: DiagnosticReportResult['recommendedNextActions'] = [];
  let actPriority = 1;

  // High priority: repeated mistakes
  for (const rm of repeatedMistakes) {
    recommendedNextActions.push({
      priority: actPriority++,
      actionType: 'RESOLVE_MISCONCEPTION',
      title: `Resolve Repeated Misconception: ${rm.concept}`,
      topic: rm.topic,
      subtopic: rm.subtopic,
      reason: `Missed ${rm.frequency} times across assessments. Priority revision required to prevent persistent test errors.`,
      expectedOutcome: `Achieve conceptual clarity on ${rm.concept} and raise topic mastery to proficiency (≥60%).`,
    });
  }

  // Medium priority: current attempt misconceptions with source coordinates
  for (const mc of currentMisconceptions) {
    if (!repeatedMistakes.some((rm) => rm.concept === mc.concept)) {
      recommendedNextActions.push({
        priority: actPriority++,
        actionType: 'REVIEW_SOURCE',
        title: `Review ${mc.concept} at ${mc.sourceCoordinate}`,
        topic: mc.topic,
        subtopic: mc.subtopic,
        sourceCoordinate: mc.sourceCoordinate,
        reason: mc.description,
        expectedOutcome: `Ground understanding directly in course materials (${mc.sourceCoordinate}) to eliminate misconceptions.`,
      });
    }
  }

  // Additional practice if score < 70%
  if (percentage < 70 && weakConcepts.length > 0) {
    recommendedNextActions.push({
      priority: actPriority++,
      actionType: 'PRACTICE_TARGETED',
      title: `Practice Targeted Assessment on ${weakConcepts[0]}`,
      topic: topic,
      subtopic: subtopic || null,
      reason: `Score was ${percentage}%. Targeted spaced repetition cements newly learned concepts.`,
      expectedOutcome: `Reinforce correct problem-solving steps and verify mastery delta.`,
    });
  }

  // Legacy compatibility performance metrics
  const topicPerf: Record<string, { total: number; correct: number; percentage: number }> = {};
  const diffPerf: Record<string, { total: number; correct: number; percentage: number }> = {};
  const recommendedMaterial: Array<{ topic: string; subtopic: string; coordinate: string; chunkId?: string | null; recommendation: string }> = [];

  questions.forEach((q, idx) => {
    const ev = evaluatedResults[idx];
    const tKey = q.subtopic || q.topic || topic;
    if (!topicPerf[tKey]) topicPerf[tKey] = { total: 0, correct: 0, percentage: 0 };
    topicPerf[tKey].total++;
    if (ev.isCorrect) topicPerf[tKey].correct++;

    const dKey = q.difficulty || difficulty;
    if (!diffPerf[dKey]) diffPerf[dKey] = { total: 0, correct: 0, percentage: 0 };
    diffPerf[dKey].total++;
    if (ev.isCorrect) diffPerf[dKey].correct++;

    if (!ev.isCorrect) {
      recommendedMaterial.push({
        topic: q.topic || topic,
        subtopic: q.subtopic || 'Core Concept',
        coordinate: ev.sourceCitation,
        chunkId: q.chunk_id || q.chunkId || null,
        recommendation: `Review ${q.subtopic || q.topic} at ${ev.sourceCitation}: '${q.correct_answer || q.correctAnswer}'`,
      });
    }
  });

  Object.keys(topicPerf).forEach(k => {
    topicPerf[k].percentage = Math.round((topicPerf[k].correct / topicPerf[k].total) * 100);
  });
  Object.keys(diffPerf).forEach(k => {
    diffPerf[k].percentage = Math.round((diffPerf[k].correct / diffPerf[k].total) * 100);
  });

  const diagnosticReport: DiagnosticReportResult = {
    overallScore: `${correctCount}/${totalQuestions}`,
    percentage,
    totalQuestions,
    correctCount,
    partialCount,
    incorrectCount,
    topicPerformance: topicPerf,
    difficultyPerformance: diffPerf,
    recommendedSourceMaterial: recommendedMaterial,
    topicWiseMastery,
    weakConcepts,
    repeatedMistakes,
    likelyMisconceptions: currentMisconceptions,
    confidenceAndMasteryChanges,
    recommendedNextActions,
    incorrectAnswers: evaluatedResults.filter((r) => r.classification !== 'correct'),
  };

  // 8. Persist Answer Evaluations & Misconceptions into DB tables
  await persistEvaluationsAndMisconceptions(attemptId, userId, evaluatedResults);

  return {
    results: evaluatedResults,
    diagnosticReport,
  };
}

// =========================================================================
// 5. Database Persistence Helpers
// =========================================================================

async function persistEvaluationsAndMisconceptions(
  attemptId: string,
  userId: string,
  results: EvaluatedAnswerResult[]
): Promise<void> {
  for (const r of results) {
    const evalId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO assessment_evaluations (id, attemptId, userId, questionId, questionText, questionType, userAnswer, correctAnswer, classification, credit, feedback, explanation, sourceId, chunkId, sourceCoordinate, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        evalId,
        attemptId,
        userId,
        r.questionId,
        r.question,
        r.questionType,
        r.userAnswer,
        r.correctAnswer,
        r.classification,
        r.credit,
        r.feedback,
        r.explanation,
        r.location.sourceId || null,
        r.location.chunkId || null,
        r.sourceCitation || null,
        new Date().toISOString()
      );

      if (r.detectedMisconception) {
        const mc = r.detectedMisconception;
        const mcId = `mc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO assessment_misconceptions (id, attemptId, evaluationId, userId, topic, subtopic, concept, misconceptionType, description, studentAnswer, expectedAnswer, sourceId, chunkId, sourceCoordinate, severity, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          mcId,
          attemptId,
          evalId,
          userId,
          mc.topic,
          mc.subtopic,
          mc.concept,
          mc.misconceptionType,
          mc.description,
          r.userAnswer,
          r.correctAnswer,
          mc.sourceId || null,
          mc.chunkId || null,
          mc.sourceCoordinate || null,
          mc.severity,
          new Date().toISOString()
        );
      }
    } catch (insertErr: any) {
      console.warn('Could not insert evaluation or misconception record:', insertErr.message);
    }
  }
}

// =========================================================================
// 6. Query APIs for Misconceptions & Diagnostics
// =========================================================================

export async function getUserMisconceptions(userId: string, topic?: string): Promise<{
  misconceptions: any[];
  repeatedMistakes: RepeatedMistake[];
  summary: {
    total: number;
    repeatedCount: number;
    highSeverityCount: number;
  };
}> {
  await ensureAssessmentSchema();
  try {
    let query = 'SELECT * FROM assessment_misconceptions WHERE userId = ?';
    const params: any[] = [userId];
    if (topic) {
      query += ' AND topic = ?';
      params.push(topic);
    }
    query += ' ORDER BY createdAt DESC LIMIT 100';

    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);
    const misconceptions = rows.map((r: any) => ({
      id: r.id,
      attemptId: r.attemptId,
      evaluationId: r.evaluationId,
      userId: r.userId,
      topic: r.topic,
      subtopic: r.subtopic,
      concept: r.concept,
      misconceptionType: r.misconceptionType,
      description: r.description,
      studentAnswer: r.studentAnswer,
      expectedAnswer: r.expectedAnswer,
      sourceId: r.sourceId,
      chunkId: r.chunkId,
      sourceCoordinate: r.sourceCoordinate,
      severity: r.severity,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    // Detect repeated mistakes from the list
    const conceptMap = new Map<string, any[]>();
    for (const m of misconceptions) {
      const k = m.concept.toLowerCase();
      if (!conceptMap.has(k)) conceptMap.set(k, []);
      conceptMap.get(k)!.push(m);
    }

    const repeatedMistakes: RepeatedMistake[] = [];
    for (const [, items] of conceptMap.entries()) {
      if (items.length > 1) {
        repeatedMistakes.push({
          topic: items[0].topic,
          subtopic: items[0].subtopic,
          concept: items[0].concept,
          frequency: items.length,
          firstEncounteredAt: items[items.length - 1].createdAt,
          lastEncounteredAt: items[0].createdAt,
          patternSummary: `Persistent difficulty with "${items[0].concept}": encountered ${items.length} times across assessments.`,
          previousAttemptIds: Array.from(new Set(items.map((i: any) => i.attemptId))),
        });
      }
    }

    const highSeverityCount = misconceptions.filter((m) => m.severity === 'high').length;

    return {
      misconceptions,
      repeatedMistakes,
      summary: {
        total: misconceptions.length,
        repeatedCount: repeatedMistakes.length,
        highSeverityCount,
      },
    };
  } catch (err: any) {
    console.warn('Error fetching misconceptions:', err.message);
    return {
      misconceptions: [],
      repeatedMistakes: [],
      summary: { total: 0, repeatedCount: 0, highSeverityCount: 0 },
    };
  }
}

export async function getAttemptDiagnostic(attemptId: string, userId?: string): Promise<any | null> {
  await ensureAssessmentSchema();
  try {
    let query = 'SELECT * FROM assessment_attempts WHERE id = ?';
    const params: any[] = [attemptId];
    if (userId) {
      query += ' AND userId = ?';
      params.push(userId);
    }
    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);
    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    const diagnosticReport = row.diagnosticJson ? JSON.parse(row.diagnosticJson) : null;
    const questions = row.questionsJson ? JSON.parse(row.questionsJson) : [];
    const answers = row.answersJson ? JSON.parse(row.answersJson) : [];

    // Also fetch detailed evaluations
    const evalRows: any[] = await prisma.$queryRawUnsafe(
      'SELECT * FROM assessment_evaluations WHERE attemptId = ? ORDER BY createdAt ASC',
      attemptId
    );

    return {
      attemptId: row.id,
      userId: row.userId,
      title: row.title,
      topic: row.topic,
      subtopic: row.subtopic,
      difficulty: row.difficulty,
      score: row.score,
      totalQuestions: row.totalQuestions,
      percentage: row.percentage,
      completedAt: row.completedAt,
      diagnosticReport,
      questions,
      answers,
      evaluations: evalRows,
    };
  } catch (err: any) {
    console.warn('Error fetching attempt diagnostic:', err.message);
    return null;
  }
}

