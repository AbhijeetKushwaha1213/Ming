/**
 * Centralized Production Configuration Validator
 * Validates environment, credentials, and data plane configurations.
 * Enforces fail-closed security invariants in production.
 * Never exposes raw secret values in logs or diagnostics.
 */

export type EnvironmentMode = 'development' | 'test' | 'staging' | 'production';

export interface ValidationResult {
  valid: boolean;
  environment: EnvironmentMode;
  errors: string[];
  warnings: string[];
  publicConfig: {
    environment: EnvironmentMode;
    vectorStore: string;
    databaseDialect: 'postgresql' | 'sqlite';
    embeddingModel: string;
    embeddingDimension: number;
    supabaseConfigured: boolean;
    geminiConfigured: boolean;
    authBypassAllowed: boolean;
  };
}

export function maskSecret(secret?: string): string {
  if (!secret) return '(not set)';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function validateProductionConfig(): ValidationResult {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase() as EnvironmentMode;
  const isProductionLike = env === 'production' || env === 'staging';
  const errors: string[] = [];
  const warnings: string[] = [];

  const vectorStore = (process.env.VECTOR_STORE || 'chroma').toLowerCase().trim();
  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  const directUrl = process.env.DIRECT_URL?.trim() || '';
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  const allowDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true';

  const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

  // 1. VectorStore Validation
  if (isProductionLike && vectorStore !== 'pgvector') {
    errors.push(`Production/Staging requires VECTOR_STORE='pgvector'. Current: '${vectorStore}'.`);
  }

  if (vectorStore === 'pgvector') {
    const hasPgConfig = isPostgres || Boolean(supabaseUrl) || Boolean(process.env.PGVECTOR_URL) || process.env.PGVECTOR_TEST_LOCAL === '1';
    if (!hasPgConfig) {
      errors.push("VECTOR_STORE is set to 'pgvector', but required PostgreSQL/Supabase configuration is missing.");
    }
  }

  // 2. Database Validation
  if (isProductionLike && !isPostgres) {
    errors.push('Production/Staging requires a PostgreSQL DATABASE_URL connection string (postgres:// or postgresql://).');
  }

  if (isProductionLike && !directUrl) {
    warnings.push('DIRECT_URL is not configured. Direct connections are recommended for Prisma migrations alongside pooled DATABASE_URL.');
  }

  // 3. Supabase Auth Validation
  if (!supabaseUrl) {
    if (isProductionLike) {
      errors.push('SUPABASE_URL is required in production/staging for user authentication.');
    } else {
      warnings.push('SUPABASE_URL is not set. Local development auth bypass will be used.');
    }
  }

  if (!supabaseKey && isProductionLike) {
    errors.push('SUPABASE_PUBLISHABLE_KEY / ANON_KEY is required in production/staging for JWT verification.');
  }

  // 4. AI Provider Gateway Validation
  if (!geminiKey) {
    if (isProductionLike) {
      errors.push('GEMINI_API_KEY is required in production/staging for grounded tutor and AI services.');
    } else {
      warnings.push('GEMINI_API_KEY is not set. AI generation endpoints will return 503.');
    }
  }

  // 5. Security Invariant: Disallow Auth Bypass in Production & Staging
  if (isProductionLike && allowDevBypass) {
    errors.push('CRITICAL SECURITY VIOLATION: ALLOW_DEV_AUTH_BYPASS cannot be true in production or staging.');
  }

  const valid = errors.length === 0;

  return {
    valid,
    environment: env,
    errors,
    warnings,
    publicConfig: {
      environment: env,
      vectorStore,
      databaseDialect: isPostgres ? 'postgresql' : 'sqlite',
      embeddingModel: 'all-MiniLM-L6-v2',
      embeddingDimension: 384,
      supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
      geminiConfigured: Boolean(geminiKey),
      authBypassAllowed: !isProductionLike && allowDevBypass,
    },
  };
}

/**
 * Asserts valid configuration at server startup.
 * Throws a fatal error if production invariants are violated.
 */
export function assertValidConfiguration(): void {
  const result = validateProductionConfig();

  if (!result.valid) {
    const errorMsg = [
      '=================================================================',
      '🚨 FATAL SERVER STARTUP CONFIGURATION ERROR',
      '=================================================================',
      ...result.errors.map((e) => `  ❌ ${e}`),
      '=================================================================',
    ].join('\n');

    throw new Error(errorMsg);
  }

  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => console.warn(`⚠️ Config Warning: ${w}`));
  }
}
