
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
      color: 'border-border bg-card'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Share achievements and connect with professionals',
      icon: <Linkedin className="w-6 h-6" />,
      connected: false,
      color: 'border-blue-500/30 bg-blue-500/5'
    },
    {
      id: 'hackerrank',
      name: 'HackerRank',
      description: 'Import coding challenges and track problem-solving stats',
      icon: <Code className="w-6 h-6" />,
      connected: false,
      color: 'border-emerald-500/30 bg-emerald-500/5',
      comingSoon: true
    },
    {
      id: 'leetcode',
      name: 'LeetCode',
      description: 'Sync coding practice and interview preparation progress',
      icon: <Trophy className="w-6 h-6" />,
      connected: false,
      color: 'border-orange-500/30 bg-orange-500/5',
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
        <h2 className="text-xl font-semibold text-foreground mb-2">Account Integrations</h2>
        <p className="text-muted-foreground">Connect your accounts to enhance your study experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id} className={`p-6 border ${integration.color} ${integration.connected ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${integration.connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-foreground">{integration.name}</h3>
                    {integration.connected && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30">Connected</Badge>
                    )}
                    {integration.comingSoon && (
                      <Badge variant="outline" className="text-muted-foreground border-border">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{integration.description}</p>
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
                <span className="text-sm text-muted-foreground">
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
              <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">Last synced:</span>
                  <span className="text-primary font-medium">Just now</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ExternalLink className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">More Integrations</h3>
            <p className="text-sm text-muted-foreground">Request new integrations or suggest improvements</p>
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
