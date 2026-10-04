import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Zap, 
  Calendar, 
  BookOpen, 
  Brain,
} from 'lucide-react';

interface QuickActionsProps {
  onNavigate: (tab: string) => void;
}

export const QuickActions = ({ onNavigate }: QuickActionsProps) => {
  const quickActions = [
    {
      id: 'create-flashcard',
      label: 'AI Generator',
      icon: Brain,
      onClick: () => onNavigate('flashcards')
    },
    {
      id: 'quick-review',
      label: 'Quick Review',
      icon: Zap,
      onClick: () => onNavigate('flashcards')
    },
    {
      id: 'view-achievements',
      label: 'View Progress',
      icon: Calendar,
      onClick: () => onNavigate('achievements')
    },
    {
      id: 'ai-chat',
      label: 'AI Chat',
      icon: BookOpen,
      onClick: () => onNavigate('ai')
    }
  ];

  return (
    <Card className="p-4 border border-border bg-card shadow-xs">
      <h3 className="font-serif text-sm font-bold text-foreground mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          
          return (
            <Button
              key={action.id}
              variant="outline"
              className="h-16 flex-col space-y-1 bg-card hover:bg-secondary hover:text-primary hover:border-primary/40 border-border text-foreground transition-all shadow-xs"
              onClick={action.onClick}
            >
              <Icon className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};
