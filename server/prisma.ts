import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

declare global {
  // eslint-disable-next-line no-var
  var __academiaPrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  const rawTurso = process.env.TURSO_DATABASE_URL?.trim();
  const isTursoConfigured = rawTurso && !rawTurso.includes('your_turso_database_url_here') && (rawTurso.startsWith('libsql://') || rawTurso.startsWith('https://') || rawTurso.startsWith('http://'));
  const url = (isTursoConfigured ? rawTurso : process.env.DATABASE_URL) || 'file:./prisma/dev.db';
  const authToken = isTursoConfigured ? process.env.TURSO_AUTH_TOKEN : undefined;

  const adapter = new PrismaLibSQL({
    url,
    ...(authToken && !authToken.includes('your_turso_auth_token_here') ? { authToken } : {}),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__academiaPrisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__academiaPrisma__ = prisma;
}

let resourceSchemaPromise: Promise<void> | null = null;

async function createResourceSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      noteContent TEXT,
      linkUrl TEXT,
      fileUrl TEXT,
      storagePath TEXT,
      folder TEXT,
      tagsJson TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS resources_userId_createdAt_idx ON resources(userId, createdAt)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS resources_userId_type_idx ON resources(userId, type)',
  );
}

export async function ensureResourceSchema() {
  if (!resourceSchemaPromise) {
    resourceSchemaPromise = createResourceSchema();
  }

  return resourceSchemaPromise;
}

let assessmentSchemaPromise: Promise<void> | null = null;

async function createAssessmentSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assessment_questions (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      assessmentId TEXT,
      fingerprint TEXT NOT NULL,
      normalizedQuestion TEXT,
      type TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      difficulty TEXT NOT NULL,
      sourceId TEXT,
      chunkId TEXT,
      pageNumber INTEGER,
      slideNumber INTEGER,
      timestampStart REAL,
      timestampEnd REAL,
      question TEXT NOT NULL,
      optionsJson TEXT,
      correctAnswer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE assessment_questions ADD COLUMN assessmentId TEXT');
  } catch {}
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE assessment_questions ADD COLUMN normalizedQuestion TEXT');
  } catch {}

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_questions_user_fingerprint_idx ON assessment_questions(userId, fingerprint)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_questions_user_topic_idx ON assessment_questions(userId, topic)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_questions_assessment_id_idx ON assessment_questions(assessmentId)',
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assessment_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      difficulty TEXT NOT NULL,
      score REAL NOT NULL,
      totalQuestions INTEGER NOT NULL,
      correctCount INTEGER NOT NULL,
      percentage REAL NOT NULL,
      questionsJson TEXT NOT NULL,
      answersJson TEXT NOT NULL,
      diagnosticJson TEXT NOT NULL,
      completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_attempts_user_completed_idx ON assessment_attempts(userId, completedAt)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_attempts_user_topic_idx ON assessment_attempts(userId, topic)',
  );

  // Phase 9: Persistent Answer Evaluations Table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assessment_evaluations (
      id TEXT PRIMARY KEY NOT NULL,
      attemptId TEXT NOT NULL,
      userId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      questionText TEXT NOT NULL,
      questionType TEXT NOT NULL,
      userAnswer TEXT NOT NULL,
      correctAnswer TEXT NOT NULL,
      classification TEXT NOT NULL,
      credit REAL NOT NULL,
      feedback TEXT NOT NULL,
      explanation TEXT,
      sourceId TEXT,
      chunkId TEXT,
      sourceCoordinate TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_evaluations_attempt_idx ON assessment_evaluations(attemptId)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_evaluations_user_idx ON assessment_evaluations(userId, createdAt)',
  );

  // Phase 9: Persistent Misconceptions Table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assessment_misconceptions (
      id TEXT PRIMARY KEY NOT NULL,
      attemptId TEXT NOT NULL,
      evaluationId TEXT,
      userId TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      concept TEXT NOT NULL,
      misconceptionType TEXT NOT NULL,
      description TEXT NOT NULL,
      studentAnswer TEXT NOT NULL,
      expectedAnswer TEXT NOT NULL,
      sourceId TEXT,
      chunkId TEXT,
      sourceCoordinate TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_misconceptions_user_topic_idx ON assessment_misconceptions(userId, topic)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_misconceptions_attempt_idx ON assessment_misconceptions(attemptId)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_misconceptions_concept_idx ON assessment_misconceptions(concept)',
  );
}

export async function ensureAssessmentSchema() {
  if (!assessmentSchemaPromise) {
    assessmentSchemaPromise = createAssessmentSchema();
  }

  return assessmentSchemaPromise;
}

let learnerSchemaPromise: Promise<void> | null = null;

async function createLearnerSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS learner_mastery (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      courseId TEXT,
      topic TEXT NOT NULL,
      subtopic TEXT,
      masteryProbability REAL NOT NULL DEFAULT 0.0,
      attempts INTEGER NOT NULL DEFAULT 0,
      correctCount INTEGER NOT NULL DEFAULT 0,
      incorrectCount INTEGER NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'unassessed',
      lastAssessedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_mastery_user_topic_idx ON learner_mastery(userId, topic)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_mastery_user_status_idx ON learner_mastery(userId, status)',
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS learner_events (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      eventType TEXT NOT NULL,
      sourceId TEXT,
      priorMastery REAL NOT NULL,
      posteriorMastery REAL NOT NULL,
      isCorrect BOOLEAN,
      difficulty TEXT,
      parametersJson TEXT,
      evidenceDetails TEXT,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_events_user_time_idx ON learner_events(userId, timestamp)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_events_user_topic_idx ON learner_events(userId, topic)',
  );
}

export async function ensureLearnerSchema() {
  if (!learnerSchemaPromise) {
    learnerSchemaPromise = createLearnerSchema();
  }

  return learnerSchemaPromise;
}

let studyPlanSchemaPromise: Promise<void> | null = null;

async function createStudyPlanSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS study_plans (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      planDate TEXT NOT NULL,
      title TEXT NOT NULL,
      targetMinutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'active',
      summary TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS study_plans_user_date_idx ON study_plans(userId, planDate)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS study_plans_user_status_idx ON study_plans(userId, status)',
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS study_plan_items (
      id TEXT PRIMARY KEY NOT NULL,
      planId TEXT NOT NULL,
      userId TEXT NOT NULL,
      priority INTEGER NOT NULL,
      priorityScore REAL NOT NULL,
      topic TEXT NOT NULL,
      subtopic TEXT,
      activityType TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      estimatedMinutes INTEGER NOT NULL,
      reason TEXT NOT NULL,
      expectedOutcome TEXT NOT NULL,
      sourceId TEXT,
      chunkId TEXT,
      sourceTitle TEXT,
      sourceCoordinate TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      completedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS study_plan_items_user_plan_idx ON study_plan_items(userId, planId)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS study_plan_items_user_status_idx ON study_plan_items(userId, status)',
  );
}

export async function ensureStudyPlanSchema() {
  if (!studyPlanSchemaPromise) {
    studyPlanSchemaPromise = createStudyPlanSchema();
  }

  return studyPlanSchemaPromise;
}

let videoSchemaPromise: Promise<void> | null = null;

async function createVideoSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      youtubeUrl TEXT,
      youtubeVideoId TEXT,
      storagePath TEXT,
      fileUrl TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      durationSeconds REAL NOT NULL DEFAULT 0,
      thumbnailUrl TEXT,
      transcriptStatus TEXT NOT NULL DEFAULT 'pending',
      transcriptJson TEXT,
      errorMessage TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS videos_userId_createdAt_idx ON videos(userId, createdAt)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS videos_userId_sourceType_idx ON videos(userId, sourceType)',
  );
}

export async function ensureVideoSchema() {
  if (!videoSchemaPromise) {
    videoSchemaPromise = createVideoSchema();
  }

  return videoSchemaPromise;
}



