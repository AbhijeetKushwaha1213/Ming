import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    let isActive = true;
    let fallbackTimer: number | undefined;
    const errorMessage = getAuthErrorMessage();

    if (errorMessage) {
      console.error('OAuth error in URL:', errorMessage);
      toast({
        title: 'Google Sign In Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      sessionStorage.removeItem('google_oauth_initiated');
      navigate('/auth', { replace: true });
      return;
    }

    const resolveSession = async () => {
      try {
        console.log('Resolving OAuth session...');
        
        // Wait a bit for Supabase to process the OAuth callback
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data, error } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (error) {
          console.error('Error getting session:', error);
          toast({
            title: 'Google Sign In Failed',
            description: error.message,
            variant: 'destructive',
          });
          sessionStorage.removeItem('google_oauth_initiated');
          navigate('/auth', { replace: true });
          return;
        }

        if (data.session) {
          console.log('Session established:', data.session.user.email);
          
          // Check if this was a Google OAuth login
          const isGoogleOAuth = sessionStorage.getItem('google_oauth_initiated') === 'true';
          
          if (isGoogleOAuth) {
            console.log('Processing Google OAuth login...');
            
            // Check if user profile exists
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('user_id, name, email')
              .eq('user_id', data.session.user.id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error('Error checking profile:', profileError);
            }

            if (!profile) {
              console.log('New Google user - creating profile...');
              
              // Create a basic profile for new Google OAuth users
              const userName = data.session.user.user_metadata?.full_name || 
                              data.session.user.user_metadata?.name || 
                              data.session.user.email?.split('@')[0] || 
                              'User';
              
              const { error: insertError } = await supabase
                .from('user_profiles')
                .insert({
                  user_id: data.session.user.id,
                  email: data.session.user.email!,
                  name: userName,
                  user_type: 'exam', // Default, user can update later
                  study_streak: 0,
                  total_study_hours: 0,
                  current_level: 1,
                  experience_points: 0,
                });

              if (insertError) {
                console.error('Error creating profile:', insertError);
                // Continue anyway - profile will be created later if needed
              } else {
                console.log('Profile created successfully for new Google user');
              }
            } else {
              console.log('Existing user profile found');
            }
          }
          
          // Clear the flag
          sessionStorage.removeItem('google_oauth_initiated');
          
          toast({
            title: 'Welcome!',
            description: 'Successfully signed in with Google.',
          });
          
          navigate('/', { replace: true });
          return;
        }

        // Set a fallback timer if session is not established
        fallbackTimer = window.setTimeout(() => {
          if (!isActive) {
            return;
          }

          console.warn('OAuth callback timeout - no session created');
          sessionStorage.removeItem('google_oauth_initiated');
          toast({
            title: 'Google Sign In Incomplete',
            description: 'No session was created. Please check your internet connection and try again.',
            variant: 'destructive',
          });
          navigate('/auth', { replace: true });
        }, 2000);
      } catch (err) {
        console.error('Error in resolveSession:', err);
        if (isActive) {
          sessionStorage.removeItem('google_oauth_initiated');
          toast({
            title: 'Google Sign In Failed',
            description: 'An unexpected error occurred. Please try again.',
            variant: 'destructive',
          });
          navigate('/auth', { replace: true });
        }
      }
    };

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        sessionStorage.removeItem('google_oauth_initiated');
        navigate('/', { replace: true });
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing Google sign in...</p>
      </div>
    </div>
  );
};
