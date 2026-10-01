import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSecurityMonitor } from '@/hooks/useSecurityMonitor';

/**
 * Component that automatically integrates session timeout monitoring
 * This component should be included in the main app layout
 */
export const SessionTimeoutWarning = () => {
  const { user } = useAuth();
  useSecurityMonitor(); // This hook handles all session timeout logic

  // This component doesn't render anything visible
  // All session timeout handling is done through the useSecurityMonitor hook
  return null;
};