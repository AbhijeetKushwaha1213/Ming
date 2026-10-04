import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Library, ShieldCheck, GitFork } from 'lucide-react';
import { PremiumAIGenerator } from '../ai/PremiumAIGenerator';
import { AdaptiveAssessmentGenerator } from '../ai/AdaptiveAssessmentGenerator';
import { DAGPipeline } from '../ai/DAGPipeline';
import '../ai/animations.css';
import { FlashcardVault } from './FlashcardVault';

export const AIGeneratorPage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('studymate-active-material-tab') || 'assessment';
  });

  useEffect(() => {
    const handleSubtab = (e: any) => {
      if (e.detail?.subtab) {
        setActiveTab(e.detail.subtab);
        localStorage.setItem('studymate-active-material-tab', e.detail.subtab);
      }
    };
    window.addEventListener('studymate-subtab', handleSubtab);
    return () => window.removeEventListener('studymate-subtab', handleSubtab);
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    localStorage.setItem('studymate-active-material-tab', val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">AI Assessment & Materials</h1>
          <p className="text-muted-foreground mt-1">Generate grounded adaptive assessments, flashcards, concept DAGs, and study guides from your course materials</p>
        </div>
      </div>

      {/* Tabs: 1. Adaptive Assessment, 2. AI Materials, 3. DAG Pipeline, 4. My Vault */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4 bg-muted/80 border border-border/60">
          <TabsTrigger value="assessment" className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Adaptive Assessment</span>
          </TabsTrigger>
          <TabsTrigger value="generate" className="flex items-center space-x-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span>AI Materials</span>
          </TabsTrigger>
          <TabsTrigger value="dag" className="flex items-center space-x-2">
            <GitFork className="w-4 h-4 text-primary" />
            <span>DAG Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex items-center space-x-2">
            <Library className="w-4 h-4 text-primary" />
            <span>My Vault</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="mt-6">
          <AdaptiveAssessmentGenerator />
        </TabsContent>

        <TabsContent value="generate" className="mt-6">
          <PremiumAIGenerator />
        </TabsContent>

        <TabsContent value="dag" className="mt-6">
          <DAGPipeline />
        </TabsContent>

        <TabsContent value="vault" className="mt-6">
          <FlashcardVault />
        </TabsContent>
      </Tabs>
    </div>
  );
};

