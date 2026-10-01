
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
    if (level >= 50) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    if (level >= 25) return 'bg-gradient-to-r from-blue-500 to-indigo-500';
    if (level >= 10) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    return 'bg-gradient-to-r from-yellow-500 to-orange-500';
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
        <span className="text-xs text-gray-500">{getBadgeTitle(level)}</span>
      </div>
    </div>
  );
};
