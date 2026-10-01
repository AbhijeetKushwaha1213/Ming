
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { AuthCallback } from "./components/auth/AuthCallback";
import { MainApp } from "./components/MainApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SecurityHeaders } from "./components/security/SecurityHeaders";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
    },
  },
});

// Only log in development to prevent information disclosure
if (process.env.NODE_ENV === 'development') {
  console.log('App: Initializing application');
}

const App = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('App: Rendering main app component');
  }
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SecurityHeaders />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={
                <AuthProvider>
                  <MainApp />
                </AuthProvider>
              } />
              <Route path="/auth/callback" element={
                <AuthProvider>
                  <AuthCallback />
                </AuthProvider>
              } />
              <Route path="/" element={
                <AuthProvider>
                  <MainApp />
                </AuthProvider>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
