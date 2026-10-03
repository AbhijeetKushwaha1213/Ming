import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Trophy,
  FileText,
  Presentation,
  Video,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { submitAssessment, DiagnosticReport } from '@/api/assessmentAPI';
import { useToast } from '@/hooks/use-toast';

export interface QuizQuestion {
  question_id?: string;
  type?: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL';
  question: string;
  options?: string[];
  correct_answer: number | string;
  explanation?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  source_id?: string;
  chunk_id?: string;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  citation_label?: string;
}

export interface QuizViewerProps {
  questions: QuizQuestion[];
  title: string;
  difficulty: string;
  topic?: string;
  subtopic?: string;
  userId?: string;
  onClose?: () => void;
  onComplete?: (report: DiagnosticReport) => void;
}

export const QuizViewer: React.FC<QuizViewerProps> = ({
  questions,
  title,
  difficulty,
  topic = 'General',
  subtopic,
  userId = 'default_user',
  onClose,
  onComplete,
}) => {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<any[]>(new Array(questions.length).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);

  const currentQuestion = questions[currentIndex];
  const qType = (currentQuestion?.type || 'MCQ').toUpperCase();
  const currentAnswer = selectedAnswers[currentIndex];

  useEffect(() => {
    // Sync text input with stored answer on question change
    if (selectedAnswers[currentIndex] !== null && selectedAnswers[currentIndex] !== undefined) {
      setTextInput(String(selectedAnswers[currentIndex]));
    } else {
      setTextInput('');
    }
    setShowResults(false);
  }, [currentIndex, selectedAnswers]);

  const selectAnswer = (answer: any) => {
    if (showResults) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentIndex] = answer;
    setSelectedAnswers(newAnswers);
  };

  const handleTextInputChange = (val: string) => {
    setTextInput(val);
    selectAnswer(val);
  };

  const checkAnswerCorrectness = (q: QuizQuestion, ans: any): boolean => {
    if (ans === null || ans === undefined) return false;
    const type = (q.type || 'MCQ').toUpperCase();
    const correct = String(q.correct_answer ?? '').trim();
    const userStr = String(ans).trim();

    if (type === 'MCQ') {
      if (userStr.toLowerCase() === correct.toLowerCase()) return true;
      if (!isNaN(Number(userStr)) && Array.isArray(q.options)) {
        const opt = q.options[Number(userStr)];
        if (opt && String(opt).trim().toLowerCase() === correct.toLowerCase()) return true;
      }
      return false;
    } else if (type === 'NUMERICAL') {
      const uNum = parseFloat(userStr.replace(/[^\d.-]/g, ''));
      const cNum = parseFloat(correct.replace(/[^\d.-]/g, ''));
      if (isNaN(uNum) || isNaN(cNum)) return false;
      const tol = Math.max(Math.abs(cNum) * 0.03, 0.01);
      return Math.abs(uNum - cNum) <= tol;
    } else {
      // SHORT_ANSWER
      const cleanU = userStr.toLowerCase().replace(/[^\w\s]/g, ' ');
      const cleanC = correct.toLowerCase().replace(/[^\w\s]/g, ' ');
      const cWords = cleanC.split(/\s+/).filter((w) => w.length > 2);
      let matchCount = 0;
      for (const w of cWords) {
        if (cleanU.includes(w)) matchCount++;
      }
      const ratio = cWords.length > 0 ? matchCount / cWords.length : 0;
      return ratio >= 0.4 || cleanU.includes(cleanC) || cleanC.includes(cleanU);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowResults(false);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowResults(false);
    }
  };

  const submitAnswer = () => {
    if (currentAnswer !== null && currentAnswer !== '') {
      setShowResults(true);
    }
  };

  const finishQuiz = async () => {
    setQuizCompleted(true);

    // Build immediate diagnostic report
    const total = questions.length;
    let correctCount = 0;
    const incorrectList: any[] = [];
    const recommendedList: any[] = [];
    const topicPerf: Record<string, { total: number; correct: number; percentage: number }> = {};
    const diffPerf: Record<string, { total: number; correct: number; percentage: number }> = {};

    questions.forEach((q, idx) => {
      const ans = selectedAnswers[idx];
      const isCorrect = checkAnswerCorrectness(q, ans);
      if (isCorrect) correctCount++;

      const tKey = q.subtopic || q.topic || topic;
      if (!topicPerf[tKey]) topicPerf[tKey] = { total: 0, correct: 0, percentage: 0 };
      topicPerf[tKey].total++;
      if (isCorrect) topicPerf[tKey].correct++;

      const dKey = q.difficulty || difficulty;
      if (!diffPerf[dKey]) diffPerf[dKey] = { total: 0, correct: 0, percentage: 0 };
      diffPerf[dKey].total++;
      if (isCorrect) diffPerf[dKey].correct++;

      if (!isCorrect) {
        const coordLabel = q.page_number
          ? `Page ${q.page_number}`
          : q.slide_number
          ? `Slide ${q.slide_number}`
          : q.timestamp_start !== null && q.timestamp_start !== undefined
          ? `${Math.floor(q.timestamp_start / 60)}m${Math.floor(q.timestamp_start % 60)}s`
          : 'Source Material';

        incorrectList.push({
          questionId: q.question_id || `q_${idx}`,
          question: q.question,
          userAnswer: String(ans || 'No answer'),
          correctAnswer: String(q.correct_answer),
          explanation: q.explanation || 'Refer to course material.',
          citationLabel: coordLabel,
        });

        recommendedList.push({
          topic: q.topic || topic,
          subtopic: q.subtopic || 'Core Concept',
          coordinate: coordLabel,
          chunkId: q.chunk_id,
          recommendation: `Review ${q.subtopic || q.topic} at ${coordLabel}: '${q.correct_answer}'`,
        });
      }
    });

    Object.keys(topicPerf).forEach((k) => {
      topicPerf[k].percentage = Math.round((topicPerf[k].correct / topicPerf[k].total) * 100);
    });
    Object.keys(diffPerf).forEach((k) => {
      diffPerf[k].percentage = Math.round((diffPerf[k].correct / diffPerf[k].total) * 100);
    });

    const report: DiagnosticReport = {
      overallScore: `${correctCount}/${total}`,
      percentage: Math.round((correctCount / total) * 100),
      totalQuestions: total,
      correctCount,
      topicPerformance: topicPerf,
      difficultyPerformance: diffPerf,
      incorrectAnswers: incorrectList,
      likelyMisconceptions: incorrectList.map(
        (i) => `Difficulty understanding: "${i.question.slice(0, 50)}...". Expected: ${i.correctAnswer}`
      ),
      recommendedSourceMaterial: recommendedList,
    };

    setDiagnosticReport(report);
    if (onComplete) onComplete(report);

    // Save assessment attempt persistently to database
    try {
      await submitAssessment({
        userId,
        title,
        topic,
        subtopic,
        difficulty,
        questions: questions as any,
        answers: selectedAnswers,
      });
      // Notify all BKT listeners (Learning Progress, LearnerMasteryCard, etc.)
      window.dispatchEvent(new CustomEvent('studymate-bkt-refresh', { detail: { topic, subtopic } }));
      toast({
        title: 'Assessment Attempt Saved',
        description: 'Your score and diagnostic report have been saved to your profile.',
      });
    } catch {
      // Local report still displays seamlessly; trigger refresh in case local state updated
      window.dispatchEvent(new CustomEvent('studymate-bkt-refresh', { detail: { topic, subtopic } }));
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedAnswers(new Array(questions.length).fill(null));
    setTextInput('');
    setShowResults(false);
    setQuizCompleted(false);
    setDiagnosticReport(null);
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 60) return 'text-amber-500';
    return 'text-rose-600';
  };

  const getDifficultyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-300';
      case 'medium':
        return 'bg-amber-500/10 text-amber-600 border-amber-300';
      case 'hard':
        return 'bg-rose-500/10 text-rose-600 border-rose-300';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTime = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!questions.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No assessment questions available.</p>
      </div>
    );
  }

  // ==========================================
  // DIAGNOSTIC REPORT VIEW (Quiz Complete)
  // ==========================================
  if (quizCompleted && diagnosticReport) {
    const { correctCount, totalQuestions, percentage, topicPerformance, incorrectAnswers, recommendedSourceMaterial } =
      diagnosticReport;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-3xl font-bold text-foreground">Assessment Complete!</h2>
          <div className="mt-4">
            <div className={`text-6xl font-bold ${getScoreColor(correctCount, totalQuestions)}`}>
              {correctCount}/{totalQuestions}
            </div>
            <div className="text-xl text-muted-foreground mt-2">{percentage}% Mastery</div>
          </div>
        </div>

        {/* Topic Breakdown */}
        {Object.keys(topicPerformance).length > 0 && (
          <Card className="p-6">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" /> Topic & Subtopic Performance
            </h3>
            <div className="space-y-3">
              {Object.entries(topicPerformance).map(([tName, perf]) => (
                <div key={tName} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{tName}</span>
                    <span>
                      {perf.correct}/{perf.total} ({perf.percentage}%)
                    </span>
                  </div>
                  <Progress value={perf.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recommended Source Material for Revision */}
        {recommendedSourceMaterial.length > 0 && (
          <Card className="p-6 border-indigo-200 bg-indigo-50/30">
            <h3 className="text-base font-semibold text-indigo-950 mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-indigo-600" /> Targeted Revision Recommendations
            </h3>
            <div className="space-y-2">
              {recommendedSourceMaterial.map((rec, rIdx) => (
                <div key={rIdx} className="p-3 rounded-lg bg-white border border-indigo-100 text-xs text-gray-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-900">{rec.topic} ({rec.subtopic})</span>
                    <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">
                      {rec.coordinate}
                    </Badge>
                  </div>
                  <p className="text-gray-600">{rec.recommendation}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Question Review */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Question Review</h3>
          <div className="space-y-4">
            {questions.map((question, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = checkAnswerCorrectness(question, userAnswer);

              return (
                <div
                  key={index}
                  className="border-l-4 pl-4 py-2"
                  style={{
                    borderColor: isCorrect ? '#10B981' : '#EF4444',
                  }}
                >
                  <div className="flex items-start space-x-2">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm text-foreground">{question.question}</p>
                      <p className="text-xs text-muted-foreground">
                        Your answer:{' '}
                        <span className={isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                          {String(userAnswer || 'No answer')}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="text-xs text-green-700">
                          Correct answer: <span className="font-semibold">{String(question.correct_answer)}</span>
                        </p>
                      )}
                      {question.explanation && (
                        <p className="text-xs text-muted-foreground bg-gray-50 p-2 rounded mt-1 border border-gray-100">
                          <strong>Source citation:</strong> {question.explanation}
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
            Retry Assessment
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

  // ==========================================
  // ACTIVE QUESTION VIEW
  // ==========================================
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
            <Badge variant="outline" className="text-xs">
              {qType === 'MCQ' ? 'Multiple Choice' : qType === 'NUMERICAL' ? 'Numerical' : 'Short Answer'}
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

      {/* Question Card */}
      <Card className="p-8 space-y-6">
        {/* Source Citation Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Grounded Source Evidence:</span>
            {currentQuestion.page_number && (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                <FileText className="w-3 h-3 mr-1" /> Page {currentQuestion.page_number}
              </Badge>
            )}
            {currentQuestion.slide_number && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                <Presentation className="w-3 h-3 mr-1" /> Slide {currentQuestion.slide_number}
              </Badge>
            )}
            {currentQuestion.timestamp_start !== null && currentQuestion.timestamp_start !== undefined && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <Video className="w-3 h-3 mr-1" /> {formatTime(currentQuestion.timestamp_start)}
              </Badge>
            )}
            {!currentQuestion.page_number && !currentQuestion.slide_number && currentQuestion.timestamp_start === null && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                <BookOpen className="w-3 h-3 mr-1" /> Course Notes
              </Badge>
            )}
          </div>
        </div>

        <h3 className="text-xl font-semibold text-foreground">{currentQuestion.question}</h3>

        {/* 1. MCQ Question Options */}
        {qType === 'MCQ' && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const optStr = String(option);
              const corrStr = String(currentQuestion.correct_answer);
              const isOptionCorrect =
                optStr.toLowerCase() === corrStr.toLowerCase() || String(index) === corrStr;
              const isOptionSelected =
                currentAnswer === index || String(currentAnswer).toLowerCase() === optStr.toLowerCase();

              let buttonClass = 'w-full p-4 text-left border-2 rounded-lg transition-all ';

              if (showResults) {
                if (isOptionCorrect) {
                  buttonClass += 'border-emerald-500 bg-emerald-50 text-emerald-900';
                } else if (isOptionSelected && !isOptionCorrect) {
                  buttonClass += 'border-rose-500 bg-rose-50 text-rose-900';
                } else {
                  buttonClass += 'border-border bg-muted text-muted-foreground';
                }
              } else {
                if (isOptionSelected) {
                  buttonClass += 'border-primary bg-primary/10 text-primary font-medium';
                } else {
                  buttonClass += 'border-border hover:border-primary/40 hover:bg-primary/5';
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => selectAnswer(option)}
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
        )}

        {/* 2. Short Answer Input */}
        {qType === 'SHORT_ANSWER' && (
          <div className="space-y-3">
            <Input
              value={textInput}
              onChange={(e) => handleTextInputChange(e.target.value)}
              placeholder="Type your explanation or answer..."
              disabled={showResults}
              className="text-base p-4 h-12"
            />
            {showResults && (
              <div className="p-3 rounded-lg border bg-gray-50 text-xs space-y-1">
                <p className="text-gray-500 font-medium">Expected key concept:</p>
                <p className="font-semibold text-emerald-800">{String(currentQuestion.correct_answer)}</p>
              </div>
            )}
          </div>
        )}

        {/* 3. Numerical Input */}
        {qType === 'NUMERICAL' && (
          <div className="space-y-3">
            <Input
              type="number"
              step="any"
              value={textInput}
              onChange={(e) => handleTextInputChange(e.target.value)}
              placeholder="Enter numerical answer..."
              disabled={showResults}
              className="text-base p-4 h-12 font-mono"
            />
            {showResults && (
              <div className="p-3 rounded-lg border bg-gray-50 text-xs space-y-1">
                <p className="text-gray-500 font-medium">Verified target value:</p>
                <p className="font-semibold text-emerald-800">
                  {String(currentQuestion.correct_answer)} <span className="font-normal text-gray-500">(±3% tolerance)</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Explanation callout */}
        {showResults && currentQuestion.explanation && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="font-medium text-foreground mb-1 text-sm">Grounded Course Explanation:</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevQuestion} disabled={currentIndex === 0}>
          Previous
        </Button>

        <div className="space-x-2">
          {!showResults && currentAnswer !== null && currentAnswer !== '' && (
            <Button onClick={submitAnswer}>Submit Answer</Button>
          )}

          {showResults && (
            <Button onClick={nextQuestion}>
              {currentIndex === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
