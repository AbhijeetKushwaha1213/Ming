import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  GitFork,
  CheckCircle2,
  Lock,
  AlertCircle,
  BookOpen,
  Presentation,
  Video,
  Sparkles,
  ArrowRight,
  Headphones,
  Wand2,
  FolderOpen,
  UploadCloud,
  FileText,
  RotateCcw,
  Layers,
  Compass,
  Maximize2,
  Minimize2,
  Filter,
  Check,
  BookmarkPlus,
  Play,
  Share2,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useCourseResources } from '@/hooks/useCourseResources';
import { useLearnerMastery } from '@/hooks/useLearnerMastery';
import { useSavedDAGs } from '@/hooks/useSavedDAGs';
import { retrieveGroundedResourceContent } from '@/utils/resourceGrounding';
import { navigateToTab } from '@/utils/navigation';
import { DAGGraphData, DAGNode, LearningPathStep, DAGTutorContext, DAGNodeStatus } from '@/types/dag';
import { generateDAG } from '@/api/dagAPI';
import {
  layoutDAGNodes,
  evaluateNodeStatuses,
  detectPrerequisiteGaps,
  computeRecommendedLearningPath,
  VERIFIED_CURRICULUM_DAGS,
} from '@/utils/dagEngine';
import { AudioBriefViewer } from '@/components/flashcards/AudioBriefViewer';

export const DAGPipeline: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { resources: availableResources, isLoading: isLoadingResources } = useCourseResources();
  const { masteryList, recordEvidence } = useLearnerMastery();
  const { savedDAGs, activeDAG, saveDAG, openDAG, updateNodeMastery, deleteDAG } = useSavedDAGs();

  // Top Area Switcher (A. Generate/Explore vs B. Saved Learning DAGs)
  const [activeTabArea, setActiveTabArea] = useState<'generate' | 'saved'>('generate');

  // Step 1: Configuration Form State
  const [topic, setTopic] = useState(() => {
    return localStorage.getItem('studymate-assessment-prefill-topic') || 'Operating Systems';
  });
  const [subtopic, setSubtopic] = useState('Process Management');
  const [sourceMode, setSourceMode] = useState<'existing' | 'upload' | 'topic_only'>('existing');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const [graphDepth, setGraphDepth] = useState<'Basic' | 'Standard' | 'Detailed'>('Standard');
  const [learningGoal, setLearningGoal] = useState<
    'Exam Preparation' | 'Concept Mastery' | 'Revision' | 'Complete Course Learning'
  >('Concept Mastery');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileText, setUploadedFileText] = useState<string>('');

  // Step 2 & 8: Active Graph & Inspector State
  const [isGenerating, setIsGenerating] = useState(false);
  const [graphData, setGraphData] = useState<DAGGraphData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeAudioBrief, setActiveAudioBrief] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  // Filters & Toggles
  const [focusWeakOnly, setFocusWeakOnly] = useState(false);
  const [showLearningPathTab, setShowLearningPathTab] = useState(true);

  // Pre-fill listener
  useEffect(() => {
    const handlePrefill = (e: any) => {
      if (e.detail?.params?.dagId) {
        openDAG(e.detail.params.dagId).then((loaded) => {
          if (loaded) {
            setGraphData(loaded.graphData);
            setSelectedNodeId(loaded.currentConceptId || loaded.graphData.nodes[0]?.id || null);
            setTopic(loaded.topic);
            if (loaded.subtopic) setSubtopic(loaded.subtopic);
            setActiveTabArea('generate');
          }
        });
      }
      if (e.detail?.params?.topic) {
        setTopic(e.detail.params.topic);
      }
      if (e.detail?.params?.subtopic) {
        setSubtopic(e.detail.params.subtopic);
      }
      if (e.detail?.params?.sourceId) {
        setSelectedSourceId(e.detail.params.sourceId);
        setSourceMode('existing');
      }
    };
    window.addEventListener('studymate-navigate', handlePrefill);
    window.addEventListener('studymate-subtab', handlePrefill);
    return () => {
      window.removeEventListener('studymate-navigate', handlePrefill);
      window.removeEventListener('studymate-subtab', handlePrefill);
    };
  }, [openDAG]);

  // Compute real-time user mastery map from useLearnerMastery
  const userMasteryMap = useMemo(() => {
    const map: Record<string, number> = {};
    masteryList.forEach(m => {
      if (m.topic) map[m.topic.toLowerCase().trim()] = m.masteryProbability;
      if (m.subtopic) map[m.subtopic.toLowerCase().trim()] = m.masteryProbability;
    });
    return map;
  }, [masteryList]);

  // Initial load: restore activeDAG if available, or generate default
  useEffect(() => {
    if (!graphData) {
      if (activeDAG && activeDAG.graphData?.nodes?.length > 0) {
        setGraphData(activeDAG.graphData);
        setSelectedNodeId(activeDAG.currentConceptId || activeDAG.graphData.nodes[0]?.id || null);
        setTopic(activeDAG.topic);
        if (activeDAG.subtopic) setSubtopic(activeDAG.subtopic);
        setGraphDepth(activeDAG.graphDepth || 'Standard');
        setLearningGoal(activeDAG.learningGoal || 'Concept Mastery');
        setIsSaved(true);
      } else {
        handleGenerateDAG(true);
      }
    }
  }, [activeDAG]);

  // Recalculate node statuses if mastery updates
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      const updatedNodes = evaluateNodeStatuses(graphData.nodes, userMasteryMap);
      setGraphData(prev => (prev ? { ...prev, nodes: updatedNodes } : null));
    }
  }, [userMasteryMap]);

  // Handle DAG Generation
  const handleGenerateDAG = async (isInitial = false) => {
    if (!topic.trim()) {
      toast({
        title: 'Topic Required',
        description: 'Please enter a course topic to generate the concept graph.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setIsSaved(false);

    try {
      let groundedContext = '';
      let sourceTitle = '';

      if (sourceMode === 'existing' && availableResources.length > 0) {
        try {
          const retrieval = await retrieveGroundedResourceContent({
            selectedSourceIds: [selectedSourceId],
            resources: availableResources,
            topic: topic,
            userId: user?.user_id || user?.id || 'default_user',
          });
          groundedContext = retrieval.groundedContext;
          sourceTitle =
            selectedSourceId === 'all'
              ? `All Course Materials (${availableResources.length} files)`
              : retrieval.sourceTitles[0] || 'Selected Course Resource';
        } catch (rErr) {
          console.warn('DAG grounding context retrieval notice:', rErr);
        }
      } else if (sourceMode === 'upload' && uploadedFileText) {
        groundedContext = uploadedFileText.slice(0, 3000);
        sourceTitle = uploadedFileName || 'Uploaded Material';
      }

      const generated = await generateDAG({
        topic: topic.trim(),
        subtopic: subtopic.trim(),
        depth: graphDepth,
        learningGoal,
        sourceId: sourceMode === 'existing' ? selectedSourceId : undefined,
        sourceTitle: sourceTitle || `${topic.trim()} Syllabus`,
        groundedContext,
        userMasteryMap,
      });

      setGraphData(generated);
      setSelectedNodeId(generated.nodes[0]?.id || null);

      if (!isInitial) {
        toast({
          title: 'Learning DAG Generated! 🚀',
          description: `Constructed prerequisite graph for "${topic}" with ${generated.nodes.length} concepts.`,
        });
      }
    } catch (err: any) {
      console.error('Failed to generate DAG:', err);
      toast({
        title: 'Generation Notice',
        description: 'Loaded default academic prerequisite map.',
        variant: 'default',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Node selection & lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, DAGNode>();
    if (graphData) {
      graphData.nodes.forEach(n => map.set(n.id, n));
    }
    return map;
  }, [graphData]);

  const selectedNode = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return null;
    return (
      graphData.nodes.find(n => n.id === selectedNodeId) ||
      graphData.nodes[0]
    );
  }, [graphData, selectedNodeId]);

  // Prerequisite gap evaluation for selected node
  const gapAnalysis = useMemo(() => {
    if (!selectedNode || !graphData) return { hasGap: false, incompletePrerequisites: [] };
    return detectPrerequisiteGaps(selectedNode.id, graphData.nodes);
  }, [selectedNode, graphData]);

  // Recommended learning path
  const recommendedSteps = useMemo(() => {
    if (!graphData) return [];
    return computeRecommendedLearningPath(graphData.nodes);
  }, [graphData]);

  // SVG Canvas dimensions and positions
  const columnWidth = 260;
  const rowHeight = 140;
  const paddingX = 40;
  const paddingY = 40;

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    if (!graphData) return pos;

    graphData.nodes.forEach(n => {
      const x = paddingX + n.level * columnWidth;
      const y = paddingY + n.row * rowHeight;
      pos.set(n.id, { x, y });
    });
    return pos;
  }, [graphData]);

  const canvasBounds = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return { width: 900, height: 450 };
    const maxLevel = Math.max(...graphData.nodes.map(n => n.level), 0);
    const maxRow = Math.max(...graphData.nodes.map(n => n.row), 0);
    return {
      width: Math.max(900, paddingX * 2 + (maxLevel + 1) * columnWidth),
      height: Math.max(450, paddingY * 2 + (maxRow + 1) * rowHeight),
    };
  }, [graphData]);

  // Connecting Bézier edges
  const edges = useMemo(() => {
    if (!graphData) return [];
    const list: Array<{
      fromId: string;
      toId: string;
      path: string;
      isPrereqMet: boolean;
      isGap: boolean;
    }> = [];

    graphData.nodes.forEach(node => {
      const toPos = nodePositions.get(node.id);
      if (!toPos) return;

      node.prerequisites.forEach(pid => {
        const fromPos = nodePositions.get(pid);
        if (!fromPos) return;

        const pNode = nodeMap.get(pid);
        const startX = fromPos.x + 215; // right side of source card
        const startY = fromPos.y + 45;  // vertical middle
        const endX = toPos.x;           // left side of dest card
        const endY = toPos.y + 45;

        const c1X = startX + (endX - startX) * 0.5;
        const c1Y = startY;
        const c2X = startX + (endX - startX) * 0.5;
        const c2Y = endY;

        const path = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
        const pStatus = pNode?.status || 'proficient';
        const isMet = pStatus === 'mastered' || pStatus === 'proficient';
        const isGap = pStatus === 'weak' || pStatus === 'locked';

        list.push({ fromId: pid, toId: node.id, path, isPrereqMet: isMet, isGap });
      });
    });

    return list;
  }, [graphData, nodePositions, nodeMap]);

  // Context builder for sidebar tutor
  const buildDAGTutorContext = useCallback((node: DAGNode): DAGTutorContext => {
    const nodes = graphData?.nodes || [];
    const nMap = new Map<string, DAGNode>();
    nodes.forEach((n) => nMap.set(n.id, n));

    const prereqNames = (node.prerequisites || []).map((pid) => {
      const p = nMap.get(pid);
      return p ? (p.name || p.title) : pid;
    });

    const downstream = nodes
      .filter((n) => (n.prerequisites || []).includes(node.id))
      .map((n) => n.name || n.title);

    const weakTopics = nodes
      .filter((n) => n.status === 'weak' || n.status === 'locked' || (n.mastery !== undefined && n.mastery < 0.45))
      .map((n) => n.name || n.title);

    const masteryPercent = Math.round((node.mastery ?? userMasteryMap[node.topic.toLowerCase().trim()] ?? 0.5) * 100);

    return {
      dagId: graphData?.id,
      dagTitle: graphData?.title || `${topic} Learning Path`,
      topic: graphData?.topic || topic,
      subtopic: graphData?.subtopic || subtopic,
      learningGoal: graphData?.learningGoal || learningGoal,
      selectedConcept: {
        id: node.id,
        name: node.name || node.title,
        description: node.description,
        difficulty: node.difficulty,
        masteryPercentage: masteryPercent,
        status: node.status || (masteryPercent >= 80 ? 'Mastered' : masteryPercent >= 45 ? 'Proficient' : 'Developing'),
        prerequisites: node.prerequisites || [],
        prerequisiteNames: prereqNames,
        downstreamConcepts: downstream,
        sourceCoordinate: node.sourceOrigin?.coordinate,
        sourceDocument: node.sourceOrigin?.documentTitle,
        formula: (node.keyFormulas || [])[0],
        misconception: (node.commonMisconceptions || [])[0],
      },
      weakTopics,
      totalConcepts: nodes.length,
    };
  }, [graphData, topic, subtopic, learningGoal, userMasteryMap]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = (graphData?.nodes || []).find((n) => n.id === nodeId);
    if (node) {
      const dagCtx = buildDAGTutorContext(node);
      window.dispatchEvent(new CustomEvent('update-dag-tutor-context', { detail: { dagContext: dagCtx } }));
    }
  };

  // Actions for Selected Node
  const handleMarkAsMastered = async (node: DAGNode) => {
    try {
      await recordEvidence({
        topic: node.title,
        subtopic: node.subtopic,
        isCorrect: true,
        difficulty: node.difficulty === 'Beginner' ? 'easy' : node.difficulty === 'Advanced' ? 'hard' : 'medium',
        eventType: 'manual_mastery_override',
        evidenceDetails: `Student marked concept '${node.name || node.title}' as mastered in Learning DAG.`,
      });

      // Update local node state immediately
      let reEvaluated: DAGNode[] = [];
      setGraphData(prev => {
        if (!prev) return null;
        const updated = prev.nodes.map(n =>
          n.id === node.id ? { ...n, status: 'mastered' as const, mastery: 1.0 } : n
        );
        reEvaluated = evaluateNodeStatuses(updated, {
          ...userMasteryMap,
          [node.title.toLowerCase()]: 1.0,
        });
        return { ...prev, nodes: reEvaluated };
      });

      // Persist to dedicated DAG system
      if (graphData?.id) {
        await updateNodeMastery(graphData.id, node.id, 1.0, 'mastered');
      } else if (graphData) {
        await saveDAG({ ...graphData, nodes: reEvaluated });
      }

      toast({
        title: 'Mastery Updated! 🌟',
        description: `Marked "${node.name || node.title}" as Mastered (100%). Downstream concepts unlocked.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err?.message || 'Could not update mastery.',
        variant: 'destructive',
      });
    }
  };

  const handleLaunchChat = (node: DAGNode) => {
    const dagCtx = buildDAGTutorContext(node);
    window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: { dagContext: dagCtx } }));
  };

  const handleLaunchStudyMaterials = (node: DAGNode) => {
    navigateToTab('flashcards', 'generate', {
      topic: node.name || node.title,
      parentTopic: graphData?.topic || topic,
      subtopic: node.subtopic,
      sourceId: node.sourceOrigin?.sourceId,
      sourceTitle: node.sourceOrigin?.documentTitle,
    });
  };

  const handleLaunchPracticeQuiz = (node: DAGNode) => {
    navigateToTab('flashcards', 'assessment', {
      topic: node.name || node.title,
      subtopic: node.subtopic || node.topic,
      difficulty: node.difficulty,
      sourceId: node.sourceOrigin?.sourceId,
    });
  };

  const handleViewSource = (node: DAGNode) => {
    if (node.sourceOrigin?.sourceId) {
      navigateToTab('resources', undefined, {
        sourceId: node.sourceOrigin.sourceId,
        sourceTitle: node.sourceOrigin.documentTitle,
      });
    } else {
      navigateToTab('resources');
    }
  };

  const handleSaveDAG = async () => {
    if (!graphData) return;

    try {
      await saveDAG(graphData);
      setIsSaved(true);
    } catch (err: any) {
      console.error('Failed to save DAG:', err);
    }
  };

  // Expand / Simplify graph modifications (Step 8)
  const handleExpandGraph = () => {
    setGraphDepth('Detailed');
    handleGenerateDAG();
  };

  const handleSimplifyGraph = () => {
    setGraphDepth('Basic');
    handleGenerateDAG();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-primary/5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <GitFork className="w-5 h-5 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              AI Learning Path & DAG Generator
              <Badge
                variant="outline"
                className="text-xs py-0 px-2 border-indigo-500/30 text-indigo-600 bg-indigo-500/10 font-semibold"
              >
                Adaptive DAG
              </Badge>
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate a prerequisite-aware concept graph from your course materials and discover the optimal learning sequence.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="text-xs h-9 gap-1.5 border-border hover:bg-muted"
          >
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span>{isConfigExpanded ? 'Hide Controls' : 'Configure DAG'}</span>
            {isConfigExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          <Button
            onClick={() => handleGenerateDAG()}
            disabled={isGenerating}
            size="sm"
            className="text-xs h-9 gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Generating Graph...' : 'Generate Learning DAG'}</span>
          </Button>

          {graphData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDAG}
              disabled={isSaved}
              className={`text-xs h-9 gap-1.5 ${
                isSaved
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              <span>{isSaved ? 'Learning DAG saved' : 'Save Learning Path'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Top View Selector: Generate / Explore vs My Saved DAGs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Button
          variant={activeTabArea === 'generate' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTabArea('generate')}
          className={`h-9 px-4 gap-2 text-xs font-semibold rounded-xl transition-all ${
            activeTabArea === 'generate'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generate / Explore DAG</span>
        </Button>

        <Button
          variant={activeTabArea === 'saved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTabArea('saved')}
          className={`h-9 px-4 gap-2 text-xs font-semibold rounded-xl transition-all ${
            activeTabArea === 'saved'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Saved Learning DAGs ({savedDAGs.length})</span>
        </Button>
      </div>

      {activeTabArea === 'saved' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">My Saved Learning Paths</h3>
              <p className="text-xs text-muted-foreground">
                Your saved prerequisite graphs and persistent skill progress.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setActiveTabArea('generate')}
              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create New DAG</span>
            </Button>
          </div>

          {savedDAGs.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-border bg-card/40">
              <GitFork className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No Saved Learning DAGs Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                Generate a prerequisite-aware concept graph from your course materials and save it to track your concept mastery progression.
              </p>
              <Button
                size="sm"
                onClick={() => setActiveTabArea('generate')}
                className="bg-primary text-primary-foreground gap-1.5 text-xs"
              >
                <Sparkles className="w-4 h-4" />
                Generate Learning DAG
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedDAGs.map((dag) => {
                const nodes = dag.graphData?.nodes || [];
                const current =
                  nodes.find((n) => n.id === dag.currentConceptId) ||
                  nodes.find((n) => n.status === 'proficient' || n.status === 'weak' || n.status === 'in_progress') ||
                  nodes[0];
                const next =
                  nodes.find((n) => n.id === dag.nextConceptId) ||
                  nodes.find((n) => n.id !== current?.id && (n.prerequisites || []).includes(current?.id || '')) ||
                  nodes[1];

                return (
                  <Card
                    key={dag.id}
                    className="p-5 border-border bg-card hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground line-clamp-1">
                            {dag.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {dag.topic} {dag.subtopic ? `• ${dag.subtopic}` : ''}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20 shrink-0"
                        >
                          {dag.totalConcepts} Concepts
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground text-[11px]">Mastery Progress</span>
                          <span className="font-bold text-primary">{dag.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(dag.progressPercent, 4)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground text-[11px] font-medium">Current:</span>
                          <span className="font-semibold text-foreground truncate">
                            {current ? (current.name || current.title) : 'Beginning'}
                          </span>
                        </div>
                        {next && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[11px] font-medium">Next:</span>
                            <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate">
                              {next.name || next.title}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(dag.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDAG(dag.id)}
                          className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const loaded = await openDAG(dag.id);
                            if (loaded) {
                              setGraphData(loaded.graphData);
                              setSelectedNodeId(loaded.currentConceptId || loaded.graphData.nodes[0]?.id || null);
                              setTopic(loaded.topic);
                              if (loaded.subtopic) setSubtopic(loaded.subtopic);
                              setActiveTabArea('generate');
                            }
                          }}
                          className="h-7 px-3 gap-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <span>Open DAG</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Configuration Panel (Step 1) - Collapsible / Expandable */}
          {isConfigExpanded && (
            <Card className="p-5 border-border bg-card/60 backdrop-blur-xs animate-in fade-in-0 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Source Material */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Source Material
                  </label>
                  <Select
                    value={selectedSourceId}
                    onValueChange={val => {
                      setSelectedSourceId(val);
                      setSourceMode(val === 'upload_custom' ? 'upload' : 'existing');
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Select course material..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📚 All Course Materials</SelectItem>
                      {availableResources.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.icon || '📄'} {r.title}
                        </SelectItem>
                      ))}
                      <SelectItem value="topic_only">⚡ Topic-Only (No File)</SelectItem>
                      <SelectItem value="upload_custom">📤 Upload New Material...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

            {/* 2. Topic */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5 text-primary" /> Course / Topic *
              </label>
              <Input
                placeholder="e.g. Operating Systems"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* 3. Subtopic */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-muted-foreground" /> Subtopic (Optional)
              </label>
              <Input
                placeholder="e.g. Process Management"
                value={subtopic}
                onChange={e => setSubtopic(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* 4. Graph Depth & Learning Goal */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Graph Depth</label>
                <Select value={graphDepth} onValueChange={(val: any) => setGraphDepth(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic (5 nodes)</SelectItem>
                    <SelectItem value="Standard">Standard (8 nodes)</SelectItem>
                    <SelectItem value="Detailed">Detailed (12+ nodes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Goal</label>
                <Select value={learningGoal} onValueChange={(val: any) => setLearningGoal(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Concept Mastery">Mastery</SelectItem>
                    <SelectItem value="Exam Preparation">Exam Prep</SelectItem>
                    <SelectItem value="Revision">Revision</SelectItem>
                    <SelectItem value="Complete Course Learning">Full Course</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Upload Dropzone if selected */}
          {selectedSourceId === 'upload_custom' && (
            <div className="mt-4 p-4 border border-dashed border-border rounded-xl bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-primary" /> Paste or type reference content:
                </span>
                {uploadedFileName && (
                  <Badge variant="secondary" className="text-[10px]">
                    {uploadedFileName}
                  </Badge>
                )}
              </div>
              <Textarea
                placeholder="Paste lecture excerpts, textbook notes, or syllabus outline here to ground the DAG..."
                value={uploadedFileText}
                onChange={e => setUploadedFileText(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          )}
        </Card>
      )}

      {/* Main DAG Workspace: Interactive Canvas + Concept Inspector */}
      <Card className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Graph Toolbar & Controls (Step 8) */}
        <div className="p-3.5 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Status Legend:
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Mastered (≥80%)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Proficient (45–79%)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Developing / Weak
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/60" /> Prerequisite Locked
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={focusWeakOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFocusWeakOnly(!focusWeakOnly)}
              className="text-[11px] h-7 gap-1 px-2.5"
            >
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span>Focus Weak Topics</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandGraph}
              className="text-[11px] h-7 gap-1 px-2.5"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand Graph</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSimplifyGraph}
              className="text-[11px] h-7 gap-1 px-2.5"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Simplify</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateDAG()}
              className="text-[11px] h-7 gap-1 px-2.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Regenerate</span>
            </Button>
          </div>
        </div>

        {/* Workspace Grid: Canvas (Left 8 cols) + Inspector Panel (Right 4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
          {/* Left Canvas: Interactive SVG DAG */}
          <div className="lg:col-span-8 p-4 overflow-x-auto overflow-y-auto bg-muted/10 relative border-b lg:border-b-0 lg:border-r border-border">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                <p className="text-sm font-semibold text-foreground">
                  Analyzing course concepts & dependency pathways...
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Checking prerequisite fulfillment against your real-time BKT mastery state.
                </p>
              </div>
            ) : graphData ? (
              <div
                className="relative select-none"
                style={{ width: canvasBounds.width, height: canvasBounds.height }}
              >
                {/* SVG Curves */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={canvasBounds.width}
                  height={canvasBounds.height}
                >
                  <defs>
                    <marker
                      id="dag-arrow-met"
                      markerWidth="8"
                      markerHeight="6"
                      refX="7"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                    </marker>
                    <marker
                      id="dag-arrow-gap"
                      markerWidth="8"
                      markerHeight="6"
                      refX="7"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                    </marker>
                    <marker
                      id="dag-arrow-unmet"
                      markerWidth="8"
                      markerHeight="6"
                      refX="7"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                    </marker>
                  </defs>

                  {edges.map((edge, idx) => {
                    const strokeColor = edge.isPrereqMet
                      ? '#10b981'
                      : edge.isGap
                      ? '#f59e0b'
                      : '#94a3b8';
                    const marker = edge.isPrereqMet
                      ? 'url(#dag-arrow-met)'
                      : edge.isGap
                      ? 'url(#dag-arrow-gap)'
                      : 'url(#dag-arrow-unmet)';

                    return (
                      <path
                        key={`edge-${idx}`}
                        d={edge.path}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={edge.isPrereqMet ? '2.5' : '1.75'}
                        strokeDasharray={edge.isPrereqMet ? 'none' : '4 3'}
                        markerEnd={marker}
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>

                {/* Concept Nodes */}
                {graphData.nodes.map(node => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const isDimmed =
                    focusWeakOnly && node.status !== 'weak' && node.status !== 'locked';

                  const getStatusBadge = () => {
                    switch (node.status) {
                      case 'mastered':
                        return (
                          <Badge className="bg-emerald-500 text-white border-0 text-[10px] py-0 px-1.5 font-medium">
                            Mastered
                          </Badge>
                        );
                      case 'proficient':
                        return (
                          <Badge className="bg-blue-500 text-white border-0 text-[10px] py-0 px-1.5 font-medium">
                            Proficient
                          </Badge>
                        );
                      case 'weak':
                        return (
                          <Badge className="bg-amber-500 text-white border-0 text-[10px] py-0 px-1.5 font-medium">
                            Developing
                          </Badge>
                        );
                      case 'locked':
                        return (
                          <Badge className="bg-muted text-muted-foreground border-border text-[10px] py-0 px-1.5">
                            Locked
                          </Badge>
                        );
                      default:
                        return null;
                    }
                  };

                  const getBorderColor = () => {
                    if (isSelected) return 'ring-2 ring-primary border-primary shadow-md';
                    switch (node.status) {
                      case 'mastered':
                        return 'border-emerald-500/50 hover:border-emerald-500';
                      case 'proficient':
                        return 'border-blue-500/40 hover:border-blue-500';
                      case 'weak':
                        return 'border-amber-500/50 hover:border-amber-500';
                      case 'locked':
                        return 'border-border opacity-70';
                      default:
                        return 'border-border';
                    }
                  };

                  return (
                    <div
                      key={node.id}
                      onClick={() => handleSelectNode(node.id)}
                      style={{
                        position: 'absolute',
                        left: `${pos.x}px`,
                        top: `${pos.y}px`,
                        width: '215px',
                        height: '92px',
                      }}
                      className={`p-3 rounded-xl bg-card border cursor-pointer transition-all duration-200 flex flex-col justify-between ${getBorderColor()} ${
                        isDimmed ? 'opacity-30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-bold text-foreground line-clamp-2 leading-snug">
                          {node.title}
                        </span>
                        {node.status === 'locked' ? (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        ) : node.status === 'weak' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              node.status === 'mastered'
                                ? 'text-emerald-500'
                                : 'text-blue-500/60'
                            }`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                        <span className="text-muted-foreground truncate max-w-[95px]">
                          {node.subtopic}
                        </span>
                        {getStatusBadge()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Right Panel: Selected Concept Inspector & Action Hub (Steps 3, 4, 6, 7) */}
          <div className="lg:col-span-4 p-5 bg-card flex flex-col justify-between space-y-4 overflow-y-auto max-h-[640px]">
            {selectedNode ? (
              <div className="space-y-4">
                {/* Concept Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
                      {selectedNode.subtopic}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedNode.difficulty}
                    </Badge>
                  </div>
                  <h4 className="text-lg font-bold text-foreground leading-snug">
                    {selectedNode.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Mastery & BKT Score Bar */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> BKT Mastery Probability:
                    </span>
                    <span className="font-bold text-foreground">
                      {Math.round((selectedNode.mastery || 0.5) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedNode.status === 'mastered'
                          ? 'bg-emerald-500'
                          : selectedNode.status === 'proficient'
                          ? 'bg-blue-500'
                          : selectedNode.status === 'locked'
                          ? 'bg-muted-foreground/60'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.round((selectedNode.mastery || 0.5) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Prerequisite Gap Alert (Step 6) */}
                {gapAnalysis.hasGap && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">⚠️ Prerequisite Gap Detected</span>
                        <p className="text-[11px] mt-0.5 leading-relaxed">
                          {gapAnalysis.guidance}
                        </p>
                      </div>
                    </div>
                    {gapAnalysis.incompletePrerequisites.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectNode(gapAnalysis.incompletePrerequisites[0].id)}
                        className="w-full text-xs h-7 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                      >
                        <span>Study Prerequisite: {gapAnalysis.incompletePrerequisites[0].title}</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Required Prerequisites Checklist */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <GitFork className="w-3.5 h-3.5 text-primary" /> Required Prerequisites:
                  </h5>
                  {selectedNode.prerequisites.length === 0 ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Foundational concept — no prior prerequisites needed.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedNode.prerequisites.map(pid => {
                        const pNode = nodeMap.get(pid);
                        const isMet =
                          pNode?.status === 'mastered' || pNode?.status === 'proficient';
                        return (
                          <div
                            key={pid}
                            onClick={() => handleSelectNode(pid)}
                            className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                          >
                            <span className="text-muted-foreground hover:text-foreground truncate max-w-[170px]">
                              {pNode?.title || pid}
                            </span>
                            {isMet ? (
                              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                                ✓ Met
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                                ⚠️ Incomplete
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Source Grounding Reference (Step 7) */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      {selectedNode.sourceOrigin.type === 'PDF' && <BookOpen className="w-3.5 h-3.5 text-rose-500" />}
                      {selectedNode.sourceOrigin.type === 'PPTX' && <Presentation className="w-3.5 h-3.5 text-amber-500" />}
                      {selectedNode.sourceOrigin.type === 'VIDEO' && <Video className="w-3.5 h-3.5 text-emerald-500" />}
                      {selectedNode.sourceOrigin.type === 'NOTE' && <FileText className="w-3.5 h-3.5 text-blue-500" />}
                      <span>Source Reference</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewSource(selectedNode)}
                      className="text-[11px] text-primary hover:underline font-normal cursor-pointer flex items-center gap-0.5"
                    >
                      <Eye className="w-3 h-3" /> View Source
                    </button>
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {selectedNode.sourceOrigin.coordinate}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedNode.sourceOrigin.documentTitle}
                  </p>
                </div>

                {/* Key Formula / Misconceptions */}
                {selectedNode.keyFormulas && selectedNode.keyFormulas.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                    <span className="font-semibold text-primary block mb-0.5">Core Formula:</span>
                    <code className="font-mono text-[11px] text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                      {selectedNode.keyFormulas[0]}
                    </code>
                  </div>
                )}

                {selectedNode.commonMisconceptions && selectedNode.commonMisconceptions.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-semibold block mb-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" /> Watch Out:
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      {selectedNode.commonMisconceptions[0]}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Actions for Selected Node (Step 4) */}
            {selectedNode && (
              <div className="space-y-2 pt-3 border-t border-border">
                <Button
                  onClick={() => handleLaunchChat(selectedNode)}
                  className="w-full text-xs h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI Tutor About Concept</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleLaunchStudyMaterials(selectedNode)}
                    className="w-full text-xs h-8 gap-1.5 text-foreground hover:bg-muted"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-primary" />
                    <span>Generate Material</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleLaunchPracticeQuiz(selectedNode)}
                    className="w-full text-xs h-8 gap-1.5 text-foreground hover:bg-muted"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Practice Quiz</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const masteryScore = selectedNode.mastery || 0.65;
                      setActiveAudioBrief({
                        title: `${selectedNode.title} — Spoken Concept Brief`,
                        topic: selectedNode.topic,
                        target_concept: selectedNode.title,
                        mastery_score: masteryScore,
                        duration_minutes: 2,
                        script: `Welcome to your 2-minute high-yield spoken revision on ${selectedNode.title}. The essential concept to understand is: ${selectedNode.description}. In examinations, remember: ${selectedNode.keyFormulas ? selectedNode.keyFormulas[0] : 'verify state invariants and boundary constraints'}. Watch out for: ${selectedNode.commonMisconceptions ? selectedNode.commonMisconceptions[0] : 'confusing necessary with sufficient conditions'}. You can cross-verify this in your course material at ${selectedNode.sourceOrigin.coordinate}. Continue practicing to elevate your mastery!`,
                        key_takeaways: [
                          `Concept: ${selectedNode.title}`,
                          `Core principle: ${selectedNode.keyFormulas ? selectedNode.keyFormulas[0] : 'Verify state invariants and boundary conditions'}`,
                          `Exam trap to avoid: ${selectedNode.commonMisconceptions ? selectedNode.commonMisconceptions[0] : 'Watch out for circular dependency edge cases'}`,
                        ],
                        citations: [
                          {
                            label: selectedNode.sourceOrigin.documentTitle,
                            coordinate: selectedNode.sourceOrigin.coordinate,
                            source_type: selectedNode.sourceOrigin.type,
                          },
                        ],
                      });
                    }}
                    className="w-full text-xs h-8 gap-1.5 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Audio Brief</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleMarkAsMastered(selectedNode)}
                    className="w-full text-xs h-8 gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Mastered</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Recommended Learning Path Section (Step 5) */}
      <Card className="p-5 border-border bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              Recommended Learning Path Sequence
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optimal pedagogical sequence derived topologically from prerequisite dependencies and real-time mastery.
            </p>
          </div>

          <Badge variant="outline" className="text-xs self-start sm:self-center">
            {recommendedSteps.filter(s => s.status === 'completed').length} / {recommendedSteps.length} Completed
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {recommendedSteps.map((step, idx) => {
            const isSelected = selectedNodeId === step.nodeId;
            return (
              <div
                key={step.nodeId}
                onClick={() => handleSelectNode(step.nodeId)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  isSelected ? 'ring-2 ring-primary border-primary shadow-sm' : ''
                } ${
                  step.status === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : step.status === 'current'
                    ? 'bg-indigo-500/10 border-indigo-500/40'
                    : step.status === 'locked'
                    ? 'bg-muted/30 border-border opacity-70'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-muted-foreground">#{step.stepNumber}</span>
                  {step.status === 'completed' ? (
                    <Badge className="bg-emerald-500 text-white border-0 text-[9px] py-0 px-1">
                      ✓ Completed
                    </Badge>
                  ) : step.status === 'current' ? (
                    <Badge className="bg-indigo-600 text-white border-0 text-[9px] py-0 px-1 animate-pulse">
                      → Current
                    </Badge>
                  ) : step.status === 'locked' ? (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground">
                      Locked
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] py-0 px-1">
                      Next
                    </Badge>
                  )}
                </div>

                <p className="font-bold text-foreground line-clamp-2 leading-snug">
                  {step.title}
                </p>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>{step.difficulty}</span>
                  <span>{Math.round(step.mastery * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      </div>
      )}

      {/* Audio Brief Modal Overlay */}
      {activeAudioBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <AudioBriefViewer brief={activeAudioBrief} onClose={() => setActiveAudioBrief(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
