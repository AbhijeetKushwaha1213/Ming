export type DailyPlanTaskType = 
  | 'concept' 
  | 'video' 
  | 'article' 
  | 'documentation' 
  | 'notes' 
  | 'recall' 
  | 'practice' 
  | 'assessment' 
  | 'review';

export interface DailyPlanResource {
  title: string;
  type: 'Video' | 'Article' | 'Documentation' | 'Book' | 'PDF' | 'PPT' | 'Course' | 'Lecture' | 'GitHub' | 'Practice' | 'Quiz' | 'Notes';
  platform: 'Ming Library' | 'YouTube' | 'LeetCode' | 'HackerRank' | 'Codeforces' | 'MDN' | 'Official Docs' | 'GeeksforGeeks' | 'MIT OpenCourseWare' | 'Other';
  url: string;
  isInternal: boolean;
  internalTarget?: {
    tab: 'resources' | 'vault' | 'assessment' | 'dag';
    subtab?: string;
    resourceId?: string;
    topic?: string;
  };
  whyRecommended: string;
  durationText?: string;
}

export interface DailyPlanPractice {
  platform: 'LeetCode' | 'HackerRank' | 'Codeforces' | 'Ming Quiz' | 'Other';
  problemTitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  url: string;
  tags?: string[];
}

export interface DailyPlanTask {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  type: DailyPlanTaskType;
  estimatedMinutes: number;
  completed: boolean;
  resource?: DailyPlanResource;
  practiceDetails?: DailyPlanPractice;
  prerequisiteNotice?: string;
  completedAt?: string;
}

export interface DailyLearningPlan {
  id: string;
  userId: string;
  skillOrProjectId: string;
  skillName: string;
  projectType: string;
  planDate: string; // YYYY-MM-DD
  status: 'not_generated' | 'generated' | 'in_progress' | 'completed';
  objective: string;
  tasks: DailyPlanTask[];
  estimatedTotalMinutes: number;
  targetStudyMinutes: number;
  preferredCodingPlatform: 'LeetCode' | 'HackerRank' | 'Codeforces';
  preferredLearningStyle: string;
  generatedAt: string;
  updatedAt: string;
  dagContext?: {
    dagId?: string;
    dagTitle?: string;
    weakPrerequisites: string[];
    targetConcept?: string;
  };
  masteryAtGeneration?: number;
}
