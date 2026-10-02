import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain,
  Sparkles,
  BookOpen,
  FileQuestion,
  Loader2,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  Clock,
  History,
  FileText,
  Presentation,
  Video,
  AlertCircle,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { generateAssessment, getAssessmentHistory, AssessmentQuestion, DiagnosticReport } from '@/api/assessmentAPI';
import { QuizViewer } from '@/components/flashcards/QuizViewer';
import { navigateToTab } from '@/utils/navigation';

export const AdaptiveAssessmentGenerator: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [topic, setTopic] = useState(() => {
    return localStorage.getItem('studymate-assessment-prefill-topic') || '';
  });
  const [subtopic, setSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [count, setCount] = useState<number>(5);
  const [questionType, setQuestionType] = useState<'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL' | 'MIXED'>('MCQ');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const [availableSources, setAvailableSources] = useState<any[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestions, setActiveQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  useEffect(() => {
    const handlePrefill = (e: any) => {
      if (e.detail?.params?.topic) {
        setTopic(e.detail.params.topic);
      }
    };
    window.addEventListener('studymate-navigate', handlePrefill);
    window.addEventListener('studymate-subtab', handlePrefill);
    return () => {
      window.removeEventListener('studymate-navigate', handlePrefill);
      window.removeEventListener('studymate-subtab', handlePrefill);
    };
  }, []);

  // Fetch student's course materials
  useEffect(() => {
    async function loadSources() {
      try {
        const res = await fetch(`/api/resources?userId=${encodeURIComponent(user?.user_id || 'default_user')}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAvailableSources(data);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadSources();
  }, [user]);

  // Fetch assessment history
  useEffect(() => {
    async function loadHistory() {
      if (!user?.user_id) return;
      try {
        const res = await getAssessmentHistory(user.user_id);
        if (res.success && res.history) {
          setHistory(res.history);
        }
      } catch {
        // Fallback
      }
    }
    loadHistory();
  }, [user, activeQuestions]);

  const handleGenerateBaseline = async () => {
    const currentTopic = topic.trim() || 'Course Diagnostic';
    const fallbackQuestions: AssessmentQuestion[] = [
      {
        question_id: `q_diag_1_${Date.now()}`,
        type: 'MCQ',
        topic: currentTopic,
        subtopic: subtopic.trim() || 'Core Primitives & Invariants',
        difficulty,
        question: `In ${currentTopic}, which principle accurately governs baseline conceptual correctness?`,
        options: [
          'Systematic enforcement of safety invariants and prerequisite conditions',
          'Unverified arbitrary guesses without invariant verification',
          'Surface-level rote memorization without contextual reasoning',
          'Skipping boundary constraints and edge cases'
        ],
        correct_answer: 'Systematic enforcement of safety invariants and prerequisite conditions',
        explanation: `Diagnostic baseline assessments verify foundational understanding of core primitives and invariants in ${currentTopic}.`,
        source_id: 'src_curriculum_standard',
        citation_label: `Curriculum Diagnostic Baseline (${currentTopic})`
      },
      {
        question_id: `q_diag_2_${Date.now()}`,
        type: 'MCQ',
        topic: currentTopic,
        subtopic: subtopic.trim() || 'Methodology & Assessment',
        difficulty,
        question: `Which methodology provides optimal long-term retention and diagnostic tracking for ${currentTopic}?`,
        options: [
          'Active retrieval practice and Bayesian Knowledge Tracing',
          'Passive re-reading of notes without any assessment',
          'Cramming only the night before an examination',
          'Randomly skimming headings without solving problems'
        ],
        correct_answer: 'Active retrieval practice and Bayesian Knowledge Tracing',
        explanation: 'Active recall and spaced repetition maximize memory consolidation and accurately calibrate knowledge state.',
        source_id: 'src_curriculum_standard',
        citation_label: `Curriculum Diagnostic Baseline (${currentTopic})`
      },
      {
        question_id: `q_diag_3_${Date.now()}`,
        type: 'MCQ',
        topic: currentTopic,
        subtopic: subtopic.trim() || 'System Trade-offs',
        difficulty,
        question: `When analyzing architectural trade-offs in ${currentTopic}, what is the primary consideration?`,
        options: [
          'Balancing performance, latency, and correctness invariants',
          'Assuming unconstrained resource availability',
          'Ignoring edge case failures when average case works',
          'Using maximum possible complexity regardless of necessity'
        ],
        correct_answer: 'Balancing performance, latency, and correctness invariants',
        explanation: 'Principled system architecture requires balancing efficiency and correctness across operational scenarios.',
        source_id: 'src_curriculum_standard',
        citation_label: `Curriculum Diagnostic Baseline (${currentTopic})`
      },
      {
        question_id: `q_diag_4_${Date.now()}`,
        type: 'MCQ',
        topic: currentTopic,
        subtopic: subtopic.trim() || 'Execution Flow',
        difficulty,
        question: `How should error handling and anomalous states be managed in ${currentTopic}?`,
        options: [
          'Through explicit boundary checks, error propagation, and safe fallback states',
          'By terminating the environment silently without logging evidence',
          'By assuming all client inputs conform to ideal formatting constraints',
          'By ignoring hardware interrupts and peripheral signals'
        ],
        correct_answer: 'Through explicit boundary checks, error propagation, and safe fallback states',
        explanation: 'Robust systems require deterministic boundary checks and graceful failure modes.',
        source_id: 'src_curriculum_standard',
        citation_label: `Curriculum Diagnostic Baseline (${currentTopic})`
      },
      {
        question_id: `q_diag_5_${Date.now()}`,
        type: 'MCQ',
        topic: currentTopic,
        subtopic: subtopic.trim() || 'Continuous Calibration',
        difficulty,
        question: `Why is an initial diagnostic assessment essential prior to full-course study planning in ${currentTopic}?`,
        options: [
          'To calibrate the Bayesian Knowledge Tracing baseline without fabricating mastery',
          'To assign permanent final grades before starting coursework',
          'To lock access to reference materials indefinitely',
          'To bypass foundational prerequisites entirely'
        ],
        correct_answer: 'To calibrate the Bayesian Knowledge Tracing baseline without fabricating mastery',
        explanation: 'Baseline diagnostics calibrate P(L0) knowledge states so study agents prioritize genuine weak concepts.',
        source_id: 'src_curriculum_standard',
        citation_label: `Curriculum Diagnostic Baseline (${currentTopic})`
      }
    ];
    setActiveQuestions(fallbackQuestions);
    setGenerationNotice(null);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: 'Topic Required',
        description: 'Please specify the course topic for this assessment.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGenerationNotice(null);

    try {
      const result = await generateAssessment({
        userId: user?.user_id || user?.id || 'default_user',
        topic: topic.trim(),
        subtopic: subtopic.trim() || undefined,
        difficulty,
        count,
        questionType,
        sourceId: selectedSourceId !== 'all' ? selectedSourceId : undefined,
      });

      if (!result.questions || result.questions.length === 0) {
        setGenerationNotice('No verified course materials found matching this topic. Please upload textbooks, slides, or lecture videos in Resources, or take the standard diagnostic baseline assessment.');
        toast({
          title: 'Insufficient Course Evidence',
          description: 'No verified course materials found matching this topic. You can upload files in Resources or start a standard diagnostic baseline.',
          variant: 'destructive',
        });
        return;
      }

      setActiveQuestions(result.questions);
      setGenerationNotice(null);
      toast({
        title: 'Assessment Ready',
        description: `Generated and verified ${result.questions.length} grounded questions.`,
      });
    } catch (err: any) {
      setGenerationNotice(err.message || 'No course materials found for this topic and student. Please upload course materials in Resources, or take the standard diagnostic assessment.');
      toast({
        title: 'Course Materials Required',
        description: err.message || 'Unable to retrieve course chunks. You can upload files in Resources or take the diagnostic baseline.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (activeQuestions && activeQuestions.length > 0) {
    return (
      <div className="space-y-6">
        <QuizViewer
          questions={activeQuestions as any}
          title={`${topic} Adaptive Assessment`}
          difficulty={difficulty}
          topic={topic}
          subtopic={subtopic}
          userId={user?.user_id || 'default_user'}
          onClose={() => setActiveQuestions(null)}
          onComplete={() => {
            // refresh history
            if (user?.user_id) {
              getAssessmentHistory(user.user_id).then((res) => {
                if (res.history) setHistory(res.history);
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <Card className="p-6 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-pink-50/40 border-indigo-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Grounded Assessment Engine
              </Badge>
              <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-white">
                ChromaDB Vector Retrieval
              </Badge>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Adaptive Course Knowledge Assessment</h2>
            <p className="text-sm text-gray-600 max-w-2xl">
              Questions are dynamically extracted from your uploaded textbooks, slide decks, and lecture recordings. Every question is verified for factual grounding and citation accuracy before testing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-white/80 border border-indigo-100 text-center shadow-xs">
              <Trophy className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="text-xs font-semibold text-gray-700 mt-1">Past Attempts</p>
              <p className="text-sm font-bold text-indigo-900">{history.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Configuration Form */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          Configure Assessment Parameters
        </h3>

        {availableSources.length === 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>No course materials uploaded yet:</strong> You can take a standard curriculum diagnostic assessment, or upload textbooks, slides, and videos in Resources to generate questions citing exact pages and timestamps.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => navigateToTab('resources')}
              className="border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs h-7 px-2.5 flex-shrink-0"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-1" />
              Upload Materials in Resources ↗
            </Button>
          </div>
        )}

        {generationNotice && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{generationNotice}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                type="button"
                onClick={() => navigateToTab('resources')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 gap-1.5 shadow-xs"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload Course Materials in Resources ↗
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={handleGenerateBaseline}
                className="text-xs h-8 px-3 gap-1.5 border-rose-300 dark:border-rose-700 hover:bg-rose-100/50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Take Standard Diagnostic Assessment Now
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source / Course Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Course Source Material</label>
            <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="All Uploaded Materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Uploaded Course Sources</SelectItem>
                {availableSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableSources.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>0 sources uploaded.</span>
                <button
                  type="button"
                  onClick={() => navigateToTab('resources')}
                  className="font-medium underline hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-0.5"
                >
                  Upload textbooks/slides in Resources <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Select a specific textbook, slide deck, or all uploaded materials.</p>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Topic *</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Operating Systems, Thermodynamics, Linear Algebra..."
            />
            <p className="text-xs text-muted-foreground">The primary subject area to retrieve chunks from.</p>
          </div>

          {/* Subtopic */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Subtopic (Optional)</label>
            <Input
              value={subtopic}
              onChange={(e) => setSubtopic(e.target.value)}
              placeholder="e.g. Deadlocks, Banker's Algorithm, Carnot Cycle..."
            />
            <p className="text-xs text-muted-foreground">Optional subtopic to narrow chunk vector similarity search.</p>
          </div>

          {/* Number of Questions */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Question Count</label>
            <Select value={String(count)} onValueChange={(val) => setCount(Number(val))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Questions (Quick Knowledge Check)</SelectItem>
                <SelectItem value="5">5 Questions (Standard Diagnostic)</SelectItem>
                <SelectItem value="10">10 Questions (Comprehensive Exam Prep)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Difficulty Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map((diff) => (
                <Button
                  key={diff}
                  type="button"
                  variant={difficulty === diff ? 'default' : 'outline'}
                  onClick={() => setDifficulty(diff)}
                  className={`capitalize text-xs h-9 ${
                    difficulty === diff
                      ? diff === 'easy'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : diff === 'hard'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : ''
                  }`}
                >
                  {diff}
                </Button>
              ))}
            </div>
          </div>

          {/* Question Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Question Format</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'MCQ', label: 'Multiple Choice' },
                { type: 'SHORT_ANSWER', label: 'Short Answer' },
                { type: 'NUMERICAL', label: 'Numerical' },
                { type: 'MIXED', label: 'Mixed Format' },
              ].map((fmt) => (
                <Button
                  key={fmt.type}
                  type="button"
                  variant={questionType === fmt.type ? 'default' : 'outline'}
                  onClick={() => setQuestionType(fmt.type as any)}
                  className="text-xs h-9"
                >
                  {fmt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Passes automated verification to eliminate hallucinated questions and repeat duplicates.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateBaseline}
              size="lg"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs px-4 h-10 w-full sm:w-auto"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Take Standard Diagnostic Baseline
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              size="lg"
              className="bg-brand-gradient text-white shadow-glow hover:opacity-95 transition-opacity px-6 h-10 w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrieving Evidence & Verifying...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Grounded Assessment
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recent Assessment Attempts History */}
      {history.length > 0 && (
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Recent Assessment History & Diagnostic Reports
          </h3>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {history.map((att) => (
              <Card key={att.id} className="p-4 border bg-gray-50/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{att.title}</h4>
                    <p className="text-xs text-gray-500">
                      {att.topic} {att.subtopic ? `• ${att.subtopic}` : ''}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      att.percentage >= 80
                        ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                        : att.percentage >= 60
                        ? 'border-amber-300 text-amber-700 bg-amber-50'
                        : 'border-rose-300 text-rose-700 bg-rose-50'
                    }
                  >
                    {att.percentage}%
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Score: {att.score}/{att.totalQuestions}
                  </span>
                  <span className="text-gray-400">
                    {new Date(att.completedAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
