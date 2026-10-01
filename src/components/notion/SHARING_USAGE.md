# Sharing Functionality Usage Guide

## Overview

The sharing functionality allows users to create share links for their pages with configurable permissions (view or edit). This implementation includes:

1. **Share API** (`src/api/shareAPI.ts`) - Backend functions for managing shares
2. **React Query Hooks** (`src/hooks/useShares.ts`) - State management for shares
3. **ShareModal Component** (`src/components/notion/ShareModal.tsx`) - UI for managing shares
4. **Integration** - Share button in PageHeader and PageView

## Features

### Share Creation
- Generate unique share links for pages
- Set permissions: "view" (read-only) or "edit" (can modify)
- Multiple shares per page supported

### Share Management
- View all active shares for a page
- Copy share links to clipboard
- Revoke access by deleting shares
- See share creation dates and permissions

### Security
- Row Level Security (RLS) policies enforce access control
- Only page owners can create/delete shares
- Share links are unique and randomly generated
- Users must be authenticated to manage shares

## Usage

### In PageView Component

The ShareModal is already integrated into the PageView component:

```tsx
import { PageView } from '@/components/notion';

// The share button appears in the page header
<PageView pageId={pageId} onNavigate={handleNavigate} />
```

### Standalone Usage

You can also use the ShareModal independently:

```tsx
import { ShareModal } from '@/components/notion';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Share</button>
      <ShareModal
        pageId="page-id"
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
```

### Using the Hooks Directly

```tsx
import { useShares, useCreateShare, useDeleteShare } from '@/hooks/useShares';

function MyComponent({ pageId }: { pageId: string }) {
  // Fetch shares
  const { data: shares, isLoading } = useShares(pageId);
  
  // Create share mutation
  const createShare = useCreateShare();
  
  // Delete share mutation
  const deleteShare = useDeleteShare();
  
  const handleCreateShare = async () => {
    await createShare.mutateAsync({
      pageId,
      permission: 'view',
    });
  };
  
  const handleDeleteShare = async (shareId: string) => {
    await deleteShare.mutateAsync(shareId);
  };
  
  return (
    <div>
      {shares?.map(share => (
        <div key={share.id}>
          {share.share_link} - {share.permission}
          <button onClick={() => handleDeleteShare(share.id)}>
            Revoke
          </button>
        </div>
      ))}
      <button onClick={handleCreateShare}>Create Share</button>
    </div>
  );
}
```

### Using the API Directly

```tsx
import { createShare, getShares, deleteShare } from '@/api/shareAPI';

// Create a share
const share = await createShare('page-id', 'view');
console.log('Share link:', share.share_link);

// Get all shares for a page
const shares = await getShares('page-id');

// Delete a share
await deleteShare('share-id');
```

## Share Link Format

Share links are generated in the format:
```
https://your-domain.com/notion/shared/{share_link}
```

The `share_link` is a randomly generated string that uniquely identifies the share.

## Database Schema

The `page_shares` table structure:

```sql
CREATE TABLE page_shares (
  id UUID PRIMARY KEY,
  page_id UUID REFERENCES pages(id),
  shared_by UUID REFERENCES auth.users(id),
  shared_with UUID REFERENCES auth.users(id), -- null for public links
  permission TEXT CHECK (permission IN ('view', 'edit')),
  share_link TEXT UNIQUE,
  created_at TIMESTAMPTZ
);
```

## RLS Policies

The following RLS policies are in place:

1. **View shared pages**: Users can view pages shared with them
2. **Edit shared pages**: Users can edit pages shared with "edit" permission
3. **Manage shares**: Only page owners can create/delete shares

## Requirements Satisfied

This implementation satisfies the following acceptance criteria:

- **AC-8.1**: Users can share pages via link ✓
- **AC-8.2**: Users can set permissions (view only, can edit) ✓
- **AC-8.3**: Users can see who has access to a page ✓
- **AC-8.4**: Users can revoke access ✓

## Testing

Unit tests are available in `src/api/__tests__/shareAPI.test.ts` covering:
- Share creation with different permissions
- Share deletion and access control
- Error handling for invalid operations
- Fetching shares for a page

Run tests with:
```bash
npm test -- run src/api/__tests__/shareAPI.test.ts
```
