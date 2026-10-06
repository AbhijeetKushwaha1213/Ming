import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPostAuthDestination, ROUTES } from './authNavigation';
import { Brain } from 'lucide-react';

const AUTH_ERROR_KEYS = ['error', 'error_code', 'error_description'];

const getAuthErrorMessage = () => {
  const url = new URL(window.location.href);

  for (const key of AUTH_ERROR_KEYS) {
    const value = url.searchParams.get(key);
    if (value) {
      return value.replace(/\+/g, ' ');
    }
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  for (const key of AUTH_ERROR_KEYS) {
    const value = hashParams.get(key);
    if (value) {
      return value.replace(/\+/g, ' ');
    }
  }

  return null;
};

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusMessage, setStatusMessage] = useState('Completing authentication...');

  useEffect(() => {
    let isActive = true;
    let fallbackTimer: number | undefined;

    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const isRecovery =
      currentUrl.searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery' ||
      currentUrl.searchParams.get('mode') === 'reset-password';

    if (isRecovery) {
      console.log('Recovery flow detected in AuthCallback, redirecting to /login?mode=reset-password');
      navigate(`/login?mode=reset-password${window.location.hash ? window.location.hash : ''}`, { replace: true });
      return;
    }

    const errorMessage = getAuthErrorMessage();

    if (errorMessage) {
      console.error('OAuth error in URL:', errorMessage);
      let userMsg = 'We could not complete Google sign-in. Please try again.';
      if (errorMessage.toLowerCase().includes('cancel') || errorMessage.toLowerCase().includes('denied')) {
        userMsg = 'Google sign-in was cancelled.';
      }
      toast({
        title: 'Sign In Failed',
        description: userMsg,
        variant: 'destructive',
      });
      sessionStorage.removeItem('google_oauth_initiated');
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    const handleUserDestination = async (supabaseUser: any) => {
      try {
        setStatusMessage('Loading your study profile...');
        const email = supabaseUser.email?.toLowerCase().trim() || '';
        const userName =
          supabaseUser.user_metadata?.full_name ||
          supabaseUser.user_metadata?.name ||
          email.split('@')[0] ||
          'User';

        // 1. Fetch profile with account-linking support (check user_id OR email)
        const { data: existingProfiles, error: fetchErr } = await supabase
          .from('user_profiles')
          .select('*')
          .or(`user_id.eq.${supabaseUser.id},email.eq.${email}`)
          .limit(1);

        let finalProfile: any = null;

        if (existingProfiles && existingProfiles.length > 0) {
          finalProfile = existingProfiles[0];
          // Account linking: update user_id if needed
          if (finalProfile.user_id !== supabaseUser.id) {
            console.log('AuthCallback: Linking existing profile for email:', email, 'to user_id:', supabaseUser.id);
            await supabase
              .from('user_profiles')
              .update({ user_id: supabaseUser.id, updated_at: new Date().toISOString() })
              .eq('id', finalProfile.id);
          }
        } else {
          // 2. Create profile if none exists
          console.log('AuthCallback: Creating new profile for OAuth user:', email);
          const newProfileRow = {
            user_id: supabaseUser.id,
            email: email,
            name: userName,
            user_type: 'exam',
            study_streak: 0,
            total_study_hours: 0,
            current_level: 1,
            experience_points: 0,
          };

          const { data: inserted, error: insertErr } = await supabase
            .from('user_profiles')
            .insert(newProfileRow)
            .select('*')
            .single();

          if (insertErr) {
            console.warn('AuthCallback: profile insertion warning:', insertErr);
          }
          finalProfile = inserted || newProfileRow;
        }

        sessionStorage.removeItem('google_oauth_initiated');

        toast({
          title: 'Welcome to StudyMate! 👋',
          description: 'Successfully signed in.',
        });

        // 3. Centralized post-auth redirect
        const destination = getPostAuthDestination(finalProfile);
        console.log('AuthCallback: Navigating to destination:', destination);
        if (isActive) {
          navigate(destination, { replace: true });
        }
      } catch (err) {
        console.error('AuthCallback: Error resolving user destination:', err);
        if (isActive) {
          navigate(ROUTES.DASHBOARD, { replace: true });
        }
      }
    };

    const resolveSession = async () => {
      try {
        console.log('AuthCallback: Resolving OAuth session...');
        // Allow brief time for Supabase client to process OAuth hash tokens
        await new Promise((resolve) => setTimeout(resolve, 400));

        const { data, error } = await supabase.auth.getSession();

        if (!isActive) return;

        if (error) {
          console.error('Error getting session:', error);
          toast({
            title: 'Sign In Failed',
            description: 'Something went wrong while completing sign in. Please try again.',
            variant: 'destructive',
          });
          sessionStorage.removeItem('google_oauth_initiated');
          navigate(ROUTES.LOGIN, { replace: true });
          return;
        }

        if (data.session?.user) {
          console.log('AuthCallback: Session verified for:', data.session.user.email);
          await handleUserDestination(data.session.user);
          return;
        }

        // Set fallback timer if session is not immediately ready
        fallbackTimer = window.setTimeout(async () => {
          if (!isActive) return;

          const { data: retryData } = await supabase.auth.getSession();
          if (retryData.session?.user) {
            await handleUserDestination(retryData.session.user);
            return;
          }

          console.warn('AuthCallback: Timeout waiting for session');
          sessionStorage.removeItem('google_oauth_initiated');
          toast({
            title: 'Sign In Incomplete',
            description: 'Could not establish session. Please try signing in again.',
            variant: 'destructive',
          });
          navigate(ROUTES.LOGIN, { replace: true });
        }, 2500);
      } catch (err) {
        console.error('Error in AuthCallback resolveSession:', err);
        if (isActive) {
          sessionStorage.removeItem('google_oauth_initiated');
          navigate(ROUTES.LOGIN, { replace: true });
        }
      }
    };

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isActive) return;
      console.log('AuthCallback onAuthStateChange:', event);

      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.removeItem('google_oauth_initiated');
        navigate(`/login?mode=reset-password`, { replace: true });
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        await handleUserDestination(session.user);
      }
    });

    return () => {
      isActive = false;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-emerald-950/10 to-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm p-6 bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-xl space-y-4 animate-fade-in">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#063B2A] to-[#20B486] rounded-2xl flex items-center justify-center mx-auto shadow-md ring-4 ring-emerald-500/10">
          <Brain className="w-7 h-7 text-white animate-pulse" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Setting Up Your Session</h2>
          <p className="text-xs text-muted-foreground">{statusMessage}</p>
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <span className="w-2 h-2 rounded-full bg-[#20B486] animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-[#20B486] animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-[#20B486] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};
