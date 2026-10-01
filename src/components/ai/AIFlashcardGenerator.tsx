
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Wand2, Plus, Loader2 } from 'lucide-react';
import { useFlashcards } from '@/hooks/useFlashcards';
import { useStudyMaterials } from '@/hooks/useStudyMaterials';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { FileUploadComponent } from './FileUploadComponent';
import { geminiClient } from '@/utils/geminiClient';

export const AIFlashcardGenerator = () => {
  const { user } = useAuth();
  const { createFlashcard } = useFlashcards();
  const { createMaterial } = useStudyMaterials();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState('5');
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadedContent, setUploadedContent] = useState('');

  const generateFlashcards = async () => {
    const finalContent = content.trim() || uploadedContent.trim();
    
    if (!finalContent && !topic.trim()) {
      toast({
        title: "Input Required",
        description: "Please provide either content to study or a topic.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log('AIFlashcardGenerator: Starting real AI generation with:', { finalContent, topic, difficulty, count });
      
      const subject = user?.userType === 'college' ? user?.branch : user?.examType;
      
      let responseText = '';
      
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            contentType: 'flashcards',
            topic: topic || finalContent,
            difficulty,
            count: parseInt(count),
            subject,
            message: finalContent || topic
          }
        });

        if (error) {
          console.error('AIFlashcardGenerator: Supabase function error:', error);
          throw new Error(error.message || 'Failed to generate flashcards');
        }
        
        if (!data || !data.response) {
          console.error('AIFlashcardGenerator: No response from AI');
          throw new Error('No response received from AI service');
        }
        
        responseText = data.response;
      } catch (invokeError) {
        console.warn('AIFlashcardGenerator: Supabase edge function failed, falling back to direct Gemini API call:', invokeError);
        const directRes = await geminiClient.generateContent({
          contentType: 'flashcards',
          topic: topic || finalContent,
          difficulty,
          count: parseInt(count),
          subject,
          message: finalContent || topic
        });
        if (directRes.error) {
          throw new Error(`${directRes.error}: ${directRes.details || ''}`);
        }
        responseText = directRes.response;
      }
      
      console.log('AIFlashcardGenerator: Raw AI response:', responseText);
      
      let aiContent;
      try {
        // Try to parse the JSON response
        aiContent = JSON.parse(responseText);
        
        // Validate the response structure
        if (!aiContent.flashcards || !Array.isArray(aiContent.flashcards)) {
          console.error('AIFlashcardGenerator: Invalid response structure:', aiContent);
          throw new Error('AI returned invalid flashcard format');
        }
      } catch (parseError) {
        console.error('AIFlashcardGenerator: Failed to parse AI response:', parseError);
        console.error('AIFlashcardGenerator: Raw response was:', responseText);
        
        // Show the actual error to help debug
        toast({
          title: "Parsing Error",
          description: `Failed to parse AI response. The AI might have returned text instead of JSON. Error: ${parseError.message}`,
          variant: "destructive",
        });
        
        // Fallback to simple content generation
        const numCards = parseInt(count);
        const cardTopic = topic || finalContent.substring(0, 30);
        aiContent = {
          flashcards: Array.from({ length: numCards }, (_, i) => ({
            question: `What is the key concept about "${cardTopic}"?`,
            answer: `This covers the fundamental principles of ${cardTopic} with practical applications.`,
            hint: `Think about the main aspects of ${cardTopic}`
          }))
        };
      }

      const cards = aiContent.flashcards?.map((card: any, i: number) => ({
        id: `generated-${Date.now()}-${i}`,
        title: `${topic || finalContent.substring(0, 30)} - Card ${i + 1}`,
        question: card.question,
        answer: card.answer,
        hint: card.hint,
        tags: [topic?.toLowerCase() || 'study', difficulty],
        difficulty,
        selected: true
      })) || [];

      console.log('AIFlashcardGenerator: Processed cards:', cards);
      setGeneratedCards(cards);

      toast({
        title: "AI Flashcards Generated! 🎉",
        description: `Generated ${cards.length} intelligent flashcards. Review and save them to your vault.`,
      });
    } catch (error) {
      console.error('AIFlashcardGenerator: Error generating flashcards:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate flashcards. Please try again with different content.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleCardSelection = (cardId: string) => {
    console.log('AIFlashcardGenerator: Toggling card selection for:', cardId);
    setGeneratedCards(prev => 
      prev.map(card => 
        card.id === cardId ? { ...card, selected: !card.selected } : card
      )
    );
  };

  const createSelectedCards = async () => {
    const selectedCards = generatedCards.filter(card => card.selected);
    if (selectedCards.length === 0) {
      toast({
        title: "No Cards Selected",
        description: "Please select at least one flashcard to create.",
        variant: "destructive",
      });
      return;
    }

    // Check authentication before proceeding
    if (!user?.user_id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save flashcards.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    let createdCount = 0;
    let errorCount = 0;

    try {
      console.log('AIFlashcardGenerator: Creating selected cards for user:', user.user_id);
      
      for (const card of selectedCards) {
        try {
          console.log('Creating flashcard:', card.title);
          
          // Save as both flashcard and study material
          await createFlashcard({
            title: card.title,
            question: card.question,
            answer: card.answer,
            difficulty: card.difficulty,
            tags: Array.isArray(card.tags) ? card.tags : [card.tags].filter(Boolean)
          });
          
          await createMaterial({
            title: card.title,
            content: { question: card.question, answer: card.answer },
            type: 'flashcards',
            topic: topic || card.title,
            difficulty: card.difficulty,
            tags: Array.isArray(card.tags) ? card.tags : [card.tags].filter(Boolean),
            source: 'AI Generator'
          });
          
          createdCount++;
          console.log('Successfully created flashcard:', card.title);
        } catch (error) {
          console.error('AIFlashcardGenerator: Error creating card:', card.title, error);
          errorCount++;
        }
      }

      if (createdCount > 0) {
        toast({
          title: "Cards Created Successfully!",
          description: `Successfully created ${createdCount} flashcards. Check your Flashcard Vault to review them.`,
        });
        
        // Reset form
        setGeneratedCards([]);
        setContent('');
        setTopic('');
        setUploadedContent('');
      }
    } catch (error) {
      console.error('AIFlashcardGenerator: Error in creation process:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create some flashcards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileContent = (fileContent: string, fileName: string) => {
    console.log('AIFlashcardGenerator: File content received:', { fileName, contentLength: fileContent.length });
    setUploadedContent(fileContent);
    if (fileContent) {
      toast({
        title: "File Processed Successfully",
        description: `Content from ${fileName} has been loaded and is ready for flashcard generation.`,
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Wand2 className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Flashcard Generator</h2>
        </div>

        <div className="space-y-4">
          {/* File Upload Component */}
          <FileUploadComponent onFileContent={handleFileContent} />

          <div className="text-center text-sm text-gray-500">OR</div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Study Content (paste text, notes, etc.)
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your study material here..."
              rows={4}
            />
          </div>

          <div className="text-center text-sm text-gray-500">OR</div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Topic/Subject
            </label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Photosynthesis, World War II, Calculus..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Difficulty
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
                Number of Cards
              </label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 cards</SelectItem>
                  <SelectItem value="5">5 cards</SelectItem>
                  <SelectItem value="10">10 cards</SelectItem>
                  <SelectItem value="15">15 cards</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={generateFlashcards}
            disabled={isGenerating || (!content.trim() && !topic.trim() && !uploadedContent.trim())}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Flashcards...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Flashcards
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Generated Flashcards Preview */}
      {generatedCards.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Generated Flashcards</h3>
            <Button 
              onClick={createSelectedCards}
              disabled={isCreating || !generatedCards.some(card => card.selected)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Cards...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Selected ({generatedCards.filter(card => card.selected).length})
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {generatedCards.map((card) => (
              <Card 
                key={card.id} 
                className={`p-4 cursor-pointer transition-all ${
                  card.selected ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:shadow-md'
                }`}
                onClick={() => toggleCardSelection(card.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{card.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {card.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Q:</strong> {card.question}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>A:</strong> {card.answer}
                    </p>
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.tags.map((tag: string, tagIndex: number) => (
                          <Badge key={tagIndex} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    {card.selected ? (
                      <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
