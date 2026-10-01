import React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { Page } from '@/types/notion';

interface PageBreadcrumbProps {
  ancestors: Page[];
  currentPageTitle: string;
  onNavigate: (pageId: string) => void;
}

export function PageBreadcrumb({
  ancestors,
  currentPageTitle,
  onNavigate,
}: PageBreadcrumbProps) {
  if (ancestors.length === 0) {
    return null;
  }

  return (
    <div className="px-16 py-2 border-b">
      <Breadcrumb>
        <BreadcrumbList>
          {ancestors.map((ancestor, index) => (
            <React.Fragment key={ancestor.id}>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => onNavigate(ancestor.id)}
                  className="cursor-pointer hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {ancestor.icon && (
                    <span className="text-sm">{ancestor.icon}</span>
                  )}
                  <span>{ancestor.title}</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
            </React.Fragment>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <span>{currentPageTitle}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
