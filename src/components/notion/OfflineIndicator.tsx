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
          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          iconClassName: 'text-amber-600 dark:text-amber-400'
        };
      case 'syncing':
        return {
          icon: RefreshCw,
          text: 'Syncing',
          subtext: `${syncStatus.pendingCount} remaining`,
          className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
          iconClassName: 'text-sky-600 dark:text-sky-400 animate-spin'
        };
      case 'queued':
        return {
          icon: Cloud,
          text: 'Queued',
          subtext: `${syncStatus.pendingCount} pending`,
          className: 'bg-muted/80 text-foreground border-border',
          iconClassName: 'text-muted-foreground'
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Sync Error',
          subtext: syncStatus.error || 'Failed to sync',
          className: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
          iconClassName: 'text-red-600 dark:text-red-400'
        };
      case 'online':
        return {
          icon: CheckCircle,
          text: 'Online',
          subtext: syncStatus.pendingCount > 0 
            ? `Syncing ${syncStatus.pendingCount}...` 
            : 'Connected',
          className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          iconClassName: 'text-emerald-600 dark:text-emerald-400'
        };
      default:
        return {
          icon: Cloud,
          text: 'Synced',
          subtext: 'All changes saved',
          className: 'bg-card text-foreground border-border',
          iconClassName: 'text-muted-foreground'
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
