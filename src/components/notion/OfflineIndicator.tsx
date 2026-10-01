// Offline indicator component showing sync status
import { useEffect, useState } from 'react';
import { syncService, SyncStatus } from '@/services/syncService';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'synced',
    pendingCount: 0
  });

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = syncService.subscribe((status) => {
      setSyncStatus(status);
    });

    return unsubscribe;
  }, []);

  // Don't show indicator if online and synced with no pending operations
  if (syncStatus.status === 'synced' && syncStatus.pendingCount === 0) {
    return null;
  }

  const getStatusConfig = () => {
    switch (syncStatus.status) {
      case 'offline':
        return {
          icon: CloudOff,
          text: 'Offline',
          subtext: syncStatus.pendingCount > 0 
            ? `${syncStatus.pendingCount} pending` 
            : 'Working offline',
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          iconClassName: 'text-yellow-600'
        };
      case 'syncing':
        return {
          icon: RefreshCw,
          text: 'Syncing',
          subtext: `${syncStatus.pendingCount} remaining`,
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          iconClassName: 'text-blue-600 animate-spin'
        };
      case 'queued':
        return {
          icon: Cloud,
          text: 'Queued',
          subtext: `${syncStatus.pendingCount} pending`,
          className: 'bg-gray-50 text-gray-700 border-gray-200',
          iconClassName: 'text-gray-600'
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Sync Error',
          subtext: syncStatus.error || 'Failed to sync',
          className: 'bg-red-50 text-red-700 border-red-200',
          iconClassName: 'text-red-600'
        };
      case 'online':
        return {
          icon: CheckCircle,
          text: 'Online',
          subtext: syncStatus.pendingCount > 0 
            ? `Syncing ${syncStatus.pendingCount}...` 
            : 'Connected',
          className: 'bg-green-50 text-green-700 border-green-200',
          iconClassName: 'text-green-600'
        };
      default:
        return {
          icon: Cloud,
          text: 'Synced',
          subtext: 'All changes saved',
          className: 'bg-gray-50 text-gray-700 border-gray-200',
          iconClassName: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex items-center gap-2 px-3 py-2',
        'rounded-lg border shadow-lg',
        'transition-all duration-200',
        config.className
      )}
    >
      <Icon className={cn('h-4 w-4', config.iconClassName)} />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{config.text}</span>
        {config.subtext && (
          <span className="text-xs opacity-80">{config.subtext}</span>
        )}
      </div>
    </div>
  );
}
