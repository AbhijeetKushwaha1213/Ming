import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface FeatureStatus {
  name: string;
  status: 'completed' | 'in-progress' | 'pending';
  description: string;
}

const features: FeatureStatus[] = [
  {
    name: '🔁 Flashcards Display',
    status: 'completed',
    description: 'Flashcards now display correctly in the Flashcard section'
  },
  {
    name: '📤 Chat History Persistence',
    status: 'completed',
    description: 'AI chat conversations are now saved and accessible'
  },
  {
    name: '⬆️ Expandable AI Chat',
    status: 'completed',
    description: 'AI chat box can now be expanded to full height'
  },
  {
    name: '🛠️ Functional Project Buttons',
    status: 'completed',
    description: 'Project and skill action buttons now work correctly'
  },
  {
    name: '🖼️ Avatar Upload',
    status: 'completed',
    description: 'Users can now upload and set profile avatars'
  },
  {
    name: '📱 Mobile Sidebar Fix',
    status: 'completed',
    description: 'Mobile sidebar now renders correctly with overflow handling'
  },
  {
    name: '🧠 User Type Separation',
    status: 'completed',
    description: 'Exam mode now shows relevant tools instead of projects/skills'
  }
];

export const FeatureStatusCard = () => {
  const completedCount = features.filter(f => f.status === 'completed').length;
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Fixed</Badge>;
      case 'in-progress':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In Progress</Badge>;
      default:
        return <Badge variant="destructive">Pending</Badge>;
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border-emerald-500/20">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-2">Feature Implementation Status</h3>
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
            {completedCount}/{features.length} features implemented successfully!
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {features.map((feature, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
            <div className="flex items-center space-x-3">
              {getStatusIcon(feature.status)}
              <div>
                <h4 className="font-medium text-foreground">{feature.name}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
            {getStatusBadge(feature.status)}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-sky-500/10 rounded-lg border border-sky-500/20">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span className="text-sky-800 dark:text-sky-300 font-medium">
            All requested features have been successfully implemented!
          </span>
        </div>
        <p className="text-sm text-sky-800/80 dark:text-sky-300/80 mt-1">
          The app now includes all functional fixes, UI enhancements, and user type personalizations as requested.
        </p>
      </div>
    </Card>
  );
};