import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { AUTH_ROUTES, isOnboardingComplete, getPostAuthDestination } from './authNavigation';
import { SignInPage } from './SignInPage';

export const AuthLoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Checking your session...',
}) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center space-y-3 animate-fade-in">
      <div className="w-10 h-10 border-3 border-[#20B486] border-t-transparent rounded-full animate-spin mx-auto shadow-sm" />
      <p className="text-sm font-semibold text-muted-foreground">{message}</p>
    </div>
  </div>
);

/**
 * Route guard for authenticated dashboard/application views.
 * - If session is resolving: displays AuthLoadingScreen.
 * - If not authenticated: redirects to /login.
 * - If onboarding incomplete and requireOnboarding=true: redirects to /onboarding.
 */
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requireOnboarding?: boolean;
}> = ({ children, requireOnboarding = true }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking your session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={AUTH_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (requireOnboarding && !isOnboardingComplete(user)) {
    return <Navigate to={AUTH_ROUTES.ONBOARDING} replace />;
  }

  return <>{children}</>;
};

/**
 * Route guard for /onboarding.
 * - If session is resolving: displays AuthLoadingScreen.
 * - If not authenticated: redirects to /login.
 * - If onboarding is ALREADY completed: redirects to /dashboard.
 */
export const OnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen message="Loading onboarding..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={AUTH_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (isOnboardingComplete(user)) {
    return <Navigate to={AUTH_ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};

/**
 * Route guard for public auth pages (/login, /signup, /auth).
 * - If authenticated: redirects to /dashboard or /onboarding (never shows login form).
 * - If unauthenticated: displays SignInPage.
 */
export const PublicAuthRoute: React.FC<{ initialTab?: 'signin' | 'signup' }> = ({
  initialTab = 'signin',
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen message="Checking your session..." />;
  }

  if (isAuthenticated && user) {
    const destination = getPostAuthDestination(user);
    return <Navigate to={destination} replace />;
  }

  return <SignInPage initialTab={initialTab} />;
};

/**
 * Root route controller for '/'.
 * - If authenticated: directs to /dashboard or /onboarding.
 * - If unauthenticated: directs to /landing.
 */
export const RootRedirectRoute: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && user) {
    const destination = getPostAuthDestination(user);
    return <Navigate to={destination} replace />;
  }

  // Instant check: If no auth token exists in local storage, route to landing in 0ms without waiting or showing a loading screen
  const hasToken =
    typeof window !== 'undefined' &&
    Object.keys(localStorage).some(
      (key) => (key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'studymate-offline-session'
    );

  if (!hasToken) {
    return <Navigate to={AUTH_ROUTES.LANDING} replace />;
  }

  if (isLoading) {
    return <AuthLoadingScreen message="Loading StudyMate..." />;
  }

  return <Navigate to={AUTH_ROUTES.LANDING} replace />;
};
