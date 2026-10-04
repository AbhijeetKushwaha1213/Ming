
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Brain, FileQuestion, GitBranch, GitFork, FileText, Search, Filter, Play, Trash2, Calendar, FolderPlus, ExternalLink, Loader2 } from 'lucide-react';
import { useFlashcards } from '@/hooks/useFlashcards';
import { FlashcardViewer } from './FlashcardViewer';
import { QuizViewer } from './QuizViewer';
import { MindMapViewer } from './MindMapViewer';
import { StudyNotesViewer } from './StudyNotesViewer';
import { DAGViewer } from './DAGViewer';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { copyVaultItemToResources } from '@/utils/vaultToResources';
import { navigateToTab } from '@/utils/navigation';
import { pageKeys } from '@/hooks/usePages';

export const FlashcardVault = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    flashcards, 
    studyMaterials, 
    isLoading, 
    deleteFlashcard, 
    deleteStudyMaterial 
  } = useFlashcards();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [viewerType, setViewerType] = useState<string>('');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const handleCopyToResources = async (item: any, type: string) => {
    try {
      setCopyingId(item.id || 'current');
      const page = await copyVaultItemToResources(item, type);
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast({
        title: 'Copied to Resources! 📚',
        description: `"${page.title}" is now available in your Resources workspace.`,
        action: (
          <Button
            size="sm"
            variant="default"
            onClick={() => navigateToTab('resources', undefined, { pageId: page.id })}
            className="text-xs"
          >
            Open Resources
          </Button>
        ),
      });
    } catch (err: any) {
      console.error('Failed to copy to resources:', err);
      toast({
        title: 'Error Copying to Resources',
        description: err.message || 'Could not copy item to Resources.',
        variant: 'destructive',
      });
    } finally {
      setCopyingId(null);
    }
  };


  const materialIcons = {
    flashcards: BookOpen,
    mindmaps: Brain,
    quizzes: FileQuestion,
    diagrams: GitBranch,
    dag: GitFork,
    'learning-path': GitFork,
    notes: FileText
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-success/10 text-success border-success/30';
      case 'medium': return 'bg-warning/10 text-warning border-warning/30';
      case 'hard': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const filterContent = (items: any[], type?: string) => {
    return items.filter(item => {
      // Exclude DAG items from My Vault — DAGs live exclusively in the dedicated DAG Pipeline
      const isItemDAG = item.content?.type === 'dag' || item.type === 'dag' || item.tags?.includes('dag');
      if (isItemDAG) return false;

      const searchFields = [
        item.title?.toLowerCase() || '',
        item.topic?.toLowerCase() || '',
        item.question?.toLowerCase() || '',
        item.description?.toLowerCase() || '',
        (typeof item.content === 'string' ? item.content.toLowerCase() : ''),
        item.content?.summary?.toLowerCase() || '',
        item.content?.notes?.summary?.toLowerCase() || '',
      ];
      
      const matchesSearch = searchTerm === '' || searchFields.some(field => 
        field.includes(searchTerm.toLowerCase())
      );
      
      const matchesDifficulty = filterDifficulty === 'all' || 
        item.difficulty?.toLowerCase() === filterDifficulty.toLowerCase();
      
      const matchesType = filterType === 'all' || (type && type === filterType) || item.type === filterType;
      
      return matchesSearch && matchesDifficulty && matchesType;
    });
  };

  const handleView = (content: any, type: string) => {
    const isDAG = content.content?.type === 'dag' || content.type === 'dag' || content.tags?.includes('dag') || !!content.content?.graphData;
    const effectiveType = isDAG ? 'dag' : type;
    console.log('Opening viewer for:', effectiveType, content);
    setViewingContent(content);
    setViewerType(effectiveType);
  };

  const handleDelete = (id: string, type: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      if (type === 'flashcards') {
        deleteFlashcard(id);
      } else {
        deleteStudyMaterial(id);
      }
    }
  };

  const renderContentCard = (item: any, type: string) => {
    const isDAG = item.content?.type === 'dag' || item.type === 'dag' || item.tags?.includes('dag') || !!item.content?.graphData;
    const IconComponent = isDAG ? GitFork : (materialIcons[type as keyof typeof materialIcons] || FileText);
    const displayType = isDAG ? 'DAG / Learning Path' : (type === 'flashcards' ? 'flashcard' : type);
    const previewText = 
      (isDAG && item.content?.summary) ||
      (isDAG && item.content?.graphData?.nodes?.length ? `${item.content.graphData.nodes.length} Concepts • ${item.content.learningGoal || 'Concept Mastery'}` : '') ||
      item.content?.summary || 
      item.content?.notes?.summary || 
      (typeof item.content?.content === 'string' ? item.content.content : '') ||
      (typeof item.content === 'string' ? item.content : '') ||
      item.description || 
      '';
    
    return (
      <Card key={item.id} className="p-4 card-interactive hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <IconComponent className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground line-clamp-1">{item.title || 'Untitled'}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={`text-xs border ${getDifficultyColor(item.difficulty)}`}>
              {item.difficulty || 'medium'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {displayType}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {type === 'flashcards' && item.question && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              <strong>Q:</strong> {item.question}
            </p>
          )}

          {previewText && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {previewText}
            </p>
          )}
          
          {item.topic && (
            <p className="text-xs text-muted-foreground">
              <strong>Topic:</strong> {item.topic}
            </p>
          )}
          
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 3).map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{item.tags.length - 3} more</span>
              )}
            </div>
          )}
          
          <div className="flex items-center text-xs text-muted-foreground space-x-2 pt-1">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(item.created_at || Date.now()), 'MMM dd, yyyy')}</span>
          </div>
        </div>

        <div className="flex space-x-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleView(item, type)}
            className="flex-1 text-xs"
          >
            <Play className="w-3.5 h-3.5 mr-1 text-primary" />
            {type === 'flashcards' ? 'Study' : 'View'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyToResources(item, type)}
            disabled={copyingId === (item.id || 'current')}
            className="text-xs text-primary hover:text-primary hover:bg-primary/10"
            title="Copy this item to your Resources workspace"
          >
            {copyingId === (item.id || 'current') ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <FolderPlus className="w-3.5 h-3.5 mr-1" />
            )}
            To Resources
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(item.id, type)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Delete item"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>
    );
  };

  // Show viewer if content is being viewed
  if (viewingContent) {
    switch (viewerType) {
      case 'flashcards':
        const flashcardData = viewingContent.content?.flashcards || 
          (viewingContent.question ? [{
            question: viewingContent.question,
            answer: viewingContent.answer,
            hint: viewingContent.hint
          }] : []);
        return (
          <FlashcardViewer
            flashcards={flashcardData}
            title={viewingContent.title}
            difficulty={viewingContent.difficulty}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
      
      case 'quizzes':
        const quizQuestions = viewingContent.content?.questions || 
                             viewingContent.content?.quiz || 
                             (Array.isArray(viewingContent.content) ? viewingContent.content : []);
        return (
          <QuizViewer
            questions={quizQuestions}
            title={viewingContent.title}
            difficulty={viewingContent.difficulty}
            topic={viewingContent.topic}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
      
      case 'mindmaps':
        const mindmapData = viewingContent.content?.mindmap || viewingContent.content;
        return (
          <MindMapViewer
            mindmap={mindmapData}
            title={viewingContent.title}
            difficulty={viewingContent.difficulty}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );

      case 'dag':
        const dagGraph = viewingContent.content?.graphData || viewingContent.content;
        return (
          <DAGViewer
            dagData={dagGraph}
            title={viewingContent.title}
            topic={viewingContent.topic}
            difficulty={viewingContent.difficulty}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
      
      default:
        return (
          <StudyNotesViewer
            notes={viewingContent.content}
            title={viewingContent.title}
            topic={viewingContent.topic}
            difficulty={viewingContent.difficulty}
            materialId={viewingContent.id}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Loading your study materials...</p>
        </div>
      </div>
    );
  }

  // Combine all content for display - separate flashcards from study materials
  const filteredFlashcards = filterContent(flashcards, 'flashcards');
  const filteredMaterials = filterContent(studyMaterials);
  
  // Combine all for unified display and ensure strict deduplication
  const rawCombined = [
    ...filteredFlashcards.map(f => ({ ...f, type: 'flashcards' })),
    ...filteredMaterials
  ];

  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  const allFilteredContent = rawCombined.filter(item => {
    if (!item) return false;
    if (item.id && seenIds.has(item.id)) return false;

    // Suppress ghost notes if a rich version (diagram, mindmap, quiz) exists
    if (item.type === 'notes') {
      const summary = (item.content?.summary || item.description || (typeof item.content === 'string' ? item.content : '')).toLowerCase();
      const isGhost = /ai generated (diagram|mindmap|quiz|flashcard)/i.test(summary);
      if (isGhost) {
        const normTitle = (item.title || '').trim().toLowerCase();
        const hasRich = rawCombined.some(other => other.id !== item.id && (other.title || '').trim().toLowerCase() === normTitle && other.type !== 'notes');
        if (hasRich) return false;
      }
    }

    const key = `${(item.title || item.question || '').trim().toLowerCase()}::${(item.type || '').toLowerCase()}`;
    if (seenKeys.has(key)) {
      return false;
    }

    if (item.id) seenIds.add(item.id);
    seenKeys.add(key);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gradient">Study Vault</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by title, topic, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-full sm:w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="flashcards">Flashcards</SelectItem>
              <SelectItem value="quizzes">Quizzes</SelectItem>
              <SelectItem value="mindmaps">Mind Maps</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
              <SelectItem value="diagrams">Diagrams</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allFilteredContent.map(item => renderContentCard(item, item.type))}
      </div>

      {/* Empty State */}
      {allFilteredContent.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {flashcards.length === 0 && studyMaterials.length === 0 
              ? "No study materials yet" 
              : "No materials match your search"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {flashcards.length === 0 && studyMaterials.length === 0 
              ? "Switch to the Generate tab to create your first flashcards, quizzes, or notes!" 
              : "Try adjusting your search terms or filters"}
          </p>
        </div>
      )}
    </div>
  );
};
