
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RotateCcw, ThumbsUp, ThumbsDown, Shuffle, X, Brain } from 'lucide-react';
import { Flashcard } from '@/hooks/useFlashcards';
import { updateLearnerMastery } from '@/api/learnerAPI';
import { useAuth } from '@/components/auth/AuthProvider';

interface FlashcardReviewProps {
  flashcards: Flashcard[];
  onUpdateMastery: (id: string, correct: boolean) => void;
  onClose?: () => void;
}

export const FlashcardReview = ({ flashcards, onUpdateMastery, onClose }: FlashcardReviewProps) => {
  const { user } = useAuth();
  const userId = user?.user_id || user?.id || 'default_user';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCards, setReviewedCards] = useState<Set<string>>(new Set());

  if (flashcards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50">
        <div className="bg-card text-foreground rounded-lg p-8 max-w-md w-full mx-4 border border-border shadow-xl">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No flashcards available for review.</p>
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

    // Record BKT Bayesian Knowledge Tracing evidence
    const topic = currentCard.tags?.[0] || currentCard.title || 'Flashcards';
    updateLearnerMastery({
      userId,
      topic,
      isCorrect: correct,
      difficulty: currentCard.difficulty || 'medium',
      eventType: 'ASSESSMENT_ANSWER',
      evidenceDetails: `Flashcard Practice (${correct ? 'Correct' : 'Incorrect'}): "${(currentCard.question || '').slice(0, 40)}"`,
    }).then(() => {
      window.dispatchEvent(new CustomEvent('studymate-bkt-refresh', { detail: { topic } }));
    }).catch(() => {});

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
      case 'easy': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';
      case 'medium': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30';
      case 'hard': return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getMasteryColor = (level: number) => {
    if (level >= 4) return 'text-emerald-600 dark:text-emerald-400 font-semibold';
    if (level >= 2) return 'text-amber-600 dark:text-amber-400 font-semibold';
    return 'text-rose-600 dark:text-rose-400 font-semibold';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-card text-foreground border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 space-y-6">
          {/* Header with close button */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-foreground">Flashcard Review</h2>
            {onClose && (
              <Button variant="ghost" onClick={onClose} size="sm">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Review Progress</span>
              <span className="font-medium text-foreground">{reviewedCards.size} / {flashcards.length}</span>
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
            <div className="text-sm text-muted-foreground">
              Card {currentIndex + 1} of {flashcards.length}
            </div>
          </div>

          {/* Flashcard */}
          <Card className="p-8 min-h-[400px] flex flex-col justify-center border-border">
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-foreground">{currentCard.title}</h3>
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
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Question:</h4>
                  <p className="text-foreground text-lg">{currentCard.question}</p>
                </div>

                {/* Answer (shown when revealed) */}
                {showAnswer && (
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Answer:</h4>
                    <p className="text-foreground text-lg">{currentCard.answer}</p>
                  </div>
                )}
              </div>

              {/* Tags */}
              {currentCard.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
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
                  className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>Incorrect</span>
                </Button>
                <Button
                  onClick={() => handleAnswer(true)}
                  className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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
