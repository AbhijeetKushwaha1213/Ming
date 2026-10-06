import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
      }),
    },
  },
  isLocalMode: vi.fn().mockReturnValue(false),
}));
