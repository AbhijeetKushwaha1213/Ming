
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Brain, Lightbulb } from 'lucide-react';

interface MindMapBranch {
  title: string;
  subtopics: string[];
  details?: string;
}

interface MindMapData {
  central_topic: string;
  branches: MindMapBranch[];
}

interface MindMapViewerProps {
  mindmap: MindMapData;
  title: string;
  difficulty: string;
  onClose?: () => void;
}

export const MindMapViewer = ({ mindmap, title, difficulty, onClose }: MindMapViewerProps) => {
  const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set());

  const toggleBranch = (index: number) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBranches(newExpanded);
  };

  const expandAll = () => {
    setExpandedBranches(new Set(mindmap.branches.map((_, index) => index)));
  };

  const collapseAll = () => {
    setExpandedBranches(new Set());
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy': return 'bg-success/10 text-success';
      case 'medium': return 'bg-warning/10 text-warning';
      case 'hard': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!mindmap) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No mind map data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <div className="flex items-center space-x-2 mt-1">
            <Badge className={getDifficultyColor(difficulty)}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {mindmap.branches.length} main branches
            </span>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              ← Back
            </Button>
          )}
        </div>
      </div>

      {/* Mind Map */}
      <div className="flex flex-col items-center space-y-8">
        {/* Central Topic */}
        <Card className="p-6 bg-brand-gradient border-0 shadow-glow">
          <div className="text-center">
            <Brain className="w-8 h-8 mx-auto mb-2 text-white" />
            <h3 className="text-2xl font-bold text-white">{mindmap.central_topic}</h3>
          </div>
        </Card>

        {/* Branches */}
        <div className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mindmap.branches.map((branch, index) => {
              const isExpanded = expandedBranches.has(index);
              const branchColors = [
                'from-emerald-50 to-emerald-100/70 border-emerald-300 dark:from-emerald-950/20 dark:to-emerald-900/30 dark:border-emerald-800',
                'from-teal-50 to-teal-100/70 border-teal-300 dark:from-teal-950/20 dark:to-teal-900/30 dark:border-teal-800',
                'from-amber-50 to-amber-100/70 border-amber-300 dark:from-amber-950/20 dark:to-amber-900/30 dark:border-amber-800',
                'from-sky-50 to-sky-100/70 border-sky-300 dark:from-sky-950/20 dark:to-sky-900/30 dark:border-sky-800',
                'from-stone-50 to-stone-100/70 border-stone-300 dark:from-stone-900/40 dark:to-stone-800/40 dark:border-stone-700',
                'from-emerald-50 to-teal-50 border-emerald-300 dark:from-emerald-950/30 dark:to-teal-950/20 dark:border-emerald-700',
              ];
              const colorClass = branchColors[index % branchColors.length];

              return (
                <Card 
                  key={index} 
                  className={`transition-all duration-300 bg-gradient-to-br ${colorClass} border-2 hover:shadow-lg`}
                >
                  {/* Branch Header */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleBranch(index)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-foreground flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-amber-500" />
                        {branch.title}
                      </h4>
                      {isExpanded ? 
                        <ChevronDown className="w-5 h-5 text-muted-foreground" /> : 
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      }
                    </div>
                    {branch.details && (
                      <p className="text-sm text-muted-foreground mt-2">{branch.details}</p>
                    )}
                  </div>

                  {/* Subtopics */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="border-t border-border/50 pt-3 space-y-2">
                        {branch.subtopics.map((subtopic, subIndex) => (
                          <div 
                            key={subIndex}
                            className="flex items-center p-2 bg-background/60 rounded border border-border/70"
                          >
                            <div className="w-2 h-2 bg-primary/70 rounded-full mr-3"></div>
                            <span className="text-sm text-foreground">{subtopic}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connection Lines Visualization */}
      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          Click on branch titles to expand/collapse subtopics
        </p>
      </div>
    </div>
  );
};
