
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Menu, Wifi, WifiOff } from 'lucide-react';

interface AppHeaderProps {
  user: any;
  isOnline: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onNavigate: (tab: string) => void;
}

export const AppHeader = ({ 
  user, 
  isOnline, 
  sidebarOpen, 
  setSidebarOpen, 
  onNavigate 
}: AppHeaderProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-background border-b border-border lg:border-0">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Logo - visible on mobile only */}
        <div className="flex items-center space-x-2.5 lg:hidden">
          <img
            src="/assets/ming-logo.png"
            alt="Ming Logo"
            className="w-7 h-7 rounded-lg bg-white border border-border/50 object-contain p-0.5 shadow-xs"
          />
          <h1 className="font-serif font-bold text-foreground text-base">Ming</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Connection status */}
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <div className="flex items-center space-x-1 text-green-600">
                <Wifi className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Offline</span>
              </div>
            )}
          </div>

          {/* User avatar - mobile only */}
          <div className="lg:hidden">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                {getInitials(user?.name || 'U')}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
};
