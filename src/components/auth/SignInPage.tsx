import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  BookOpen,
  Target,
  AlertCircle,
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Send,
  Lock,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type AuthView = 'auth' | 'forgot-request' | 'forgot-verify' | 'reset-new-password';

export const SignInPage = () => {
  const [authView, setAuthView] = useState<AuthView>('auth');
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password reset flow state
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResetSuccess, setIsResetSuccess] = useState(false);

  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const {
    signIn,
    signInWithGoogle,
    signUp,
    resetPasswordForEmail,
    verifyOtpForPasswordReset,
    updatePassword,
  } = useAuth();
  const { toast } = useToast();

  // Detect recovery URL params or password recovery state from Supabase
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);

    const isRecoveryMode =
      url.searchParams.get('mode') === 'reset-password' ||
      url.searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery';

    if (isRecoveryMode) {
      console.log('SignInPage: Recovery parameter detected in URL, showing Set New Password');
      setAuthView('reset-new-password');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('SignInPage: Supabase PASSWORD_RECOVERY event received');
        setAuthView('reset-new-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cooldown countdown for resending reset code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const validateEmail = (val: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  };

  const validateForm = (isSignUp = false) => {
    const errors: { [key: string]: string } = {};

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    if (isSignUp && !name.trim()) {
      errors.name = 'Full name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    try {
      await signUp(email, password, name);
    } catch (error) {
      console.error('Sign up error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Send password reset request (sends email link + OTP)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!forgotEmail.trim()) {
      errors.forgotEmail = 'Please enter your email address';
    } else if (!validateEmail(forgotEmail)) {
      errors.forgotEmail = 'Please enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    try {
      await resetPasswordForEmail(forgotEmail);
      setResendCooldown(60);
      setAuthView('forgot-verify');
    } catch (error: any) {
      console.error('Request reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP / reset link
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    try {
      await resetPasswordForEmail(forgotEmail);
      setResendCooldown(60);
    } catch (error) {
      console.error('Resend reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Verify OTP & set new password (via OTP code entered directly)
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!otpCode.trim()) {
      errors.otpCode = 'Enter the 6-digit OTP code sent to your email';
    } else if (otpCode.trim().length < 6) {
      errors.otpCode = 'OTP code must be 6 digits';
    }

    if (!newPassword.trim()) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    try {
      // Step A: Verify OTP with Supabase
      await verifyOtpForPasswordReset(forgotEmail, otpCode);
      // Step B: Set new password
      await updatePassword(newPassword);
      setIsResetSuccess(true);
    } catch (error: any) {
      console.error('Verify & Reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Direct new password reset (used when arriving from email link or recovery token)
  const handleSetNewPasswordDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!newPassword.trim()) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsLoading(true);
    try {
      await updatePassword(newPassword);
      setIsResetSuccess(true);
    } catch (error: any) {
      console.error('Set new password direct error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToSignIn = () => {
    setAuthView('auth');
    setActiveTab('signin');
    setIsResetSuccess(false);
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setValidationErrors({});
    if (forgotEmail) {
      setEmail(forgotEmail);
    }
    // Clean up recovery params from URL
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, document.title, '/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-emerald-950/10 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#063B2A] to-[#20B486] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/20 ring-4 ring-emerald-500/10">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#063B2A] via-[#20B486] to-[#0A4D37] dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-200 bg-clip-text text-transparent mb-1.5">
            StudyMate AI
          </h1>
          <p className="text-sm text-muted-foreground">Your intelligent study companion</p>
        </div>

        <Card className="p-6 sm:p-7 shadow-2xl border border-border/80 bg-card/95 backdrop-blur-xl">
          {/* ========================================================= */}
          {/* VIEW: PASSWORD RESET SUCCESS                              */}
          {/* ========================================================= */}
          {isResetSuccess ? (
            <div className="text-center py-4 space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[#20B486] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Password Reset Complete!</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>
              </div>
              <Button
                type="button"
                className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                onClick={handleReturnToSignIn}
              >
                Continue to Sign In
              </Button>
            </div>
          ) : authView === 'forgot-request' ? (
            /* ========================================================= */
            /* VIEW: STEP 1 - REQUEST PASSWORD RESET (LINK & OTP)       */
            /* ========================================================= */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReturnToSignIn}
                  className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                  Back to Sign In
                </button>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#063B2A] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  Step 1 of 2
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[#20B486] flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Reset your password</h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Enter your registered email address. We'll send you a <span className="font-semibold text-foreground">6-digit OTP code</span> and a <span className="font-semibold text-foreground">direct reset link</span>.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-4 pt-1">
                <div>
                  <Label htmlFor="forgot-email" className="text-xs font-semibold">
                    Account Email
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                      className={`pl-9 ${validationErrors.forgotEmail ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                  </div>
                  {validationErrors.forgotEmail && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.forgotEmail}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending Reset Email...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Send Reset Link & OTP
                    </span>
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (!forgotEmail && email) setForgotEmail(email);
                      setAuthView('forgot-verify');
                    }}
                    className="text-xs text-muted-foreground hover:text-[#20B486] transition-colors"
                  >
                    Already received a 6-digit code? <span className="underline font-semibold">Enter code here →</span>
                  </button>
                </div>
              </form>
            </div>
          ) : authView === 'forgot-verify' ? (
            /* ========================================================= */
            /* VIEW: STEP 2 - VERIFY OTP & SET NEW PASSWORD              */
            /* ========================================================= */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAuthView('forgot-request')}
                  className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                  Change Email
                </button>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#063B2A] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  Step 2 of 2
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[#20B486] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Enter Code & New Password</h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-foreground underline">{forgotEmail || 'your email'}</span>. Enter the code below or click the reset link in your email.
                </p>
              </div>

              <form onSubmit={handleVerifyOtpAndReset} className="space-y-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="otp-code" className="text-xs font-semibold">
                      6-Digit OTP Code
                    </Label>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={handleResendCode}
                      className="text-xs font-medium text-[#20B486] hover:text-[#0A4D37] disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className={`font-mono text-center tracking-[0.35em] text-lg font-bold ${
                      validationErrors.otpCode ? 'border-destructive' : 'focus-visible:ring-[#20B486]'
                    }`}
                  />
                  {validationErrors.otpCode && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.otpCode}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="new-password" className="text-xs font-semibold">
                    New Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.newPassword ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.newPassword && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.newPassword}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.confirmPassword ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.confirmPassword}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Verifying & Updating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Verify OTP & Update Password
                    </span>
                  )}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground pt-1">
                  💡 Tip: You can also click the direct reset link in the email to bypass entering the OTP manually.
                </p>
              </form>
            </div>
          ) : authView === 'reset-new-password' ? (
            /* ========================================================= */
            /* VIEW: DIRECT SET NEW PASSWORD (FROM EMAIL MAGIC LINK)    */
            /* ========================================================= */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReturnToSignIn}
                  className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                  Back to Sign In
                </button>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#063B2A] dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                  Email Verified
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-[#20B486] flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Set New Password</h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Your recovery link has been verified. Choose a secure new password of at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSetNewPasswordDirect} className="space-y-4 pt-1">
                <div>
                  <Label htmlFor="direct-new-password" className="text-xs font-semibold">
                    New Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="direct-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      className={`pr-10 ${validationErrors.newPassword ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.newPassword && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.newPassword}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="direct-confirm-password" className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="direct-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`pr-10 ${validationErrors.confirmPassword ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <div className="flex items-center mt-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      {validationErrors.confirmPassword}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Save New Password & Sign In
                    </span>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            /* ========================================================= */
            /* VIEW: MAIN SIGN IN / SIGN UP TABS                         */
            /* ========================================================= */
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as 'signin' | 'signup');
                setValidationErrors({});
              }}
              className="space-y-6"
            >
              <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/70 rounded-xl">
                <TabsTrigger
                  value="signin"
                  className="rounded-lg text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* SIGN IN TAB */}
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email" className="text-xs font-semibold">
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`mt-1 ${validationErrors.email ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    {validationErrors.email && (
                      <div className="flex items-center mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {validationErrors.email}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password" className="text-xs font-semibold">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setAuthView('forgot-request');
                          setValidationErrors({});
                        }}
                        className="text-xs font-medium text-[#20B486] hover:text-[#0A4D37] hover:underline transition-colors focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative mt-1">
                      <Input
                        id="signin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`pr-10 ${validationErrors.password ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <div className="flex items-center mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {validationErrors.password}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Signing In...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      OR
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-border/80 hover:bg-muted/50 rounded-xl font-medium transition-all"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>

              {/* SIGN UP TAB */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name" className="text-xs font-semibold">
                      Full Name
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={`mt-1 ${validationErrors.name ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    {validationErrors.name && (
                      <div className="flex items-center mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {validationErrors.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="signup-email" className="text-xs font-semibold">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`mt-1 ${validationErrors.email ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                    />
                    {validationErrors.email && (
                      <div className="flex items-center mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {validationErrors.email}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="signup-password" className="text-xs font-semibold">
                      Password
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`pr-10 ${validationErrors.password ? 'border-destructive' : 'focus-visible:ring-[#20B486]'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <div className="flex items-center mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        {validationErrors.password}
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#063B2A] hover:bg-[#0A4D37] text-white font-semibold py-2.5 rounded-xl shadow-md transition-all active:scale-98"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </Button>

                  <div className="relative my-4">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      OR
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-border/80 hover:bg-muted/50 rounded-xl font-medium transition-all"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign up with Google
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </Card>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center p-2 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="w-11 h-11 bg-muted/80 rounded-xl flex items-center justify-center mb-2 shadow-sm">
              <Target className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Smart Plans</p>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="w-11 h-11 bg-muted/80 rounded-xl flex items-center justify-center mb-2 shadow-sm">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">AI Flashcards</p>
          </div>
          <div className="flex flex-col items-center p-2 rounded-xl hover:bg-muted/30 transition-colors">
            <div className="w-11 h-11 bg-muted/80 rounded-xl flex items-center justify-center mb-2 shadow-sm">
              <Brain className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Adaptive Mastery</p>
          </div>
        </div>
      </div>
    </div>
  );
};
