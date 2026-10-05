import { DailyLearningPlan, DailyPlanTask, DailyPlanResource, DailyPlanPractice } from '@/types/dailyPlan';
import { getTodayDateString } from './dailyPlanStorage';

interface GenerateDailyPlanParams {
  userId: string;
  skillOrProjectId: string;
  skillName: string;
  projectType?: string;
  assignedTasks?: Array<{ id: any; title: string; completed?: boolean }>;
  targetStudyMinutes?: number;
  preferredCodingPlatform?: 'LeetCode' | 'HackerRank' | 'Codeforces';
  preferredLearningStyle?: string;
  learnerMasteryList?: Array<{ topic: string; subtopic?: string; masteryProbability: number; status: string }>;
  uploadedResources?: Array<{ id: string; title: string; type?: string; folder?: string; file_url?: string }>;
  userSavedDAGs?: Array<{ id: string; topic: string; graphData: { nodes: any[] } }>;
  studyVaultMaterials?: Array<{ id: string; title: string; topic?: string; type: string }>;
}

export function generateDailyPlan(params: GenerateDailyPlanParams): DailyLearningPlan {
  const {
    userId,
    skillOrProjectId,
    skillName,
    projectType = 'skill',
    assignedTasks = [],
    targetStudyMinutes = 60,
    preferredCodingPlatform = 'LeetCode',
    preferredLearningStyle = 'Concept → Example → Practice',
    learnerMasteryList = [],
    uploadedResources = [],
    userSavedDAGs = [],
    studyVaultMaterials = []
  } = params;

  const planDate = getTodayDateString();
  const isCoding = /code|programming|react|python|javascript|frontend|backend|dsa|algorithm|fullstack/i.test(skillName) || 
                   /coding|frontend|backend/i.test(projectType);

  // 1. Identify primary topic for today
  const pendingTasks = assignedTasks.filter(t => !t.completed);
  const currentTask = pendingTasks.length > 0 ? pendingTasks[0] : (assignedTasks[0] || { title: `${skillName} Core Concepts` });
  const focusTopic = currentTask.title || skillName;

  // 2. Check for matching DAG and analyze prerequisites
  let weakPrerequisites: string[] = [];
  let dagId: string | undefined;
  let dagTitle: string | undefined;

  const matchingDAG = userSavedDAGs.find(d => {
    const t = (d.topic || '').toLowerCase();
    const sn = skillName.toLowerCase();
    const ft = focusTopic.toLowerCase();
    return sn.includes(t) || t.includes(sn) || ft.includes(t) || t.includes(ft);
  });

  if (matchingDAG && matchingDAG.graphData?.nodes) {
    dagId = matchingDAG.id;
    dagTitle = matchingDAG.topic;
    const nodes = matchingDAG.graphData.nodes;
    
    // Find concept node closest to today's topic
    const targetNode = nodes.find((n: any) => 
      (n.title && focusTopic.toLowerCase().includes(n.title.toLowerCase())) ||
      (n.name && focusTopic.toLowerCase().includes(n.name.toLowerCase()))
    ) || nodes[0];

    if (targetNode && targetNode.prerequisites && targetNode.prerequisites.length > 0) {
      targetNode.prerequisites.forEach((preId: string) => {
        const preNode = nodes.find((n: any) => n.id === preId);
        if (preNode) {
          const m = preNode.mastery ?? 0.5;
          if (m < 0.65 || preNode.status === 'weak' || preNode.status === 'available') {
            weakPrerequisites.push(preNode.title || preNode.name || 'Foundational Concept');
          }
        }
      });
    }
  }

  // 3. Check Learner Mastery for this skill
  const skillMastery = learnerMasteryList.find(m => 
    (m.topic && skillName.toLowerCase().includes(m.topic.toLowerCase())) ||
    (m.topic && focusTopic.toLowerCase().includes(m.topic.toLowerCase()))
  );
  const currentMastery = skillMastery ? skillMastery.masteryProbability : 0.55;

  // 4. Check for internal resources matching this topic (Internal First!)
  const lowerTopic = focusTopic.toLowerCase();
  const lowerSkill = skillName.toLowerCase();

  const matchingUploadedResource = uploadedResources.find(r => {
    const t = (r.title || '').toLowerCase();
    const f = (r.folder || '').toLowerCase();
    return lowerTopic.includes(t) || t.includes(lowerTopic) || lowerSkill.includes(t) || t.includes(lowerSkill) || f.includes(lowerTopic);
  });

  const matchingVaultItem = studyVaultMaterials.find(m => {
    const t = (m.title || '').toLowerCase();
    const top = (m.topic || '').toLowerCase();
    return lowerTopic.includes(t) || t.includes(lowerTopic) || top.includes(lowerTopic);
  });

  // 5. Time distribution based on targetStudyMinutes (30, 45, 60, 90, 120)
  const timeBudget = targetStudyMinutes;
  const hasPrereqStep = weakPrerequisites.length > 0;

  // Calculate task durations
  let tPrereq = hasPrereqStep ? Math.round(timeBudget * 0.18) : 0;
  let tConcept = Math.round(timeBudget * (hasPrereqStep ? 0.22 : 0.28));
  let tActive = Math.round(timeBudget * 0.22);
  let tPractice = Math.round(timeBudget * 0.25);
  let tAssessment = Math.round(timeBudget * 0.15);

  // Normalize sum
  const currentSum = tPrereq + tConcept + tActive + tPractice + tAssessment;
  if (currentSum !== timeBudget) {
    tPractice += (timeBudget - currentSum);
  }

  // 6. Build Objective
  const objective = currentMastery >= 0.75
    ? `By the end of today's session, you will apply and master advanced patterns in ${focusTopic}, demonstrating practical problem-solving and solving verified challenges.`
    : `By the end of today's session, you will understand the core architecture and key principles of ${focusTopic}, study primary grounded examples, and validate your knowledge with practice.`;

  // 7. Assemble Tasks with Grounded Resources
  const tasks: DailyPlanTask[] = [];
  let stepIndex = 1;

  // Step 1: Prerequisite refresher if DAG detected weak prerequisite
  if (hasPrereqStep) {
    const prereqName = weakPrerequisites[0];
    tasks.push({
      id: `task_${Date.now()}_prereq`,
      stepNumber: stepIndex++,
      title: `Review Prerequisite: ${prereqName}`,
      description: `A prerequisite concept (${prereqName}) was identified in your concept graph with Developing mastery. A quick refresher ensures smooth understanding today.`,
      type: 'concept',
      estimatedMinutes: tPrereq,
      completed: false,
      prerequisiteNotice: `Prerequisite Detected from Concept DAG: ${prereqName}`,
      resource: matchingVaultItem ? {
        title: matchingVaultItem.title,
        type: 'Notes',
        platform: 'StudyMate Library',
        url: '#',
        isInternal: true,
        internalTarget: { tab: 'vault', topic: matchingVaultItem.topic || prereqName },
        whyRecommended: 'Grounded in your StudyMate vault notes for this prerequisite.',
        durationText: `${tPrereq} min`
      } : {
        title: `${prereqName} Core Principles`,
        type: 'Documentation',
        platform: 'Official Docs',
        url: isCoding ? 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' : 'https://en.wikipedia.org/wiki/Operating_system',
        isInternal: false,
        whyRecommended: 'Essential conceptual bridge for today\'s topic.',
        durationText: `${tPrereq} min`
      }
    });
  }

  // Step 2: Concept Introduction & Primary Resource
  let primaryResource: DailyPlanResource;
  if (matchingUploadedResource) {
    primaryResource = {
      title: matchingUploadedResource.title,
      type: (matchingUploadedResource.type?.toUpperCase() === 'PDF' ? 'PDF' : 'Lecture') as any,
      platform: 'StudyMate Library',
      url: matchingUploadedResource.file_url || '#',
      isInternal: true,
      internalTarget: { tab: 'resources', resourceId: matchingUploadedResource.id },
      whyRecommended: 'Found in your uploaded course library. Grounds today\'s study in your official professor materials.',
      durationText: `${tConcept} min`
    };
  } else if (/agent|ai|llm/i.test(skillName)) {
    primaryResource = {
      title: 'Introduction to AI Agents & Planning Architecture',
      type: 'Video',
      platform: 'YouTube',
      url: 'https://www.youtube.com/watch?v=sal78ACtGTc',
      isInternal: false,
      whyRecommended: 'Clear breakdown of agent perception, planning, tool selection, and memory loops.',
      durationText: `${tConcept} min`
    };
  } else if (/react|frontend|javascript|web/i.test(skillName)) {
    primaryResource = {
      title: 'React Components, Props & Interactive State Flow',
      type: 'Documentation',
      platform: 'Official Docs',
      url: 'https://react.dev/learn',
      isInternal: false,
      whyRecommended: 'Official React docs with interactive live examples and best practices.',
      durationText: `${tConcept} min`
    };
  } else if (/os|operating system|cpu|deadlock/i.test(skillName)) {
    primaryResource = {
      title: 'CPU Scheduling & Process Lifecycle Architecture',
      type: 'Book',
      platform: 'MIT OpenCourseWare',
      url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
      isInternal: false,
      whyRecommended: 'Classic, crystal-clear explanation of CPU scheduling algorithms and preemption.',
      durationText: `${tConcept} min`
    };
  } else if (/python/i.test(skillName)) {
    primaryResource = {
      title: 'The Python Tutorial: Modern Idioms & Data Structures',
      type: 'Documentation',
      platform: 'Official Docs',
      url: 'https://docs.python.org/3/tutorial/',
      isInternal: false,
      whyRecommended: 'Authoritative Python reference with idiomatic patterns.',
      durationText: `${tConcept} min`
    };
  } else {
    primaryResource = {
      title: `${focusTopic} Comprehensive Overview`,
      type: 'Article',
      platform: 'GeeksforGeeks',
      url: 'https://www.geeksforGeeks.org/',
      isInternal: false,
      whyRecommended: 'High-quality technical breakdown tailored for exam and project preparation.',
      durationText: `${tConcept} min`
    };
  }

  tasks.push({
    id: `task_${Date.now()}_concept`,
    stepNumber: stepIndex++,
    title: `Understand: ${focusTopic}`,
    description: `Study the primary resource to understand the foundational mechanisms, design choices, and core mental model of ${focusTopic}.`,
    type: primaryResource.type === 'Video' ? 'video' : 'article',
    estimatedMinutes: tConcept,
    completed: false,
    resource: primaryResource
  });

  // Step 3: Active Learning & Concept Review
  const hasVaultFlashcards = matchingVaultItem && matchingVaultItem.type === 'flashcards';
  tasks.push({
    id: `task_${Date.now()}_active`,
    stepNumber: stepIndex++,
    title: `Active Recall: Key Principles of ${focusTopic}`,
    description: `Engage active recall to consolidate memory. Review key formulas, common pitfalls, and conceptual milestones before practicing.`,
    type: 'recall',
    estimatedMinutes: tActive,
    completed: false,
    resource: hasVaultFlashcards ? {
      title: `Study Vault: ${matchingVaultItem?.title || focusTopic}`,
      type: 'Quiz',
      platform: 'StudyMate Library',
      url: '#',
      isInternal: true,
      internalTarget: { tab: 'vault', topic: focusTopic },
      whyRecommended: 'Interactive flashcards already saved in your vault for rapid revision.',
      durationText: `${tActive} min`
    } : {
      title: `${focusTopic} Concept Summary & Memory Triggers`,
      type: 'Notes',
      platform: 'StudyMate Library',
      url: '#',
      isInternal: true,
      internalTarget: { tab: 'vault', topic: focusTopic },
      whyRecommended: 'Generate or review AI notes and visual diagrams to cement understanding.',
      durationText: `${tActive} min`
    }
  });

  // Step 4: Adaptive Practice (Coding or Conceptual Exercises)
  let practiceItem: DailyPlanPractice;
  let practiceResource: DailyPlanResource;

  if (isCoding) {
    // Coding practice customized to preferred platform
    if (preferredCodingPlatform === 'HackerRank') {
      practiceItem = {
        platform: 'HackerRank',
        problemTitle: currentMastery >= 0.70 ? 'Advanced Algorithms Challenge' : 'Warm-up & Implementation',
        difficulty: currentMastery >= 0.70 ? 'Medium' : 'Easy',
        url: 'https://www.hackerrank.com/domains/algorithms'
      };
    } else if (preferredCodingPlatform === 'Codeforces') {
      practiceItem = {
        platform: 'Codeforces',
        problemTitle: currentMastery >= 0.70 ? 'Problemset 1200-1400 Rating' : 'Problemset 800-1000 Rating',
        difficulty: currentMastery >= 0.70 ? 'Medium' : 'Easy',
        url: 'https://codeforces.com/problemset'
      };
    } else {
      // Default: LeetCode
      const lcProblems = [
        { title: 'Two Sum & Hash Map Lookup', url: 'https://leetcode.com/problems/two-sum/', diff: 'Easy' as const },
        { title: 'Binary Search Algorithm', url: 'https://leetcode.com/problems/binary-search/', diff: 'Easy' as const },
        { title: 'Valid Parentheses & Stack Flow', url: 'https://leetcode.com/problems/valid-parentheses/', diff: 'Easy' as const },
        { title: 'Longest Substring Without Repeating Characters', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', diff: 'Medium' as const },
        { title: 'Search in Rotated Sorted Array', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/', diff: 'Medium' as const },
      ];
      const selectedLc = currentMastery >= 0.70 ? lcProblems[3] : lcProblems[1];
      practiceItem = {
        platform: 'LeetCode',
        problemTitle: selectedLc.title,
        difficulty: selectedLc.diff,
        url: selectedLc.url
      };
    }

    practiceResource = {
      title: `${practiceItem.problemTitle} (${practiceItem.platform})`,
      type: 'Practice',
      platform: practiceItem.platform,
      url: practiceItem.url,
      isInternal: false,
      whyRecommended: `Calibrated to your ${currentMastery >= 0.70 ? 'Proficient' : 'Developing'} mastery on ${preferredCodingPlatform}.`,
      durationText: `${tPractice} min`
    };
  } else {
    practiceItem = {
      platform: 'StudyMate Quiz',
      problemTitle: `${focusTopic} Scenario-Based Questions`,
      difficulty: currentMastery >= 0.70 ? 'Medium' : 'Easy',
      url: '#'
    };
    practiceResource = {
      title: `${focusTopic} Practical Case Study`,
      type: 'Quiz',
      platform: 'StudyMate Library',
      url: '#',
      isInternal: true,
      internalTarget: { tab: 'assessment', topic: focusTopic },
      whyRecommended: 'Hands-on applied questions testing real-world trade-offs and edge cases.',
      durationText: `${tPractice} min`
    };
  }

  tasks.push({
    id: `task_${Date.now()}_practice`,
    stepNumber: stepIndex++,
    title: `Practice: ${practiceItem.problemTitle}`,
    description: `Apply the concept hands-on. Solve targeted problems on ${practiceItem.platform} matching your current mastery level.`,
    type: 'practice',
    estimatedMinutes: tPractice,
    completed: false,
    practiceDetails: practiceItem,
    resource: practiceResource
  });

  // Step 5: Adaptive Assessment (Feedback Loop)
  tasks.push({
    id: `task_${Date.now()}_assessment`,
    stepNumber: stepIndex++,
    title: `Adaptive Assessment: ${focusTopic}`,
    description: `Complete a 3-question adaptive diagnostic knowledge check. Your performance directly updates your BKT mastery and refines tomorrow's plan.`,
    type: 'assessment',
    estimatedMinutes: tAssessment,
    completed: false,
    resource: {
      title: `Grounded Diagnostic Assessment (${focusTopic})`,
      type: 'Quiz',
      platform: 'StudyMate Library',
      url: '#',
      isInternal: true,
      internalTarget: { tab: 'assessment', topic: focusTopic },
      whyRecommended: 'Connects directly with the Adaptive Assessment engine to update your cognitive mastery model.',
      durationText: `${tAssessment} min`
    }
  });

  const totalCalculatedMinutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    skillOrProjectId,
    skillName,
    projectType,
    planDate,
    status: 'generated',
    objective,
    tasks,
    estimatedTotalMinutes: totalCalculatedMinutes,
    targetStudyMinutes,
    preferredCodingPlatform,
    preferredLearningStyle,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dagContext: dagId ? {
      dagId,
      dagTitle,
      weakPrerequisites,
      targetConcept: focusTopic
    } : undefined,
    masteryAtGeneration: currentMastery
  };
}
