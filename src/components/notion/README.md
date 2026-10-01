# Notion-like Components

This directory contains the components for the Notion-like Resource Manager feature.

## Components

### PageView

The main page viewing and editing component that displays a page with its header, breadcrumb navigation, and block editor.

**Usage:**

```tsx
import { PageView } from '@/components/notion';

function MyApp() {
  const [currentPageId, setCurrentPageId] = useState<string>('page-id');

  const handleNavigate = (pageId: string) => {
    setCurrentPageId(pageId);
  };

  return (
    <div className="h-screen">
      <PageView pageId={currentPageId} onNavigate={handleNavigate} />
    </div>
  );
}
```

**Features:**
- Displays page header with editable title, icon, and cover image
- Shows breadcrumb navigation for nested pages
- Integrates BlockEditor for content editing
- Auto-saves changes with debouncing (500ms for title, 1s for content)
- Shows save status indicator
- Error handling with user-friendly messages

### PageHeader

Displays and allows editing of page title, icon, and cover image.

**Features:**
- Editable title with auto-save
- Icon picker with common emoji options
- Cover image upload with validation (max 5MB)
- Hover actions for removing icon/cover
- Smooth transitions and animations

### PageBreadcrumb

Displays ancestor pages as a breadcrumb trail for navigation.

**Features:**
- Shows all ancestor pages from root to current
- Clickable breadcrumb items for navigation
- Displays page icons alongside titles
- Automatically hides when no ancestors exist

### PageSidebar

The main sidebar component that displays both favorites and the page tree hierarchy.

**Usage:**

```tsx
import { PageSidebar } from '@/components/notion';
import { useState } from 'react';

function MyApp() {
  const [selectedPageId, setSelectedPageId] = useState<string>();

  const handlePageClick = (page: Page) => {
    setSelectedPageId(page.id);
    // Navigate to the page or load its content
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r">
        <PageSidebar
          onPageClick={handlePageClick}
          selectedPageId={selectedPageId}
        />
      </aside>
      <main className="flex-1">
        {/* Page content goes here */}
      </main>
    </div>
  );
}
```

### PageTree

Displays a hierarchical tree of pages with expand/collapse functionality and drag-and-drop reordering.

**Features:**
- Hierarchical display with unlimited nesting
- Expand/collapse nested pages
- Drag and drop to reorder pages
- Loading states for async operations
- Empty state when no pages exist

### FavoritesList

Displays favorited pages at the top of the sidebar with drag-and-drop reordering.

**Features:**
- Shows only favorited pages
- Drag and drop to reorder favorites
- Quick unfavorite action on hover
- Automatically hides when no favorites exist

### PageTreeNode

Individual node component used within PageTree. Handles rendering of a single page with its children.

**Features:**
- Displays page icon and title
- Expand/collapse button for nested pages
- Drag handle for reordering
- Hover states and visual feedback
- Recursive rendering of child pages

## Drag and Drop

All components use `@dnd-kit` for accessible drag and drop functionality:

- **Activation constraint**: 8px movement required before drag starts (prevents accidental drags)
- **Visual feedback**: Drag overlay shows the page being dragged
- **Opacity change**: Dragged item becomes semi-transparent
- **Accessible**: Keyboard navigation support built-in

## Styling

Components use Tailwind CSS with shadcn/ui design tokens:

- `bg-accent`: Selected/hover state background
- `text-muted-foreground`: Secondary text and icons
- `rounded-md`: Consistent border radius
- Responsive spacing with `px-2`, `py-1`, etc.

## Testing

Unit tests are provided for PageTree and FavoritesList components:

```bash
npm test -- src/components/notion/__tests__/
```

Tests cover:
- Loading states
- Error states
- Empty states
- Successful rendering
- User interactions (clicks, selections)
- Icon display
