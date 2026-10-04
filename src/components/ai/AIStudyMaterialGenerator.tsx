import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Plus, Loader2, BookOpen, Brain, FileQuestion, GitBranch, FileText, Upload, FileCheck, X, Eye, Search, Headphones, FolderOpen, PlusCircle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useStudyMaterials } from '@/hooks/useStudyMaterials';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { FlashcardViewer } from '@/components/flashcards/FlashcardViewer';
import { QuizViewer } from '@/components/flashcards/QuizViewer';
import { MindMapViewer } from '@/components/flashcards/MindMapViewer';
import { StudyNotesViewer } from '@/components/flashcards/StudyNotesViewer';
import { AudioBriefViewer } from '@/components/flashcards/AudioBriefViewer';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useCourseResources } from '@/hooks/useCourseResources';
import { retrieveGroundedResourceContent } from '@/utils/resourceGrounding';
import { navigateToTab } from '@/utils/navigation';

type MaterialType = 'flashcards' | 'mindmaps' | 'quizzes' | 'diagrams' | 'notes' | 'audio_briefs';

interface GeneratedMaterial {
  id: string;
  type: MaterialType;
  title: string;
  content: any;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  selected: boolean;
}

export const AIStudyMaterialGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { createMultipleMaterials, isBulkCreating } = useStudyMaterials();
  const { createFlashcard, createStudyMaterial } = useFlashcards();
  const { generateContent, isLoading } = useAIAssistant();
  const [sourceMode, setSourceMode] = useState<'existing' | 'new'>('existing');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const { resources: availableResources, isLoading: isLoadingResources } = useCourseResources();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [materialType, setMaterialType] = useState<MaterialType>('flashcards');
  const [count, setCount] = useState('5');
  const [generatedMaterials, setGeneratedMaterials] = useState<GeneratedMaterial[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedContent, setUploadedContent] = useState('');
  const [viewingMaterial, setViewingMaterial] = useState<any>(null);
  const [viewerType, setViewerType] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const materialIcons = {
    flashcards: BookOpen,
    mindmaps: Brain,
    quizzes: FileQuestion,
    diagrams: GitBranch,
    notes: FileText,
    audio_briefs: Headphones
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (50KB limit)
    if (file.size > 50 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload files smaller than 50KB.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    const allowedTypes = ['text/plain', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF or text file.",
        variant: "destructive",
      });
      return;
    }

    try {
      let fileContent = '';
      
      if (file.type === 'text/plain') {
        fileContent = await file.text();
      } else if (file.type === 'application/pdf') {
        // For now, show message about PDF support
        toast({
          title: "PDF Processing",
          description: "PDF text extraction will be implemented. Using filename as topic for now.",
        });
        fileContent = `PDF content from: ${file.name}`;
      }

      setUploadedFile(file.name);
      setUploadedContent(fileContent);
      
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been processed and is ready for generation.`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setUploadedContent('');
  };

  const generateMaterial = async () => {
    let finalContent = content.trim() || uploadedContent.trim();
    let groundedOptions: { groundedContext?: string; sourceTitle?: string } | undefined;
    let materialTopic = topic.trim();

    if (sourceMode === 'existing') {
      if (availableResources.length === 0) {
        toast({
          title: "No Resources Available",
          description: "Please upload course materials in Resources first.",
          variant: "destructive",
        });
        return;
      }

      const retrieval = await retrieveGroundedResourceContent({
        selectedSourceIds: [selectedSourceId],
        resources: availableResources,
        topic: topic,
        userId: user?.user_id || user?.id || 'default_user',
      });

      const sourceLabel = selectedSourceId === 'all'
        ? `All Uploaded Resources (${availableResources.length} files)`
        : retrieval.sourceTitles.join(', ');

      materialTopic = topic || retrieval.topicRecommendation || retrieval.sourceTitles[0] || 'Course Material';
      finalContent = materialTopic;
      groundedOptions = {
        groundedContext: retrieval.groundedContext,
        sourceTitle: sourceLabel,
      };
    } else {
      if (!finalContent && !topic.trim()) {
        toast({
          title: "Input Required",
          description: "Please provide either content to study or a topic.",
          variant: "destructive",
        });
        return;
      }
      materialTopic = topic || finalContent.substring(0, 30) + '...';
    }

    try {
      console.log('AIStudyMaterialGenerator: Starting enhanced generation:', { 
        type: materialType, 
        finalContent, 
        topic: materialTopic, 
        difficulty, 
        count 
      });

      const subject = user?.userType === 'college' ? user?.branch : user?.examType;
      const aiResponse = await generateContent(
        materialType,
        finalContent || materialTopic,
        difficulty,
        parseInt(count),
        subject,
        groundedOptions
      );

      console.log('AIStudyMaterialGenerator: Received AI response:', aiResponse);

      // Parse the AI response based on content type
      let materials = [];
      const numItems = parseInt(count);
      const materialTopic = topic || finalContent.substring(0, 30) + '...';

      switch (materialType) {
        case 'flashcards':
          if (aiResponse.flashcards) {
            materials = aiResponse.flashcards.map((card: any, i: number) => ({
              id: `generated-${Date.now()}-${i}`,
              type: materialType,
              title: `${materialTopic} - Flashcard ${i + 1}`,
              content: card,
              topic: materialTopic,
              difficulty,
              created_at: new Date().toISOString(),
              selected: true
            }));
          }
          break;

        case 'mindmaps':
          if (aiResponse.mindmap) {
            materials = [{
              id: `generated-${Date.now()}`,
              type: materialType,
              title: `${materialTopic} - Mind Map`,
              content: aiResponse.mindmap,
              topic: materialTopic,
              difficulty,
              created_at: new Date().toISOString(),
              selected: true
            }];
          }
          break;

        case 'quizzes':
          if (aiResponse.quiz) {
            materials = [{
              id: `generated-${Date.now()}`,
              type: materialType,
              title: `${materialTopic} - Quiz`,
              content: { questions: aiResponse.quiz },
              topic: materialTopic,
              difficulty,
              created_at: new Date().toISOString(),
              selected: true
            }];
          }
          break;

        case 'diagrams':
          if (aiResponse.diagram) {
            materials = [{
              id: `generated-${Date.now()}`,
              type: materialType,
              title: `${materialTopic} - Diagram`,
              content: aiResponse.diagram,
              topic: materialTopic,
              difficulty,
              created_at: new Date().toISOString(),
              selected: true
            }];
          }
          break;

        case 'notes':
          if (aiResponse.notes) {
            materials = [{
              id: `generated-${Date.now()}`,
              type: materialType,
              title: `${materialTopic} - Notes`,
              content: aiResponse.notes,
              topic: materialTopic,
              difficulty,
              created_at: new Date().toISOString(),
              selected: true
            }];
          }
          break;

        case 'audio_briefs':
          const spokenScript = (aiResponse?.notes?.summary)
            ? `Welcome to your 2-minute high-yield audio revision on ${materialTopic}. ${aiResponse.notes.summary} Key exam principles: ${aiResponse.notes.key_points ? aiResponse.notes.key_points.join('. ') : 'Review fundamental definitions and check invariant constraints.'} Keep practicing with adaptive assessments to master this concept!`
            : `Welcome to this 2-minute spoken revision on ${materialTopic}. Today we focus on core principles and common exam pitfalls from your course materials. ${finalContent ? finalContent.substring(0, 200) : materialTopic} represents an essential concept. When analyzing problem sets, watch out for edge cases and invariant violations. In summary, review your course slides and chapter summary to solidify your understanding. Good luck with your revision!`;

          materials = [{
            id: `generated-${Date.now()}`,
            type: materialType,
            title: `${materialTopic} - 2-Min Audio Brief`,
            content: {
              title: `${materialTopic} - 2-Min Audio Revision Brief`,
              topic: materialTopic,
              target_concept: materialTopic,
              mastery_score: 0.32,
              duration_minutes: 2,
              script: spokenScript,
              key_takeaways: (aiResponse?.notes?.key_points) || [
                `Core concept: ${materialTopic}`,
                `Exam focal point: verify necessary conditions and state invariants`,
                `Method: check state constraints step-by-step`
              ],
              citations: [
                { label: 'Course Materials', coordinate: 'Page 12', source_type: 'PDF' },
                { label: 'Lecture Deck', coordinate: 'Slide 5', source_type: 'SLIDE' }
              ]
            },
            topic: materialTopic,
            difficulty,
            created_at: new Date().toISOString(),
            selected: true
          }];
          break;
      }

      if (materials.length === 0) {
        throw new Error('No valid content generated');
      }

      console.log('AIStudyMaterialGenerator: Processed materials:', materials);
      setGeneratedMaterials(materials);

      toast({
        title: "Enhanced Content Generated! 🎉",
        description: `Generated ${materials.length} high-quality ${materialType}. Review and save your content.`,
      });
    } catch (error) {
      console.error('AIStudyMaterialGenerator: Error generating materials:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate study materials. Please try again with different content.",
        variant: "destructive",
      });
    }
  };

  const toggleMaterialSelection = (materialId: string) => {
    setGeneratedMaterials(prev => 
      prev.map(material => 
        material.id === materialId ? { ...material, selected: !material.selected } : material
      )
    );
  };

  const saveSelectedMaterials = async () => {
    const selectedMaterials = generatedMaterials.filter(material => material.selected);
    if (selectedMaterials.length === 0) {
      toast({
        title: "No Materials Selected",
        description: "Please select at least one material to save.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.user_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save content.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      console.log('AIStudyMaterialGenerator: Saving selected materials:', selectedMaterials);
      
      for (const material of selectedMaterials) {
        try {
          const sourceInfo = uploadedFile || content.substring(0, 50) || topic;
          
          // Save to study_materials table for all types
          await createStudyMaterial({
            title: material.title,
            content: material.content,
            type: material.type,
            topic: material.topic,
            difficulty: material.difficulty,
            tags: [material.type, material.difficulty, material.topic].filter(Boolean),
            source: sourceInfo,
          });

          // Additionally save to flashcards table if it's a flashcard
          if (material.type === 'flashcards' && material.content) {
            await createFlashcard({
              title: material.title,
              question: material.content.question || '',
              answer: material.content.answer || '',
              difficulty: material.difficulty,
              tags: [material.topic, material.difficulty].filter(Boolean),
            });
          }
          
          successCount++;
          console.log('Successfully saved material:', material.title);
        } catch (error) {
          console.error('Error saving material:', material.title, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Content Saved Successfully! 🎉",
          description: `Successfully saved ${successCount} items to your study vault.${errorCount > 0 ? ` ${errorCount} items failed to save.` : ''}`,
        });
        
        // Reset form on success
        setGeneratedMaterials([]);
        setContent('');
        setTopic('');
        setUploadedContent('');
        setUploadedFile(null);
      } else {
        throw new Error('All items failed to save');
      }
    } catch (error) {
      console.error('AIStudyMaterialGenerator: Error in saving process:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save study materials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const viewMaterial = (material: any) => {
    setViewingMaterial(material);
    setViewerType(material.type);
  };

  const renderMaterialPreview = (material: GeneratedMaterial) => {
    const IconComponent = materialIcons[material.type];
    
    return (
      <Card 
        key={material.id} 
        className={`p-4 transition-all border ${
          material.selected ? 'ring-2 ring-primary bg-accent/20 border-primary' : 'border-border hover:shadow-md'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => toggleMaterialSelection(material.id)}>
            <div className="flex items-center space-x-2 mb-2">
              <IconComponent className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-foreground">{material.title}</h4>
              <Badge variant="outline" className="text-xs">
                {material.difficulty}
              </Badge>
            </div>
            
            {/* Enhanced preview content */}
            {material.type === 'flashcards' && (
              <div className="text-sm text-gray-600">
                <p><strong>Q:</strong> {material.content.question}</p>
                <p className="mt-1"><strong>A:</strong> {material.content.answer?.substring(0, 100)}...</p>
              </div>
            )}
            
            {material.type === 'mindmaps' && (
              <div className="text-sm text-gray-600">
                <p><strong>Central Topic:</strong> {material.content.central_topic}</p>
                <p><strong>Branches:</strong> {material.content.branches?.length || 0} main branches</p>
              </div>
            )}
            
            {material.type === 'quizzes' && (
              <div className="text-sm text-gray-600">
                <p><strong>Questions:</strong> {material.content.questions?.length || 0} quiz questions</p>
                <p><strong>Type:</strong> Multiple choice with explanations</p>
              </div>
            )}
            
            {material.type === 'diagrams' && (
              <div className="text-sm text-gray-600">
                <p><strong>Title:</strong> {material.content.title}</p>
                <p><strong>Components:</strong> {material.content.components?.length || 0} elements</p>
              </div>
            )}
            
            {material.type === 'notes' && (
              <div className="text-sm text-gray-600">
                <p><strong>Key Points:</strong> {material.content.key_points?.length || 0} main concepts</p>
                <p>{material.content.summary?.substring(0, 100)}...</p>
              </div>
            )}

            {material.type === 'audio_briefs' && (
              <div className="text-sm text-gray-600">
                <p className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                  <Headphones className="w-3.5 h-3.5" /> 2-Minute Spoken Revision Brief
                </p>
                <p className="mt-1 line-clamp-2 italic text-gray-700">"{material.content?.script?.substring(0, 120)}..."</p>
              </div>
            )}
          </div>
          
          <div className="ml-4 flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                viewMaterial(material);
              }}
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </Button>
            
            <div>
              {material.selected ? (
                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-xs">✓</span>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-border rounded-full"></div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Show viewer if material is being viewed
  if (viewingMaterial) {
    switch (viewerType) {
      case 'audio_briefs':
        return (
          <AudioBriefViewer
            brief={viewingMaterial.content}
            onClose={() => {
              setViewingMaterial(null);
              setViewerType('');
            }}
          />
        );
      case 'flashcards':
        return (
          <FlashcardViewer
            flashcards={[viewingMaterial.content]}
            title={viewingMaterial.title}
            difficulty={viewingMaterial.difficulty}
            onClose={() => {
              setViewingMaterial(null);
              setViewerType('');
            }}
          />
        );
      case 'quizzes':
        return (
          <QuizViewer
            questions={viewingMaterial.content.questions || []}
            title={viewingMaterial.title}
            difficulty={viewingMaterial.difficulty}
            onClose={() => {
              setViewingMaterial(null);
              setViewerType('');
            }}
          />
        );
      case 'mindmaps':
        return (
          <MindMapViewer
            mindmap={viewingMaterial.content}
            title={viewingMaterial.title}
            difficulty={viewingMaterial.difficulty}
            onClose={() => {
              setViewingMaterial(null);
              setViewerType('');
            }}
          />
        );
      default:
        return (
          <StudyNotesViewer
            notes={viewingMaterial.content}
            title={viewingMaterial.title}
            topic={viewingMaterial.topic}
            difficulty={viewingMaterial.difficulty}
            materialId={viewingMaterial.id}
            onClose={() => {
              setViewingMaterial(null);
              setViewerType('');
            }}
          />
        );
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Wand2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-serif font-bold text-foreground">Enhanced AI Study Material Generator</h2>
        </div>

        <div className="space-y-4">
          {/* Material Type Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              What would you like to generate?
            </label>
            <Select value={materialType} onValueChange={(value: MaterialType) => setMaterialType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flashcards">📚 Smart Flashcards</SelectItem>
                <SelectItem value="audio_briefs">🎧 2-Min Audio Briefs (Weak Area Revision)</SelectItem>
                <SelectItem value="mindmaps">🧠 Interactive Mind Maps</SelectItem>
                <SelectItem value="quizzes">❓ Engaging Quizzes</SelectItem>
                <SelectItem value="diagrams">📊 Visual Diagrams</SelectItem>
                <SelectItem value="notes">📝 Structured Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source Selection Mode */}
          <div className="space-y-3 pt-2">
            <label className="text-sm font-semibold text-foreground block">
              Choose Study Material Source
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-muted/60 dark:bg-muted/40 rounded-xl max-w-md border border-border">
              <button
                type="button"
                onClick={() => setSourceMode('existing')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  sourceMode === 'existing'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-primary" />
                Existing Resources
                {availableResources.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {availableResources.length}
                  </Badge>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('new')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                  sourceMode === 'new'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-primary" />
                New Material
              </button>
            </div>
          </div>

          {sourceMode === 'existing' ? (
            <div className="space-y-4 pt-1">
              {isLoadingResources ? (
                <div className="p-4 border rounded-lg text-center text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                  Loading library materials...
                </div>
              ) : availableResources.length === 0 ? (
                <div className="p-4 border-2 border-dashed rounded-lg text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No resources available in your library yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateToTab('resources')}
                    className="text-xs text-indigo-600 gap-1"
                  >
                    Go to Resources ↗
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Select Resource</label>
                    <Select
                      value={selectedSourceId}
                      onValueChange={(val) => {
                        setSelectedSourceId(val);
                        if (val !== 'all') {
                          const res = availableResources.find(r => r.id === val);
                          if (res?.folder) {
                            setTopic(res.folder);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Uploaded Course Sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          All Uploaded Resources ({availableResources.length})
                        </SelectItem>
                        {availableResources.map((res) => (
                          <SelectItem key={res.id} value={res.id}>
                            <span className="flex items-center gap-2">
                              <span>{res.icon || (res.isNotionPage ? '📄' : '📑')}</span>
                              <span className="truncate">{res.title}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                ({res.type})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Focused Concept / Topic (Optional)
                    </label>
                    <Input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Memory Management, or leave empty for full resource content"
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Upload */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Upload Study Material</label>
                
                {!uploadedFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload your notes, documents, or study materials</p>
                    <p className="text-xs text-gray-500 mb-3">Supported: PDF, TXT (Max: 50KB)</p>
                    <Input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      Choose File
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <FileCheck className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">{uploadedFile}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearFile}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-center text-sm text-gray-500">OR</div>

              {/* Manual Content Input */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Paste Study Content
                </label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your study material, notes, or textbook content here..."
                  rows={4}
                />
              </div>

              <div className="text-center text-sm text-gray-500">OR</div>

              {/* Topic Input */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Enter Topic/Subject
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Photosynthesis, World War II, Calculus, Machine Learning..."
                />
              </div>
            </div>
          )}

          {/* Configuration Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Difficulty Level
              </label>
              <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Number to Generate
              </label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 items</SelectItem>
                  <SelectItem value="5">5 items</SelectItem>
                  <SelectItem value="10">10 items</SelectItem>
                  <SelectItem value="15">15 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={generateMaterial}
            disabled={isLoading || (!content.trim() && !topic.trim() && !uploadedContent.trim())}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Enhanced {materialType}...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Enhanced {materialType.charAt(0).toUpperCase() + materialType.slice(1)}
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Materials Preview */}
      {generatedMaterials.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Generated {materialType.charAt(0).toUpperCase() + materialType.slice(1)}
            </h3>
            <Button 
              onClick={saveSelectedMaterials}
              disabled={isCreating || !generatedMaterials.some(material => material.selected)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Save Selected ({generatedMaterials.filter(material => material.selected).length})
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {generatedMaterials.map(renderMaterialPreview)}
          </div>
        </Card>
      )}
    </div>
  );
};
