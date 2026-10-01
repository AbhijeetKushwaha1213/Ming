import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

declare global {
  // eslint-disable-next-line no-var
  var __academiaPrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const adapter = new PrismaLibSQL({
    url,
    ...(authToken ? { authToken } : {}),
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
      fingerprint TEXT NOT NULL,
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

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_questions_user_fingerprint_idx ON assessment_questions(userId, fingerprint)',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS assessment_questions_user_topic_idx ON assessment_questions(userId, topic)',
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
}

export async function ensureAssessmentSchema() {
  if (!assessmentSchemaPromise) {
    assessmentSchemaPromise = createAssessmentSchema();
  }

  return assessmentSchemaPromise;
}

