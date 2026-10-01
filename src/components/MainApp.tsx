
import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { SignInPage } from './auth/SignInPage';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { AppLayout } from './layout/AppLayout';
import { ErrorBoundary } from './ErrorBoundary';
import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SessionTimeoutWarning } from '@/components/security/SessionTimeoutWarning';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';

export const MainApp = () => {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const { isOnline } = useOfflineSupport();
  const { measureComponentRender } = usePerformanceMonitor();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  console.log('MainApp render - Auth state:', { 
    isAuthenticated, 
    isLoading, 
    user: user?.id, 
    userType: user?.userType,
    activeTab 
  });

  // Redirect to landing page if user comes to root and is not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location.pathname === '/') {
      navigate('/landing');
    }
  }, [isLoading, isAuthenticated, location.pathname, navigate]);

  // Add keyboard shortcuts
  useKeyboardShortcuts({
    onNavigate: (tab: string) => {
      console.log('MainApp: Keyboard shortcut navigation to:', tab);
      setActiveTab(tab);
    },
    onQuickAction: (action) => {
      console.log('MainApp: Keyboard shortcut quick action:', action);
      switch (action) {
        case 'create-flashcard':
          setActiveTab('flashcards');
          break;
        case 'search':
          // Focus search if available
          break;
      }
    }
  });

  useEffect(() => {
    const startTime = performance.now();
    
    // Unregister all service workers to prevent caching issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          console.log('Unregistering service worker:', registration);
          registration.unregister();
        });
      });
    }

    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('dark', darkMode);

    return () => {
      measureComponentRender('MainApp', startTime);
    };
  }, [measureComponentRender]);

  useEffect(() => {
    // Show offline/online status
    if (!isOnline) {
      toast({
        title: "You're offline",
        description: "Some features may be limited. We'll sync when you're back online.",
        variant: "default",
      });
    }
  }, [isOnline, toast]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    console.log('MainApp: Showing loading state');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show sign in
  if (!isAuthenticated) {
    console.log('MainApp: User not authenticated, showing SignInPage');
    return (
      <ErrorBoundary>
        <SignInPage />
      </ErrorBoundary>
    );
  }

  // Authenticated but incomplete onboarding - show onboarding flow
  if (!user?.userType || !user?.name || 
      (user?.userType === 'exam' && !user?.examType) ||
      (user?.userType === 'college' && !user?.college)) {
    console.log('MainApp: User authenticated but incomplete profile, showing OnboardingFlow. User data:', {
      userType: user?.userType,
      name: user?.name,
      email: user?.email,
      examType: user?.examType,
      college: user?.college
    });
    return (
      <ErrorBoundary>
        <OnboardingFlow />
      </ErrorBoundary>
    );
  }

  console.log('MainApp: Rendering main app with activeTab:', activeTab);

  const handleSignOut = async () => {
    try {
      console.log('MainApp: Signing out user');
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      navigate('/landing');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTabChange = (tab: string) => {
    console.log('MainApp: Tab change requested:', tab);
    setActiveTab(tab);
  };

  return (
    <ErrorBoundary>
      <SessionTimeoutWarning />
      <AppLayout 
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        handleSignOut={handleSignOut}
        isOnline={isOnline}
      />
    </ErrorBoundary>
  );
};
