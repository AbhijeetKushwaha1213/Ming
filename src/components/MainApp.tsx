import React, { useState, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { AppLayout } from './layout/AppLayout';
import { ErrorBoundary } from './ErrorBoundary';
import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SessionTimeoutWarning } from '@/components/security/SessionTimeoutWarning';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export const MainApp = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const { isOnline } = useOfflineSupport();
  const { measureComponentRender } = usePerformanceMonitor();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      console.log('MainApp: Signing out user');
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      navigate('/login');
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
