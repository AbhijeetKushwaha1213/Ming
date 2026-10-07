
import React, { useState, useEffect } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileNavigation } from './MobileNavigation';
import { AppHeader } from './AppHeader';
import { ContentRenderer } from './ContentRenderer';
import { QuickActions } from '../common/QuickActions';
import { ErrorBoundary } from '../ErrorBoundary';
import { RightSidebar } from './RightSidebar';
import { ChatPanel } from './ChatPanel';
import { SearchModal } from '../notion/SearchModal';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  X, 
  Menu, 
  Maximize, 
  Minimize, 
  MessageCircle, 
  ListTodo, 
  Moon, 
  Sun,
  User,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface AppLayoutProps {
  user: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleSignOut: () => void;
  isOnline: boolean;
}

export const AppLayout = ({ 
  user, 
  activeTab, 
  setActiveTab, 
  handleSignOut, 
  isOnline 
}: AppLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [todoSidebarOpen, setTodoSidebarOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('darkMode', next.toString());
  };

  console.log('AppLayout render - activeTab:', activeTab, 'user:', user?.id);

  const handleTabChange = (tab: string) => {
    console.log('AppLayout: Tab change to:', tab);
    setActiveTab(tab);
    // Close mobile menu when navigating
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    const handleNavEvent = (e: any) => {
      if (e.detail?.tab) {
        handleTabChange(e.detail.tab);
      }
    };
    const handleDailyPlanEvent = () => {
      setTodoSidebarOpen(true);
      setChatPanelOpen(false);
    };
    const handleOpenChatPanel = () => {
      setChatPanelOpen(true);
      setTodoSidebarOpen(false);
    };
    window.addEventListener('studymate-navigate', handleNavEvent);
    window.addEventListener('open-daily-plan', handleDailyPlanEvent);
    window.addEventListener('open-chat-panel', handleOpenChatPanel);
    return () => {
      window.removeEventListener('studymate-navigate', handleNavEvent);
      window.removeEventListener('open-daily-plan', handleDailyPlanEvent);
      window.removeEventListener('open-chat-panel', handleOpenChatPanel);
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const toggleFullScreen = () => {
    setFullScreenMode(!fullScreenMode);
  };

  const toggleTodoSidebar = () => {
    if (chatPanelOpen) {
      setChatPanelOpen(false);
    }
    setTodoSidebarOpen(!todoSidebarOpen);
  };

  const toggleChatPanel = () => {
    if (todoSidebarOpen) {
      setTodoSidebarOpen(false);
    }
    setChatPanelOpen(!chatPanelOpen);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .trim()
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Desktop Sidebar - Collapsible */}
      {!fullScreenMode && (
        <div className={`hidden lg:flex transition-all duration-300 ease-in-out shrink-0 relative z-30 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}>
          <DesktopSidebar 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            onSignOut={handleSignOut}
            isCollapsed={sidebarCollapsed}
          />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-background shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Menu</h2>
              <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="h-full overflow-y-auto">
              <DesktopSidebar 
                activeTab={activeTab} 
                onTabChange={handleTabChange}
                onSignOut={handleSignOut}
                isCollapsed={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Enhanced Header with controls */}
        <div className="h-16 glass border-b border-border/60 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          <div className="flex items-center space-x-4">
            {/* Sidebar Toggle - Desktop */}
            {!fullScreenMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="hidden lg:flex"
                title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            
            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <h1 className="text-lg font-serif font-bold tracking-tight text-foreground">
              {activeTab === 'home' ? 'Dashboard' :
               activeTab === 'video-learning' ? 'Video Learning' :
               activeTab === 'flashcards' ? 'AI Generator' :
               activeTab === 'ai' ? 'AI Chat' :
               activeTab === 'achievements' ? 'Achievements' :
               activeTab === 'resources' ? 'Resources' :
               activeTab === 'settings' ? 'Settings' :
               activeTab === 'profile' ? 'Profile' :
               'Ming AI'}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className="text-foreground hover:text-primary"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* Chat Toggle */}
            <Button
              variant={chatPanelOpen ? "default" : "ghost"}
              size="sm"
              onClick={toggleChatPanel}
              className={`hidden sm:flex ${chatPanelOpen ? 'text-primary-foreground' : 'text-foreground hover:text-primary'}`}
              title="AI Chat"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            {/* Todo Sidebar Toggle */}
            <Button
              variant={todoSidebarOpen ? "default" : "ghost"}
              size="sm"
              onClick={toggleTodoSidebar}
              className={`hidden sm:flex ${todoSidebarOpen ? 'text-primary-foreground' : 'text-foreground hover:text-primary'}`}
              title="To-Do List"
            >
              <ListTodo className="w-5 h-5" />
            </Button>

            {/* Full Screen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullScreen}
              className="hidden sm:flex text-foreground hover:text-primary"
              title={fullScreenMode ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {fullScreenMode ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>

            {/* User Profile Avatar in Top-Right Header (Directly opens profile) */}
            <button
              type="button"
              onClick={() => handleTabChange('profile')}
              className="relative p-0.5 rounded-full hover:ring-2 hover:ring-primary/40 transition-all outline-none group shrink-0 focus-visible:ring-2 focus-visible:ring-ring"
              title="Open Profile"
              aria-label="Open Profile"
            >
              <Avatar className="w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-primary/20 shadow-sm cursor-pointer transition-transform group-hover:scale-105">
                {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || 'User'} />}
                <AvatarFallback className="text-xs font-bold bg-brand-gradient text-white">
                  {(user?.name?.[0] || 'A').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 border-background absolute -bottom-0.5 -right-0.5 ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'
                }`}
                title={isOnline ? 'Online' : 'Offline'}
              />
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto bg-background bg-grid-subtle">
          <div className="w-full flex-1 flex flex-col min-h-0 pb-20 lg:pb-0 animate-fade-in">
            <ErrorBoundary>
              <ContentRenderer activeTab={activeTab} onNavigate={handleTabChange} />
            </ErrorBoundary>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Hide in full screen */}
      {!fullScreenMode && (
        <MobileNavigation 
          user={user}
          activeTab={activeTab} 
          setActiveTab={handleTabChange}
          handleSignOut={handleSignOut}
          isOnline={isOnline}
        />
      )}

      {/* Mobile Floating Action Buttons */}
      {!fullScreenMode && (
        <div className="fixed bottom-20 right-4 flex flex-col space-y-3 lg:hidden z-40">
          <Button
            size="lg"
            onClick={toggleChatPanel}
            className={`h-14 w-14 rounded-full shadow-lg ${
              chatPanelOpen ? 'bg-primary' : 'bg-background border-2 border-primary'
            }`}
            variant={chatPanelOpen ? "default" : "outline"}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
          <Button
            size="lg"
            onClick={toggleTodoSidebar}
            className={`h-14 w-14 rounded-full shadow-lg ${
              todoSidebarOpen ? 'bg-primary' : 'bg-background border-2 border-primary'
            }`}
            variant={todoSidebarOpen ? "default" : "outline"}
          >
            <ListTodo className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Overlay for mobile when panels are open */}
      {(todoSidebarOpen || chatPanelOpen) && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => {
            setTodoSidebarOpen(false);
            setChatPanelOpen(false);
          }}
        />
      )}

      {/* Right Sidebar - Todo List */}
      <RightSidebar 
        isOpen={todoSidebarOpen && !fullScreenMode} 
        onClose={() => setTodoSidebarOpen(false)} 
      />

      {/* Chat Panel */}
      <ChatPanel 
        isOpen={chatPanelOpen && !fullScreenMode} 
        onClose={() => setChatPanelOpen(false)} 
      />

      {/* Search Modal */}
      <SearchModal 
        open={searchModalOpen} 
        onOpenChange={setSearchModalOpen} 
      />
    </div>
  );
};
