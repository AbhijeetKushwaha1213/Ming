import * as nodeModule from 'node:module';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

function getRequire() {
  if (typeof (nodeModule as any)?.createRequire === 'function') {
    return (nodeModule as any).createRequire(import.meta.url);
  }
  if (typeof (nodeModule as any)?.default?.createRequire === 'function') {
    return (nodeModule as any).default.createRequire(import.meta.url);
  }
  if (typeof (globalThis as any).require === 'function') {
    return (globalThis as any).require;
  }
  return null;
}

declare global {
  // eslint-disable-next-line no-var
  var __academiaPrisma__: PrismaClient | undefined;
}

export function isPostgresDatabase(): boolean {
  const url = process.env.DATABASE_URL?.trim() || '';
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

export function adaptSqlForDialect(query: string): string {
  if (isPostgresDatabase()) {
    let paramIndex = 1;
    let adapted = query.replace(/\?/g, () => `$${paramIndex++}`);
    adapted = adapted.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');
    return adapted;
  }
  return query;
}

function wrapClientWithDialectAdapter(rawClient: any): PrismaClient {
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === '$queryRawUnsafe') {
        return (query: string, ...values: any[]) => {
          const adapted = adaptSqlForDialect(query);
          return target.$queryRawUnsafe(adapted, ...values);
        };
      }
      if (prop === '$executeRawUnsafe') {
        return (query: string, ...values: any[]) => {
          const adapted = adaptSqlForDialect(query);
          return target.$executeRawUnsafe(adapted, ...values);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  };
  return new Proxy(rawClient, handler);
}

function createPrismaClient(): PrismaClient {
  let baseClient: any;

  if (isPostgresDatabase()) {
    try {
      const requireFn = getRequire();
      if (!requireFn) {
        throw new Error('createRequire is not available in the current execution context');
      }
      const pgModule = requireFn('../prisma/generated-pg-client/index.js');
      baseClient = new pgModule.PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });
    } catch (err) {
      console.error('Failed to initialize PostgreSQL Prisma client:', err);
      throw err;
    }
  } else {
    const rawTurso = process.env.TURSO_DATABASE_URL?.trim();
    const isTursoConfigured = rawTurso && !rawTurso.includes('your_turso_database_url_here') && (rawTurso.startsWith('libsql://') || rawTurso.startsWith('https://') || rawTurso.startsWith('http://'));
    const url = (isTursoConfigured ? rawTurso : process.env.DATABASE_URL) || 'file:./prisma/dev.db';
    const authToken = isTursoConfigured ? process.env.TURSO_AUTH_TOKEN : undefined;

    const adapter = new PrismaLibSQL({
      url,
      ...(authToken && !authToken.includes('your_turso_auth_token_here') ? { authToken } : {}),
    });

    baseClient = new PrismaClient({ adapter });
  }

  return wrapClientWithDialectAdapter(baseClient);
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
      idempotencyKey TEXT,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE learner_events ADD COLUMN idempotencyKey TEXT');
  } catch {}

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_events_user_time_idx ON learner_events(userId, timestamp)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learner_events_user_topic_idx ON learner_events(userId, topic)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS learner_events_idempotency_idx ON learner_events(idempotencyKey)',
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
      conceptId TEXT,
      category TEXT,
      questionId TEXT,
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

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE study_plan_items ADD COLUMN conceptId TEXT');
  } catch {}
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE study_plan_items ADD COLUMN category TEXT');
  } catch {}
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE study_plan_items ADD COLUMN questionId TEXT');
  } catch {}
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

let dagSchemaPromise: Promise<void> | null = null;

async function createDAGSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS learning_dags (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      courseId TEXT,
      topic TEXT NOT NULL,
      subtopic TEXT,
      sourceMaterialIds TEXT,
      graphDepth TEXT NOT NULL DEFAULT 'Standard',
      learningGoal TEXT NOT NULL DEFAULT 'Concept Mastery',
      nodesJson TEXT NOT NULL,
      edgesJson TEXT,
      masteryStatesJson TEXT,
      sourceReferencesJson TEXT,
      progressStatus TEXT NOT NULL DEFAULT 'active',
      progressPercent REAL NOT NULL DEFAULT 0.0,
      currentConceptId TEXT,
      nextConceptId TEXT,
      totalConcepts INTEGER NOT NULL DEFAULT 0,
      masteredConcepts INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastOpenedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learning_dags_userId_updatedAt_idx ON learning_dags(userId, updatedAt)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS learning_dags_userId_topic_idx ON learning_dags(userId, topic)',
  );
}

export async function ensureDAGSchema() {
  if (!dagSchemaPromise) {
    dagSchemaPromise = createDAGSchema();
  }

  return dagSchemaPromise;
}

let ingestionSchemaPromise: Promise<void> | null = null;

async function createIngestionSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ingestion_records (
      id TEXT PRIMARY KEY NOT NULL,
      resourceId TEXT NOT NULL,
      userId TEXT NOT NULL,
      tenantType TEXT NOT NULL DEFAULT 'USER_PRIVATE',
      documentId TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      status TEXT NOT NULL,
      contentHash TEXT NOT NULL,
      chunkCount INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      metricsJson TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS ingestion_records_userId_resourceId_idx ON ingestion_records(userId, resourceId)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS ingestion_records_userId_contentHash_idx ON ingestion_records(userId, contentHash)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS ingestion_records_userId_status_idx ON ingestion_records(userId, status)',
  );
}

export async function ensureIngestionSchema() {
  if (!ingestionSchemaPromise) {
    ingestionSchemaPromise = createIngestionSchema();
  }

  return ingestionSchemaPromise;
}

export async function upsertIngestionRecord(data: {
  id?: string;
  resourceId: string;
  userId: string;
  tenantType?: string;
  documentId: string;
  sourceType: string;
  status: string;
  contentHash: string;
  chunkCount?: number;
  error?: string | null;
  metricsJson?: string | null;
}) {
  await ensureIngestionSchema();
  const existing = await getIngestionRecord(data.resourceId, data.userId);
  const now = new Date().toISOString();

  if (existing) {
    await prisma.$executeRawUnsafe(
      `UPDATE ingestion_records SET
        status = ?,
        chunkCount = ?,
        error = ?,
        metricsJson = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE resourceId = ? AND userId = ?`,
      data.status,
      data.chunkCount ?? existing.chunkCount,
      data.error !== undefined ? data.error : existing.error,
      data.metricsJson !== undefined ? data.metricsJson : existing.metricsJson,
      data.resourceId,
      data.userId,
    );
    return getIngestionRecord(data.resourceId, data.userId);
  }

  const recordId = data.id || `ing_${data.resourceId}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO ingestion_records (
      id, resourceId, userId, tenantType, documentId, sourceType, status, contentHash, chunkCount, error, metricsJson, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    recordId,
    data.resourceId,
    data.userId,
    data.tenantType || 'USER_PRIVATE',
    data.documentId,
    data.sourceType,
    data.status,
    data.contentHash,
    data.chunkCount || 0,
    data.error || null,
    data.metricsJson || null,
  );

  return getIngestionRecord(data.resourceId, data.userId);
}

export async function getIngestionRecord(resourceId: string, userId: string): Promise<any | null> {
  await ensureIngestionSchema();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT * FROM ingestion_records WHERE resourceId = ? AND userId = ? LIMIT 1`,
    resourceId,
    userId,
  )) as any[];

  return rows && rows.length > 0 ? rows[0] : null;
}

export async function updateIngestionStatus(
  resourceId: string,
  userId: string,
  status: string,
  extra: { error?: string | null; chunkCount?: number; metricsJson?: string | null } = {},
) {
  await ensureIngestionSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE ingestion_records SET
      status = ?,
      error = COALESCE(?, error),
      chunkCount = COALESCE(?, chunkCount),
      metricsJson = COALESCE(?, metricsJson),
      updatedAt = CURRENT_TIMESTAMP
    WHERE resourceId = ? AND userId = ?`,
    status,
    extra.error ?? null,
    extra.chunkCount ?? null,
    extra.metricsJson ?? null,
    resourceId,
    userId,
  );
  return getIngestionRecord(resourceId, userId);
}

let analyticsSchemaPromise: Promise<void> | null = null;

async function createAnalyticsSchema() {
  const isPg = isPostgresDatabase();
  const createSql = isPg
    ? `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_properties_json TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    : `CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY NOT NULL,
        userId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        eventPropertiesJson TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;

  await prisma.$executeRawUnsafe(createSql);

  const idxUserTime = isPg
    ? 'CREATE INDEX IF NOT EXISTS analytics_events_user_time_idx ON analytics_events(user_id, timestamp)'
    : 'CREATE INDEX IF NOT EXISTS analytics_events_user_time_idx ON analytics_events(userId, timestamp)';

  const idxUserType = isPg
    ? 'CREATE INDEX IF NOT EXISTS analytics_events_user_type_idx ON analytics_events(user_id, event_type)'
    : 'CREATE INDEX IF NOT EXISTS analytics_events_user_type_idx ON analytics_events(userId, eventType)';

  await prisma.$executeRawUnsafe(idxUserTime);
  await prisma.$executeRawUnsafe(idxUserType);
}

export async function ensureAnalyticsSchema(): Promise<void> {
  if (!analyticsSchemaPromise) {
    analyticsSchemaPromise = createAnalyticsSchema().catch((err: any) => {
      analyticsSchemaPromise = null;
      if (err?.message?.includes('already exists')) {
        return;
      }
      throw err;
    });
  }

  return analyticsSchemaPromise;
}
