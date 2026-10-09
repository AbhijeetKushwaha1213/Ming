/**
 * Canonical Phase 5 — Step 3
 * Adaptive Learning Recommendations & Study Prioritization Service
 * 
 * SERVER-AUTHORITATIVE RECOMMENDATION ENGINE:
 * 1. Evaluates learner evidence, latent mastery, and Ebbinghaus retention decay.
 * 2. Classifies study priorities into 6 canonical categories:
 *    - LEARN_CONCEPT
 *    - PRACTICE_CONCEPT
 *    - REVIEW_CONCEPT
 *    - ADDRESS_MISCONCEPTION
 *    - CONSOLIDATE_MASTERY
 *    - NO_ACTION
 * 3. Applies transparent, deterministic multi-factor prioritization scoring with tie-breaking.
 * 4. Grounded resource & validated question selection strictly scoped to authenticated user.
 * 5. Deterministic, evidence-based explanations generated strictly from verified signals.
 * 6. Zero-trust security: tenant isolation, client cannot override mastery or scores.
 */

import crypto from 'crypto';
import { prisma, ensureLearnerSchema, ensureResourceSchema, ensureAssessmentSchema } from './prisma.ts';
import type {
  AdaptiveRecommendation,
  RecommendationCategory,
  PriorityBand,
  RecommendedResource,
  RecommendedQuestion,
  LearnerRecommendationResponse,
} from './learnerTypes.ts';
import { calculateConceptRetention } from './bktCalibrationService.ts';
import { computeCanonicalConceptId, normalizeConceptString } from './learnerEvidenceService.ts';
import { getUserDAGs } from './dagService.ts';

// Category precedence order for deterministic tie-breaking
const CATEGORY_PRECEDENCE: Record<RecommendationCategory, number> = {
  ADDRESS_MISCONCEPTION: 1,
  REVIEW_CONCEPT: 2,
  PRACTICE_CONCEPT: 3,
  LEARN_CONCEPT: 4,
  CONSOLIDATE_MASTERY: 5,
  NO_ACTION: 6,
};

export interface EvaluateRecommendationsOptions {
  topic?: string;
  limit?: number;
  now?: Date | string;
}

/**
 * Computes deterministic priority score bounded in [0.0, 1.0]
 * 
 * Score Formula:
 * Base = 0.35 * MasteryDeficit + 0.25 * RetrievalDeficit + 0.25 * RecentMistakes + 0.15 * Uncertainty
 * Score = min(1.0, max(0.0, (Base + MisconceptionBoost + PrereqBonus) * PrereqGate))
 */
export function calculatePriorityScore(params: {
  attempts: number;
  latentMastery: number;
  currentRecall: number;
  confidence: number;
  recentIncorrectCount: number;
  hasRecurringMisconception: boolean;
  hasSingleMisconception: boolean;
  prerequisiteStatus: 'MET' | 'UNMET' | 'NONE';
}): { score: number; band: PriorityBand } {
  const {
    attempts,
    latentMastery,
    currentRecall,
    confidence,
    recentIncorrectCount,
    hasRecurringMisconception,
    hasSingleMisconception,
    prerequisiteStatus,
  } = params;

  // 1. Mastery Deficit:
  // If unassessed (attempts = 0), neutral deficit 0.70 (learning needed, but not proven weakness)
  const masteryDeficit = attempts === 0 ? 0.70 : Math.max(0.05, 1.0 - latentMastery);

  // 2. Retrieval Deficit:
  // Gap between latent competence and current recall probability
  const retrievalDeficit = attempts === 0 ? 0.0 : Math.max(0.0, latentMastery - currentRecall);

  // 3. Recent Mistakes Factor:
  const recentMistakes = Math.min(1.0, recentIncorrectCount * 0.25);

  // 4. Uncertainty Factor (1.0 - confidence):
  const uncertainty = Math.max(0.0, 1.0 - confidence);

  // Base Multi-Factor Score:
  const baseScore =
    0.35 * masteryDeficit +
    0.25 * retrievalDeficit +
    0.25 * recentMistakes +
    0.15 * uncertainty;

  // Misconception Boost:
  let misconceptionBoost = 0.0;
  if (hasRecurringMisconception) {
    misconceptionBoost = 0.15;
  } else if (hasSingleMisconception) {
    misconceptionBoost = 0.05;
  }

  // Prerequisite Gating:
  // If explicit prerequisite is UNMET (locked in DAG), deprioritize heavily
  let prereqGate = 1.0;
  let prereqBonus = 0.0;
  if (prerequisiteStatus === 'UNMET') {
    prereqGate = 0.10;
  } else if (prerequisiteStatus === 'MET') {
    prereqBonus = 0.05;
  }

  const rawScore = (baseScore + misconceptionBoost + prereqBonus) * prereqGate;
  const boundedScore = Math.max(0.0, Math.min(1.0, rawScore));
  const finalScore = Math.round(boundedScore * 1000) / 1000;

  let band: PriorityBand = 'LOW';
  if (finalScore >= 0.75) band = 'CRITICAL';
  else if (finalScore >= 0.55) band = 'HIGH';
  else if (finalScore >= 0.35) band = 'MEDIUM';

  return { score: finalScore, band };
}

/**
 * Deterministically classifies a concept into one of the 6 canonical categories.
 */
export function determineRecommendationCategory(params: {
  attempts: number;
  latentMastery: number;
  currentRecall: number;
  confidence: number;
  retentionNeedsReview: boolean;
  elapsedDays: number;
  recentIncorrectCount: number;
  hasRecurringMisconception: boolean;
}): { category: RecommendationCategory; reasonCodes: string[] } {
  const {
    attempts,
    latentMastery,
    currentRecall,
    confidence,
    retentionNeedsReview,
    elapsedDays,
    recentIncorrectCount,
    hasRecurringMisconception,
  } = params;

  // 1. ADDRESS_MISCONCEPTION:
  // Verified recurring misconception detected (>= 2 occurrences of error category)
  if (hasRecurringMisconception) {
    return {
      category: 'ADDRESS_MISCONCEPTION',
      reasonCodes: ['VERIFIED_RECURRING_MISCONCEPTION'],
    };
  }

  // 2. REVIEW_CONCEPT:
  // Latent competence exists (pL >= 0.50), but recall has decayed significantly over time
  if (
    latentMastery >= 0.50 &&
    (currentRecall < 0.70 * latentMastery || retentionNeedsReview) &&
    elapsedDays >= 1.0
  ) {
    return {
      category: 'REVIEW_CONCEPT',
      reasonCodes: ['RETRIEVAL_DECAY_DETECTED', 'SPACED_REPETITION_DUE'],
    };
  }

  // 3. PRACTICE_CONCEPT:
  // Multiple attempts recorded, but mastery is developing (< 0.60) or recent errors occurred
  if (attempts >= 2 && (latentMastery < 0.60 || recentIncorrectCount > 0)) {
    return {
      category: 'PRACTICE_CONCEPT',
      reasonCodes: [
        latentMastery < 0.60 ? 'DEVELOPING_MASTERY' : 'RECENT_MISTAKES_RECORDED',
      ],
    };
  }

  // 4. LEARN_CONCEPT:
  // Insufficient evidence (0 or 1 attempt, cold-start)
  if (attempts < 2) {
    return {
      category: 'LEARN_CONCEPT',
      reasonCodes: ['INSUFFICIENT_EVIDENCE', 'COLD_START_DIAGNOSTIC'],
    };
  }

  // 5. CONSOLIDATE_MASTERY:
  // High latent mastery (>= 0.85) with high statistical confidence (>= 0.70)
  if (latentMastery >= 0.85 && confidence >= 0.70) {
    return {
      category: 'CONSOLIDATE_MASTERY',
      reasonCodes: ['MASTERY_PROFICIENT', 'STRENGTHEN_STABILITY'],
    };
  }

  // 6. Default fallback
  if (latentMastery >= 0.60) {
    return {
      category: 'CONSOLIDATE_MASTERY',
      reasonCodes: ['SUFFICIENT_MASTERY_STABILIZATION'],
    };
  }

  return {
    category: 'NO_ACTION',
    reasonCodes: ['NO_ACTIVE_INTERVENTION_CRITERIA_MET'],
  };
}

/**
 * Generates concise, truthful evidence-based explanation without hallucinations.
 */
export function generateRecommendationExplanation(params: {
  category: RecommendationCategory;
  conceptName: string;
  latentMastery: number;
  currentRecall: number;
  evidenceCount: number;
  recentIncorrectCount: number;
  elapsedDays: number | null;
  recurringMisconception: string | null;
}): string {
  const {
    category,
    conceptName,
    latentMastery,
    currentRecall,
    evidenceCount,
    recentIncorrectCount,
    elapsedDays,
    recurringMisconception,
  } = params;

  const pLMastPct = Math.round(latentMastery * 100);
  const recallPct = Math.round(currentRecall * 100);
  const daysText = elapsedDays !== null ? `${Math.round(elapsedDays)} day(s)` : 'a period of inactivity';

  switch (category) {
    case 'ADDRESS_MISCONCEPTION':
      return `Targeted misconception resolution recommended for ${conceptName}: persistent error pattern (${recurringMisconception || 'recurring misunderstanding'}) detected across verified attempts.`;
    case 'REVIEW_CONCEPT':
      return `Review recommended for ${conceptName}: estimated recall probability has declined to ${recallPct}% (from ${pLMastPct}% latent mastery) over ${daysText} since last review.`;
    case 'PRACTICE_CONCEPT':
      return `Practice recommended for ${conceptName}: developing mastery (${pLMastPct}%) with ${recentIncorrectCount} recent incorrect attempt(s) recorded.`;
    case 'LEARN_CONCEPT':
      return `Initial learning recommended for ${conceptName}: insufficient evidence (${evidenceCount} attempt(s)) to reliably estimate mastery.`;
    case 'CONSOLIDATE_MASTERY':
      return `Consolidation recommended for ${conceptName}: strong verified mastery (${pLMastPct}%) achieved with high confidence to reinforce long-term retention.`;
    case 'NO_ACTION':
    default:
      return `No immediate study action required for ${conceptName}: current mastery and retention meet proficiency targets.`;
  }
}

/**
 * Main Recommendation Evaluation Engine
 */
export async function evaluateAdaptiveRecommendations(
  userId: string,
  options: EvaluateRecommendationsOptions = {}
): Promise<LearnerRecommendationResponse> {
  await ensureLearnerSchema();
  await ensureResourceSchema();
  await ensureAssessmentSchema();

  const now = options.now ? new Date(options.now) : new Date();
  const limit = Math.max(1, Math.min(20, options.limit || 5));
  const filterTopic = options.topic ? options.topic.trim().toLowerCase() : null;

  // 1. Fetch Authoritative Mastery Records
  const masteryRows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_mastery WHERE userId = ?',
    userId
  );

  // 2. Fetch Recent Events for Mistake Recency & Concept Extractions
  const eventRows: any[] = await prisma.$queryRawUnsafe(
    'SELECT * FROM learner_events WHERE userId = ? ORDER BY timestamp DESC LIMIT 100',
    userId
  );

  // 3. Fetch User Misconceptions (Phase 4 / Phase 9 verified errors)
  let misconceptionRows: any[] = [];
  try {
    misconceptionRows = await prisma.$queryRawUnsafe(
      'SELECT topic, subtopic, concept, severity, misconceptionType FROM assessment_misconceptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
      userId
    );
  } catch {
    misconceptionRows = [];
  }

  // 4. Fetch User Resources strictly scoped to userId
  const resourceRows: any[] = await prisma.$queryRawUnsafe(
    userId === 'default_user'
      ? "SELECT id, title, type, folder, storagePath FROM resources WHERE userId = 'default_user' ORDER BY createdAt DESC LIMIT 100"
      : "SELECT id, title, type, folder, storagePath FROM resources WHERE userId = ? ORDER BY createdAt DESC LIMIT 100",
    ...(userId === 'default_user' ? [] : [userId])
  );

  // 5. Fetch User Assessment Questions strictly scoped to userId
  const questionRows: any[] = await prisma.$queryRawUnsafe(
    userId === 'default_user'
      ? "SELECT id, question, type, difficulty, topic, subtopic, sourceId FROM assessment_questions WHERE userId = 'default_user' ORDER BY createdAt DESC LIMIT 100"
      : "SELECT id, question, type, difficulty, topic, subtopic, sourceId FROM assessment_questions WHERE userId = ? ORDER BY createdAt DESC LIMIT 100",
    ...(userId === 'default_user' ? [] : [userId])
  );

  // 6. Fetch User DAGs for Prerequisite Relationships
  let userDAGs: any[] = [];
  try {
    userDAGs = await getUserDAGs(userId);
  } catch {
    userDAGs = [];
  }

  // Build DAG node status map for prerequisite lookup
  const dagNodeMap = new Map<string, { status: string; prerequisites: string[] }>();
  userDAGs.forEach((dag) => {
    (dag.nodes || []).forEach((node: any) => {
      if (node.title) {
        dagNodeMap.set(normalizeConceptString(node.title), {
          status: node.status || 'available',
          prerequisites: node.prerequisites || [],
        });
      }
    });
  });

  // 7. Aggregate Distinct Concepts from Mastery, Events, and Course Resources
  interface ConceptCandidate {
    concept_id: string;
    concept_name: string;
    topic: string;
    subtopic: string | null;
    masteryRow?: any;
  }

  const candidateMap = new Map<string, ConceptCandidate>();

  // A. From Mastery Records
  masteryRows.forEach((m) => {
    const ident = computeCanonicalConceptId(m.topic, m.subtopic, m.subtopic || m.topic);
    if (!candidateMap.has(ident.concept_id)) {
      candidateMap.set(ident.concept_id, {
        concept_id: ident.concept_id,
        concept_name: ident.concept_name,
        topic: m.topic,
        subtopic: m.subtopic || null,
        masteryRow: m,
      });
    } else {
      const existing = candidateMap.get(ident.concept_id)!;
      existing.masteryRow = m;
    }
  });

  // B. From Events
  eventRows.forEach((e) => {
    let conceptStr = e.subtopic || e.topic;
    if (e.evidenceDetails) {
      try {
        const details = JSON.parse(e.evidenceDetails);
        if (details.concept_name) conceptStr = details.concept_name;
      } catch {}
    }
    const ident = computeCanonicalConceptId(e.topic, e.subtopic, conceptStr);
    if (!candidateMap.has(ident.concept_id)) {
      candidateMap.set(ident.concept_id, {
        concept_id: ident.concept_id,
        concept_name: ident.concept_name,
        topic: e.topic,
        subtopic: e.subtopic || null,
      });
    }
  });

  // C. From Uploaded Resources (ensures cold-start unassessed topics are discoverable)
  resourceRows.forEach((r) => {
    const topic = r.folder || r.title || 'Course Material';
    const ident = computeCanonicalConceptId(topic, null, topic);
    if (!candidateMap.has(ident.concept_id)) {
      candidateMap.set(ident.concept_id, {
        concept_id: ident.concept_id,
        concept_name: ident.concept_name,
        topic: topic,
        subtopic: null,
      });
    }
  });

  // 8. Filter by Topic if requested
  const allCandidates = Array.from(candidateMap.values()).filter((c) => {
    if (!filterTopic) return true;
    return (
      c.topic.toLowerCase().includes(filterTopic) ||
      (c.subtopic && c.subtopic.toLowerCase().includes(filterTopic)) ||
      c.concept_name.toLowerCase().includes(filterTopic)
    );
  });

  const totalAssessed = masteryRows.filter((m) => Number(m.attempts) > 0).length;
  const isColdStart = totalAssessed === 0;

  // 9. Evaluate Each Concept Deterministically
  const evaluatedRecommendations: AdaptiveRecommendation[] = [];

  for (const candidate of allCandidates) {
    const mRow = candidate.masteryRow;
    const attempts = mRow ? Number(mRow.attempts || 0) : 0;
    const latentMastery = mRow ? Number(mRow.masteryProbability || 0.0) : 0.0;
    const confidence = mRow ? Number(mRow.confidence || 0.0) : 0.0;
    const lastAssessedAt = mRow?.lastAssessedAt ? new Date(mRow.lastAssessedAt).toISOString() : null;
    const correctCount = mRow ? Number(mRow.correctCount || 0) : 0;

    // Temporal Retention (Ebbinghaus decay)
    const retention = calculateConceptRetention({
      initialMastery: latentMastery,
      lastAssessedAt,
      correctCount,
      now,
    });

    // Recent Mistakes Count for this concept/topic
    const recentTopicMistakes = eventRows.filter((e) => {
      const matchTopic = e.topic.toLowerCase() === candidate.topic.toLowerCase();
      const matchSub = candidate.subtopic ? e.subtopic?.toLowerCase() === candidate.subtopic.toLowerCase() : true;
      return matchTopic && matchSub && (e.isCorrect === 0 || e.isCorrect === false);
    }).length;

    // Check Misconceptions for this concept/topic
    const matchingMisconceptions = misconceptionRows.filter((mc) => {
      const matchTopic = mc.topic.toLowerCase() === candidate.topic.toLowerCase();
      const matchConcept = mc.concept ? normalizeConceptString(mc.concept) === normalizeConceptString(candidate.concept_name) : true;
      return matchTopic && matchConcept;
    });

    const misconceptionCounts = new Map<string, number>();
    matchingMisconceptions.forEach((mc) => {
      const key = mc.misconceptionType || mc.concept || 'misconception';
      misconceptionCounts.set(key, (misconceptionCounts.get(key) || 0) + 1);
    });

    let recurringMisconceptionKey: string | null = null;
    let hasRecurring = false;
    for (const [key, count] of misconceptionCounts.entries()) {
      if (count >= 2) {
        hasRecurring = true;
        recurringMisconceptionKey = key;
        break;
      }
    }
    const hasSingle = matchingMisconceptions.length > 0 && !hasRecurring;

    // Prerequisite Status
    const normConcept = normalizeConceptString(candidate.concept_name);
    const dagNode = dagNodeMap.get(normConcept);
    let prereqStatus: 'MET' | 'UNMET' | 'NONE' = 'NONE';
    if (dagNode) {
      if (dagNode.status === 'locked') {
        prereqStatus = 'UNMET';
      } else if (dagNode.prerequisites.length > 0) {
        prereqStatus = 'MET';
      }
    }

    // Determine Category
    const { category, reasonCodes } = determineRecommendationCategory({
      attempts,
      latentMastery,
      currentRecall: retention.current_recall_probability,
      confidence,
      retentionNeedsReview: retention.needs_review,
      elapsedDays: retention.elapsed_days,
      recentIncorrectCount: recentTopicMistakes,
      hasRecurringMisconception: hasRecurring,
    });

    // Calculate Deterministic Priority Score
    const { score, band } = calculatePriorityScore({
      attempts,
      latentMastery,
      currentRecall: retention.current_recall_probability,
      confidence,
      recentIncorrectCount: recentTopicMistakes,
      hasRecurringMisconception: hasRecurring,
      hasSingleMisconception: hasSingle,
      prerequisiteStatus: prereqStatus,
    });

    // Content Selection: Search user resources strictly scoped
    let recommendedResource: RecommendedResource | null = null;
    const matchRes = resourceRows.find((r) => {
      const tNorm = (r.folder || r.title || '').toLowerCase();
      return (
        tNorm.includes(candidate.topic.toLowerCase()) ||
        (candidate.subtopic && tNorm.includes(candidate.subtopic.toLowerCase()))
      );
    });

    if (matchRes) {
      recommendedResource = {
        id: matchRes.id,
        title: matchRes.title,
        type: matchRes.type,
        folder: matchRes.folder || null,
        storage_path: matchRes.storagePath || null,
      };
    }

    // Content Selection: Search user assessment questions strictly scoped
    let recommendedQuestion: RecommendedQuestion | null = null;
    const matchQ = questionRows.find((q) => {
      const qTopic = (q.topic || '').toLowerCase();
      const qSub = (q.subtopic || '').toLowerCase();
      return (
        qTopic.includes(candidate.topic.toLowerCase()) ||
        (candidate.subtopic && qSub.includes(candidate.subtopic.toLowerCase()))
      );
    });

    if (matchQ) {
      recommendedQuestion = {
        id: matchQ.id,
        question_text: matchQ.question,
        type: matchQ.type,
        difficulty: matchQ.difficulty,
        topic: matchQ.topic,
        subtopic: matchQ.subtopic || null,
        source_id: matchQ.sourceId || null,
      };
    }

    // Explanation
    const explanation = generateRecommendationExplanation({
      category,
      conceptName: candidate.concept_name,
      latentMastery,
      currentRecall: retention.current_recall_probability,
      evidenceCount: attempts,
      recentIncorrectCount: recentTopicMistakes,
      elapsedDays: retention.elapsed_days > 0 ? retention.elapsed_days : null,
      recurringMisconception: recurringMisconceptionKey,
    });

    const recHash = crypto
      .createHash('sha256')
      .update(`${userId}::${candidate.concept_id}::${category}`)
      .digest('hex')
      .substring(0, 12);

    evaluatedRecommendations.push({
      recommendation_id: `rec_${recHash}`,
      user_id: userId,
      category,
      priority_band: band,
      priority_score: score,
      concept_id: candidate.concept_id,
      concept_name: candidate.concept_name,
      topic: candidate.topic,
      subtopic: candidate.subtopic,
      explanation,
      reason_codes: reasonCodes,
      evidence_summary: {
        latent_mastery: latentMastery,
        current_recall_probability: retention.current_recall_probability,
        confidence,
        evidence_count: attempts,
        recent_incorrect_count: recentTopicMistakes,
        days_since_last_review: retention.elapsed_days > 0 ? retention.elapsed_days : null,
        recurring_misconception: recurringMisconceptionKey,
        prerequisite_status: prereqStatus,
      },
      recommended_resource: recommendedResource,
      recommended_question: recommendedQuestion,
      generated_at: now.toISOString(),
    });
  }

  // 10. Deterministic Multi-Level Tie-Breaking Sort
  evaluatedRecommendations.sort((a, b) => {
    // Primary: Score descending
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    // Secondary: Category precedence
    const precA = CATEGORY_PRECEDENCE[a.category] || 99;
    const precB = CATEGORY_PRECEDENCE[b.category] || 99;
    if (precA !== precB) {
      return precA - precB;
    }
    // Tertiary: Latent mastery ascending (prioritize lower competence)
    if (a.evidence_summary.latent_mastery !== b.evidence_summary.latent_mastery) {
      return a.evidence_summary.latent_mastery - b.evidence_summary.latent_mastery;
    }
    // Quaternary: Current recall ascending
    if (a.evidence_summary.current_recall_probability !== b.evidence_summary.current_recall_probability) {
      return a.evidence_summary.current_recall_probability - b.evidence_summary.current_recall_probability;
    }
    // Quinary: Lexicographical by concept_id
    return a.concept_id.localeCompare(b.concept_id);
  });

  const sliced = evaluatedRecommendations.slice(0, limit);

  return {
    success: true,
    recommendations: sliced,
    is_cold_start: isColdStart,
    generated_at: now.toISOString(),
    total_concepts_evaluated: allCandidates.length,
  };
}
