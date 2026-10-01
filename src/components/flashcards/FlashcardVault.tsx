
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Brain, FileQuestion, GitBranch, FileText, Search, Filter, Play, Trash2, Calendar } from 'lucide-react';
import { useFlashcards } from '@/hooks/useFlashcards';
import { FlashcardViewer } from './FlashcardViewer';
import { QuizViewer } from './QuizViewer';
import { MindMapViewer } from './MindMapViewer';
import { format } from 'date-fns';

export const FlashcardVault = () => {
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


  const materialIcons = {
    flashcards: BookOpen,
    mindmaps: Brain,
    quizzes: FileQuestion,
    diagrams: GitBranch,
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
      const searchFields = [
        item.title?.toLowerCase() || '',
        item.topic?.toLowerCase() || '',
        item.question?.toLowerCase() || ''
      ];
      
      const matchesSearch = searchTerm === '' || searchFields.some(field => 
        field.includes(searchTerm.toLowerCase())
      );
      
      const matchesDifficulty = filterDifficulty === 'all' || 
        item.difficulty?.toLowerCase() === filterDifficulty.toLowerCase();
      
      const matchesType = filterType === 'all' || 
        (type && type === filterType) || 
        item.type === filterType;
      
      return matchesSearch && matchesDifficulty && matchesType;
    });
  };

  const handleView = (content: any, type: string) => {
    console.log('Opening viewer for:', type, content);
    setViewingContent(content);
    setViewerType(type);
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
    const IconComponent = materialIcons[type as keyof typeof materialIcons] || FileText;
    
    return (
      <Card key={item.id} className="p-4 card-interactive">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <IconComponent className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground line-clamp-1">{item.title || 'Untitled'}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={`text-xs border ${getDifficultyColor(item.difficulty)}`}>
              {item.difficulty || 'medium'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {type === 'flashcards' ? 'flashcard' : type}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {type === 'flashcards' && item.question && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              <strong>Q:</strong> {item.question}
            </p>
          )}
          
          {item.topic && (
            <p className="text-sm text-muted-foreground">
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
          
          <div className="flex items-center text-xs text-muted-foreground space-x-2">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(item.created_at), 'MMM dd, yyyy')}</span>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleView(item, type)}
            className="flex-1"
          >
            <Play className="w-3 h-3 mr-1" />
            {type === 'flashcards' ? 'Study' : 'View'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(item.id, type)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </Card>
    );
  };

  // Show viewer if content is being viewed
  if (viewingContent) {
    switch (viewerType) {
      case 'flashcards':
        const flashcardData = [{
          question: viewingContent.question,
          answer: viewingContent.answer,
          hint: viewingContent.hint
        }];
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
        return (
          <QuizViewer
            questions={viewingContent.content?.questions || []}
            title={viewingContent.title}
            difficulty={viewingContent.difficulty}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
      
      case 'mindmaps':
        return (
          <MindMapViewer
            mindmap={viewingContent.content}
            title={viewingContent.title}
            difficulty={viewingContent.difficulty}
            onClose={() => {
              setViewingContent(null);
              setViewerType('');
            }}
          />
        );
      
      default:
        return (
          <div className="space-y-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setViewingContent(null);
                setViewerType('');
              }}
            >
              ← Back to Vault
            </Button>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{viewingContent.title}</h3>
              <div className="space-y-4">
                {viewerType === 'notes' && viewingContent.content ? (
                  <div className="space-y-4">
                    {viewingContent.content.summary && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Summary</h4>
                        <p className="text-muted-foreground">{viewingContent.content.summary}</p>
                      </div>
                    )}
                    
                    {viewingContent.content.key_points && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Key Points</h4>
                        <div className="space-y-2">
                          {viewingContent.content.key_points.map((point: any, index: number) => (
                            <div key={index} className="border-l-4 border-blue-500 pl-4">
                              <h5 className="font-medium">{point.heading}</h5>
                              <p className="text-muted-foreground">{point.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {viewingContent.content.quick_facts && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Quick Facts</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {viewingContent.content.quick_facts.map((fact: string, index: number) => (
                            <li key={index} className="text-muted-foreground">{fact}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded">
                    {JSON.stringify(viewingContent.content, null, 2)}
                  </pre>
                )}
              </div>
            </Card>
          </div>
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
  
  // Combine all for unified display
  const allFilteredContent = [
    ...filteredFlashcards.map(f => ({ ...f, type: 'flashcards' })),
    ...filteredMaterials
  ];

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
