import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

declare global {
  // eslint-disable-next-line no-var
  var __academiaPrisma__: PrismaClient | undefined;
}

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  }

  const adapter = new PrismaLibSQL({
    url,
    authToken,
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
