# React Query Hooks for Notion-Like Resource Manager

This directory contains React Query hooks for managing state in the Notion-like Resource Manager feature.

## Available Hooks

### Page Management (`usePages.ts`)

#### `usePages(parentId: string | null)`
Fetches child pages of a parent (or root pages if parentId is null).

```typescript
const { data: pages, isLoading, error } = usePages(null); // Get root pages
const { data: childPages } = usePages('parent-id'); // Get child pages
```

#### `useCreatePage()`
Creates a new page with optimistic updates.

```typescript
const createPage = useCreatePage();
createPage.mutate({ title: 'New Page', parent_id: null });
```

#### `useUpdatePage()`
Updates a page with optimistic updates.

```typescript
const updatePage = useUpdatePage();
updatePage.mutate({ id: 'page-id', data: { title: 'Updated Title' } });
```

#### `useDeletePage()`
Soft deletes a page with optimistic updates.

```typescript
const deletePage = useDeletePage();
deletePage.mutate('page-id');
```

#### `useMovePage()`
Moves a page to a new parent and/or position.

```typescript
const movePage = useMovePage();
movePage.mutate({ id: 'page-id', newParentId: 'new-parent-id', position: 0 });
```

### Single Page Operations (`usePage.ts`)

#### `usePage(id: string | undefined)`
Fetches a single page by ID.

```typescript
const { data: page, isLoading } = usePage('page-id');
```

#### `useUpdatePageOptimistic(pageId: string)`
Updates a single page with optimistic updates (scoped to a specific page).

```typescript
const updatePage = useUpdatePageOptimistic('page-id');
updatePage.mutate({ title: 'New Title' });
```

### Block Operations (`useBlocks.ts`)

#### `useCreateBlock(pageId: string)`
Creates a new block in a page with optimistic updates.

```typescript
const createBlock = useCreateBlock('page-id');
createBlock.mutate({ type: 'text', content: { text: 'Hello', marks: [] } });
```

#### `useUpdateBlock(pageId: string)`
Updates a block with optimistic updates.

```typescript
const updateBlock = useUpdateBlock('page-id');
updateBlock.mutate({ blockId: 'block-id', data: { content: { text: 'Updated', marks: [] } } });
```

#### `useDeleteBlock(pageId: string)`
Deletes a block with optimistic updates.

```typescript
const deleteBlock = useDeleteBlock('page-id');
deleteBlock.mutate('block-id');
```

#### `useReorderBlocks(pageId: string)`
Reorders blocks in a page with optimistic updates.

```typescript
const reorderBlocks = useReorderBlocks('page-id');
reorderBlocks.mutate(['block-2', 'block-1', 'block-3']);
```

#### `useDuplicateBlock(pageId: string)`
Duplicates a block with optimistic updates.

```typescript
const duplicateBlock = useDuplicateBlock('page-id');
duplicateBlock.mutate('block-id');
```

### Search (`useSearch.ts`)

#### `useSearch(query: string, debounceMs?: number)`
Searches pages with automatic debouncing (default 300ms).

```typescript
const [searchQuery, setSearchQuery] = useState('');
const { data: results, isLoading } = useSearch(searchQuery);
```

#### `useRecentPages(limit?: number)`
Fetches recently viewed pages.

```typescript
const { data: recentPages } = useRecentPages(10);
```

### Favorites (`useFavorites.ts`)

#### `useFavorites()`
Fetches all favorited pages.

```typescript
const { data: favorites, isLoading } = useFavorites();
```

#### `useToggleFavorite()`
Toggles favorite status of a page with optimistic updates.

```typescript
const toggleFavorite = useToggleFavorite();
toggleFavorite.mutate('page-id');
```

## Features

### Optimistic Updates
All mutation hooks implement optimistic updates for smooth UX:
- Changes appear immediately in the UI
- Automatically rolled back on error
- Synced with server response on success

### Automatic Cache Management
- Query results are automatically cached
- Related queries are invalidated on mutations
- Stale data is refetched in the background

### Error Handling
All hooks handle errors gracefully:
```typescript
const createPage = useCreatePage();

createPage.mutate(
  { title: 'New Page' },
  {
    onSuccess: (data) => {
      console.log('Page created:', data);
    },
    onError: (error) => {
      console.error('Failed to create page:', error);
    },
  }
);
```

## Query Keys

Query keys are exported for advanced cache manipulation:

```typescript
import { pageKeys } from '@/hooks/usePages';
import { searchKeys } from '@/hooks/useSearch';
import { favoritesKeys } from '@/hooks/useFavorites';

// Invalidate all pages
queryClient.invalidateQueries({ queryKey: pageKeys.all });

// Invalidate specific page
queryClient.invalidateQueries({ queryKey: pageKeys.detail('page-id') });
```

## Testing

All hooks have comprehensive unit tests in `__tests__/` directory. Run tests with:

```bash
npm test -- src/hooks/__tests__/
```
