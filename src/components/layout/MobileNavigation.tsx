import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Menu, 
  Home, 
  Wand2, 
  Bot,
  FolderOpen, 
  Trophy,
  User,
  Settings,
  Bell,
  LogOut,
  X,
  ChevronRight,
  Plug,
  Video
} from 'lucide-react';

interface MobileNavigationProps {
  user: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleSignOut: () => void;
  isOnline: boolean;
}

const primaryBottomTabs = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'flashcards', label: 'AI Tools', icon: Wand2 },
  { id: 'ai', label: 'AI Chat', icon: Bot },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
];

const drawerNavItems = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'ai', label: 'AI Chat', icon: Bot },
  { id: 'flashcards', label: 'AI Generator & Assessment', icon: Wand2 },
  { id: 'video-learning', label: 'Video Learning', icon: Video },
  { id: 'resources', label: 'Resources & Vault', icon: FolderOpen },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
];

const drawerSecondaryItems = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

export const MobileNavigation = ({ 
  user, 
  activeTab, 
  setActiveTab, 
  handleSignOut, 
  isOnline 
}: MobileNavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    setIsOpen(false);
  };

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around h-16 px-1 lg:hidden shadow-lg"
    >
      {/* Primary 4 Tabs */}
      {primaryBottomTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleNavigation(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[44px] min-h-[44px] transition-colors ${
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isActive ? 'scale-110 text-primary' : ''}`} />
            <span className="text-[10px] tracking-tight truncate max-w-[64px]">{tab.label}</span>
          </button>
        );
      })}

      {/* 5th Tab: Drawer Trigger (More) */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="More Navigation Menu"
            className="flex flex-col items-center justify-center flex-1 h-full min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex flex-col h-full bg-background">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/ming-logo.png"
                    alt="Ming Logo"
                    className="w-7 h-7 rounded-lg bg-white border border-border/60 object-contain p-0.5 shadow-xs"
                  />
                  <h2 className="text-lg font-serif font-bold text-foreground">Ming</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {user && (
                <div className="flex items-center space-x-3 pt-2">
                  <div className="w-10 h-10 bg-brand-gradient text-white rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">{user.name || 'Learner'}</p>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                        {user.userType === 'college' ? 'College' : 'Exam Prep'}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] py-0 px-1.5 ${isOnline ? 'text-emerald-600 border-emerald-300' : 'text-destructive border-destructive'}`}
                      >
                        {isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Main Navigation
                </p>
                {drawerNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                          : 'text-foreground hover:bg-accent/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-primary-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <Separator className="my-2" />

              {/* Secondary Items */}
              <div className="space-y-1">
                <p className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Settings & Preferences
                </p>
                {drawerSecondaryItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                          : 'text-foreground hover:bg-accent/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-primary-foreground shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer with Sign Out */}
            <div className="p-4 border-t border-border bg-muted/20">
              <Button
                variant="outline"
                className="w-full justify-center text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false);
                  handleSignOut();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>

          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
};
