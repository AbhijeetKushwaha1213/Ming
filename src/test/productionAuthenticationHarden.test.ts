import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authenticateRequest,
  resolveContextUser,
  isAuthorizedTestClockRequest,
  AuthError,
} from '../../server/authMiddleware.ts';
import * as supabaseAuth from '../../server/supabaseAuth.ts';

describe('Production Authentication & Identity Derivation Hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.MING_TEST_SECRET = 'super_secret_test_key_xyz';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Production Rejection of Unauthenticated Requests & Header Spoofing', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_DEV_AUTH_BYPASS;
    });

    it('rejects unauthenticated request supplying x-ming-user-id in production', async () => {
      const mockReq = {
        headers: {
          'x-ming-user-id': 'victim_tenant_123',
        },
      } as any;

      await expect(resolveContextUser(mockReq)).rejects.toThrow(AuthError);
      await expect(authenticateRequest(mockReq)).rejects.toThrow(AuthError);
    });

    it('rejects unauthenticated request supplying x-dev-user-id in production', async () => {
      const mockReq = {
        headers: {
          'x-dev-user-id': 'victim_tenant_123',
        },
      } as any;

      await expect(resolveContextUser(mockReq)).rejects.toThrow(AuthError);
      await expect(authenticateRequest(mockReq)).rejects.toThrow(AuthError);
    });

    it('rejects unauthenticated request supplying forged or wrong x-ming-test-key in production', async () => {
      const mockReq = {
        headers: {
          'x-ming-test-key': 'attacker_unauthorized_key',
          'x-ming-user-id': 'victim_tenant_123',
        },
      } as any;

      await expect(resolveContextUser(mockReq)).rejects.toThrow(AuthError);
      await expect(authenticateRequest(mockReq)).rejects.toThrow(AuthError);
    });

    it('rejects unauthenticated request when MING_TEST_SECRET is not configured in production', async () => {
      delete process.env.MING_TEST_SECRET;
      const mockReq = {
        headers: {
          'x-ming-test-key': 'test_internal_secret',
          'x-ming-user-id': 'victim_tenant_123',
        },
      } as any;

      await expect(resolveContextUser(mockReq)).rejects.toThrow(AuthError);
      await expect(authenticateRequest(mockReq)).rejects.toThrow(AuthError);
    });

    it('strictly forbids test clock override in production even with valid test key', () => {
      const mockReq = {
        headers: {
          'x-ming-test-key': 'super_secret_test_key_xyz',
        },
      };

      expect(isAuthorizedTestClockRequest(mockReq)).toBe(false);
    });

    it('rejects invalid or expired Bearer token in production with 401', async () => {
      vi.spyOn(supabaseAuth, 'verifySupabaseToken').mockRejectedValue(new Error('JWT expired'));

      const mockReq = {
        headers: {
          authorization: 'Bearer expired_token_xyz',
          'x-ming-user-id': 'victim_tenant_123',
        },
      } as any;

      await expect(resolveContextUser(mockReq)).rejects.toThrow(AuthError);
      await expect(authenticateRequest(mockReq)).rejects.toThrow(AuthError);
    });
  });

  describe('2. Verified Learner Session with Forged Identity Header', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('derives identity strictly from verified token and ignores forged x-ming-user-id', async () => {
      const legitUser = { id: 'legit_student_user_456', email: 'legit@example.com' };
      vi.spyOn(supabaseAuth, 'verifySupabaseToken').mockResolvedValue(legitUser as any);

      const mockReq = {
        headers: {
          authorization: 'Bearer legit_verified_jwt_token',
          'x-ming-user-id': 'attacker_chosen_victim_789',
          'x-dev-user-id': 'attacker_chosen_victim_789',
        },
      } as any;

      const resolvedUserId = await resolveContextUser(mockReq);
      expect(resolvedUserId).toBe('legit_student_user_456');

      const secContext = await authenticateRequest(mockReq);
      expect(secContext?.userId).toBe('legit_student_user_456');
      expect(secContext?.email).toBe('legit@example.com');
      expect(secContext?.isServiceRole).toBe(false);
    });

    it('derives identity strictly from verified token and ignores forged test key in production', async () => {
      const legitUser = { id: 'legit_student_user_456', email: 'legit@example.com' };
      vi.spyOn(supabaseAuth, 'verifySupabaseToken').mockResolvedValue(legitUser as any);

      const mockReq = {
        headers: {
          authorization: 'Bearer legit_verified_jwt_token',
          'x-ming-test-key': 'super_secret_test_key_xyz',
          'x-ming-user-id': 'spoofed_admin_user',
        },
      } as any;

      const resolvedUserId = await resolveContextUser(mockReq);
      expect(resolvedUserId).toBe('legit_student_user_456');

      const secContext = await authenticateRequest(mockReq);
      expect(secContext?.userId).toBe('legit_student_user_456');
      expect(secContext?.isServiceRole).toBe(false);
    });
  });

  describe('3. Non-Production Development & Automated Test Isolation', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.MING_TEST_SECRET = 'super_secret_test_key_xyz';
    });

    it('permits authorized test key in non-production test runner', async () => {
      const mockReq = {
        headers: {
          'x-ming-test-key': 'super_secret_test_key_xyz',
          'x-ming-user-id': 'test_student_suite',
        },
      } as any;

      const resolvedUserId = await resolveContextUser(mockReq);
      expect(resolvedUserId).toBe('test_student_suite');

      const secContext = await authenticateRequest(mockReq);
      expect(secContext?.userId).toBe('test_student_suite');
      expect(secContext?.isServiceRole).toBe(true);
    });

    it('allows controlled test clock override in test environment with valid test key', () => {
      const mockReq = {
        headers: {
          'x-ming-test-key': 'super_secret_test_key_xyz',
        },
      };

      expect(isAuthorizedTestClockRequest(mockReq)).toBe(true);
    });

    it('rejects test clock override when test key does not match secret', () => {
      const mockReq = {
        headers: {
          'x-ming-test-key': 'wrong_secret',
        },
      };

      expect(isAuthorizedTestClockRequest(mockReq)).toBe(false);
    });
  });
});
