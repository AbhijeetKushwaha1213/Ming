
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface QuizViewerProps {
  questions: QuizQuestion[];
  title: string;
  difficulty: string;
  onClose?: () => void;
}

export const QuizViewer = ({ questions, title, difficulty, onClose }: QuizViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(new Array(questions.length).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = selectedAnswers[currentIndex];

  const selectAnswer = (optionIndex: number) => {
    if (showResults) return;
    
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowResults(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowResults(false);
    }
  };

  const submitAnswer = () => {
    if (currentAnswer !== null) {
      setShowResults(true);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedAnswers(new Array(questions.length).fill(null));
    setShowResults(false);
    setQuizCompleted(false);
  };

  const calculateScore = () => {
    return selectedAnswers.reduce((score, answer, index) => {
      return score + (answer === questions[index].correct_answer ? 1 : 0);
    }, 0);
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'easy': return 'bg-success/10 text-success';
      case 'medium': return 'bg-warning/10 text-warning';
      case 'hard': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!questions.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No quiz questions available</p>
      </div>
    );
  }

  if (quizCompleted) {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-3xl font-bold text-foreground">Quiz Complete!</h2>
          <div className="mt-4">
            <div className={`text-6xl font-bold ${getScoreColor(score, questions.length)}`}>
              {score}/{questions.length}
            </div>
            <div className="text-xl text-muted-foreground mt-2">{percentage}% Correct</div>
          </div>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Review</h3>
          <div className="space-y-4">
            {questions.map((question, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === question.correct_answer;
              
              return (
                <div key={index} className="border-l-4 pl-4 py-2" style={{
                  borderColor: isCorrect ? '#10B981' : '#EF4444'
                }}>
                  <div className="flex items-start space-x-2">
                    {isCorrect ? 
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" /> : 
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    }
                    <div className="flex-1">
                      <p className="font-medium">{question.question}</p>
                      <p className="text-sm text-muted-foreground">
                        Your answer: {question.options[userAnswer || 0]}
                      </p>
                      {!isCorrect && (
                        <p className="text-sm text-green-600">
                          Correct answer: {question.options[question.correct_answer]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-center space-x-4">
          <Button onClick={restartQuiz}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry Quiz
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Back to Library
            </Button>
          )}
        </div>
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
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            ← Back
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
      </div>

      {/* Question */}
      <Card className="p-8">
        <h3 className="text-xl font-semibold mb-6 text-foreground">
          {currentQuestion.question}
        </h3>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            let buttonClass = "w-full p-4 text-left border-2 rounded-lg transition-all ";
            
            if (showResults) {
              if (index === currentQuestion.correct_answer) {
                buttonClass += "border-success bg-success/10 text-success";
              } else if (index === currentAnswer && index !== currentQuestion.correct_answer) {
                buttonClass += "border-destructive bg-destructive/10 text-destructive";
              } else {
                buttonClass += "border-border bg-muted text-muted-foreground";
              }
            } else {
              if (index === currentAnswer) {
                buttonClass += "border-primary bg-primary/10 text-primary";
              } else {
                buttonClass += "border-border hover:border-primary/40 hover:bg-primary/5";
              }
            }

            return (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                disabled={showResults}
                className={buttonClass}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showResults && currentQuestion.explanation && (
          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-foreground mb-2">Explanation:</h4>
            <p className="text-muted-foreground">{currentQuestion.explanation}</p>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevQuestion}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>

        <div className="space-x-2">
          {!showResults && currentAnswer !== null && (
            <Button onClick={submitAnswer}>
              Submit Answer
            </Button>
          )}
          
          {showResults && (
            <Button onClick={nextQuestion}>
              {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
