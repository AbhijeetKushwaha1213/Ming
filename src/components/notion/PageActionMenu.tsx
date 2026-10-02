import React, { useState } from 'react';
import { 
  MoreHorizontal, 
  Star, 
  Edit3, 
  Copy, 
  FolderInput, 
  Link2, 
  Trash2, 
  Folder,
  Home,
  Check
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { pageKeys, usePages } from '@/hooks/usePages';
import { getPage, createPage, updatePage, deletePage, movePage } from '@/api/pageAPI';
import type { Page } from '@/types/notion';
import { format } from 'date-fns';

interface PageActionMenuProps {
  page: Page;
  trigger?: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}

export function PageActionMenu({
  page,
  trigger,
  align = 'end',
  className = '',
}: PageActionMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pagesQuery = usePages(null);
  const allRootPages = pagesQuery?.data;

  // Modal dialog states
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync title when opening rename modal
  const handleOpenRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNewTitle(page.title);
    setIsRenameOpen(true);
  };

  // 1. Rename
  const handleConfirmRename = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTitle.trim()) return;

    setIsProcessing(true);
    try {
      await updatePage(page.id, { title: newTitle.trim() });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studymate-page-updated', { detail: { pageId: page.id } }));
      }
      toast({
        title: 'Page Renamed',
        description: `Renamed to "${newTitle.trim()}"`,
      });
      setIsRenameOpen(false);
    } catch (err: any) {
      toast({
        title: 'Rename Failed',
        description: err.message || 'Could not rename page',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Duplicate
  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      let content = page.content || [];
      try {
        const fullPage = await getPage(page.id);
        if (fullPage?.content) content = fullPage.content;
      } catch {}

      const duplicateTitle = `${page.title} (Copy)`;
      const newPage = await createPage({
        title: duplicateTitle,
        icon: page.icon,
        cover_image: page.cover_image,
        parent_id: page.parent_id,
        content: content,
      });

      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studymate-page-created', { detail: { pageId: newPage.id } }));
        window.dispatchEvent(new CustomEvent('studymate-select-resource-page', { detail: { pageId: newPage.id } }));
      }

      toast({
        title: 'Page Duplicated',
        description: `Created "${duplicateTitle}"`,
      });
    } catch (err: any) {
      toast({
        title: 'Duplicate Failed',
        description: err.message || 'Could not duplicate page',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Move To
  const handleSelectMoveDestination = async (targetParentId: string | null) => {
    if (targetParentId === page.id) return;
    setIsProcessing(true);
    try {
      const oldParentId = page.parent_id;
      const movedPage = await movePage(page.id, targetParentId, 0);

      // Optimistically update old parent's query list
      queryClient.setQueryData<Page[]>(pageKeys.list(oldParentId), (old) => {
        if (!old) return [];
        return old.filter((p) => p.id !== page.id);
      });
      queryClient.setQueriesData<Page[]>({ queryKey: pageKeys.list(oldParentId) }, (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== page.id);
      });

      // Optimistically update target parent's query list
      const itemToInsert = { ...page, ...movedPage, parent_id: targetParentId };
      queryClient.setQueryData<Page[]>(pageKeys.list(targetParentId), (old) => {
        if (!old) return [itemToInsert];
        return [...old.filter((p) => p.id !== page.id), itemToInsert];
      });
      queryClient.setQueriesData<Page[]>({ queryKey: pageKeys.list(targetParentId) }, (old) => {
        if (!old) return [itemToInsert];
        return [...old.filter((p) => p.id !== page.id), itemToInsert];
      });

      queryClient.setQueryData(pageKeys.detail(page.id), movedPage);
      await queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studymate-page-updated', { detail: { pageId: page.id } }));
        window.dispatchEvent(
          new CustomEvent('studymate-page-moved', {
            detail: {
              pageId: page.id,
              oldParentId,
              targetParentId,
            },
          })
        );
        window.dispatchEvent(new CustomEvent('studymate-resources-updated'));
      }

      toast({
        title: 'Page Moved',
        description: targetParentId ? `Moved "${page.title}" into folder` : `Moved "${page.title}" to Workspace Root`,
      });
      setIsMoveOpen(false);
    } catch (err: any) {
      toast({
        title: 'Move Failed',
        description: err.message || 'Could not move page',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Toggle Favorite
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextFavorite = !page.is_favorite;
      await updatePage(page.id, { is_favorite: nextFavorite });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast({
        title: nextFavorite ? 'Added to Favorites' : 'Removed from Favorites',
        description: `"${page.title}"`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to update favorites',
        variant: 'destructive',
      });
    }
  };

  // 5. Copy Link
  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/?tab=resources&pageId=${page.id}`;
      navigator.clipboard.writeText(url);
      toast({
        title: 'Link Copied',
        description: 'Page link copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  // 6. Delete Page
  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await deletePage(page.id);
      // Immediately remove page from all cached lists in react-query
      queryClient.setQueriesData<Page[]>({ queryKey: pageKeys.lists() }, (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== page.id);
      });
      queryClient.removeQueries({ queryKey: pageKeys.detail(page.id) });
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('studymate-page-deleted', { detail: { pageId: page.id } }));
        window.dispatchEvent(new CustomEvent('studymate-resources-updated'));
      }
      toast({
        title: 'Page Deleted',
        description: `"${page.title}" has been deleted`,
      });
      setIsDeleteOpen(false);
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err.message || 'Could not delete page',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Format date
  let formattedDate = 'Recently';
  try {
    if (page.updated_at) {
      formattedDate = format(new Date(page.updated_at), 'MMM d, yyyy h:mm a');
    }
  } catch {}

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={`p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center justify-center ${className}`}
              aria-label="Page options"
              title="Page options (Rename, Delete, Move, Copy link)"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align={align}
          className="w-56 p-1 bg-popover/98 backdrop-blur-md border border-border/80 rounded-xl shadow-xl z-50 text-popover-foreground animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Favorite Toggle */}
          <DropdownMenuItem
            onClick={handleToggleFavorite}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${page.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            <span>{page.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          {/* Copy Link */}
          <DropdownMenuItem
            onClick={handleCopyLink}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Copy link</span>
            </div>
          </DropdownMenuItem>

          {/* Duplicate */}
          <DropdownMenuItem
            onClick={handleDuplicate}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Duplicate</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-mono">⌘D</span>
          </DropdownMenuItem>

          {/* Rename */}
          <DropdownMenuItem
            onClick={handleOpenRename}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Rename</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-mono">⌘R</span>
          </DropdownMenuItem>

          {/* Move To */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsMoveOpen(true);
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Move to</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-mono">⌘P</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border/40" />

          {/* Delete Page */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsDeleteOpen(true);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Move to Trash</span>
          </DropdownMenuItem>

          {/* Last Edited Footer */}
          <div className="px-2.5 pt-2 pb-1 border-t border-border/30 mt-1">
            <span className="text-[10px] text-muted-foreground/70 block leading-tight">
              Last edited {formattedDate}
            </span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* RENAME DIALOG */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-primary" /> Rename Page
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleConfirmRename} className="space-y-4 pt-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new page title"
              autoFocus
              className="w-full text-sm"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRenameOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isProcessing || !newTitle.trim()}>
                {isProcessing ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MOVE TO DIALOG */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-primary" /> Move "{page.title}"
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1 max-h-64 overflow-y-auto pr-1">
            <p className="text-xs text-muted-foreground mb-2">Select destination folder or root:</p>

            {/* Root Option */}
            <button
              type="button"
              onClick={() => handleSelectMoveDestination(null)}
              disabled={page.parent_id === null || isProcessing}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                page.parent_id === null 
                  ? 'bg-accent/50 border-border text-muted-foreground cursor-not-allowed' 
                  : 'hover:bg-accent border-transparent hover:border-border/60 text-foreground'
              }`}
            >
              <Home className="w-4 h-4 text-primary" />
              <span className="font-medium flex-1">Workspace Root (Top level)</span>
              {page.parent_id === null && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>

            {/* Other Pages / Folders */}
            {(allRootPages || [])
              .filter((p) => p.id !== page.id)
              .map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => handleSelectMoveDestination(target.id)}
                  disabled={page.parent_id === target.id || isProcessing}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                    page.parent_id === target.id
                      ? 'bg-accent/50 border-border text-muted-foreground cursor-not-allowed'
                      : 'hover:bg-accent border-transparent hover:border-border/60 text-foreground'
                  }`}
                >
                  <Folder className="w-4 h-4 text-amber-500" />
                  <span className="truncate flex-1 font-medium">{target.title}</span>
                  {page.parent_id === target.id && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMoveOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete Page?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{page.title}"</span>? You can recreate it anytime with the AI assistant.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
