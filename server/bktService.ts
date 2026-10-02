import { prisma, ensureLearnerSchema } from './prisma.ts';

export interface BKTParameters {
  pL0: number; // Prior probability of mastery (initial learning state)
  pT: number;  // Transition probability (rate of learning between trials)
  pG: number;  // Guess probability (answering correctly without knowing)
  pS: number;  // Slip probability (answering incorrectly despite knowing)
}

export const DEFAULT_BKT_PARAMS: BKTParameters = {
  pL0: 0.15,
  pT: 0.10,
  pG: 0.20,
  pS: 0.10,
};

export type MasteryStatus = 'unassessed' | 'developing' | 'proficient' | 'mastered';

export type LearnerEventType =
  | 'ASSESSMENT_ANSWER'
  | 'ASSESSMENT_RESULT'
  | 'TUTOR_INTERACTION'
  | 'DIAGNOSTIC_ASSESSMENT';

/**
 * Adjust BKT Guess (pG) and Slip (pS) parameters based on question difficulty.
 * - Easy: Easier to guess (higher pG), rare to slip (lower pS).
 * - Hard: Difficult to guess (lower pG), more common to slip (higher pS).
 * - Medium: Standard parameters.
 */
export function getDifficultyBKTParameters(
  difficulty: string = 'medium',
  customParams?: Partial<BKTParameters>
): BKTParameters {
  const base = { ...DEFAULT_BKT_PARAMS, ...customParams };
  const diff = (difficulty || 'medium').toLowerCase();

  if (diff === 'easy') {
    return {
      pL0: base.pL0,
      pT: base.pT,
      pG: 0.25,
      pS: 0.05,
    };
  } else if (diff === 'hard') {
    return {
      pL0: base.pL0,
      pT: base.pT,
      pG: 0.10,
      pS: 0.20,
    };
  }

  // Medium / Default
  return {
    pL0: base.pL0,
    pT: base.pT,
    pG: 0.20,
    pS: 0.10,
  };
}

/**
 * Standard Bayesian Knowledge Tracing Bayes Update Rule
 *
 * 1. P(L_t | obs = 1) = [P(L_{t-1}) * (1 - pS)] / [P(L_{t-1}) * (1 - pS) + (1 - P(L_{t-1})) * pG]
 * 2. P(L_t | obs = 0) = [P(L_{t-1}) * pS] / [P(L_{t-1}) * pS + (1 - P(L_{t-1})) * (1 - pG)]
 * 3. Learning step: P(L_t) = P(L_t | obs) + (1 - P(L_t | obs)) * pT
 */
export function calculateBKTUpdate(
  priorMastery: number,
  isCorrect: boolean,
  params: BKTParameters,
  credit?: number
): { posterior: number; prior: number; parameters: BKTParameters } {
  const pL_prev = Math.max(0.01, Math.min(0.99, priorMastery));
  const { pT, pG, pS } = params;

  // Phase 9: Partial credit calibration
  if (credit !== undefined && credit > 0 && credit < 1) {
    const resCorrect = calculateBKTUpdate(priorMastery, true, params);
    const resIncorrect = calculateBKTUpdate(priorMastery, false, params);
    const interpolated = credit * resCorrect.posterior + (1 - credit) * resIncorrect.posterior;
    return {
      prior: pL_prev,
      posterior: Math.max(0.01, Math.min(0.99, Math.round(interpolated * 1000) / 1000)),
      parameters: params,
    };
  }

  let pL_given_obs: number;

  if (isCorrect) {
    const num = pL_prev * (1 - pS);
    const denom = pL_prev * (1 - pS) + (1 - pL_prev) * pG;
    pL_given_obs = denom > 0 ? num / denom : pL_prev;
  } else {
    const num = pL_prev * pS;
    const denom = pL_prev * pS + (1 - pL_prev) * (1 - pG);
    pL_given_obs = denom > 0 ? num / denom : pL_prev;
  }

  // Learning transition update
  const pL_updated = pL_given_obs + (1 - pL_given_obs) * pT;
  const clampedPosterior = Math.max(0.01, Math.min(0.99, pL_updated));

  return {
    prior: pL_prev,
    posterior: clampedPosterior,
    parameters: params,
  };
}

/**
 * Compute confidence metric based on cumulative evidence/trials.
 * As evidence accumulates, confidence increases asymptotically toward 1.0.
 */
export function calculateConfidence(attempts: number): number {
  if (attempts <= 0) return 0.0;
  // Smooth asymptotic confidence: e.g. 1 attempt -> 0.33, 4 -> 0.67, 8 -> 0.80, 18 -> 0.90
  const conf = attempts / (attempts + 2.0);
  return Math.round(conf * 100) / 100;
}

/**
 * Determine mastery category from attempts count and mastery probability.
 */
export function determineMasteryStatus(attempts: number, masteryProbability: number): MasteryStatus {
  if (attempts === 0) return 'unassessed';
  if (masteryProbability < 0.60) return 'developing';
  if (masteryProbability < 0.85) return 'proficient';
  return 'mastered';
}

/**
 * Fetch or initialize a student's topic mastery record.
 */
export async function getOrCreateLearnerRecord(
  userId: string,
  topic: string,
  subtopic?: string | null,
  courseId?: string | null
): Promise<{
  id: string;
  userId: string;
  courseId: string | null;
  topic: string;
  subtopic: string | null;
  masteryProbability: number;
  attempts: number;
  correctCount: number;
  incorrectCount: number;
  confidence: number;
  status: MasteryStatus;
  lastAssessedAt: Date | null;
  isNew: boolean;
}> {
  await ensureLearnerSchema();

  const query = subtopic
    ? 'SELECT * FROM learner_mastery WHERE userId = ? AND topic = ? AND subtopic = ? LIMIT 1'
    : "SELECT * FROM learner_mastery WHERE userId = ? AND topic = ? AND (subtopic IS NULL OR subtopic = '') LIMIT 1";

  const params = subtopic ? [userId, topic, subtopic] : [userId, topic];
  const rows: any[] = await prisma.$queryRawUnsafe(query, ...params);

  if (rows && rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      courseId: r.courseId,
      topic: r.topic,
      subtopic: r.subtopic,
      masteryProbability: Number(r.masteryProbability),
      attempts: Number(r.attempts),
      correctCount: Number(r.correctCount),
      incorrectCount: Number(r.incorrectCount),
      confidence: Number(r.confidence),
      status: r.status as MasteryStatus,
      lastAssessedAt: r.lastAssessedAt ? new Date(r.lastAssessedAt) : null,
      isNew: false,
    };
  }

  // Unassessed cold-start record
  const newId = `lm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: newId,
    userId,
    courseId: courseId || null,
    topic,
    subtopic: subtopic || null,
    masteryProbability: 0.0,
    attempts: 0,
    correctCount: 0,
    incorrectCount: 0,
    confidence: 0.0,
    status: 'unassessed',
    lastAssessedAt: null,
    isNew: true,
  };
}

/**
 * Record an auditable learner update event.
 */
export async function logLearnerEvent(event: {
  userId: string;
  topic: string;
  subtopic?: string | null;
  eventType: LearnerEventType;
  sourceId?: string | null;
  priorMastery: number;
  posteriorMastery: number;
  isCorrect?: boolean | null;
  difficulty?: string | null;
  parameters: BKTParameters;
  evidenceDetails?: string | null;
}): Promise<string> {
  await ensureLearnerSchema();
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO learner_events (id, userId, topic, subtopic, eventType, sourceId, priorMastery, posteriorMastery, isCorrect, difficulty, parametersJson, evidenceDetails, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    eventId,
    event.userId,
    event.topic,
    event.subtopic || null,
    event.eventType,
    event.sourceId || null,
    event.priorMastery,
    event.posteriorMastery,
    event.isCorrect !== undefined ? (event.isCorrect ? 1 : 0) : null,
    event.difficulty || null,
    JSON.stringify(event.parameters),
    event.evidenceDetails || null,
    new Date().toISOString()
  );

  return eventId;
}

/**
 * Update topic mastery from a question response or assessment evidence.
 */
export async function updateMasteryFromEvidence(params: {
  userId: string;
  topic: string;
  subtopic?: string | null;
  isCorrect: boolean;
  credit?: number;
  difficulty?: string;
  sourceId?: string;
  eventType?: LearnerEventType;
  customParameters?: Partial<BKTParameters>;
  evidenceDetails?: string;
}): Promise<{
  topic: string;
  subtopic: string | null;
  priorMastery: number;
  masteryProbability: number;
  attempts: number;
  confidence: number;
  status: MasteryStatus;
  bktParams: BKTParameters;
}> {
  await ensureLearnerSchema();
  const record = await getOrCreateLearnerRecord(params.userId, params.topic, params.subtopic);

  // If cold-start (attempts == 0), initialize prior from pL0
  const bktParams = getDifficultyBKTParameters(params.difficulty || 'medium', params.customParameters);
  const prior = record.attempts === 0 ? bktParams.pL0 : record.masteryProbability;

  const { posterior } = calculateBKTUpdate(prior, params.isCorrect, bktParams, params.credit);

  const attempts = record.attempts + 1;
  const isFullCredit = params.credit !== undefined ? params.credit >= 0.75 : params.isCorrect;
  const correctCount = record.correctCount + (isFullCredit ? 1 : 0);
  const incorrectCount = record.incorrectCount + (isFullCredit ? 0 : 1);
  const confidence = calculateConfidence(attempts);
  const status = determineMasteryStatus(attempts, posterior);
  const now = new Date().toISOString();

  if (record.isNew) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO learner_mastery (id, userId, courseId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, lastAssessedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      params.userId,
      null,
      params.topic,
      params.subtopic || null,
      posterior,
      attempts,
      correctCount,
      incorrectCount,
      confidence,
      status,
      now,
      now,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE learner_mastery 
       SET masteryProbability = ?, attempts = ?, correctCount = ?, incorrectCount = ?, confidence = ?, status = ?, lastAssessedAt = ?, updatedAt = ?
       WHERE id = ?`,
      posterior,
      attempts,
      correctCount,
      incorrectCount,
      confidence,
      status,
      now,
      now,
      record.id
    );
  }

  // Log auditable event
  await logLearnerEvent({
    userId: params.userId,
    topic: params.topic,
    subtopic: params.subtopic,
    eventType: params.eventType || 'ASSESSMENT_ANSWER',
    sourceId: params.sourceId,
    priorMastery: prior,
    posteriorMastery: posterior,
    isCorrect: params.isCorrect,
    difficulty: params.difficulty,
    parameters: bktParams,
    evidenceDetails: params.evidenceDetails || `Assessment response (${params.isCorrect ? 'Correct' : 'Incorrect'})`,
  });

  return {
    topic: params.topic,
    subtopic: params.subtopic || null,
    priorMastery: prior,
    masteryProbability: posterior,
    attempts,
    confidence,
    status,
    bktParams,
  };
}

/**
 * Cold-Start Diagnostic Initialization
 * When no history exists, diagnostic results initialize P(L0) directly.
 */
export async function initializeDiagnosticMastery(params: {
  userId: string;
  topic: string;
  subtopic?: string | null;
  score: number;
  totalQuestions: number;
  sourceId?: string;
}): Promise<{
  topic: string;
  masteryProbability: number;
  status: MasteryStatus;
  attempts: number;
  confidence: number;
}> {
  await ensureLearnerSchema();
  const total = Math.max(1, params.totalQuestions);
  const ratio = params.score / total;

  // Initialize P(L0) within sensible bounds [0.10, 0.90] based on diagnostic ratio
  const pL0_init = Math.max(0.10, Math.min(0.90, Math.round(ratio * 100) / 100));
  const attempts = total;
  const correctCount = params.score;
  const incorrectCount = total - params.score;
  const confidence = calculateConfidence(attempts);
  const status = determineMasteryStatus(attempts, pL0_init);
  const now = new Date().toISOString();

  const record = await getOrCreateLearnerRecord(params.userId, params.topic, params.subtopic);

  if (record.isNew) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO learner_mastery (id, userId, courseId, topic, subtopic, masteryProbability, attempts, correctCount, incorrectCount, confidence, status, lastAssessedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      params.userId,
      null,
      params.topic,
      params.subtopic || null,
      pL0_init,
      attempts,
      correctCount,
      incorrectCount,
      confidence,
      status,
      now,
      now,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE learner_mastery 
       SET masteryProbability = ?, attempts = ?, correctCount = ?, incorrectCount = ?, confidence = ?, status = ?, lastAssessedAt = ?, updatedAt = ?
       WHERE id = ?`,
      pL0_init,
      attempts,
      correctCount,
      incorrectCount,
      confidence,
      status,
      now,
      now,
      record.id
    );
  }

  await logLearnerEvent({
    userId: params.userId,
    topic: params.topic,
    subtopic: params.subtopic,
    eventType: 'DIAGNOSTIC_ASSESSMENT',
    sourceId: params.sourceId,
    priorMastery: 0.0,
    posteriorMastery: pL0_init,
    isCorrect: ratio >= 0.5,
    difficulty: 'diagnostic',
    parameters: { ...DEFAULT_BKT_PARAMS, pL0: pL0_init },
    evidenceDetails: `Diagnostic test completed: ${params.score}/${total} (${Math.round(ratio * 100)}%)`,
  });

  return {
    topic: params.topic,
    masteryProbability: pL0_init,
    status,
    attempts,
    confidence,
  };
}

/**
 * Query all mastery records for an authenticated student.
 */
export async function getAllLearnerMastery(userId: string): Promise<any[]> {
  await ensureLearnerSchema();
  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_mastery WHERE userId = ? ORDER BY updatedAt DESC',
    userId
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    courseId: r.courseId,
    topic: r.topic,
    subtopic: r.subtopic,
    masteryProbability: Number(r.masteryProbability),
    masteryPercentage: Math.round(Number(r.masteryProbability) * 100),
    attempts: Number(r.attempts),
    correctCount: Number(r.correctCount),
    incorrectCount: Number(r.incorrectCount),
    confidence: Number(r.confidence),
    status: r.status as MasteryStatus,
    lastAssessedAt: r.lastAssessedAt,
  }));
}

/**
 * Query specific topic mastery for an authenticated student.
 */
export async function getTopicLearnerMastery(userId: string, topic: string): Promise<any> {
  await ensureLearnerSchema();
  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_mastery WHERE userId = ? AND topic = ? ORDER BY updatedAt DESC',
    userId,
    topic
  );

  if (!rows || rows.length === 0) {
    // Return unassessed cold-start state
    return {
      userId,
      topic,
      subtopic: null,
      masteryProbability: 0.0,
      masteryPercentage: 0,
      attempts: 0,
      correctCount: 0,
      incorrectCount: 0,
      confidence: 0.0,
      status: 'unassessed' as MasteryStatus,
      lastAssessedAt: null,
    };
  }

  const primary = rows[0];
  const subtopics = rows.filter((r) => r.subtopic).map((r) => ({
    subtopic: r.subtopic,
    masteryProbability: Number(r.masteryProbability),
    status: r.status,
    attempts: Number(r.attempts),
  }));

  return {
    id: primary.id,
    userId: primary.userId,
    topic: primary.topic,
    subtopic: primary.subtopic,
    masteryProbability: Number(primary.masteryProbability),
    masteryPercentage: Math.round(Number(primary.masteryProbability) * 100),
    attempts: Number(primary.attempts),
    correctCount: Number(primary.correctCount),
    incorrectCount: Number(primary.incorrectCount),
    confidence: Number(primary.confidence),
    status: primary.status as MasteryStatus,
    lastAssessedAt: primary.lastAssessedAt,
    subtopics,
  };
}

/**
 * Query auditable learner events for an authenticated student.
 */
export async function getLearnerEventHistory(userId: string, limit: number = 50): Promise<any[]> {
  await ensureLearnerSchema();
  const rows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_events WHERE userId = ? ORDER BY timestamp DESC LIMIT ?',
    userId,
    limit
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    topic: r.topic,
    subtopic: r.subtopic,
    eventType: r.eventType,
    sourceId: r.sourceId,
    priorMastery: Number(r.priorMastery),
    posteriorMastery: Number(r.posteriorMastery),
    isCorrect: r.isCorrect === 1,
    difficulty: r.difficulty,
    parameters: r.parametersJson ? JSON.parse(r.parametersJson) : null,
    evidenceDetails: r.evidenceDetails,
    timestamp: r.timestamp,
  }));
}
