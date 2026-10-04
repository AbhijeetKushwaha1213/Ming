import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  GitFork, CheckCircle2, Lock, AlertCircle, BookOpen, 
  Presentation, Video, Sparkles, ArrowRight, ChevronRight,
  Compass, Layers, RotateCcw, Headphones, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { navigateToTab } from '@/utils/navigation';
import { AudioBriefViewer } from '@/components/flashcards/AudioBriefViewer';
import { useSavedDAGs } from '@/hooks/useSavedDAGs';
import { PersistedDAGRecord, DAGTutorContext } from '@/types/dag';

export interface ConceptNode {
  id: string;
  title: string;
  topic: string;
  subtopic: string;
  level: number; // Column level in DAG (0 = foundational, 1 = intermediate, 2 = advanced, 3 = specialized)
  row: number;   // Vertical slot within level
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  prerequisites: string[]; // List of node IDs required before this one
  description: string;
  sourceOrigin: {
    type: 'PDF' | 'PPTX' | 'VIDEO';
    coordinate: string;
    documentTitle: string;
  };
  keyFormulas?: string[];
  commonMisconceptions?: string[];
}

export interface CourseGraphData {
  courseId: string;
  courseTitle: string;
  category: string;
  nodes: ConceptNode[];
}

// Built-in verified college curriculum graphs
const DEFAULT_COURSE_GRAPHS: CourseGraphData[] = [
  {
    courseId: 'cs-os',
    courseTitle: 'Operating Systems & Concurrency',
    category: 'Computer Science',
    nodes: [
      {
        id: 'os-1',
        title: 'CPU Registers & Kernel Mode',
        topic: 'Operating Systems',
        subtopic: 'Hardware Interface',
        level: 0,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: [],
        description: 'Privileged instruction execution, dual-mode operation, system call dispatch vector, and interrupt handling.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 18',
          documentTitle: 'Operating System Concepts, 10th Ed.'
        },
        commonMisconceptions: ['Confusing user-mode library calls with kernel-level traps']
      },
      {
        id: 'os-2',
        title: 'Process Lifecycle & PCB',
        topic: 'Operating Systems',
        subtopic: 'Process Management',
        level: 1,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: ['os-1'],
        description: 'Process states (Ready, Running, Waiting, Terminated), context switching overhead, and Process Control Block structure.',
        sourceOrigin: {
          type: 'PPTX',
          coordinate: 'Lecture 3 Slide 14',
          documentTitle: 'CS301_Lecture3_Processes.pptx'
        },
        commonMisconceptions: ['Thinking context switching occurs without CPU cycle penalty']
      },
      {
        id: 'os-3',
        title: 'CPU Scheduling Algorithms',
        topic: 'Operating Systems',
        subtopic: 'Process Management',
        level: 2,
        row: 0,
        difficulty: 'Intermediate',
        prerequisites: ['os-2'],
        description: 'Preemptive vs Non-preemptive scheduling: Round Robin (quantum tuning), FCFS, Shortest Job First, and Priority Aging.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 142',
          documentTitle: 'Operating System Concepts, 10th Ed.'
        },
        commonMisconceptions: ['Assuming shorter quantum always yields lower turnaround times']
      },
      {
        id: 'os-4',
        title: 'Process Synchronization & Semaphores',
        topic: 'Operating Systems',
        subtopic: 'Concurrency',
        level: 1,
        row: 1,
        difficulty: 'Intermediate',
        prerequisites: ['os-1'],
        description: 'Critical section problem, Peterson algorithm, binary and counting semaphores, mutex locks, and atomic test-and-set.',
        sourceOrigin: {
          type: 'VIDEO',
          coordinate: 'Lecture 6 Timestamp 22:40',
          documentTitle: 'Prof. Lecture 6: Concurrency & Locks.mp4'
        },
        commonMisconceptions: ['Calling wait() and signal() out of sequence causing starvation']
      },
      {
        id: 'os-5',
        title: 'Deadlock Characterization',
        topic: 'Operating Systems',
        subtopic: 'Deadlocks',
        level: 2,
        row: 1,
        difficulty: 'Intermediate',
        prerequisites: ['os-4'],
        description: 'The four Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait with Resource Allocation Graphs.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 218',
          documentTitle: 'Operating System Concepts, 10th Ed.'
        },
        commonMisconceptions: ['Believing cycle in resource graph always implies deadlock with multiple instances']
      },
      {
        id: 'os-6',
        title: "Banker's Algorithm & Avoidance",
        topic: 'Operating Systems',
        subtopic: 'Deadlocks',
        level: 3,
        row: 1,
        difficulty: 'Advanced',
        prerequisites: ['os-5'],
        description: 'Safety algorithm and resource-request algorithm using Available, Max, Allocation, and Need vectors to avoid unsafe states.',
        sourceOrigin: {
          type: 'PPTX',
          coordinate: 'Lecture 9 Slide 22',
          documentTitle: 'CS301_Lecture9_Deadlock_Avoidance.pptx'
        },
        keyFormulas: ['Need[i, j] = Max[i, j] - Allocation[i, j]'],
        commonMisconceptions: ['Conflating unsafe state with guaranteed deadlock']
      },
      {
        id: 'os-7',
        title: 'Memory Hierarchy & Paging',
        topic: 'Operating Systems',
        subtopic: 'Memory Management',
        level: 2,
        row: 2,
        difficulty: 'Intermediate',
        prerequisites: ['os-1'],
        description: 'Logical to physical address translation, Page Tables, TLB cache hit/miss ratio, and effective memory access time.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 320',
          documentTitle: 'Operating System Concepts, 10th Ed.'
        },
        keyFormulas: ['EMAT = Hit_TLB * (TLB_time + Mem_time) + Miss_TLB * (TLB_time + 2 * Mem_time)'],
        commonMisconceptions: ['Forgetting TLB lookup occurs in parallel or before main memory access']
      },
      {
        id: 'os-8',
        title: 'Virtual Memory & Page Replacement',
        topic: 'Operating Systems',
        subtopic: 'Memory Management',
        level: 3,
        row: 2,
        difficulty: 'Advanced',
        prerequisites: ['os-7'],
        description: 'Demand paging, page fault service latency, FIFO anomaly (Belady Anomaly), Optimal algorithm, and LRU clock approximations.',
        sourceOrigin: {
          type: 'VIDEO',
          coordinate: 'Lecture 12 Timestamp 34:10',
          documentTitle: 'Prof. Lecture 12: Virtual Memory & Thrashing.mp4'
        },
        commonMisconceptions: ['Believing FIFO never experiences Beladys anomaly']
      }
    ]
  },
  {
    courseId: 'cs-dsa',
    courseTitle: 'Data Structures & Algorithms',
    category: 'Computer Science',
    nodes: [
      {
        id: 'dsa-1',
        title: 'Arrays & Amortized Complexity',
        topic: 'Data Structures',
        subtopic: 'Linear Structures',
        level: 0,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: [],
        description: 'Contiguous memory layout, dynamic array geometric doubling, amortized O(1) insertions, and Big-O asymptotic notation.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Cormen CLRS Page 28',
          documentTitle: 'Introduction to Algorithms, 4th Ed.'
        }
      },
      {
        id: 'dsa-2',
        title: 'Linked Lists & Pointer Traversal',
        topic: 'Data Structures',
        subtopic: 'Linear Structures',
        level: 0,
        row: 1,
        difficulty: 'Beginner',
        prerequisites: [],
        description: 'Singly, doubly, and circular linked lists. Fast and slow pointer Floyd cycle detection algorithm.',
        sourceOrigin: {
          type: 'PPTX',
          coordinate: 'Lecture 2 Slide 8',
          documentTitle: 'DSA_Lecture2_Lists.pptx'
        }
      },
      {
        id: 'dsa-3',
        title: 'Stacks, Queues & Monotonic Deques',
        topic: 'Data Structures',
        subtopic: 'Abstract Types',
        level: 1,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: ['dsa-1', 'dsa-2'],
        description: 'LIFO & FIFO semantics, monotonic stacks for next greater element, and sliding window maximum in O(N).',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Cormen CLRS Page 104',
          documentTitle: 'Introduction to Algorithms, 4th Ed.'
        }
      },
      {
        id: 'dsa-4',
        title: 'Binary Trees & BST Invariant',
        topic: 'Data Structures',
        subtopic: 'Trees',
        level: 1,
        row: 1,
        difficulty: 'Intermediate',
        prerequisites: ['dsa-2'],
        description: 'Recursive depth traversals (In-order, Pre-order, Post-order), BST search invariant, height balance, and tree reconstruction.',
        sourceOrigin: {
          type: 'VIDEO',
          coordinate: 'Lecture 5 Timestamp 18:15',
          documentTitle: 'Lecture 5: Binary Search Trees.mp4'
        }
      },
      {
        id: 'dsa-5',
        title: 'Graph Adjacency & BFS / DFS',
        topic: 'Algorithms',
        subtopic: 'Graphs',
        level: 2,
        row: 0,
        difficulty: 'Intermediate',
        prerequisites: ['dsa-3', 'dsa-4'],
        description: 'Adjacency list vs matrix representations, breadth-first search shortest unweighted paths, and DFS cycle detection / topological sort.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Cormen CLRS Page 589',
          documentTitle: 'Introduction to Algorithms, 4th Ed.'
        }
      },
      {
        id: 'dsa-6',
        title: "Dijkstra's Shortest Path & Heaps",
        topic: 'Algorithms',
        subtopic: 'Greedy Graphs',
        level: 3,
        row: 0,
        difficulty: 'Advanced',
        prerequisites: ['dsa-5'],
        description: 'Min-heap priority queue extraction, non-negative edge weights invariant, edge relaxation, and O((V + E) log V) complexity.',
        sourceOrigin: {
          type: 'PPTX',
          coordinate: 'Lecture 11 Slide 19',
          documentTitle: 'DSA_Lecture11_Dijkstra.pptx'
        }
      },
      {
        id: 'dsa-7',
        title: 'Dynamic Programming & Memoization',
        topic: 'Algorithms',
        subtopic: 'Dynamic Programming',
        level: 3,
        row: 1,
        difficulty: 'Advanced',
        prerequisites: ['dsa-3', 'dsa-4'],
        description: 'Optimal substructure and overlapping subproblems: memoization recursion vs bottom-up tabulation for knapsack and LCS.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Cormen CLRS Page 360',
          documentTitle: 'Introduction to Algorithms, 4th Ed.'
        }
      }
    ]
  },
  {
    courseId: 'cs-ai-ml',
    courseTitle: 'Machine Learning & Transformer Systems',
    category: 'Artificial Intelligence',
    nodes: [
      {
        id: 'ml-1',
        title: 'Linear Algebra & Vectors',
        topic: 'Machine Learning',
        subtopic: 'Foundations',
        level: 0,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: [],
        description: 'Dot products, matrix multiplications, cosine similarity, orthogonal projections, and eigenvalues.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Strang Linear Algebra Page 45',
          documentTitle: 'Linear Algebra for Everyone'
        }
      },
      {
        id: 'ml-2',
        title: 'Gradient Descent Optimization',
        topic: 'Machine Learning',
        subtopic: 'Optimization',
        level: 1,
        row: 0,
        difficulty: 'Beginner',
        prerequisites: ['ml-1'],
        description: 'Loss surfaces, learning rate scheduling, stochastic mini-batch gradient descent, and Adam momentum optimization.',
        sourceOrigin: {
          type: 'PPTX',
          coordinate: 'Lecture 3 Slide 12',
          documentTitle: 'ML_Lecture3_GradientDescent.pptx'
        }
      },
      {
        id: 'ml-3',
        title: 'Vector Embeddings & Dense Retrieval',
        topic: 'Machine Learning',
        subtopic: 'Representation',
        level: 2,
        row: 0,
        difficulty: 'Intermediate',
        prerequisites: ['ml-1', 'ml-2'],
        description: 'Dense semantic representations, contrastive loss training, HNSW indexing in vector databases, and semantic search.',
        sourceOrigin: {
          type: 'VIDEO',
          coordinate: 'Lecture 7 Timestamp 19:40',
          documentTitle: 'Embeddings and ChromaDB Architecture.mp4'
        }
      },
      {
        id: 'ml-4',
        title: 'Multi-Head Self-Attention',
        topic: 'Machine Learning',
        subtopic: 'Transformers',
        level: 3,
        row: 0,
        difficulty: 'Advanced',
        prerequisites: ['ml-3'],
        description: 'Query, Key, Value matrix projections, scaled dot-product attention softmax((QK^T)/sqrt(d_k))V, and positional encodings.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Attention Is All You Need Page 3',
          documentTitle: 'Vaswani et al. Research Paper'
        }
      }
    ]
  }
];

// Helper to transform user-saved DAG into CourseGraphData
function persistedDAGToCourseGraph(dag: PersistedDAGRecord): CourseGraphData {
  const levels = new Map<string, number>();
  const getNodeLevel = (nodeId: string, visited = new Set<string>()): number => {
    if (levels.has(nodeId)) return levels.get(nodeId)!;
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    const n = dag.nodes.find(x => x.id === nodeId);
    if (!n || !n.prerequisites || n.prerequisites.length === 0) {
      levels.set(nodeId, 0);
      return 0;
    }
    const maxP = Math.max(...n.prerequisites.map(p => getNodeLevel(p, new Set(visited))));
    const lvl = maxP + 1;
    levels.set(nodeId, lvl);
    return lvl;
  };

  dag.nodes.forEach(n => getNodeLevel(n.id));

  const levelCounts: Record<number, number> = {};
  const nodes: ConceptNode[] = dag.nodes.map(n => {
    const level = levels.get(n.id) ?? 0;
    const row = levelCounts[level] ?? 0;
    levelCounts[level] = row + 1;

    let sourceOriginType: 'PDF' | 'PPTX' | 'VIDEO' = 'PDF';
    const rawType = (n.sourceCoordinates?.type || '').toUpperCase();
    if (rawType.includes('PPT') || rawType.includes('SLIDE')) sourceOriginType = 'PPTX';
    else if (rawType.includes('VIDEO') || rawType.includes('MP4') || rawType.includes('AUDIO')) sourceOriginType = 'VIDEO';

    return {
      id: n.id,
      title: n.label,
      topic: n.topic || dag.topic,
      subtopic: n.subtopic || dag.subtopic || 'Core Concept',
      level,
      row,
      difficulty: n.difficulty || 'Intermediate',
      prerequisites: n.prerequisites || [],
      description: n.description || '',
      sourceOrigin: {
        type: sourceOriginType,
        coordinate: n.sourceCoordinates?.coordinate || dag.sourceMaterial?.fileName || 'Concept Reference',
        documentTitle: n.sourceCoordinates?.documentTitle || dag.sourceMaterial?.title || dag.topic
      },
      commonMisconceptions: n.commonMisconceptions
    };
  });

  return {
    courseId: dag.id,
    courseTitle: dag.title || `${dag.topic} Mastery Path`,
    category: 'Saved Learning DAGs',
    nodes
  };
}

interface CoursePrerequisiteGraphProps {
  userMasteryMap?: Record<string, number>; // Map of topic -> BKT mastery probability
  onSelectTopic?: (topic: string, subtopic?: string) => void;
  className?: string;
  compact?: boolean;
}

export const CoursePrerequisiteGraph: React.FC<CoursePrerequisiteGraphProps> = ({
  userMasteryMap = {},
  onSelectTopic,
  className = '',
  compact = true,
}) => {
  const { savedDAGs, activeDAG, activeDAGSummary, openDAG } = useSavedDAGs();

  const availableCourses = useMemo(() => {
    const customCourses = savedDAGs.map(persistedDAGToCourseGraph);
    return [...customCourses, ...DEFAULT_COURSE_GRAPHS];
  }, [savedDAGs]);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    return activeDAG?.id || DEFAULT_COURSE_GRAPHS[0].courseId;
  });

  useEffect(() => {
    if (activeDAG && availableCourses.some(c => c.courseId === activeDAG.id)) {
      setActiveCourseId(activeDAG.id);
    }
  }, [activeDAG?.id, availableCourses]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeAudioBrief, setActiveAudioBrief] = useState<any>(null);
  const [showFullGraph, setShowFullGraph] = useState(false);

  const currentCourse = useMemo(() => {
    return availableCourses.find(c => c.courseId === activeCourseId) || availableCourses[0];
  }, [availableCourses, activeCourseId]);

  useEffect(() => {
    if (!selectedNodeId || !currentCourse.nodes.some(n => n.id === selectedNodeId)) {
      setSelectedNodeId(currentCourse.nodes[0]?.id || null);
    }
  }, [currentCourse, selectedNodeId]);

  // Node helper lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, ConceptNode>();
    for (const node of currentCourse.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [currentCourse]);

  // Compute node status using userMasteryMap and prerequisite check
  const nodeStatuses = useMemo(() => {
    const statuses = new Map<string, { status: 'mastered' | 'proficient' | 'weak' | 'locked'; mastery: number }>();

    for (const node of currentCourse.nodes) {
      const savedNode = activeDAG && activeCourseId === activeDAG.id
        ? activeDAG.nodes.find(n => n.id === node.id)
        : null;

      // Lookup mastery based on topic or subtopic or saved state
      const topicMastery = savedNode?.masteryProbability ?? userMasteryMap[node.topic] ?? userMasteryMap[node.subtopic] ?? 0.55;

      // Check if prerequisites are fulfilled
      let prereqsFulfilled = true;
      for (const pid of node.prerequisites) {
        const pNode = nodeMap.get(pid);
        if (pNode) {
          const pSaved = activeDAG && activeCourseId === activeDAG.id
            ? activeDAG.nodes.find(n => n.id === pid)
            : null;
          const pMastery = pSaved?.masteryProbability ?? userMasteryMap[pNode.topic] ?? userMasteryMap[pNode.subtopic] ?? 0.55;
          if (pMastery < 0.40) {
            prereqsFulfilled = false;
            break;
          }
        }
      }

      if (!prereqsFulfilled && node.prerequisites.length > 0) {
        statuses.set(node.id, { status: 'locked', mastery: topicMastery });
      } else if (savedNode?.status) {
        statuses.set(node.id, { status: savedNode.status, mastery: topicMastery });
      } else if (topicMastery >= 0.80) {
        statuses.set(node.id, { status: 'mastered', mastery: topicMastery });
      } else if (topicMastery >= 0.45) {
        statuses.set(node.id, { status: 'proficient', mastery: topicMastery });
      } else {
        statuses.set(node.id, { status: 'weak', mastery: topicMastery });
      }
    }

    return statuses;
  }, [currentCourse, userMasteryMap, nodeMap, activeDAG, activeCourseId]);

  const selectedNode = useMemo(() => {
    return currentCourse.nodes.find(n => n.id === selectedNodeId) || currentCourse.nodes[0] || {
      id: 'none',
      title: 'No concept selected',
      topic: 'General',
      subtopic: 'General',
      level: 0,
      row: 0,
      difficulty: 'Beginner' as const,
      prerequisites: [],
      description: 'Select a concept to inspect',
      sourceOrigin: { type: 'PDF' as const, coordinate: 'N/A', documentTitle: 'N/A' }
    };
  }, [currentCourse, selectedNodeId]);

  // Derived current and next concept for compact summary view
  const learningSummary = useMemo(() => {
    const nodes = currentCourse.nodes;
    if (nodes.length === 0) {
      return {
        current: { title: 'No Concepts', description: 'Create or generate a learning DAG to track pathways' } as any,
        next: { title: 'Next Concept', description: 'No prerequisite queued' } as any,
        masteredCount: 0,
        total: 0,
        progressPercent: 0
      };
    }

    const current =
      nodes.find(n => {
        const s = nodeStatuses.get(n.id)?.status;
        return s === 'proficient' || s === 'weak';
      }) || nodes[1] || nodes[0];

    const next =
      nodes.find(n => {
        if (n.id === current.id) return false;
        return n.prerequisites.includes(current.id);
      }) || nodes[2] || nodes[0];

    const masteredCount = nodes.filter(n => nodeStatuses.get(n.id)?.status === 'mastered').length;
    const progressPercent = Math.round((masteredCount / nodes.length) * 100);

    return { current, next, masteredCount, total: nodes.length, progressPercent };
  }, [currentCourse, nodeStatuses]);

  // Compute layout coordinates for SVG canvas
  // Column spacing: 260px, Row spacing: 130px, Padding: 40px
  const columnWidth = 260;
  const rowHeight = 135;
  const paddingX = 40;
  const paddingY = 40;

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of currentCourse.nodes) {
      const x = paddingX + n.level * columnWidth;
      const y = paddingY + n.row * rowHeight;
      pos.set(n.id, { x, y });
    }
    return pos;
  }, [currentCourse]);

  // Canvas bounds
  const maxLevel = Math.max(...currentCourse.nodes.map(n => n.level), 0);
  const maxRow = Math.max(...currentCourse.nodes.map(n => n.row), 0);
  const canvasWidth = paddingX * 2 + (maxLevel + 1) * columnWidth;
  const canvasHeight = paddingY * 2 + (maxRow + 1) * rowHeight;

  // Build connecting SVG edges (Bézier curves)
  const edges = useMemo(() => {
    const list: Array<{ fromId: string; toId: string; path: string; isPrereqMet: boolean }> = [];
    for (const node of currentCourse.nodes) {
      const toPos = nodePositions.get(node.id);
      if (!toPos) continue;

      for (const pid of node.prerequisites) {
        const fromPos = nodePositions.get(pid);
        if (!fromPos) continue;

        const startX = fromPos.x + 210; // Right side of source card
        const startY = fromPos.y + 40;  // Vertical middle of source card
        const endX = toPos.x;           // Left side of destination card
        const endY = toPos.y + 40;      // Vertical middle of destination card

        const c1X = startX + (endX - startX) * 0.5;
        const c1Y = startY;
        const c2X = startX + (endX - startX) * 0.5;
        const c2Y = endY;

        const path = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
        const pStatus = nodeStatuses.get(pid)?.status;
        const isMet = pStatus === 'mastered' || pStatus === 'proficient';

        list.push({ fromId: pid, toId: node.id, path, isPrereqMet: isMet });
      }
    }
    return list;
  }, [currentCourse, nodePositions, nodeStatuses]);

  const handleLaunchChat = (topic: string, subtopic?: string) => {
    const dagContext: DAGTutorContext = {
      dagTitle: currentCourse.courseTitle,
      topic: selectedNode.topic,
      subtopic: selectedNode.subtopic,
      learningGoal: 'Concept Mastery',
      selectedConcept: {
        id: selectedNode.id,
        name: selectedNode.title,
        difficulty: selectedNode.difficulty,
        description: selectedNode.description,
        masteryPercentage: Math.round((nodeStatuses.get(selectedNode.id)?.mastery ?? 0.5) * 100),
        status: nodeStatuses.get(selectedNode.id)?.status || 'proficient',
        prerequisites: selectedNode.prerequisites,
        prerequisiteNames: selectedNode.prerequisites.map(pid => nodeMap.get(pid)?.title || pid),
        downstreamConcepts: currentCourse.nodes
          .filter(n => n.prerequisites.includes(selectedNode.id))
          .map(n => n.title),
        sourceCoordinate: selectedNode.sourceOrigin?.coordinate,
        sourceDocument: selectedNode.sourceOrigin?.documentTitle,
      },
      weakTopics: currentCourse.nodes
        .filter(n => nodeStatuses.get(n.id)?.status === 'weak')
        .map(n => n.title),
      totalConcepts: currentCourse.nodes.length,
    };

    window.dispatchEvent(new CustomEvent('open-chat-panel', { detail: { dagContext } }));

    if (onSelectTopic) {
      onSelectTopic(topic, subtopic);
    }
  };

  const handleLaunchAssessment = () => {
    navigateToTab('ai-generator');
  };

  // If in compact mode on Dashboard and user hasn't toggled full view
  if (compact && !showFullGraph) {
    return (
      <Card className={`rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden ${className}`}>
        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Compass className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">Learning Path</h3>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-medium">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current Topic: <span className="font-semibold text-foreground">{currentCourse.courseTitle.split('&')[0].trim()}</span>
              </p>
            </div>
          </div>

          {/* Course Switcher Pills */}
          <div className="flex items-center gap-1.5 flex-wrap bg-muted/60 p-1 rounded-xl border border-border">
            {availableCourses.map(course => {
              const isSaved = savedDAGs.some(d => d.id === course.courseId);
              return (
                <button
                  key={course.courseId}
                  type="button"
                  onClick={() => {
                    setActiveCourseId(course.courseId);
                    setSelectedNodeId(course.nodes[0]?.id || null);
                    if (isSaved) {
                      openDAG(course.courseId);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeCourseId === course.courseId
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {isSaved && <Sparkles className="w-3 h-3 text-amber-400" />}
                  <span>{course.courseTitle.split('&')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Learning Path Summary Cards */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Current Concept */}
          <div className="md:col-span-4 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Current
              </span>
              <Badge className="bg-indigo-600 text-white text-[10px] py-0 px-1.5">In Progress</Badge>
            </div>
            <h4 className="font-bold text-sm text-foreground line-clamp-1">{learningSummary.current.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {learningSummary.current.description}
            </p>
          </div>

          {/* Arrow connector */}
          <div className="hidden md:flex md:col-span-1 justify-center text-muted-foreground">
            <ArrowRight className="w-5 h-5 text-primary/60" />
          </div>

          {/* Next Concept */}
          <div className="md:col-span-4 p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Next
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">Prerequisite</Badge>
            </div>
            <h4 className="font-bold text-sm text-foreground line-clamp-1">{learningSummary.next.title}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {learningSummary.next.description}
            </p>
          </div>

          {/* Open DAG Pipeline CTA & Toggle */}
          <div className="md:col-span-3 flex flex-col justify-center gap-2 pl-0 md:pl-2">
            <Button
              onClick={() => {
                if (activeDAG && activeCourseId === activeDAG.id) {
                  openDAG(activeDAG.id);
                  navigateToTab('flashcards', 'dag', { dagId: activeDAG.id, topic: activeDAG.topic });
                } else {
                  navigateToTab('flashcards', 'dag', { topic: currentCourse.courseTitle.split('&')[0].trim() });
                }
              }}
              className="w-full text-xs h-9 gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open DAG Pipeline</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullGraph(true)}
              className="w-full text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              <span>Preview Full Map</span>
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden ${className}`}>
      {/* Top Banner & Course Selector */}
      <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-card via-card to-accent/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
                Visual Course Flow & Prerequisite Map
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                  DAG Preview
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Interactive concept dependency DAG showing prerequisite pathways and real-time BKT mastery states
              </p>
            </div>
          </div>
        </div>

        {/* Course Switcher Pills & Collapse CTA */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap bg-muted/60 p-1 rounded-xl border border-border">
            {availableCourses.map(course => {
              const isSaved = savedDAGs.some(d => d.id === course.courseId);
              return (
                <button
                  key={course.courseId}
                  type="button"
                  onClick={() => {
                    setActiveCourseId(course.courseId);
                    setSelectedNodeId(course.nodes[0]?.id || null);
                    if (isSaved) {
                      openDAG(course.courseId);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeCourseId === course.courseId
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {isSaved && <Sparkles className="w-3 h-3 text-amber-400" />}
                  <span>{course.courseTitle.split('&')[0].trim()}</span>
                </button>
              );
            })}
          </div>

          {compact && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullGraph(false)}
              className="text-xs h-8 gap-1 border-border"
            >
              <span>Collapse</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => {
              if (activeDAG && activeCourseId === activeDAG.id) {
                openDAG(activeDAG.id);
                navigateToTab('flashcards', 'dag', { dagId: activeDAG.id, topic: activeDAG.topic });
              } else {
                navigateToTab('flashcards', 'dag', { topic: currentCourse.courseTitle.split('&')[0].trim() });
              }
            }}
            className="text-xs h-8 gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open DAG Pipeline</span>
          </Button>
        </div>
      </div>

      {/* Main Flow Canvas & Concept Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
        {/* Left Side: Interactive SVG Graph Canvas */}
        <div className="lg:col-span-8 p-4 overflow-x-auto overflow-y-auto bg-muted/10 relative border-b lg:border-b-0 lg:border-r border-border">
          {/* Legend Banner */}
          <div className="flex items-center gap-3 text-[11px] mb-3 text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-primary" /> Status Legend:
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Mastered (≥80%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Proficient (45–79%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Developing / Weak
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" /> Prerequisite Locked
            </span>
          </div>

          <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
            {/* SVG Connecting Curves */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasWidth}
              height={canvasHeight}
            >
              <defs>
                <marker
                  id="arrowhead-met"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                </marker>
                <marker
                  id="arrowhead-unmet"
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>
              {edges.map((edge, idx) => (
                <path
                  key={`edge-${idx}`}
                  d={edge.path}
                  fill="none"
                  stroke={edge.isPrereqMet ? '#10b981' : '#94a3b8'}
                  strokeWidth={edge.isPrereqMet ? '2.5' : '1.75'}
                  strokeDasharray={edge.isPrereqMet ? 'none' : '4 3'}
                  markerEnd={edge.isPrereqMet ? 'url(#arrowhead-met)' : 'url(#arrowhead-unmet)'}
                  className="transition-all duration-300"
                />
              ))}
            </svg>

            {/* Render Interactive Node Cards */}
            {currentCourse.nodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const nodeInfo = nodeStatuses.get(node.id) || { status: 'proficient', mastery: 0.55 };
              const isSelected = selectedNodeId === node.id;

              const getStatusBadge = () => {
                switch (nodeInfo.status) {
                  case 'mastered':
                    return <Badge className="bg-emerald-500 text-white border-0 text-[10px] py-0 px-1.5">Mastered</Badge>;
                  case 'proficient':
                    return <Badge className="bg-blue-500 text-white border-0 text-[10px] py-0 px-1.5">Proficient</Badge>;
                  case 'weak':
                    return <Badge className="bg-amber-500 text-white border-0 text-[10px] py-0 px-1.5">Review</Badge>;
                  case 'locked':
                    return <Badge className="bg-muted text-muted-foreground border-border text-[10px] py-0 px-1.5">Locked</Badge>;
                }
              };

              const getBorderColor = () => {
                if (isSelected) return 'ring-2 ring-primary border-primary shadow-md';
                switch (nodeInfo.status) {
                  case 'mastered': return 'border-emerald-500/50 hover:border-emerald-500';
                  case 'proficient': return 'border-blue-500/40 hover:border-blue-500';
                  case 'weak': return 'border-amber-500/40 hover:border-amber-500';
                  case 'locked': return 'border-border opacity-70';
                }
              };

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: '210px',
                    height: '88px',
                  }}
                  className={`p-3 rounded-xl bg-card border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between ${getBorderColor()}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-foreground line-clamp-2 leading-tight">
                      {node.title}
                    </span>
                    {nodeInfo.status === 'locked' ? (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${nodeInfo.status === 'mastered' ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40 text-[10px]">
                    <span className="text-muted-foreground truncate max-w-[90px]">{node.subtopic}</span>
                    {getStatusBadge()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Concept Inspector & Action Hub */}
        <div className="lg:col-span-4 p-5 bg-card flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
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
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {selectedNode.description}
              </p>
            </div>

            {/* Prerequisites Checklist */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border">
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
                    const isMet = nodeStatuses.get(pid)?.status === 'mastered' || nodeStatuses.get(pid)?.status === 'proficient';
                    return (
                      <div key={pid} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[170px]">
                          {pNode?.title || pid}
                        </span>
                        {isMet ? (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            ✓ Mastered
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

            {/* Multimodal Origin Linking */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {selectedNode.sourceOrigin.type === 'PDF' && <BookOpen className="w-3.5 h-3.5 text-rose-500" />}
                {selectedNode.sourceOrigin.type === 'PPTX' && <Presentation className="w-3.5 h-3.5 text-amber-500" />}
                {selectedNode.sourceOrigin.type === 'VIDEO' && <Video className="w-3.5 h-3.5 text-emerald-500" />}
                <span>Source Coordinate (Req 1b):</span>
              </div>
              <p className="text-xs font-medium text-foreground">
                {selectedNode.sourceOrigin.coordinate}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {selectedNode.sourceOrigin.documentTitle}
              </p>
            </div>

            {/* Key Formula or Common Misconception Callout */}
            {selectedNode.keyFormulas && selectedNode.keyFormulas.length > 0 && (
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                <span className="font-semibold text-primary block mb-0.5">Core Formula:</span>
                <code className="font-mono text-[11px] text-foreground bg-muted/50 px-1 py-0.5 rounded">
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

          {/* Action CTAs: Ask Tutor, Practice Quiz & Audio Brief */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Button
              onClick={() => handleLaunchChat(selectedNode.topic, selectedNode.subtopic)}
              className="w-full text-xs h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask Tutor About {selectedNode.title.split(' ')[0]}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const nodeStatus = nodeStatuses.get(selectedNode.id);
                const masteryScore = nodeStatus?.status === 'weak' ? 0.32 : nodeStatus?.status === 'locked' ? 0.18 : 0.78;
                setActiveAudioBrief({
                  title: `${selectedNode.title} — Spoken Revision Brief`,
                  topic: selectedNode.topic,
                  target_concept: selectedNode.title,
                  mastery_score: masteryScore,
                  duration_minutes: 2,
                  script: `Welcome to your 2-minute high-yield spoken revision on ${selectedNode.title}. In this concept, the primary focus is understanding: ${selectedNode.description} For exams, make sure you keep in mind this core rule: ${selectedNode.keyFormulas ? selectedNode.keyFormulas[0] : 'verify state invariants'}. A frequent student pitfall is: ${selectedNode.commonMisconceptions ? selectedNode.commonMisconceptions[0] : 'confusing necessary versus sufficient conditions'}. You can verify these steps in your course material at ${selectedNode.sourceOrigin.coordinate}. Keep practicing to elevate your mastery!`,
                  key_takeaways: [
                    `Concept: ${selectedNode.title}`,
                    `Exam focal point: ${selectedNode.keyFormulas ? selectedNode.keyFormulas[0] : 'Verify state invariants and boundary conditions'}`,
                    `Exam trap to avoid: ${selectedNode.commonMisconceptions ? selectedNode.commonMisconceptions[0] : 'Watch out for circular dependency edge cases'}`
                  ],
                  citations: [
                    {
                      label: selectedNode.sourceOrigin.documentTitle,
                      coordinate: selectedNode.sourceOrigin.coordinate,
                      source_type: selectedNode.sourceOrigin.type
                    }
                  ]
                });
              }}
              className="w-full text-xs h-8 gap-1.5 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Listen to 2-Min Audio Brief</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleLaunchAssessment}
              className="w-full text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <span>Launch Practice Quiz for Topic</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Audio Brief Overlay Modal */}
      {activeAudioBrief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <AudioBriefViewer
              brief={activeAudioBrief}
              onClose={() => setActiveAudioBrief(null)}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
