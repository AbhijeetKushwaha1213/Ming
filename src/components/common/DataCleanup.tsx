import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../auth/AuthProvider';

export const DataCleanup = () => {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleResetData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Reset user profile to minimal state (keep only essential data)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          // Keep core fields but reset extras
          subjects: null,
          study_preference: null,
          motivation: null,
          daily_hours: null,
          review_modes: null,
          study_reminder: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      // Refresh user data
      await refetch();

      toast({
        title: "Data Reset Complete! ✅",
        description: "Your profile has been reset to a clean state. The onboarding flow will restart.",
      });

    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: "Reset Failed",
        description: "Unable to reset data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dataToClean = [
    {
      type: 'Onboarding Data',
      description: 'Reset preference data to trigger clean onboarding',
      items: ['Study preferences', 'Motivation settings', 'Review modes', 'Daily goals'],
      critical: false
    },
    {
      type: 'Debug Data',
      description: 'Remove development strings and test data',
      items: ['Console logs', 'Test prompts', 'Dummy notifications'],
      critical: false
    }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Cleanup & Reset</h2>
        <p className="text-gray-600">Clean up your profile for a fresh start</p>
      </div>

      <div className="space-y-4">
        {dataToClean.map((item, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{item.type}</h3>
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
              </div>
              <Badge variant={item.critical ? "destructive" : "secondary"}>
                {item.critical ? "Critical" : "Safe"}
              </Badge>
            </div>
            
            <div className="space-y-1 mb-3">
              {item.items.map((dataItem, i) => (
                <div key={i} className="flex items-center text-sm text-gray-600">
                  <CheckCircle2 className="w-3 h-3 mr-2 text-green-500" />
                  {dataItem}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800">Reset Warning</h3>
            <p className="text-sm text-yellow-700 mt-1">
              This will reset your profile preferences and trigger the onboarding flow again. 
              Your core account data (email, name, user type) will be preserved.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-center space-x-4">
        <Button
          onClick={handleResetData}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Reset Profile Data
            </>
          )}
        </Button>
      </div>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">What happens after reset?</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-2 text-blue-600" />
            You'll be redirected to the onboarding flow
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-2 text-blue-600" />
            All dummy/test data will be cleared
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-2 text-blue-600" />
            Fresh, clean user experience
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-2 text-blue-600" />
            Your account and authentication remain intact
          </li>
        </ul>
      </Card>
    </div>
  );
};
