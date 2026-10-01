
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, ChevronLeft, ChevronRight, Eye, EyeOff, Lightbulb } from 'lucide-react';

interface FlashcardData {
  question: string;
  answer: string;
  hint?: string;
}

interface FlashcardViewerProps {
  flashcards: FlashcardData[];
  title: string;
  difficulty: string;
  startingIndex?: number;
  onClose?: () => void;
}

export const FlashcardViewer = ({ flashcards, title, difficulty, startingIndex = 0, onClose }: FlashcardViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(startingIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentCard = flashcards[currentIndex];

  const nextCard = () => {
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    setIsFlipped(false);
    setShowHint(false);
  };

  const prevCard = () => {
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    setIsFlipped(false);
    setShowHint(false);
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy': return 'bg-success/10 text-success';
      case 'medium': return 'bg-warning/10 text-warning';
      case 'hard': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!flashcards.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No flashcards available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <div className="flex items-center space-x-2 mt-1">
            <Badge className={getDifficultyColor(difficulty)}>
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {flashcards.length}
            </span>
          </div>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            ← Back
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-brand-gradient h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div className="flex justify-center">
        <div 
          className="relative w-full max-w-2xl h-80 cursor-pointer"
          onClick={flipCard}
        >
          <div className={`absolute inset-0 transition-transform duration-700 transform-style-preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}>
            {/* Front Side - Question */}
            <Card className="absolute inset-0 flex items-center justify-center p-8 backface-hidden bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 hover:shadow-lg transition-shadow">
              <div className="text-center space-y-4">
                <div className="text-sm font-medium text-blue-600 mb-4">Question</div>
                <p className="text-xl font-semibold text-gray-900 leading-relaxed">
                  {currentCard.question}
                </p>
                <p className="text-sm text-gray-500 mt-6">Click to reveal answer</p>
              </div>
            </Card>

            {/* Back Side - Answer */}
            <Card className="absolute inset-0 flex items-center justify-center p-8 backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 hover:shadow-lg transition-shadow">
              <div className="text-center space-y-4">
                <div className="text-sm font-medium text-green-600 mb-4">Answer</div>
                <p className="text-lg text-gray-900 leading-relaxed">
                  {currentCard.answer}
                </p>
                <p className="text-sm text-gray-500 mt-6">Click to see question</p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Hint Section */}
      {currentCard.hint && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHint(!showHint)}
              className="mb-2"
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </Button>
            {showHint && (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <p className="text-sm text-gray-700">
                  <strong>Hint:</strong> {currentCard.hint}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-center space-x-4">
        <Button
          variant="outline"
          onClick={prevCard}
          disabled={flashcards.length <= 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        <Button
          variant="outline"
          onClick={() => {
            setIsFlipped(false);
            setShowHint(false);
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>

        <Button
          variant="outline"
          onClick={flipCard}
        >
          {isFlipped ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {isFlipped ? 'Show Question' : 'Show Answer'}
        </Button>

        <Button
          variant="outline"
          onClick={nextCard}
          disabled={flashcards.length <= 1}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
