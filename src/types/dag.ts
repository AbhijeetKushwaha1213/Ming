export interface DAGSourceOrigin {
  type: 'PDF' | 'PPTX' | 'VIDEO' | 'NOTE' | 'DOCUMENT';
  coordinate: string;
  documentTitle: string;
  sourceId?: string;
  pageNumber?: number;
  slideNumber?: number;
  timestampStart?: number;
}

export type DAGNodeStatus = 'mastered' | 'proficient' | 'weak' | 'locked' | 'available' | 'in_progress';

export interface DAGNode {
  id: string;
  title: string;
  name?: string; // convenient alias
  topic: string;
  subtopic: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  level: number; // 0 = foundational, 1, 2, ...
  row: number;   // row within the level column
  prerequisites: string[]; // IDs of prerequisite nodes
  mastery?: number; // 0.0 to 1.0 (from BKT)
  status?: DAGNodeStatus;
  sourceOrigin: DAGSourceOrigin;
  keyFormulas?: string[];
  commonMisconceptions?: string[];
}

export interface DAGGraphData {
  id: string;
  title: string;
  topic: string;
  subtopic?: string;
  learningGoal: 'Exam Preparation' | 'Concept Mastery' | 'Revision' | 'Complete Course Learning';
  depth: 'Basic' | 'Standard' | 'Detailed';
  sourceId?: string;
  sourceTitle?: string;
  sourceType?: string;
  nodes: DAGNode[];
  createdAt: string;
  stats?: {
    totalConcepts: number;
    masteredCount: number;
    proficientCount: number;
    weakCount: number;
    lockedCount: number;
  };
}

export interface LearningPathStep {
  nodeId: string;
  title: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  stepNumber: number;
  status: 'completed' | 'current' | 'next' | 'locked';
  mastery: number;
  prerequisites: string[];
  unmetPrerequisites: string[];
}

export interface PersistedDAGRecord {
  id: string;
  userId: string;
  title: string;
  courseId?: string | null;
  topic: string;
  subtopic?: string | null;
  sourceMaterialIds: string[];
  graphDepth: 'Basic' | 'Standard' | 'Detailed';
  learningGoal: 'Exam Preparation' | 'Concept Mastery' | 'Revision' | 'Complete Course Learning';
  graphData: DAGGraphData;
  progressStatus: 'active' | 'in_progress' | 'completed' | 'archived';
  progressPercent: number; // 0 to 100
  currentConceptId?: string | null;
  nextConceptId?: string | null;
  totalConcepts: number;
  masteredConcepts: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface DAGTutorContext {
  dagId?: string;
  dagTitle: string;
  topic: string;
  subtopic?: string;
  learningGoal: string;
  selectedConcept: {
    id: string;
    name: string;
    description: string;
    difficulty: string;
    masteryPercentage: number;
    status: string;
    prerequisites: string[];
    prerequisiteNames: string[];
    downstreamConcepts: string[];
    sourceCoordinate?: string;
    sourceDocument?: string;
    formula?: string;
    misconception?: string;
  };
  weakTopics: string[];
  totalConcepts: number;
}

