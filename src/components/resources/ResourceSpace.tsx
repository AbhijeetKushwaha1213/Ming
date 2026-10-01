import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createPdfSignedUrl,
  createResource,
  deletePdfResource,
  deleteResource,
  listResources,
  uploadPdfResource,
} from '@/api/resourceAPI';
import type { CreateResourceInput, ResourceItem, ResourceType } from '@/types/resource';
import { Plus, Search, Filter, FileText, Link as LinkIcon, StickyNote, Folder, X, Trash2, Loader2, Upload, ExternalLink } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

const RESOURCE_TYPE_OPTIONS: ResourceType[] = ['NOTE', 'LINK', 'PDF'];

const emptyForm = {
  title: '',
  description: '',
  type: 'NOTE' as ResourceType,
  linkUrl: '',
  noteContent: '',
  folder: '',
  tags: [] as string[],
};

export const ResourceSpace = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resourceApiError, setResourceApiError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newResource, setNewResource] = useState(emptyForm);
  const [newTag, setNewTag] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const folders = useMemo(
    () =>
      Array.from(
        new Set(resources.map((resource) => resource.folder).filter(Boolean) as string[]),
      ).sort(),
    [resources],
  );

  useEffect(() => {
    if (!user?.user_id) {
      setIsLoading(false);
      return;
    }

    void fetchResources();
  }, [user?.user_id]);

  const getResourceApiHelpText = (message: string) => {
    if (message.includes('Resource API error (401)')) {
      return 'Your resource API request is unauthorized. Sign out and sign back in, then try again.';
    }

    if (message.includes('Resource API error (404)')) {
      return 'The Node resource API route was not found. Start the backend with `npm run dev` or `npm run dev:api` and verify Vite is proxying `/api` to port 3001.';
    }

    if (message === 'Resource API error (500): 500 Internal Server Error') {
      return 'Vite could not get a valid response from the Node resource API on port 3001. Restart the dev stack with `npm run dev` and check the API terminal for startup failures.';
    }

    if (message === 'Resource API error (500): Internal server error') {
      return 'The Node resource API returned a server error. Check the API terminal logs and confirm Turso credentials/connectivity are valid.';
    }

    if (message.includes('User not authenticated') || message.includes('Missing bearer token')) {
      return 'Your session is missing for the resource API. Sign out and sign back in, then try again.';
    }

    if (message.includes('Failed to fetch') || message.includes('Resource API request failed')) {
      return 'The Node resource API is not reachable. Start it with `npm run dev` or `npm run dev:api` and make sure Vite is proxying `/api` requests.';
    }

    if (message.includes('Internal server error')) {
      return 'The resource API is running but failed on the server side. Check the Node API logs and confirm Turso is reachable.';
    }

    return message;
  };

  const fetchResources = async () => {
    if (!user?.user_id) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await listResources();
      setResources(Array.isArray(data) ? data : []);
      setResourceApiError(null);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      setResources([]);
      setResourceApiError(
        getResourceApiHelpText(
          error instanceof Error ? error.message : 'Unable to load resources.',
        ),
      );
      toast({
        title: 'Unable to load resources',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewResource(emptyForm);
    setNewTag('');
    setSelectedFile(null);
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (!tag || newResource.tags.includes(tag)) {
      return;
    }

    setNewResource((current) => ({
      ...current,
      tags: [...current.tags, tag],
    }));
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewResource((current) => ({
      ...current,
      tags: current.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleAddResource = async () => {
    if (!user?.user_id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save resources.',
        variant: 'destructive',
      });
      return;
    }

    if (!newResource.title.trim()) {
      toast({
        title: 'Title required',
        description: 'Add a title before saving the resource.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    let uploadedStoragePath: string | undefined;

    try {
      const payload: CreateResourceInput = {
        title: newResource.title.trim(),
        description: newResource.description.trim() || undefined,
        type: newResource.type,
        folder: newResource.folder.trim() || undefined,
        tags: newResource.tags,
      };

      if (newResource.type === 'NOTE') {
        payload.noteContent = newResource.noteContent.trim();
      }

      if (newResource.type === 'LINK') {
        payload.linkUrl = newResource.linkUrl.trim();
      }

      if (newResource.type === 'PDF') {
        if (!selectedFile) {
          throw new Error('Choose a PDF file before saving.');
        }

        const upload = await uploadPdfResource(selectedFile, user.user_id);
        uploadedStoragePath = upload.storagePath;
        payload.fileUrl = upload.fileUrl;
        payload.storagePath = upload.storagePath;
      }

      const resource = await createResource(payload);
      setResources((current) => [resource, ...current]);
      setResourceApiError(null);
      resetForm();
      setShowAddDialog(false);

      toast({
        title: 'Resource saved',
        description: `${resource.title} is now available in your vault.`,
      });
    } catch (error) {
      if (uploadedStoragePath) {
        await deletePdfResource(uploadedStoragePath).catch(() => undefined);
      }

      console.error('Failed to save resource:', error);
      toast({
        title: 'Failed to save resource',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteResource = async (resource: ResourceItem) => {
    try {
      if (resource.type === 'PDF') {
        await deletePdfResource(resource.storagePath);
      }

      await deleteResource(resource.id);
      setResources((current) => current.filter((item) => item.id !== resource.id));

      toast({
        title: 'Resource deleted',
        description: `${resource.title} has been removed.`,
      });
    } catch (error) {
      console.error('Failed to delete resource:', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenResource = async (resource: ResourceItem) => {
    try {
      if (resource.type === 'LINK' && resource.linkUrl) {
        window.open(resource.linkUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (resource.type === 'PDF' && resource.storagePath) {
        const signedUrl = await createPdfSignedUrl(resource.storagePath);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (resource.type === 'NOTE') {
        toast({
          title: resource.title,
          description: resource.noteContent || 'No content saved for this note.',
        });
      }
    } catch (error) {
      console.error('Failed to open resource:', error);
      toast({
        title: 'Unable to open resource',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const haystack = [
        resource.title,
        resource.description || '',
        resource.noteContent || '',
        resource.linkUrl || '',
        ...resource.tags,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || resource.type === selectedType;
      const matchesFolder = selectedFolder === 'all' || resource.folder === selectedFolder;

      return matchesSearch && matchesType && matchesFolder;
    });
  }, [resources, searchTerm, selectedType, selectedFolder]);

  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'NOTE':
        return <StickyNote className="w-5 h-5" />;
      case 'LINK':
        return <LinkIcon className="w-5 h-5" />;
      case 'PDF':
        return <FileText className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Resource Space</h1>
          <p className="text-gray-600">Supabase stores the PDFs. Prisma stores the metadata.</p>
        </div>

        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Resource</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Title</label>
                  <Input
                    value={newResource.title}
                    onChange={(event) =>
                      setNewResource((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="Resource title"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Type</label>
                  <Select
                    value={newResource.type}
                    onValueChange={(value: ResourceType) =>
                      setNewResource((current) => ({
                        ...current,
                        type: value,
                        linkUrl: '',
                        noteContent: '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Description</label>
                <Textarea
                  value={newResource.description}
                  onChange={(event) =>
                    setNewResource((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Short description"
                  rows={2}
                />
              </div>

              {newResource.type === 'NOTE' && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Note Content</label>
                  <Textarea
                    value={newResource.noteContent}
                    onChange={(event) =>
                      setNewResource((current) => ({
                        ...current,
                        noteContent: event.target.value,
                      }))
                    }
                    placeholder="Write your note here"
                    rows={6}
                  />
                </div>
              )}

              {newResource.type === 'LINK' && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Link URL</label>
                  <Input
                    value={newResource.linkUrl}
                    onChange={(event) =>
                      setNewResource((current) => ({ ...current, linkUrl: event.target.value }))
                    }
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {newResource.type === 'PDF' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">PDF File</label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4">
                    <Upload className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : 'Choose a PDF up to 10MB'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Folder</label>
                  <Input
                    value={newResource.folder}
                    onChange={(event) =>
                      setNewResource((current) => ({ ...current, folder: event.target.value }))
                    }
                    placeholder="Optional folder"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Tags</label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(event) => setNewTag(event.target.value)}
                      placeholder="exam, chemistry, revision"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {newResource.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {newResource.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      <span>#{tag}</span>
                      <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleAddResource} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Resource
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search resources"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-64"
            />
          </div>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="NOTE">Notes</SelectItem>
              <SelectItem value="LINK">Links</SelectItem>
              <SelectItem value="PDF">PDFs</SelectItem>
            </SelectContent>
          </Select>

          {folders.length > 0 && (
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger className="w-40">
                <Folder className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      {resourceApiError ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            {resourceApiError}
          </p>
        </Card>
      ) : null}

      {filteredResources.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">No resources yet</h3>
          <p className="mb-4 text-gray-600">
            Save notes, links, and PDFs here. PDF files go to Supabase Storage and the metadata goes to Turso.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gray-100 p-2 text-gray-700">
                    {getResourceIcon(resource.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{resource.title}</h3>
                    <p className="text-sm text-gray-500">{resource.type}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500"
                  onClick={() => handleDeleteResource(resource)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {resource.description ? (
                <p className="text-sm text-gray-600">{resource.description}</p>
              ) : null}

              {resource.type === 'NOTE' && resource.noteContent ? (
                <p className="line-clamp-5 text-sm text-gray-700">{resource.noteContent}</p>
              ) : null}

              {resource.type === 'LINK' && resource.linkUrl ? (
                <p className="truncate text-sm text-blue-600">{resource.linkUrl}</p>
              ) : null}

              <div className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-2">
                  {resource.folder ? <Badge variant="outline">{resource.folder}</Badge> : null}
                  {resource.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(resource.createdAt).toLocaleDateString()}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => handleOpenResource(resource)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
