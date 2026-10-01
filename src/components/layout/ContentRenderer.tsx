import React from 'react';
import { CollegeDashboard } from '../dashboard/CollegeDashboard';
import { ExamDashboard } from '../dashboard/ExamDashboard';
import { AIGeneratorPage } from '../flashcards/AIGeneratorPage';
import { AIChat } from '../chat/AIChat';
import { ProfilePage } from '../profile/ProfilePage';
import { SettingsPage } from '../settings/SettingsPage';
import { NewAchievementsPage } from '../achievements/NewAchievementsPage';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { DiscoverResources } from '../discover/DiscoverResources';
import { IntegrationsPage } from '../integrations/IntegrationsPage';
import { useAuth } from '../auth/AuthProvider';
import { NotionResourceManager } from '../notion/NotionResourceManager';

interface ContentRendererProps {
  activeTab: string;
  onNavigate?: (tab: string) => void;
}

export const ContentRenderer = ({ activeTab, onNavigate }: ContentRendererProps) => {
  const { user } = useAuth();

  const handleNavigate = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  const renderContent = () => {
    console.log('ContentRenderer: Rendering activeTab:', activeTab);
    
    switch (activeTab) {
      case 'home':
        return user?.userType === 'college' ? <CollegeDashboard /> : <ExamDashboard />;
      case 'flashcards':
        return <AIGeneratorPage />;
      case 'ai':
        return <AIChat />;
      case 'achievements':
        return <NewAchievementsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'resources':
        return <NotionResourceManager />;
      case 'notifications':
        return <NotificationCenter onNavigate={handleNavigate} />;
      case 'discover':
        return <DiscoverResources onNavigate={handleNavigate} />;
      default:
        console.log('ContentRenderer: Unknown tab, rendering default dashboard');
        return user?.userType === 'college' ? <CollegeDashboard /> : <ExamDashboard />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {renderContent()}
    </div>
  );
};
