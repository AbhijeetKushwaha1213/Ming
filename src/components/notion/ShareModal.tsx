import { useState } from 'react';
import { Copy, Check, Trash2, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useShares, useCreateShare, useDeleteShare } from '@/hooks/useShares';
import type { PageShare } from '@/types/notion';

interface ShareModalProps {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ pageId, open, onOpenChange }: ShareModalProps) {
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch existing shares
  const { data: shares, isLoading } = useShares(pageId);

  // Mutations
  const createShareMutation = useCreateShare();
  const deleteShareMutation = useDeleteShare();

  // Handle creating a new share
  const handleCreateShare = async () => {
    try {
      await createShareMutation.mutateAsync({
        pageId,
        permission,
      });

      toast({
        title: 'Share link created',
        description: 'Your share link has been created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create share link',
        variant: 'destructive',
      });
    }
  };

  // Handle copying share link to clipboard
  const handleCopyLink = async (share: PageShare) => {
    const fullUrl = `${window.location.origin}/notion/shared/${share.share_link}`;
    
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(share.id);
      
      toast({
        title: 'Link copied',
        description: 'Share link copied to clipboard.',
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Handle deleting a share
  const handleDeleteShare = async (shareId: string) => {
    try {
      await deleteShareMutation.mutateAsync(shareId);

      toast({
        title: 'Share revoked',
        description: 'The share link has been revoked.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke share',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Page
          </DialogTitle>
          <DialogDescription>
            Create a share link to give others access to this page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new share section */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="permission">Permission</Label>
              <Select
                value={permission}
                onValueChange={(value) => setPermission(value as 'view' | 'edit')}
              >
                <SelectTrigger id="permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Can view</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreateShare}
              disabled={createShareMutation.isPending}
              className="w-full"
            >
              {createShareMutation.isPending ? 'Creating...' : 'Create Share Link'}
            </Button>
          </div>

          {/* Existing shares list */}
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading shares...
            </div>
          ) : shares && shares.length > 0 ? (
            <div className="space-y-2">
              <Label>Active Shares</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">
                          {share.permission}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          •
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {share.share_link}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created {new Date(share.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyLink(share)}
                        disabled={copiedId === share.id}
                      >
                        {copiedId === share.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteShare(share.id)}
                        disabled={deleteShareMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
              No active shares. Create one to get started.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
