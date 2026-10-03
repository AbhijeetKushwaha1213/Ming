
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
    window.addEventListener('studymate-navigate', handleNavEvent);
    window.addEventListener('open-daily-plan', handleDailyPlanEvent);
    return () => {
      window.removeEventListener('studymate-navigate', handleNavEvent);
      window.removeEventListener('open-daily-plan', handleDailyPlanEvent);
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

            <h1 className="text-xl font-bold tracking-tight text-gradient">
              {activeTab === 'home' ? 'Dashboard' :
               activeTab === 'video-learning' ? 'Video Learning' :
               activeTab === 'flashcards' ? 'AI Generator' :
               activeTab === 'ai' ? 'AI Chat' :
               activeTab === 'achievements' ? 'Achievements' :
               activeTab === 'resources' ? 'Resources' :
               activeTab === 'settings' ? 'Settings' :
               'StudyMate AI'}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* Chat Toggle */}
            <Button
              variant={chatPanelOpen ? "default" : "ghost"}
              size="sm"
              onClick={toggleChatPanel}
              className="hidden sm:flex"
              title="AI Chat"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            {/* Todo Sidebar Toggle */}
            <Button
              variant={todoSidebarOpen ? "default" : "ghost"}
              size="sm"
              onClick={toggleTodoSidebar}
              className="hidden sm:flex"
              title="To-Do List"
            >
              <ListTodo className="w-5 h-5" />
            </Button>

            {/* Full Screen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullScreen}
              className="hidden sm:flex"
              title={fullScreenMode ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {fullScreenMode ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>

            {/* User Profile Widget in Top-Right Header (Replaces the online button) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center space-x-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-muted/70 transition-all border border-transparent hover:border-border/60 outline-none group text-left"
                >
                  {/* Avatar with Online Status Dot */}
                  <div className="relative shrink-0">
                    <Avatar className="w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-primary/20">
                      {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                      <AvatarFallback className="text-xs font-bold bg-brand-gradient text-white">
                        {getInitials(user?.name || 'abhi')}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`w-2.5 h-2.5 rounded-full border-2 border-background absolute -bottom-0.5 -right-0.5 ${
                        isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'
                      }`}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  {/* Name and Level / XP */}
                  <div className="hidden sm:block text-left min-w-0">
                    <p className="text-xs font-bold text-foreground leading-tight truncate max-w-[110px]">
                      {user?.name || 'abhi'}
                    </p>
                    <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-primary">Level {user?.current_level || 1}</span>
                      <span>•</span>
                      <span>{user?.experience_points || 0} XP</span>
                    </div>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground hidden sm:block transition-transform duration-200" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 p-1.5">
                {/* Header in Dropdown */}
                <div className="px-2.5 py-2 border-b border-border/50 mb-1">
                  <p className="text-xs font-bold text-foreground truncate">{user?.name || 'abhi'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user?.email || 'abhitest1290@gmail.com'}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0 font-semibold">
                      Level {user?.current_level || 1}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{user?.experience_points || 0} XP</span>
                  </div>
                </div>

                <DropdownMenuItem
                  onClick={() => handleTabChange('profile')}
                  className="cursor-pointer text-xs py-2 gap-2"
                >
                  <User className="w-4 h-4 text-primary" />
                  <span>My Profile</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleTabChange('settings')}
                  className="cursor-pointer text-xs py-2 gap-2"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>Account Settings</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-xs py-2 gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto bg-gradient-to-br from-background via-background to-accent/20">
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
