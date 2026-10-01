
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Github, Linkedin, Code, Trophy, ExternalLink } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  color: string;
  comingSoon?: boolean;
}

export const IntegrationsSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'github',
      name: 'GitHub',
      description: 'Sync your repositories and track coding progress',
      icon: <Github className="w-6 h-6" />,
      connected: false,
      color: 'border-gray-800 bg-gray-50'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Share achievements and connect with professionals',
      icon: <Linkedin className="w-6 h-6" />,
      connected: false,
      color: 'border-blue-600 bg-blue-50'
    },
    {
      id: 'hackerrank',
      name: 'HackerRank',
      description: 'Import coding challenges and track problem-solving stats',
      icon: <Code className="w-6 h-6" />,
      connected: false,
      color: 'border-green-600 bg-green-50',
      comingSoon: true
    },
    {
      id: 'leetcode',
      name: 'LeetCode',
      description: 'Sync coding practice and interview preparation progress',
      icon: <Trophy className="w-6 h-6" />,
      connected: false,
      color: 'border-orange-600 bg-orange-50',
      comingSoon: true
    }
  ]);

  const handleConnect = async (integrationId: string) => {
    if (integrationId === 'github') {
      // Simulate GitHub OAuth flow
      toast({
        title: "Connecting to GitHub",
        description: "Redirecting to GitHub authorization...",
      });
      
      // In a real app, this would redirect to GitHub OAuth
      setTimeout(() => {
        setIntegrations(prev => 
          prev.map(integration => 
            integration.id === integrationId 
              ? { ...integration, connected: true }
              : integration
          )
        );
        
        toast({
          title: "GitHub Connected!",
          description: "Successfully connected to your GitHub account.",
        });
      }, 2000);
      
    } else if (integrationId === 'linkedin') {
      // Simulate LinkedIn OAuth flow
      toast({
        title: "Connecting to LinkedIn",
        description: "Redirecting to LinkedIn authorization...",
      });
      
      setTimeout(() => {
        setIntegrations(prev => 
          prev.map(integration => 
            integration.id === integrationId 
              ? { ...integration, connected: true }
              : integration
          )
        );
        
        toast({
          title: "LinkedIn Connected!",
          description: "Successfully connected to your LinkedIn account.",
        });
      }, 2000);
      
    } else {
      toast({
        title: "Coming Soon",
        description: `${integrations.find(i => i.id === integrationId)?.name} integration will be available soon!`,
      });
    }
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, connected: false }
          : integration
      )
    );
    
    const integrationName = integrations.find(i => i.id === integrationId)?.name;
    toast({
      title: "Disconnected",
      description: `Successfully disconnected from ${integrationName}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Integrations</h2>
        <p className="text-gray-600">Connect your accounts to enhance your study experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id} className={`p-6 border-2 ${integration.color} ${integration.connected ? 'ring-2 ring-indigo-500' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${integration.connected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    {integration.connected && (
                      <Badge className="bg-green-100 text-green-800">Connected</Badge>
                    )}
                    {integration.comingSoon && (
                      <Badge variant="outline">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={integration.connected}
                  disabled={integration.comingSoon}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleConnect(integration.id);
                    } else {
                      handleDisconnect(integration.id);
                    }
                  }}
                />
                <span className="text-sm text-gray-600">
                  {integration.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {integration.connected && !integration.comingSoon && (
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              )}
            </div>

            {integration.connected && (
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-indigo-800">Last synced:</span>
                  <span className="text-indigo-600">Just now</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ExternalLink className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">More Integrations</h3>
            <p className="text-sm text-gray-600">Request new integrations or suggest improvements</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            Request Integration
          </Button>
          <Button variant="outline" size="sm">
            View Documentation
          </Button>
        </div>
      </Card>
    </div>
  );
};
