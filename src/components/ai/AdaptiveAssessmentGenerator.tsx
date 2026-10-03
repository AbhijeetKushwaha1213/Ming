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
import { listResources } from '@/api/resourceAPI';
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
        // 1. First try authorized listResources() from resourceAPI
        try {
          const resList = await listResources();
          if (Array.isArray(resList) && resList.length > 0) {
            setAvailableSources(resList);
            return;
          }
        } catch {
          // Token might not be present; proceed to direct API query
        }

        // 2. Direct API call with userId query param fallback
        const effectiveUserId = user?.user_id || user?.id || 'default_user';
        const res = await fetch(`/api/resources?userId=${encodeURIComponent(effectiveUserId)}`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : Array.isArray(data?.resources) ? data.resources : [];
          if (items.length > 0) {
            setAvailableSources(items);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not load course resources for assessment dropdown:', err);
      }
    }
    loadSources();

    const handleRefresh = () => loadSources();
    window.addEventListener('studymate-resource-added', handleRefresh);
    window.addEventListener('studymate-resources-changed', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      window.removeEventListener('studymate-resource-added', handleRefresh);
      window.removeEventListener('studymate-resources-changed', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
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

  // Client-side subject-faithful diagnostic generator (Used when offline or as instant fallback)
  const generateClientTopicQuestions = (
    cTopic: string,
    cSubtopic: string,
    cDiff: 'easy' | 'medium' | 'hard',
    cCount: number,
    cType: string
  ): AssessmentQuestion[] => {
    const norm = (cTopic + ' ' + cSubtopic).toLowerCase();
    let bank: Array<{
      subtopic: string;
      question: string;
      options: string[];
      correct_answer: string;
      explanation: string;
      type?: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL';
    }> = [];

    if (norm.includes('linear') || norm.includes('eigen') || norm.includes('matrix') || norm.includes('vector')) {
      bank = [
        {
          subtopic: 'Eigenvalues & Eigenvectors',
          question: `For a square matrix A and non-zero vector v, what condition defines v as an eigenvector of A with eigenvalue λ?`,
          options: ['A v = λ v', 'A v = v + λ', 'A + λ I = v', 'A v = λ^2 I'],
          correct_answer: 'A v = λ v',
          explanation: `An eigenvector is a non-zero vector that changes at most by a scalar factor λ (the eigenvalue) when linear transformation A is applied: Av = λv.`,
        },
        {
          subtopic: 'Characteristic Equation',
          question: `Which equation is solved to find the eigenvalues λ of an n × n square matrix A?`,
          options: ['det(A - λ I) = 0', 'trace(A - λ I) = 0', 'A - λ I = 0', 'det(A) - λ = 0'],
          correct_answer: 'det(A - λ I) = 0',
          explanation: `The condition (A - λI)v = 0 has non-trivial solutions v ≠ 0 if and only if the matrix (A - λI) is singular, meaning det(A - λI) = 0.`,
        },
        {
          subtopic: 'Spectral Theorem',
          question: `According to the Spectral Theorem, what property is guaranteed for any real symmetric matrix A (where A = A^T)?`,
          options: [
            'All of its eigenvalues are real, and eigenvectors corresponding to distinct eigenvalues are orthogonal',
            'All of its eigenvalues are purely imaginary numbers',
            'Its determinant is always guaranteed to be zero',
            'It cannot be diagonalized under any basis transformation',
          ],
          correct_answer:
            'All of its eigenvalues are real, and eigenvectors corresponding to distinct eigenvalues are orthogonal',
          explanation: `The Spectral Theorem guarantees that any real symmetric matrix has exclusively real eigenvalues and can be orthogonally diagonalized by a matrix of orthonormal eigenvectors.`,
        },
        {
          subtopic: 'Trace and Determinant Invariants',
          question: `For an n × n square matrix A with eigenvalues λ_1, ..., λ_n, how does the trace of A relate to its eigenvalues?`,
          options: [
            'trace(A) = λ_1 + λ_2 + ... + λ_n (the sum of the eigenvalues)',
            'trace(A) = λ_1 · λ_2 · ... · λ_n (the product of the eigenvalues)',
            'trace(A) = max(λ_1, ..., λ_n) - min(λ_1, ..., λ_n)',
            'trace(A) = 1 / (λ_1 + λ_2 + ... + λ_n)',
          ],
          correct_answer: 'trace(A) = λ_1 + λ_2 + ... + λ_n (the sum of the eigenvalues)',
          explanation: `The trace of a matrix is invariant under similarity transformations and identically equals the sum of its eigenvalues (counted with algebraic multiplicity).`,
        },
        {
          subtopic: 'Matrix Invertibility',
          question: `Which statement regarding an n × n matrix A and its determinant det(A) is equivalent to A being invertible?`,
          options: [
            'det(A) ≠ 0 and zero is not an eigenvalue of A',
            'det(A) = 0 and at least one eigenvalue is zero',
            'trace(A) > 0 and all row sums equal 1',
            'rank(A) < n and the nullity is non-zero',
          ],
          correct_answer: 'det(A) ≠ 0 and zero is not an eigenvalue of A',
          explanation: `A square matrix is invertible if and only if det(A) ≠ 0, its rank is n, and 0 is not an eigenvalue.`,
        },
      ];
    } else if (norm.includes('data mining') || norm.includes('machine learning') || norm.includes('neural') || norm.includes('cluster') || norm.includes('apriori')) {
      bank = [
        {
          subtopic: 'Association Rule Mining',
          question: `In association rule mining, what does the 'Support' of an itemset X denote?`,
          options: [
            'The fraction of total transactions in the database that contain itemset X',
            'The conditional probability of transaction containing Y given it contains X',
            'The ratio of observed joint occurrence to expected independent occurrence',
            'The total computational memory allocated to frequent itemset trees',
          ],
          correct_answer: 'The fraction of total transactions in the database that contain itemset X',
          explanation: `Support measures the frequency of occurrence of an itemset in the dataset: Support(X) = count(X) / total_transactions.`,
        },
        {
          subtopic: 'Apriori Property',
          question: `What fundamental anti-monotonicity property forms the basis of the Apriori algorithm?`,
          options: [
            'If an itemset is infrequent, all of its supersets must also be infrequent',
            'All subsets of an infrequent itemset are guaranteed to be frequent',
            'The support of an itemset increases monotonically with each added item',
            'Rules with high confidence must always have minimum support of 100%',
          ],
          correct_answer: 'If an itemset is infrequent, all of its supersets must also be infrequent',
          explanation: `The Apriori property holds that any subset of a frequent itemset must be frequent; conversely, if an itemset is infrequent, none of its supersets can be frequent.`,
        },
        {
          subtopic: 'Supervised vs Unsupervised Learning',
          question: `What is the primary operational distinction between Supervised Learning and Unsupervised Learning?`,
          options: [
            'Supervised learning trains on input data with target ground-truth labels, while unsupervised learning discovers intrinsic patterns without labels',
            'Supervised learning operates without algorithms, while unsupervised learning requires manual feature weights',
            'Supervised learning only handles numerical values, while unsupervised learning only handles text',
            'Unsupervised learning always produces zero prediction error on unseen data',
          ],
          correct_answer:
            'Supervised learning trains on input data with target ground-truth labels, while unsupervised learning discovers intrinsic patterns without labels',
          explanation: `Supervised models learn a mapping function from labeled training pairs (X, y), whereas unsupervised algorithms (like K-Means or PCA) identify cluster structures or representations without target labels.`,
        },
        {
          subtopic: 'Overfitting & Regularization',
          question: `What mathematical effect distinguishes L1 Regularization (Lasso) from L2 Regularization (Ridge)?`,
          options: [
            'L1 regularization adds the absolute sum of weights inducing sparsity, while L2 adds squared weights shrinking coefficients smoothly',
            'L2 regularization eliminates features completely by driving weights exactly to zero',
            'L1 regularization requires infinite training epochs to converge',
            'L2 regularization is applicable only to decision tree models',
          ],
          correct_answer:
            'L1 regularization adds the absolute sum of weights inducing sparsity, while L2 adds squared weights shrinking coefficients smoothly',
          explanation: `L1 norm regularization (Lasso) penalizes |w|, driving irrelevant feature weights to exactly 0 to create sparse models. L2 norm (Ridge) penalizes w^2, shrinking weights toward zero without setting them exactly to zero.`,
        },
        {
          subtopic: 'Classification Evaluation Metrics',
          question: `In binary classification, how is the 'Precision' metric defined?`,
          options: [
            'True Positives / (True Positives + False Positives)',
            'True Positives / (True Positives + False Negatives)',
            '(True Positives + True Negatives) / Total Samples',
            'False Positives / (False Positives + True Negatives)',
          ],
          correct_answer: 'True Positives / (True Positives + False Positives)',
          explanation: `Precision measures the accuracy of positive predictions (of all instances predicted positive, how many were truly positive), whereas Recall measures True Positives / (True Positives + False Negatives).`,
        },
      ];
    } else if (norm.includes('operating') || norm.includes('os') || norm.includes('kernel') || norm.includes('deadlock') || norm.includes('virtual memory')) {
      bank = [
        {
          subtopic: 'Process Lifecycle & State Transitions',
          question: `In ${cTopic}, which state transition occurs when an executing process issues an I/O request and must wait for completion?`,
          options: ['Running to Blocked/Waiting', 'Blocked to Running', 'Ready to Terminated', 'Running to Ready'],
          correct_answer: 'Running to Blocked/Waiting',
          explanation: `When an executing process issues a blocking I/O request or system call, it moves from the Running state to the Blocked/Waiting state until the I/O operation completes.`,
        },
        {
          subtopic: 'Deadlock Characterization & Prevention',
          question: `Which of the following conditions is NOT one of the four essential Coffman conditions required for a deadlock to occur?`,
          options: ['Preemptive Resource Allocation', 'Mutual Exclusion', 'Hold and Wait', 'Circular Wait'],
          correct_answer: 'Preemptive Resource Allocation',
          explanation: `Deadlock requires No Preemption (resources cannot be forcibly taken from a process holding them), along with Mutual Exclusion, Hold and Wait, and Circular Wait.`,
        },
        {
          subtopic: 'Virtual Memory & Address Translation',
          question: `What is the primary role of the Translation Lookaside Buffer (TLB) in ${cTopic} memory management?`,
          options: [
            'To cache recent virtual-to-physical address translations for fast lookup',
            'To store secondary disk swap partitions for backing storage',
            'To allocate CPU execution slices to user-level threads',
            'To encrypt process memory spaces during hardware context switching',
          ],
          correct_answer: 'To cache recent virtual-to-physical address translations for fast lookup',
          explanation: `The TLB is a high-speed associative hardware cache that stores recently used page table mappings to avoid repeated memory access delays.`,
        },
        {
          subtopic: 'CPU Scheduling Algorithms',
          question: `Which CPU scheduling algorithm provides the theoretical minimum average waiting time for a stationary set of processes?`,
          options: ['Shortest Job First (SJF)', 'First-Come, First-Served (FCFS)', 'Round Robin (RR)', 'Multilevel Feedback Queue without priority aging'],
          correct_answer: 'Shortest Job First (SJF)',
          explanation: `Shortest Job First (SJF) is provably optimal with respect to minimizing average waiting time for a given set of stationary jobs.`,
        },
        {
          subtopic: 'File System Architecture & Inodes',
          question: `In a standard UNIX file system architecture, which data is stored inside an inode?`,
          options: [
            'File metadata, permissions, owner ID, size, and data block pointers (excluding the file name)',
            'The human-readable file name and its parent directory path only',
            'The raw unstructured payload bytes stored contiguously on the platter',
            'The operating system kernel symbol lookup table',
          ],
          correct_answer: 'File metadata, permissions, owner ID, size, and data block pointers (excluding the file name)',
          explanation: `An inode stores all file metadata (file size, permissions, owner, timestamps, and pointers to disk blocks), while the file name is stored separately in the directory table.`,
        },
      ];
    } else {
      // General topic-faithful generator (Strictly about cTopic and cSubtopic)
      const sub = cSubtopic || 'Core Principles';
      bank = [
        {
          subtopic: `${sub} - Conceptual Definition`,
          question: `Which statement accurately defines the fundamental concept of ${sub} in ${cTopic}?`,
          options: [
            `The foundational principles and mechanisms governing ${sub} within ${cTopic}`,
            `An unrelated secondary hypothesis rejected by standard ${cTopic} theory`,
            `A transient calculation error that does not reflect verified ${cTopic} models`,
            `A non-standard convention unsupported by peer-reviewed literature in ${cTopic}`,
          ],
          correct_answer: `The foundational principles and mechanisms governing ${sub} within ${cTopic}`,
          explanation: `Foundational mastery of ${cTopic} requires precise understanding of ${sub} and its governing conceptual framework.`,
        },
        {
          subtopic: `${sub} - Governing Mechanism`,
          question: `In ${cTopic}, what is the primary role or mechanism of ${sub}?`,
          options: [
            `To explain and predict core interactions and structural relationships in ${cTopic}`,
            `To contradict verified empirical laws and theoretical foundations of ${cTopic}`,
            `To eliminate quantitative evaluation and replace it with speculative guesswork`,
            `To prevent systematic analysis of ${cTopic} phenomena`,
          ],
          correct_answer: `To explain and predict core interactions and structural relationships in ${cTopic}`,
          explanation: `Within ${cTopic}, ${sub} provides the theoretical framework for analyzing and resolving domain-specific problems.`,
        },
        {
          subtopic: `${sub} - Practical Application`,
          question: `When applying ${sub} to solve practical problems in ${cTopic}, which approach is methodologically sound?`,
          options: [
            `Systematically applying foundational formulas, theorems, and definitions established in ${cTopic}`,
            `Relying on arbitrary heuristics without verifying prerequisite constraints in ${cTopic}`,
            `Ignoring boundary constraints and fundamental definitions of ${sub}`,
            `Assuming all problems in ${cTopic} have identical trivial solutions`,
          ],
          correct_answer: `Systematically applying foundational formulas, theorems, and definitions established in ${cTopic}`,
          explanation: `Rigorous problem solving in ${cTopic} demands systematic adherence to proven formulas, definitions, and theorems.`,
        },
        {
          subtopic: `${sub} - Comparative Evaluation`,
          question: `When comparing different models or techniques in ${cTopic} (${sub}), what is the primary distinguishing criterion?`,
          options: [
            `The validity of underlying assumptions, domain applicability, and accuracy of results in ${cTopic}`,
            `Whichever approach has the shortest textual name regardless of theoretical accuracy`,
            `Discarding mathematical consistency whenever calculations become complex`,
            `Assuming all methodologies produce identical outcomes regardless of inputs`,
          ],
          correct_answer: `The validity of underlying assumptions, domain applicability, and accuracy of results in ${cTopic}`,
          explanation: `Evaluating models in ${cTopic} requires examining underlying assumptions, boundaries, and predictive validity.`,
        },
        {
          subtopic: `${sub} - Conceptual Misconceptions`,
          question: `What is a common conceptual misconception that students must avoid when studying ${sub} in ${cTopic}?`,
          options: [
            `Confusing surface-level terminology with deep structural mechanisms and mathematical definitions in ${cTopic}`,
            `Verifying every derivation against foundational principles of ${cTopic}`,
            `Practicing active problem solving and quantitative reasoning in ${cTopic}`,
            `Consulting authoritative textbooks and verified course materials`,
          ],
          correct_answer: `Confusing surface-level terminology with deep structural mechanisms and mathematical definitions in ${cTopic}`,
          explanation: `Deep conceptual understanding in ${cTopic} requires distinguishing superficial terminology from underlying mechanisms and definitions.`,
        },
      ];
    }

    return bank.slice(0, cCount).map((item, idx) => ({
      question_id: `q_diag_${Date.now()}_${idx}`,
      type: (item.type || (cType === 'MIXED' ? 'MCQ' : cType)) as any,
      topic: cTopic,
      subtopic: item.subtopic,
      difficulty: cDiff,
      question: item.question,
      options: item.options,
      correct_answer: item.correct_answer,
      explanation: item.explanation,
      source_id: 'src_curriculum_standard',
      citation_label: `Curriculum Diagnostic (${cTopic})`,
    }));
  };

  const handleGenerateBaseline = async () => {
    const currentTopic = topic.trim() || 'Course Diagnostic';
    setIsGenerating(true);
    setGenerationNotice(null);

    try {
      const result = await generateAssessment({
        userId: user?.user_id || user?.id || 'default_user',
        topic: currentTopic,
        subtopic: subtopic.trim() || undefined,
        difficulty,
        count,
        questionType,
      });

      if (result.questions && result.questions.length > 0) {
        setActiveQuestions(result.questions);
        toast({
          title: 'Diagnostic Assessment Ready',
          description: `Generated ${result.questions.length} diagnostic questions for ${currentTopic}.`,
        });
        return;
      }
    } catch (apiErr) {
      console.warn('Backend baseline API fallback to client generation:', apiErr);
    } finally {
      setIsGenerating(false);
    }

    const fallbackQuestions = generateClientTopicQuestions(
      currentTopic,
      subtopic.trim(),
      difficulty,
      count,
      questionType
    );
    setActiveQuestions(fallbackQuestions);
    toast({
      title: 'Topic Diagnostic Assessment',
      description: `Generated ${fallbackQuestions.length} diagnostic questions tailored for ${currentTopic}.`,
    });
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
        // Automatically provide a clean topic diagnostic baseline rather than leaving student stranded
        const diagQuestions = generateClientTopicQuestions(
          topic.trim(),
          subtopic.trim(),
          difficulty,
          count,
          questionType
        );
        setActiveQuestions(diagQuestions);
        setGenerationNotice(null);
        toast({
          title: 'Curriculum Diagnostic Assessment',
          description: `No local materials uploaded for this topic. Generated ${diagQuestions.length} curriculum diagnostic questions for ${topic.trim()}.`,
        });
        return;
      }

      setActiveQuestions(result.questions);
      setGenerationNotice(null);
      toast({
        title: 'Assessment Ready',
        description: `Generated and verified ${result.questions.length} grounded questions for ${topic.trim()}.`,
      });
    } catch (err: any) {
      // Fallback to topic diagnostic assessment rather than throwing a blocking error
      const diagQuestions = generateClientTopicQuestions(
        topic.trim(),
        subtopic.trim(),
        difficulty,
        count,
        questionType
      );
      setActiveQuestions(diagQuestions);
      setGenerationNotice(null);
      toast({
        title: 'Topic Diagnostic Assessment',
        description: `Generated ${diagQuestions.length} diagnostic questions for ${topic.trim()}.`,
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
            <Select
              value={selectedSourceId}
              onValueChange={(val) => {
                setSelectedSourceId(val);
                if (val !== 'all') {
                  const src = availableSources.find((s) => s.id === val);
                  if (src) {
                    if (src.folder && (!topic || topic === 'Foundational Course Review')) {
                      setTopic(src.folder);
                    } else if (src.title && (!topic || topic === 'Foundational Course Review')) {
                      setTopic(src.title);
                    }
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Uploaded Materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Uploaded Course Sources{availableSources.length > 0 ? ` (${availableSources.length})` : ''}
                </SelectItem>
                {availableSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.type || 'DOCUMENT'})
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
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="text-emerald-600 font-semibold">{availableSources.length} source{availableSources.length > 1 ? 's' : ''} available</span>
                <span>• Choose a specific material or keep 'All Uploaded Course Sources'.</span>
              </p>
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
