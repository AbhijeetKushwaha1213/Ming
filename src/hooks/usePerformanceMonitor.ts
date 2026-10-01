
import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const usePerformanceMonitor = () => {
  const { toast } = useToast();

  const measurePageLoad = useCallback(() => {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      
      if (loadTime > 3000) {
        console.warn('Slow page load detected:', loadTime + 'ms');
      }
      
      return loadTime;
    }
    return 0;
  }, []);

  const measureComponentRender = useCallback((componentName: string, startTime: number) => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    if (renderTime > 100) {
      console.warn(`Slow render detected for ${componentName}:`, renderTime + 'ms');
    }
    
    return renderTime;
  }, []);

  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMemoryMB = memory.usedJSHeapSize / (1024 * 1024);
      
      if (usedMemoryMB > 50) {
        console.warn('High memory usage detected:', usedMemoryMB.toFixed(2) + 'MB');
        toast({
          title: "Performance Notice",
          description: "App is using significant memory. Consider refreshing if performance is slow.",
          variant: "default",
        });
      }
      
      return usedMemoryMB;
    }
    return 0;
  }, [toast]);

  useEffect(() => {
    // Monitor performance on mount
    measurePageLoad();
    
    // Check memory usage periodically
    const memoryCheckInterval = setInterval(checkMemoryUsage, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(memoryCheckInterval);
    };
  }, [measurePageLoad, checkMemoryUsage]);

  return {
    measurePageLoad,
    measureComponentRender,
    checkMemoryUsage,
  };
};
