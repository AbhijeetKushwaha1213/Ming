import { DAGGraphData, DAGNode, LearningPathStep } from '@/types/dag';

/**
 * Ensures a graph is strictly a Directed Acyclic Graph (DAG) and computes
 * column levels (topological depth) and vertical row slots.
 */
export function layoutDAGNodes(nodes: DAGNode[]): DAGNode[] {
  if (!nodes || nodes.length === 0) return [];

  const nodeMap = new Map<string, DAGNode>();
  nodes.forEach(n => {
    nodeMap.set(n.id, { ...n, prerequisites: [...(n.prerequisites || [])] });
  });

  // 1. Break cycles to enforce DAG property
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function removeCycles(nodeId: string) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      const validPrereqs: string[] = [];
      for (const pid of node.prerequisites) {
        if (!nodeMap.has(pid)) continue; // ignore non-existent prereq
        if (recursionStack.has(pid)) {
          // Cycle detected! Drop this back-edge
          console.warn(`[DAG Engine] Cycle detected between ${nodeId} and ${pid}. Dropping edge.`);
          continue;
        }
        if (!visited.has(pid)) {
          removeCycles(pid);
        }
        validPrereqs.push(pid);
      }
      node.prerequisites = validPrereqs;
    }

    recursionStack.delete(nodeId);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      removeCycles(n.id);
    }
  });

  // 2. Compute levels (Longest path from roots to each node)
  const memoLevels = new Map<string, number>();

  function getLevel(nodeId: string, depth = 0): number {
    if (depth > 20) return 0; // prevent deep recursion
    if (memoLevels.has(nodeId)) return memoLevels.get(nodeId)!;

    const node = nodeMap.get(nodeId);
    if (!node || !node.prerequisites || node.prerequisites.length === 0) {
      memoLevels.set(nodeId, 0);
      return 0;
    }

    let maxPrereqLevel = -1;
    for (const pid of node.prerequisites) {
      maxPrereqLevel = Math.max(maxPrereqLevel, getLevel(pid, depth + 1));
    }

    const level = maxPrereqLevel + 1;
    memoLevels.set(nodeId, level);
    return level;
  }

  nodes.forEach(n => getLevel(n.id));

  // 3. Assign row indices per level to prevent vertical overlap
  const levelBuckets = new Map<number, DAGNode[]>();
  nodeMap.forEach(node => {
    const lvl = memoLevels.get(node.id) || 0;
    node.level = lvl;
    if (!levelBuckets.has(lvl)) {
      levelBuckets.set(lvl, []);
    }
    levelBuckets.get(lvl)!.push(node);
  });

  const positionedNodes: DAGNode[] = [];
  const sortedLevels = Array.from(levelBuckets.keys()).sort((a, b) => a - b);

  sortedLevels.forEach(lvl => {
    const list = levelBuckets.get(lvl)!;
    list.forEach((node, idx) => {
      node.row = idx;
      positionedNodes.push(node);
    });
  });

  return positionedNodes;
}

/**
 * Evaluates node statuses (mastered, proficient, weak, locked)
 * using the learner's BKT mastery map and prerequisite fulfillment.
 */
export function evaluateNodeStatuses(
  nodes: DAGNode[],
  userMasteryMap: Record<string, number> = {}
): DAGNode[] {
  const nodeMap = new Map<string, DAGNode>();
  nodes.forEach(n => nodeMap.set(n.id, { ...n }));

  // Helper to get mastery
  const getNodeMastery = (node: DAGNode): number => {
    if (node.mastery !== undefined && node.mastery !== null) {
      return node.mastery;
    }
    const cleanTitle = (node.title || '').trim().toLowerCase();
    const cleanTopic = (node.topic || '').trim().toLowerCase();
    const cleanSub = (node.subtopic || '').trim().toLowerCase();

    // Check by title, topic, or subtopic in userMasteryMap
    for (const [key, val] of Object.entries(userMasteryMap)) {
      const k = key.trim().toLowerCase();
      if (k === cleanTitle || cleanTitle.includes(k) || k.includes(cleanTitle)) {
        return val;
      }
      if (k === cleanSub || cleanSub.includes(k)) {
        return val;
      }
      if (k === cleanTopic) {
        return val;
      }
    }

    // Default heuristic based on difficulty
    if (node.difficulty === 'Beginner') return 0.65;
    if (node.difficulty === 'Intermediate') return 0.50;
    return 0.35;
  };

  // Topological pass to evaluate locked state
  const evaluated: DAGNode[] = [];
  const sortedByLevel = [...nodes].sort((a, b) => a.level - b.level);

  const statusMap = new Map<string, 'mastered' | 'proficient' | 'weak' | 'locked'>();

  for (const node of sortedByLevel) {
    const mastery = getNodeMastery(node);
    let prereqsFulfilled = true;

    for (const pid of node.prerequisites) {
      const pStatus = statusMap.get(pid);
      const pNode = nodeMap.get(pid);
      const pMastery = pNode ? getNodeMastery(pNode) : 0.5;

      if (pStatus === 'locked' || pStatus === 'weak' || pMastery < 0.40) {
        prereqsFulfilled = false;
        break;
      }
    }

    let status: 'mastered' | 'proficient' | 'weak' | 'locked';
    if (!prereqsFulfilled && node.prerequisites.length > 0) {
      status = 'locked';
    } else if (mastery >= 0.80) {
      status = 'mastered';
    } else if (mastery >= 0.45) {
      status = 'proficient';
    } else {
      status = 'weak';
    }

    statusMap.set(node.id, status);
    evaluated.push({
      ...node,
      mastery,
      status,
    });
  }

  return evaluated;
}

/**
 * Detects prerequisite gaps for a specific node.
 * Returns information about any prerequisites that are incomplete or weak.
 */
export function detectPrerequisiteGaps(
  targetNodeId: string,
  nodes: DAGNode[]
): {
  hasGap: boolean;
  incompletePrerequisites: Array<{
    id: string;
    title: string;
    status: string;
    mastery: number;
  }>;
  guidance?: string;
} {
  const nodeMap = new Map<string, DAGNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const target = nodeMap.get(targetNodeId);
  if (!target || !target.prerequisites || target.prerequisites.length === 0) {
    return { hasGap: false, incompletePrerequisites: [] };
  }

  const incomplete: Array<{
    id: string;
    title: string;
    status: string;
    mastery: number;
  }> = [];

  for (const pid of target.prerequisites) {
    const p = nodeMap.get(pid);
    if (!p) continue;
    const mastery = p.mastery ?? 0.5;
    const status = p.status || (mastery >= 0.8 ? 'mastered' : mastery >= 0.45 ? 'proficient' : 'weak');

    if (status === 'weak' || status === 'locked' || mastery < 0.45) {
      incomplete.push({
        id: p.id,
        title: p.title,
        status,
        mastery,
      });
    }
  }

  if (incomplete.length > 0) {
    const titles = incomplete.map(i => `"${i.title}"`).join(', ');
    return {
      hasGap: true,
      incompletePrerequisites: incomplete,
      guidance: `${titles} should be strengthened before studying "${target.title}". Master fundamental prerequisites to avoid cognitive overload.`,
    };
  }

  return { hasGap: false, incompletePrerequisites: [] };
}

/**
 * Computes the recommended learning path sequence from a DAG.
 * Sorts topologically and marks each concept as:
 * - 'completed' (mastered)
 * - 'current' (first unlocked concept that is not yet completed)
 * - 'next' (subsequent unlocked concepts)
 * - 'locked' (concepts with pending prerequisites)
 */
export function computeRecommendedLearningPath(nodes: DAGNode[]): LearningPathStep[] {
  if (!nodes || nodes.length === 0) return [];

  const nodeMap = new Map<string, DAGNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Sort nodes primarily by level, secondarily by row
  const sorted = [...nodes].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.row - b.row;
  });

  const steps: LearningPathStep[] = [];
  let foundCurrent = false;

  sorted.forEach((node, index) => {
    const unmet = node.prerequisites.filter(pid => {
      const p = nodeMap.get(pid);
      return !p || (p.status !== 'mastered' && (p.mastery || 0) < 0.75);
    });

    let stepStatus: 'completed' | 'current' | 'next' | 'locked';

    if (node.status === 'mastered' || (node.mastery || 0) >= 0.80) {
      stepStatus = 'completed';
    } else if (node.status === 'locked' || unmet.length > 0) {
      stepStatus = 'locked';
    } else if (!foundCurrent) {
      stepStatus = 'current';
      foundCurrent = true;
    } else {
      stepStatus = 'next';
    }

    steps.push({
      nodeId: node.id,
      title: node.title,
      topic: node.topic,
      difficulty: node.difficulty,
      stepNumber: index + 1,
      status: stepStatus,
      mastery: node.mastery ?? 0.5,
      prerequisites: node.prerequisites,
      unmetPrerequisites: unmet,
    });
  });

  // If all are completed, mark the last one as current/completed
  if (!foundCurrent && steps.length > 0) {
    const lastUnlocked = steps.findLast(s => s.status !== 'locked');
    if (lastUnlocked) {
      lastUnlocked.status = 'current';
    }
  }

  return steps;
}

/**
 * Intelligent curriculum fallback database for academic topics.
 * Ensures the student always gets a deep, accurate DAG even if offline or without API key.
 */
export const VERIFIED_CURRICULUM_DAGS: Record<string, {
  title: string;
  topic: string;
  subtopic: string;
  depth: 'Basic' | 'Standard' | 'Detailed';
  nodes: DAGNode[];
}> = {
  'operating systems': {
    title: 'Operating Systems & Concurrency Architecture',
    topic: 'Operating Systems',
    subtopic: 'Process & Memory Management',
    depth: 'Standard',
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
          documentTitle: 'Operating System Concepts, 10th Ed.',
        },
        keyFormulas: ['TRAP = User-to-Kernel Vector Dispatch'],
        commonMisconceptions: ['Confusing user-mode library calls with kernel-level traps'],
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
          documentTitle: 'CS301_Lecture3_Processes.pptx',
        },
        keyFormulas: ['Context Switch Latency = T_save + T_schedule + T_restore'],
        commonMisconceptions: ['Thinking context switching occurs without CPU cycle penalty'],
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
          documentTitle: 'Operating System Concepts, 10th Ed.',
        },
        keyFormulas: ['Turnaround Time = Completion Time - Arrival Time'],
        commonMisconceptions: ['Assuming shorter quantum always yields lower turnaround times'],
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
          documentTitle: 'Prof. Lecture 6: Concurrency & Locks.mp4',
        },
        keyFormulas: ['wait(S): S <= 0 block, signal(S): S++', 'Mutex Invariant: C_in <= 1'],
        commonMisconceptions: ['Calling wait() and signal() out of sequence causing starvation'],
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
        description: 'Four Coffman conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait), Resource Allocation Graphs, and Banker Algorithm.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 315',
          documentTitle: 'Operating System Concepts, 10th Ed.',
        },
        keyFormulas: ['Need[i][j] = Max[i][j] - Allocation[i][j] <= Available[j]'],
        commonMisconceptions: ['Assuming deadlock prevention and deadlock avoidance are identical'],
      },
      {
        id: 'os-6',
        title: 'Virtual Memory & Paging',
        topic: 'Operating Systems',
        subtopic: 'Memory Management',
        level: 3,
        row: 0,
        difficulty: 'Advanced',
        prerequisites: ['os-3', 'os-5'],
        description: 'Paging hardware, TLB hit/miss latency, multi-level page tables, page fault handling routine, and LRU replacement.',
        sourceOrigin: {
          type: 'PDF',
          coordinate: 'Silberschatz OS Page 390',
          documentTitle: 'Operating System Concepts, 10th Ed.',
        },
        keyFormulas: ['Effective Memory Access = HitRatio * TLB_time + (1 - HitRatio) * (2 * Mem_time)'],
        commonMisconceptions: ['Believing TLB misses generate CPU page-fault interrupts'],
      },
    ],
  },
  'data structures': {
    title: 'Data Structures & Algorithmic Foundations',
    topic: 'Data Structures & Algorithms',
    subtopic: 'Core Structures & Search',
    depth: 'Standard',
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
          documentTitle: 'Introduction to Algorithms, 4th Ed.',
        },
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
          documentTitle: 'DSA_Lecture2_Lists.pptx',
        },
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
          documentTitle: 'Introduction to Algorithms, 4th Ed.',
        },
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
          documentTitle: 'Lecture 5: Binary Search Trees.mp4',
        },
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
          documentTitle: 'Introduction to Algorithms, 4th Ed.',
        },
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
          documentTitle: 'DSA_Lecture11_Dijkstra.pptx',
        },
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
          documentTitle: 'Introduction to Algorithms, 4th Ed.',
        },
      },
    ],
  },
  'machine learning': {
    title: 'Machine Learning & Transformer Systems',
    topic: 'Machine Learning',
    subtopic: 'Foundations & Deep Learning',
    depth: 'Standard',
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
          documentTitle: 'Linear Algebra for Everyone',
        },
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
          documentTitle: 'ML_Lecture3_GradientDescent.pptx',
        },
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
          documentTitle: 'Embeddings and ChromaDB Architecture.mp4',
        },
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
          documentTitle: 'Vaswani et al. Research Paper',
        },
      },
    ],
  },
};
