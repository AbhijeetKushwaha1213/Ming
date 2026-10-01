
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RotateCcw, ThumbsUp, ThumbsDown, Shuffle, X } from 'lucide-react';
import { Flashcard } from '@/hooks/useFlashcards';

interface FlashcardReviewProps {
  flashcards: Flashcard[];
  onUpdateMastery: (id: string, correct: boolean) => void;
  onClose?: () => void;
}

export const FlashcardReview = ({ flashcards, onUpdateMastery, onClose }: FlashcardReviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCards, setReviewedCards] = useState<Set<string>>(new Set());

  if (flashcards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No flashcards available for review.</p>
            {onClose && (
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((reviewedCards.size) / flashcards.length) * 100;

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handleAnswer = (correct: boolean) => {
    onUpdateMastery(currentCard.id, correct);
    setReviewedCards(prev => new Set([...prev, currentCard.id]));
    setTimeout(handleNext, 500);
  };

  const handleShuffle = () => {
    setCurrentIndex(Math.floor(Math.random() * flashcards.length));
    setShowAnswer(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setReviewedCards(new Set());
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMasteryColor = (level: number) => {
    if (level >= 4) return 'text-green-600';
    if (level >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header with close button */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Flashcard Review</h2>
            {onClose && (
              <Button variant="ghost" onClick={onClose} size="sm">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Review Progress</span>
              <span className="font-medium">{reviewedCards.size} / {flashcards.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={handleShuffle}>
                <Shuffle className="w-4 h-4 mr-2" />
                Shuffle
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              Card {currentIndex + 1} of {flashcards.length}
            </div>
          </div>

          {/* Flashcard */}
          <Card className="p-8 min-h-[400px] flex flex-col justify-center">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-gray-900">{currentCard.title}</h3>
                <div className="flex space-x-2">
                  <Badge className={getDifficultyColor(currentCard.difficulty)}>
                    {currentCard.difficulty}
                  </Badge>
                  <Badge variant="outline">
                    <span className={getMasteryColor(currentCard.mastery_level)}>
                      Mastery: {currentCard.mastery_level}/5
                    </span>
                  </Badge>
                </div>
              </div>

              {/* Question */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Question:</h4>
                  <p className="text-gray-900 text-lg">{currentCard.question}</p>
                </div>

                {/* Answer (shown when revealed) */}
                {showAnswer && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Answer:</h4>
                    <p className="text-gray-900 text-lg">{currentCard.answer}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {currentCard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {currentCard.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} className="px-8">
                Show Answer
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleAnswer(false)}
                  className="flex items-center space-x-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>Incorrect</span>
                </Button>
                <Button
                  onClick={() => handleAnswer(true)}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>Correct</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
