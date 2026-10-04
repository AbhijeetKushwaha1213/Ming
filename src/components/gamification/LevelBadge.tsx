
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Star, Shield, Zap } from 'lucide-react';

interface LevelBadgeProps {
  level: number;
  experiencePoints: number;
  className?: string;
}

export const LevelBadge = ({ level, experiencePoints, className = '' }: LevelBadgeProps) => {
  const getBadgeIcon = (level: number) => {
    if (level >= 50) return Crown;
    if (level >= 25) return Shield;
    if (level >= 10) return Star;
    return Zap;
  };

  const getBadgeColor = (level: number) => {
    if (level >= 50) return 'bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-700 shadow-sm';
    if (level >= 25) return 'bg-gradient-to-r from-emerald-600 to-teal-700';
    if (level >= 10) return 'bg-gradient-to-r from-teal-500 to-emerald-600';
    return 'bg-gradient-to-r from-amber-500 to-amber-600';
  };

  const getBadgeTitle = (level: number) => {
    if (level >= 50) return 'Legend';
    if (level >= 25) return 'Expert';
    if (level >= 10) return 'Advanced';
    return 'Beginner';
  };

  const Icon = getBadgeIcon(level);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getBadgeColor(level)}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col">
        <Badge variant="secondary" className="text-xs">
          Level {level}
        </Badge>
        <span className="text-xs text-muted-foreground">{getBadgeTitle(level)}</span>
      </div>
    </div>
  );
};
