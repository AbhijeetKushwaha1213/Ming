import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton loader for page content while loading
 */
export function PageContentSkeleton() {
  return (
    <div className="page-view h-full overflow-y-auto">
      {/* Breadcrumb skeleton */}
      <div className="px-16 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Cover image skeleton */}
      <div className="px-16">
        <Skeleton className="w-full h-48 rounded-lg mb-8" />
      </div>

      {/* Page header skeleton */}
      <div className="px-16 mb-8">
        {/* Icon and title */}
        <div className="flex items-start gap-3 mb-4">
          <Skeleton className="w-12 h-12 rounded" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>

      {/* Block content skeleton */}
      <div className="px-16 pb-32 space-y-3">
        <BlockSkeleton variant="heading" />
        <BlockSkeleton variant="text" />
        <BlockSkeleton variant="text" />
        <BlockSkeleton variant="heading" />
        <BlockSkeleton variant="text" />
        <BlockSkeleton variant="list" />
        <BlockSkeleton variant="text" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for individual blocks
 */
interface BlockSkeletonProps {
  variant?: 'text' | 'heading' | 'list' | 'image' | 'table';
}

export function BlockSkeleton({ variant = 'text' }: BlockSkeletonProps) {
  switch (variant) {
    case 'heading':
      return (
        <div className="py-2">
          <Skeleton className="h-8 w-3/4" />
        </div>
      );
    
    case 'text':
      return (
        <div className="py-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      );
    
    case 'list':
      return (
        <div className="py-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </div>
      );
    
    case 'image':
      return (
        <div className="py-2">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      );
    
    case 'table':
      return (
        <div className="py-2 space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-6 flex-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-6 flex-1" />
            <Skeleton className="h-6 flex-1" />
          </div>
        </div>
      );
    
    default:
      return <Skeleton className="h-4 w-full" />;
  }
}

/**
 * Skeleton loader for sidebar page tree
 */
export function SidebarSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-2">
      {/* Favorites section skeleton */}
      <div className="mb-4">
        <div className="px-2 py-1 mb-2">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-1">
          <SidebarPageItemSkeleton />
          <SidebarPageItemSkeleton />
        </div>
      </div>

      {/* Separator */}
      <div className="px-2 my-2">
        <Skeleton className="h-px w-full" />
      </div>

      {/* Pages section skeleton */}
      <div className="px-2 py-1 mb-2">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-1">
        <SidebarPageItemSkeleton />
        <SidebarPageItemSkeleton nested />
        <SidebarPageItemSkeleton nested />
        <SidebarPageItemSkeleton />
        <SidebarPageItemSkeleton nested />
        <SidebarPageItemSkeleton />
      </div>
    </div>
  );
}

/**
 * Skeleton for individual sidebar page item
 */
interface SidebarPageItemSkeletonProps {
  nested?: boolean;
}

function SidebarPageItemSkeleton({ nested = false }: SidebarPageItemSkeletonProps) {
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 ${nested ? 'ml-4' : ''}`}>
      <Skeleton className="w-4 h-4 rounded" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}
