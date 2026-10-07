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
import { ingestSource, searchChunks } from '@/api/ragAPI';
import type { CreateResourceInput, ResourceItem, ResourceType, RagChunk } from '@/types/resource';
import {
  Plus,
  Search,
  Filter,
  FileText,
  Link as LinkIcon,
  StickyNote,
  Folder,
  X,
  Trash2,
  Loader2,
  Upload,
  ExternalLink,
  Presentation,
  Video,
  Database,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

const RESOURCE_TYPE_OPTIONS: ResourceType[] = ['NOTE', 'LINK', 'PDF', 'PPTX', 'VIDEO'];

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

  // Multimodal RAG State
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState<RagChunk[]>([]);
  const [isSearchingRag, setIsSearchingRag] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'rag'>('vault');

  const handleRagSearch = async () => {
    if (!ragQuery.trim()) return;
    setIsSearchingRag(true);
    try {
      const res = await searchChunks(ragQuery, { userId: user?.user_id, topK: 6 });
      setRagResults(res.results || []);
      if (!res.results || res.results.length === 0) {
        toast({
          title: 'No vector matches found',
          description: 'Try searching for different terms or ingest more lecture documents.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Search error',
        description: err.message || 'Failed to search vector store',
        variant: 'destructive',
      });
    } finally {
      setIsSearchingRag(false);
    }
  };

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
        // Index note in background
        ingestSource({
          text: newResource.noteContent.trim(),
          topic: newResource.folder || 'General',
          subtopic: newResource.title,
          userId: user.user_id,
          title: newResource.title,
          sourceType: 'TEXT',
        }).catch(err => console.warn('Note vector indexing:', err));
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

        // Ingest into ChromaDB with page-by-page coordinates
        ingestSource({
          file: selectedFile,
          topic: newResource.folder || 'General',
          subtopic: newResource.title,
          userId: user.user_id,
          title: newResource.title,
          sourceType: 'PDF',
        }).catch(err => console.warn('PDF vector indexing:', err));
      }

      if (newResource.type === 'PPTX') {
        if (!selectedFile) {
          throw new Error('Choose a PPTX / PPT slide deck file before saving.');
        }

        // Ingest into ChromaDB with slide-by-slide coordinates
        await ingestSource({
          file: selectedFile,
          topic: newResource.folder || 'General',
          subtopic: newResource.title,
          userId: user.user_id,
          title: newResource.title,
          sourceType: 'PPTX',
        });
      }

      if (newResource.type === 'VIDEO') {
        if (!selectedFile && !newResource.linkUrl.trim()) {
          throw new Error('Provide a video/audio file or enter a YouTube/lecture link.');
        }

        if (newResource.linkUrl.trim()) {
          payload.linkUrl = newResource.linkUrl.trim();
        }

        // Ingest into ChromaDB with timestamp coordinates
        await ingestSource({
          file: selectedFile || undefined,
          url: newResource.linkUrl.trim() || undefined,
          topic: newResource.folder || 'General',
          subtopic: newResource.title,
          userId: user.user_id,
          title: newResource.title,
          sourceType: 'VIDEO',
        });
      }

      const resource = await createResource(payload);
      setResources((current) => [resource, ...current]);
      setResourceApiError(null);
      resetForm();
      setShowAddDialog(false);

      window.dispatchEvent(new CustomEvent('studymate-resource-added', { detail: resource }));
      window.dispatchEvent(new CustomEvent('studymate-resources-changed'));

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
      window.dispatchEvent(new CustomEvent('studymate-resources-changed'));

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
          <h1 className="font-serif text-3xl font-bold text-foreground">Resource Space</h1>
          <p className="text-muted-foreground">Manage your documents, research PDFs, lecture slides, and knowledge base.</p>
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
                  <label className="block text-sm font-medium text-foreground">PDF File (Textbook / Chapter / Paper)</label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 hover:border-primary/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
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

              {newResource.type === 'PPTX' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">Slide Deck File (PPTX / PPT)</label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 hover:border-primary/50 transition-colors">
                    <Presentation className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-muted-foreground">
                      {selectedFile ? selectedFile.name : 'Choose a PPTX / PPT slide deck'}
                    </span>
                    <input
                      type="file"
                      accept=".pptx,.ppt"
                      className="hidden"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}

              {newResource.type === 'VIDEO' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Lecture Video URL (YouTube / Video Stream)</label>
                    <Input
                      value={newResource.linkUrl}
                      onChange={(event) =>
                        setNewResource((current) => ({ ...current, linkUrl: event.target.value }))
                      }
                      placeholder="https://youtube.com/watch?v=... or direct video link"
                    />
                  </div>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-border"></div>
                    <span className="flex-shrink mx-3 text-xs text-muted-foreground uppercase">Or upload media file</span>
                    <div className="flex-grow border-t border-border"></div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 hover:border-primary/50 transition-colors">
                    <Video className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {selectedFile ? selectedFile.name : 'Upload MP4, WebM, MP3, WAV lecture file'}
                    </span>
                    <input
                      type="file"
                      accept=".mp4,.webm,.mp3,.wav,.m4a"
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

      {/* View Switcher: Document Vault vs Multimodal Knowledge Base (Chroma RAG) */}
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Button
          variant={activeTab === 'vault' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('vault')}
          className="gap-2"
        >
          <Folder className="w-4 h-4" />
          Document Vault ({resources.length})
        </Button>
        <Button
          variant={activeTab === 'rag' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('rag')}
          className="gap-2"
        >
          <Database className="w-4 h-4 text-primary" />
          Multimodal Knowledge Base (Chroma RAG)
          <Badge variant="secondary" className="ml-1 text-[10px] bg-primary/10 text-primary">
            Vector Store
          </Badge>
        </Button>
      </div>

      {activeTab === 'rag' ? (
        <div className="space-y-6">
          {/* Knowledge Base Search Banner */}
          <Card className="p-6 bg-gradient-to-br from-primary/5 via-card to-background border-primary/20">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-5 h-5 text-primary" />
                  <h2 className="font-serif text-lg font-bold text-foreground">Vector Knowledge Base Search</h2>
                  <Badge variant="outline" className="text-xs">ChromaDB</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Semantically query textbook pages, PPTX slides, and lecture video transcripts with exact source origin coordinates.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewResource({ ...emptyForm, type: 'PDF' });
                  setShowAddDialog(true);
                }}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Ingest New Source
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRagSearch();
                    }
                  }}
                  placeholder="Ask a question or enter a topic (e.g. 'Banker algorithm safe state', 'Coffman conditions')..."
                  className="pl-10"
                />
              </div>
              <Button onClick={handleRagSearch} disabled={isSearchingRag} className="gap-2">
                {isSearchingRag ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Semantic Search
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex-wrap">
              <span>Try queries:</span>
              {['Banker algorithm safe state', 'Coffman conditions deadlock', 'Operating systems'].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setRagQuery(q);
                  }}
                  className="underline hover:text-primary transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </Card>

          {/* Search Results */}
          {ragResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>Retrieved Knowledge Chunks</span>
                  <Badge variant="secondary">{ragResults.length} matches</Badge>
                </h3>
                <span className="text-xs text-muted-foreground">Ranked by Cosine Similarity</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {ragResults.map((chunk) => {
                  const loc = chunk.location;
                  const isPdf = loc?.source_type === 'PDF' || loc?.page_number !== null;
                  const isSlide = loc?.source_type === 'SLIDE' || loc?.slide_number !== null;
                  const isVideo = loc?.source_type === 'VIDEO' || loc?.timestamp_start !== null;

                  return (
                    <Card key={chunk.chunk_id} className="p-5 flex flex-col justify-between border-border hover:border-primary/40 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isPdf && (
                              <Badge variant="outline" className="gap-1 border-indigo-500/30 text-indigo-600 bg-indigo-50/50">
                                <BookOpen className="w-3 h-3" />
                                {loc.page_number ? `Page ${loc.page_number}` : 'PDF'}
                              </Badge>
                            )}
                            {isSlide && (
                              <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 bg-amber-50/50">
                                <Presentation className="w-3 h-3" />
                                {loc.slide_number ? `Slide ${loc.slide_number}` : 'Slide'}
                              </Badge>
                            )}
                            {isVideo && (
                              <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-secondary/60">
                                <Clock className="w-3 h-3" />
                                {loc.timestamp_start !== null ? `${Math.floor(Number(loc.timestamp_start) / 60)}m${Math.floor(Number(loc.timestamp_start) % 60)}s` : 'Video'}
                              </Badge>
                            )}
                            {chunk.topic && (
                              <Badge variant="secondary" className="text-xs">
                                {chunk.topic}
                              </Badge>
                            )}
                          </div>
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">
                            {Math.round(chunk.score * 100)}% Match
                          </Badge>
                        </div>

                        {chunk.subtopic && (
                          <div className="text-xs font-medium text-muted-foreground">
                            Section: {chunk.subtopic}
                          </div>
                        )}

                        <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/40 font-mono text-xs">
                          {chunk.text}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-xs text-muted-foreground">
                        <span className="font-mono text-[11px] truncate max-w-[180px]">
                          ID: {chunk.chunk_id}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const citationTag = isPdf
                              ? `[[cite:textbook|${chunk.source_id || 'doc'}|page=${loc.page_number || 1}]]`
                              : isSlide
                              ? `[[cite:slide|${chunk.source_id || 'deck'}|slide=${loc.slide_number || 1}]]`
                              : `[[cite:video|${chunk.source_id || 'vid'}|t=${Math.floor(Number(loc.timestamp_start || 0))}s]]`;
                            navigator.clipboard.writeText(citationTag);
                            toast({
                              title: 'Citation copied',
                              description: citationTag,
                            });
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          Copy Citation Tag
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
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
                  <SelectItem value="PPTX">Slides (PPTX)</SelectItem>
                  <SelectItem value="VIDEO">Videos</SelectItem>
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
              <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">No resources yet</h3>
              <p className="mb-4 text-muted-foreground">
                Save notes, links, and PDFs here to build your verified academic library.
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
                      <div className="rounded-lg bg-secondary p-2 text-primary">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{resource.title}</h3>
                        <p className="text-sm text-muted-foreground">{resource.type}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteResource(resource)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {resource.description ? (
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                  ) : null}

                  {resource.type === 'NOTE' && resource.noteContent ? (
                    <p className="line-clamp-5 text-sm text-foreground/85">{resource.noteContent}</p>
                  ) : null}

                  {resource.type === 'LINK' && resource.linkUrl ? (
                    <p className="truncate text-sm text-emerald-600 dark:text-emerald-400">{resource.linkUrl}</p>
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
                      <span className="text-xs text-muted-foreground">
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
        </>
      )}
    </div>
  );
};
