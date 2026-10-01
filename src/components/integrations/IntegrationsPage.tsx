import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Github, Linkedin, Code, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Integration {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  status: 'connected' | 'disconnected' | 'failed';
  lastSync?: string;
  data?: any;
}

export const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'github',
      name: 'GitHub',
      icon: Github,
      description: 'Sync your repositories and contribution data',
      status: 'disconnected'
    },
    {
      id: 'leetcode',
      name: 'LeetCode',
      icon: Code,
      description: 'Track your coding problem-solving progress',
      status: 'disconnected'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      description: 'Connect your professional profile and learning',
      status: 'disconnected'
    }
  ]);
  
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async (integrationId: string) => {
    setIsLoading(integrationId);
    
    try {
      // Step 1: Show redirect message
      toast({
        title: `Connecting to ${integrations.find(i => i.id === integrationId)?.name}...`,
        description: "You'll be redirected to authorize the connection.",
      });

      // Simulate OAuth flow - in real app, this would redirect to OAuth provider
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Simulate permission grant
      toast({
        title: "Permission Granted ✅",
        description: "Syncing your data...",
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: Update status and show summary
      setIntegrations(prev => prev.map(integration => 
        integration.id === integrationId 
          ? { 
              ...integration, 
              status: 'connected' as const,
              lastSync: new Date().toISOString(),
              data: getMockData(integrationId)
            }
          : integration
      ));

      toast({
        title: "Integration Successful! 🎉",
        description: `${integrations.find(i => i.id === integrationId)?.name} connected successfully.`,
      });

    } catch (error) {
      console.error('Integration error:', error);
      
      setIntegrations(prev => prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, status: 'failed' as const }
          : integration
      ));

      toast({
        title: "Connection Failed ❌",
        description: "Unable to connect. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setIntegrations(prev => prev.map(integration => 
      integration.id === integrationId 
        ? { ...integration, status: 'disconnected' as const, data: undefined, lastSync: undefined }
        : integration
    ));

    toast({
      title: "Disconnected",
      description: `${integrations.find(i => i.id === integrationId)?.name} has been disconnected.`,
    });
  };

  const getMockData = (integrationId: string) => {
    switch (integrationId) {
      case 'github':
        return {
          repos: 24,
          commits: 156,
          stars: 42,
          languages: ['JavaScript', 'Python', 'TypeScript']
        };
      case 'leetcode':
        return {
          solved: 89,
          total: 2800,
          easy: 45,
          medium: 35,
          hard: 9,
          rating: 1654
        };
      case 'linkedin':
        return {
          connections: 234,
          skills: ['React', 'Node.js', 'Python', 'Machine Learning'],
          courses: 5
        };
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Connected ✅</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed ❌</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  const renderIntegrationData = (integration: Integration) => {
    if (!integration.data) return null;

    switch (integration.id) {
      case 'github':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{integration.data.repos}</div>
              <div className="text-sm text-muted-foreground">Repositories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{integration.data.commits}</div>
              <div className="text-sm text-muted-foreground">Commits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{integration.data.stars}</div>
              <div className="text-sm text-muted-foreground">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Top Languages</div>
              <div className="text-xs mt-1">{integration.data.languages.join(', ')}</div>
            </div>
          </div>
        );
      
      case 'leetcode':
        return (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{integration.data.solved}</div>
                <div className="text-sm text-muted-foreground">Problems Solved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{integration.data.easy}</div>
                <div className="text-sm text-muted-foreground">Easy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{integration.data.medium}</div>
                <div className="text-sm text-muted-foreground">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{integration.data.hard}</div>
                <div className="text-sm text-muted-foreground">Hard</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">Rating: {integration.data.rating}</div>
            </div>
          </div>
        );
      
      case 'linkedin':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{integration.data.connections}</div>
              <div className="text-sm text-muted-foreground">Connections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{integration.data.courses}</div>
              <div className="text-sm text-muted-foreground">Courses</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Top Skills</div>
              <div className="text-xs mt-1">{integration.data.skills.slice(0, 2).join(', ')}</div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gradient mb-3">Platform Integrations</h1>
        <p className="text-lg text-muted-foreground">
          Connect your accounts to sync progress and enhance your learning experience
        </p>
      </div>

      <div className="space-y-6">
        {integrations.map((integration) => {
          const IconComponent = integration.icon;
          
          return (
            <Card key={integration.id} className="p-6 card-interactive">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                    <IconComponent className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-foreground">{integration.name}</h3>
                      {getStatusIcon(integration.status)}
                      {getStatusBadge(integration.status)}
                    </div>
                    <p className="text-muted-foreground">{integration.description}</p>
                    {integration.lastSync && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Last synced: {new Date(integration.lastSync).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  {integration.status === 'connected' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={isLoading === integration.id}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="premium"
                      onClick={() => handleConnect(integration.id)}
                      disabled={isLoading === integration.id}
                    >
                      {isLoading === integration.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {renderIntegrationData(integration)}
            </Card>
          );
        })}
      </div>

      <Separator />

      <Card className="p-6 bg-brand-gradient-subtle border-primary/20">
        <h3 className="text-lg font-semibold text-foreground mb-2">Integration Benefits</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
            Automatic progress tracking across platforms
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
            Personalized study recommendations based on your activity
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
            Unified dashboard showing all your achievements
          </li>
          <li className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-primary" />
            Portfolio enhancement with verified skills and projects
          </li>
        </ul>
      </Card>
    </div>
  );
};