import React from 'react';
import { useAuth } from '../auth/AuthProvider';
import { 
  Home, 
  Bot, 
  Wand2, 
  Trophy, 
  FolderOpen,
  Settings,
  Plug,
  Video
} from 'lucide-react';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSignOut: () => void;
  isCollapsed?: boolean;
}

export const DesktopSidebar = ({ activeTab, onTabChange, onSignOut, isCollapsed = false }: DesktopSidebarProps) => {
  const { user } = useAuth();

  if (!user) return null;

  const mainNavItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'video-learning', label: 'Video Learning', icon: Video },
    { id: 'flashcards', label: 'AI Generator', icon: Wand2 },
    { id: 'ai', label: 'AI Chat', icon: Bot },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'resources', label: 'Resources', icon: FolderOpen },
  ];

  const secondaryNavItems = [
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-sidebar border-r border-sidebar-border sticky top-0">
      {/* Header */}
      <div className="flex items-center h-16 px-5 border-b border-sidebar-border flex-shrink-0">
        {isCollapsed ? (
          <img
            src="/assets/ming-logo.png"
            alt="Ming Logo"
            className="w-8 h-8 rounded-lg bg-white border border-sidebar-border/60 object-contain p-0.5 shadow-xs mx-auto"
          />
        ) : (
          <div className="flex items-center space-x-3">
            <img
              src="/assets/ming-logo.png"
              alt="Ming Logo"
              className="w-8 h-8 rounded-lg bg-white border border-sidebar-border/60 object-contain p-0.5 shadow-xs"
            />
            <h1 className="font-serif font-bold text-foreground text-lg tracking-tight leading-none">
              Ming
            </h1>
          </div>
        )}
      </div>

      {/* Navigation - Scrollable */}
      <nav className={`flex-1 py-4 space-y-2 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`group relative w-full h-9 flex items-center rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent font-medium'
                } ${isCollapsed ? 'justify-center px-0' : 'justify-start px-3'}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'} ${
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`} />
                {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="pt-4 mt-2 border-t border-sidebar-border">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider mb-2">
              Tools & Settings
            </p>
          )}
          <div className="space-y-1">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`group relative w-full h-9 flex items-center rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent font-medium'
                  } ${isCollapsed ? 'justify-center px-0' : 'justify-start px-3'}`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'} ${
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`} />
                  {!isCollapsed && <span className="text-sm truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
};
