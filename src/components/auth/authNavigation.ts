import { UserProfile } from './AuthProvider';

export const AUTH_ROUTES = {
  LANDING: '/landing',
  LOGIN: '/login',
  SIGNUP: '/signup',
  AUTH: '/auth',
  CALLBACK: '/auth/callback',
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
} as const;

export const ROUTES = AUTH_ROUTES;

/**
 * Determines whether a user has satisfied all requirements of onboarding.
 * - Must have a name and chosen userType ('exam' or 'college').
 * - Exam students must have selected their target examType.
 * - College students must have configured their college or course/branch.
 */
export function isOnboardingComplete(profile: Partial<UserProfile> | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.name || !profile.userType) return false;

  if (profile.userType === 'exam') {
    return Boolean(profile.examType && profile.examType.trim().length > 0);
  }

  if (profile.userType === 'college') {
    const collegeOrCourse = profile.college || profile.branch || (profile as any).course;
    return Boolean(collegeOrCourse && collegeOrCourse.trim().length > 0);
  }

  return false;
}

/**
 * Sanitizes a post-auth internal redirect path to prevent open redirects.
 */
export function getSafeRedirectTarget(redirectPath?: string | null): string | null {
  if (!redirectPath || typeof redirectPath !== 'string') return null;
  const trimmed = redirectPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
}

/**
 * Single source of truth for post-authentication destinations.
 * Authenticated + Onboarding Incomplete -> /onboarding
 * Authenticated + Onboarding Complete   -> safe redirectPath or /dashboard
 * Unauthenticated                       -> /login
 */
export function getPostAuthDestination(
  profile: Partial<UserProfile> | null | undefined,
  redirectPath?: string | null
): string {
  if (!profile) return AUTH_ROUTES.ONBOARDING;
  if (!isOnboardingComplete(profile)) {
    return AUTH_ROUTES.ONBOARDING;
  }
  return getSafeRedirectTarget(redirectPath) || AUTH_ROUTES.DASHBOARD;
}
