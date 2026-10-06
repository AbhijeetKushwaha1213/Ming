import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { isOnboardingComplete, getPostAuthDestination, ROUTES } from '../components/auth/authNavigation';
import {
  ProtectedRoute,
  OnboardingRoute,
  PublicAuthRoute,
  RootRedirectRoute,
} from '../components/auth/RouteGuards';
import { SignInPage } from '../components/auth/SignInPage';

// Mocks for useAuth
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockResendVerificationEmail = vi.fn();
const mockSignOut = vi.fn();

let mockAuthState = {
  user: null as any,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    ...mockAuthState,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    resendVerificationEmail: mockResendVerificationEmail,
    signOut: mockSignOut,
    resetPasswordForEmail: vi.fn(),
    verifyOtpForPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('StudyMate Production-Ready Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
  });

  describe('Centralized Destination Controller (authNavigation)', () => {
    it('correctly determines incomplete onboarding', () => {
      // Null or empty user
      expect(isOnboardingComplete(null)).toBe(false);

      // Incomplete exam profile
      expect(
        isOnboardingComplete({
          id: '1',
          user_id: '1',
          name: 'Alice',
          email: 'alice@test.com',
          userType: 'exam',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(false);

      // Incomplete college profile (missing college)
      expect(
        isOnboardingComplete({
          id: '2',
          user_id: '2',
          name: 'Bob',
          email: 'bob@test.com',
          userType: 'college',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(false);
    });

    it('correctly determines complete onboarding', () => {
      // Complete exam profile
      expect(
        isOnboardingComplete({
          id: '1',
          user_id: '1',
          name: 'Alice',
          email: 'alice@test.com',
          userType: 'exam',
          examType: 'GATE',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(true);

      // Complete college profile
      expect(
        isOnboardingComplete({
          id: '2',
          user_id: '2',
          name: 'Bob',
          email: 'bob@test.com',
          userType: 'college',
          college: 'IIT Delhi',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(true);
    });

    it('routes incomplete profiles to /onboarding and complete profiles to /dashboard', () => {
      expect(getPostAuthDestination(null)).toBe(ROUTES.ONBOARDING);
      expect(
        getPostAuthDestination({
          id: '1',
          user_id: '1',
          name: 'New User',
          email: 'new@test.com',
          userType: 'exam',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(ROUTES.ONBOARDING);

      expect(
        getPostAuthDestination({
          id: '2',
          user_id: '2',
          name: 'Completed User',
          email: 'complete@test.com',
          userType: 'exam',
          examType: 'NEET',
          study_streak: 0,
          total_study_hours: 0,
          current_level: 1,
          experience_points: 0,
        })
      ).toBe(ROUTES.DASHBOARD);
    });
  });

  describe('Route Guards & Protected Routes', () => {
    it('ProtectedRoute: displays loading screen while resolving auth state', () => {
      mockAuthState.isLoading = true;
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/Checking your session\.\.\./i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('ProtectedRoute: redirects unauthenticated user to /login', () => {
      mockAuthState.isLoading = false;
      mockAuthState.isAuthenticated = false;
      mockAuthState.user = null;

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('ProtectedRoute: redirects incomplete user to /onboarding', () => {
      mockAuthState.isLoading = false;
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = {
        id: 'u1',
        user_id: 'u1',
        name: 'Incomplete User',
        email: 'user@test.com',
        userType: 'exam',
        study_streak: 0,
        total_study_hours: 0,
        current_level: 1,
        experience_points: 0,
      };

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/onboarding" element={<div>Onboarding Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('ProtectedRoute: allows authenticated & completed user to view /dashboard', () => {
      mockAuthState.isLoading = false;
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = {
        id: 'u1',
        user_id: 'u1',
        name: 'Complete User',
        email: 'user@test.com',
        userType: 'exam',
        examType: 'JEE',
        study_streak: 0,
        total_study_hours: 0,
        current_level: 1,
        experience_points: 0,
      };

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('PublicAuthRoute: redirects already authenticated users away from /login', () => {
      mockAuthState.isLoading = false;
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = {
        id: 'u1',
        user_id: 'u1',
        name: 'Active User',
        email: 'active@test.com',
        userType: 'exam',
        examType: 'JEE',
        study_streak: 0,
        total_study_hours: 0,
        current_level: 1,
        experience_points: 0,
      };

      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<PublicAuthRoute />} />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign In/i })).not.toBeInTheDocument();
    });

    it('RootRedirectRoute: redirects unauthenticated users to /landing and authenticated users to destination', () => {
      // Unauthenticated
      mockAuthState.isAuthenticated = false;
      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootRedirectRoute />} />
            <Route path="/landing" element={<div>Public Landing Page</div>} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Public Landing Page')).toBeInTheDocument();
      unmount();

      // Authenticated with complete profile
      mockAuthState.isAuthenticated = true;
      mockAuthState.user = {
        id: 'u1',
        user_id: 'u1',
        name: 'Active User',
        email: 'active@test.com',
        userType: 'exam',
        examType: 'JEE',
        study_streak: 0,
        total_study_hours: 0,
        current_level: 1,
        experience_points: 0,
      };

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<RootRedirectRoute />} />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });

  describe('SignInPage UX & Separation of Flows', () => {
    it('renders Continue with Google and Email/Password clearly separated by OR', () => {
      render(
        <MemoryRouter>
          <SignInPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    });

    it('renders Name, Email, Password, and Confirm Password on Sign Up tab', () => {
      render(
        <MemoryRouter>
          <SignInPage initialTab="signup" />
        </MemoryRouter>
      );

      expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
    });

    it('validates matching passwords on Sign Up', async () => {
      const { container } = render(
        <MemoryRouter>
          <SignInPage initialTab="signup" />
        </MemoryRouter>
      );

      fireEvent.change(container.querySelector('#signup-name')!, { target: { value: 'Jane Doe' } });
      fireEvent.change(container.querySelector('#signup-email')!, { target: { value: 'jane@example.com' } });
      fireEvent.change(container.querySelector('#signup-password')!, { target: { value: 'Password123' } });
      fireEvent.change(container.querySelector('#signup-confirm-password')!, { target: { value: 'Mismatch999' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      });
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('when email confirmation is DISABLED: immediately authenticates without false email-sent message', async () => {
      const mockCreatedUser = {
        id: 'new-id',
        user_id: 'new-id',
        name: 'New Student',
        email: 'student@example.com',
        userType: 'exam' as const,
        study_streak: 0,
        total_study_hours: 0,
        current_level: 1,
        experience_points: 0,
      };

      mockSignUp.mockResolvedValueOnce({
        requiresVerification: false,
        email: 'student@example.com',
        user: mockCreatedUser,
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignInPage initialTab="signup" />} />
            <Route path="/onboarding" element={<div>Onboarding Target Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(container.querySelector('#signup-name')!, { target: { value: 'New Student' } });
      fireEvent.change(container.querySelector('#signup-email')!, { target: { value: 'student@example.com' } });
      fireEvent.change(container.querySelector('#signup-password')!, { target: { value: 'StrongPass123' } });
      fireEvent.change(container.querySelector('#signup-confirm-password')!, { target: { value: 'StrongPass123' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('student@example.com', 'StrongPass123', 'New Student');
        expect(screen.getByText('Onboarding Target Screen')).toBeInTheDocument();
      });

      // Crucial: No false magic-link or email-sent screen
      expect(screen.queryByText(/Verify Your Email Address/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/magic link/i)).not.toBeInTheDocument();
    });

    it('when email confirmation is ENABLED: shows clean email verification screen with Resend option', async () => {
      mockSignUp.mockResolvedValueOnce({
        requiresVerification: true,
        email: 'verify-me@example.com',
        user: null,
      });

      const { container } = render(
        <MemoryRouter initialEntries={['/signup']}>
          <Routes>
            <Route path="/signup" element={<SignInPage initialTab="signup" />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(container.querySelector('#signup-name')!, { target: { value: 'Verify User' } });
      fireEvent.change(container.querySelector('#signup-email')!, { target: { value: 'verify-me@example.com' } });
      fireEvent.change(container.querySelector('#signup-password')!, { target: { value: 'StrongPass123' } });
      fireEvent.change(container.querySelector('#signup-confirm-password')!, { target: { value: 'StrongPass123' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Verify Your Email Address/i })).toBeInTheDocument();
        expect(screen.getByText('verify-me@example.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Change Email/i })).toBeInTheDocument();
      });

      // No magic-link wording
      expect(screen.queryByText(/magic link/i)).not.toBeInTheDocument();
    });
  });
});
