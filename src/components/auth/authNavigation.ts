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
 * Single source of truth for post-authentication destinations.
 * Authenticated + Onboarding Incomplete -> /onboarding
 * Authenticated + Onboarding Complete   -> /dashboard
 * Unauthenticated                       -> /login
 */
export function getPostAuthDestination(profile: Partial<UserProfile> | null | undefined): string {
  if (!profile) return AUTH_ROUTES.ONBOARDING;
  return isOnboardingComplete(profile) ? AUTH_ROUTES.DASHBOARD : AUTH_ROUTES.ONBOARDING;
}
