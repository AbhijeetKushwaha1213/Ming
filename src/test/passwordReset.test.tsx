import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from '../components/auth/SignInPage';

// Mock useAuth
const mockResetPasswordForEmail = vi.fn();
const mockVerifyOtpForPasswordReset = vi.fn();
const mockUpdatePassword = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    resetPasswordForEmail: mockResetPasswordForEmail,
    verifyOtpForPasswordReset: mockVerifyOtpForPasswordReset,
    updatePassword: mockUpdatePassword,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Password Reset & Forgot Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Forgot password?" option on the Sign In tab', () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
    expect(forgotBtn).toBeInTheDocument();
  });

  it('switches to Step 1 (Reset your password) when clicking "Forgot password?"', () => {
    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByText(/Reset your password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link & OTP/i })).toBeInTheDocument();
  });

  it('validates email and calls resetPasswordForEmail on submit, transitioning to Step 2', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    // Navigate to forgot password view
    fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));

    const emailInput = screen.getByPlaceholderText(/you@example\.com/i);
    const submitBtn = screen.getByRole('button', { name: /Send Reset Link & OTP/i });

    // Try submitting with valid email
    fireEvent.change(emailInput, { target: { value: 'learner@studymate.ai' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('learner@studymate.ai');
    });

    // Should transition to Step 2 (Enter Code & New Password)
    await waitFor(() => {
      expect(screen.getByText(/Enter Code & New Password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });
  });

  it('allows entering 6-digit OTP and new password to complete reset', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce(undefined);
    mockVerifyOtpForPasswordReset.mockResolvedValueOnce(undefined);
    mockUpdatePassword.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    // Open Step 1
    fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link & OTP/i }));

    // Await Step 2
    await waitFor(() => {
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText('123456');
    const newPassInput = screen.getByPlaceholderText(/Minimum 8 characters/i);
    const confirmPassInput = screen.getByPlaceholderText(/Re-enter your new password/i);
    const submitBtn = screen.getByRole('button', { name: /Verify OTP & Update Password/i });

    fireEvent.change(otpInput, { target: { value: '654321' } });
    fireEvent.change(newPassInput, { target: { value: 'NewSuperPass123!' } });
    fireEvent.change(confirmPassInput, { target: { value: 'NewSuperPass123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockVerifyOtpForPasswordReset).toHaveBeenCalledWith('student@example.com', '654321');
      expect(mockUpdatePassword).toHaveBeenCalledWith('NewSuperPass123!');
      expect(screen.getByText(/Password Reset Complete!/i)).toBeInTheDocument();
    });
  });

  it('prevents submission when passwords do not match in Step 2', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send Reset Link & OTP/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
    });

    const otpInput = screen.getByPlaceholderText('123456');
    const newPassInput = screen.getByPlaceholderText(/Minimum 8 characters/i);
    const confirmPassInput = screen.getByPlaceholderText(/Re-enter your new password/i);
    const submitBtn = screen.getByRole('button', { name: /Verify OTP & Update Password/i });

    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.change(newPassInput, { target: { value: 'PasswordOne1' } });
    fireEvent.change(confirmPassInput, { target: { value: 'DifferentPassword2' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('renders Step 3 (Set New Password) directly when recovery URL parameters are detected', () => {
    // Set window.location search parameter
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/auth?mode=reset-password');

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Set New Password/i)).toBeInTheDocument();
    expect(screen.getByText(/Email Verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save New Password & Sign In/i })).toBeInTheDocument();
  });

  it('allows returning back to Sign In from forgot password view', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/auth');

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    );

    // Open Step 1
    fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
    expect(screen.getByText(/Reset your password/i)).toBeInTheDocument();

    // Click Back to Sign In
    const backBtn = screen.getByRole('button', { name: /Back to Sign In/i });
    fireEvent.click(backBtn);

    // Should be back on the Sign In tab
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();
  });
});
