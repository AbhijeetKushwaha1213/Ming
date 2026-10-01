
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Plus, 
  Zap, 
  Calendar, 
  BookOpen, 
  Brain,
  Clock
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
      color: 'bg-purple-500 hover:bg-purple-600',
      onClick: () => onNavigate('flashcards')
    },
    {
      id: 'quick-review',
      label: 'Quick Review',
      icon: Zap,
      color: 'bg-green-500 hover:bg-green-600',
      onClick: () => onNavigate('flashcards')
    },
    {
      id: 'view-achievements',
      label: 'View Progress',
      icon: Calendar,
      color: 'bg-orange-500 hover:bg-orange-600',
      onClick: () => onNavigate('achievements')
    },
    {
      id: 'ai-chat',
      label: 'AI Chat',
      icon: BookOpen,
      color: 'bg-blue-500 hover:bg-blue-600',
      onClick: () => onNavigate('ai')
    }
  ];

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;
          
          return (
            <Button
              key={action.id}
              variant="ghost"
              className={`h-16 flex-col space-y-1 ${action.color} text-white hover:text-white transition-colors`}
              onClick={action.onClick}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{action.label}</span>
            </Button>
          );
        })}
      </div>
    </Card>
  );
};
