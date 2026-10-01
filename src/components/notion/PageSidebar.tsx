import { FavoritesList } from './FavoritesList';
import { PageTree } from './PageTree';
import { SidebarSkeleton } from './PageSkeleton';
import { Separator } from '@/components/ui/separator';
import type { Page } from '@/types/notion';

interface PageSidebarProps {
  onPageClick?: (page: Page) => void;
  selectedPageId?: string;
  isLoading?: boolean;
}

/**
 * Combined sidebar component that displays favorites and page tree
 */
export function PageSidebar({ onPageClick, selectedPageId, isLoading = false }: PageSidebarProps) {
  if (isLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <FavoritesList onPageClick={onPageClick} selectedPageId={selectedPageId} />
      
      {/* Show separator only if there are favorites */}
      <div className="px-2">
        <Separator className="my-2" />
      </div>

      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
        Pages
      </div>
      
      <PageTree onPageClick={onPageClick} selectedPageId={selectedPageId} />
    </div>
  );
}
