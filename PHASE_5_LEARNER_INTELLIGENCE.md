# Canonical Phase 5 — Learner Intelligence
## Step 1: Learner Evidence & Mastery Model Foundation

**Status:**
- **Phase 5 Step 1 — Learner Evidence & Mastery Model Foundation:** **COMPLETE**
- **Phase 5 Step 2+ (BKT Calibration, Forgetting/Retention Curves, Adaptive Recommendations):** **NOT STARTED**

---

## 1. Audit Findings

Before writing or altering any code, a comprehensive audit was executed across the repository to determine what learner-intelligence functionality already existed.

### Audit Questions (A – J)

| Question | Finding |
|---|---|
| **A. What learner state already exists?** | SQLite tables `learner_mastery` and `learner_events` defined in `server/prisma.ts`. Records `masteryProbability`, `confidence`, `attempts`, `correctCount`, `incorrectCount`, `status`, and event streams. |
| **B. What assessment evidence is currently persisted?** | Assessment sessions and attempts persisted in `assessment_sessions` and `assessment_attempts`. Evaluated answers stored in `evaluatedResults` and `learner_events`. |
| **C. Can an individual response be traced?** | Yes: learner ID, question ID, question type, topic/subtopic, assessment attempt, timestamp, score, correctness, misconception category, and source location (`source_id`, `chunk_id`, citation coordinate) can be linked. |
| **D. How is mastery currently calculated?** | Via Bayesian Knowledge Tracing formulas in `server/bktService.ts` (`calculateBKTUpdate`) adjusting posterior probability using slip ($pS$) and guess ($pG$) parameters based on difficulty. |
| **E. Is mastery persisted or computed dynamically?** | Persisted in `learner_mastery` table upon evidence ingestion, and auditable by replaying `learner_events`. |
| **F. Can current implementation distinguish valid vs. invalid submissions?** | In Phase 4 grading: Yes (`correct`, `partially_correct`, `incorrect`, `invalid_format`, `unverifiable`). However, prior to Phase 5 Step 1, invalid and unverifiable questions were passed into `updateMasteryFromEvidence` and penalized students. |
| **G. Are repeated attempts represented correctly?** | In Phase 4, attempt counts were incremented. However, there was no idempotency key preventing repeated submissions or network retries from double-counting the same question attempt. |
| **H. Can stale or duplicate events corrupt learner state?** | Prior to Phase 5 Step 1: Yes, duplicate API calls would re-apply BKT updates and artificially inflate trial count. Fixed with unique idempotency key. |
| **I. Are there tenant/user isolation concerns?** | `learnerHandler.ts` routes through `resolveContextUser`. Prior API allowed client body payloads to supply `userId` without strict rejection, though auth middleware was present. |
| **J. What parts of Phase 5 already existed?** | Core BKT mathematical formulas (`calculateBKTUpdate`), difficulty parameter mapping (`getDifficultyBKTParameters`), and confidence formula (`calculateConfidence`). |

### Audit Classification

| Component | Classification | Notes |
|---|---|---|
| Core BKT mathematical update formula | `EXISTS_AND_CORRECT` | Kept intact and reused directly from `server/bktService.ts`. |
| Asymptotic confidence scaling | `EXISTS_AND_CORRECT` | Kept intact from `server/bktService.ts`. |
| SQLite Schema (`learner_mastery`, `learner_events`) | `EXISTS_BUT_INCOMPLETE` | Required `idempotencyKey` column and unique index to prevent duplicate counting. |
| Assessment Intelligence pipeline integration | `EXISTS_BUT_UNSAFE` | Was updating mastery on `unverifiable` and `invalid_format` responses without discarding non-learning evidence. |
| Event Idempotency & Duplicate Protection | `MISSING` | Implemented via `idem_<userId>_<attemptId>_<questionId>`. |
| Concept Taxonomy Normalization | `MISSING` | Implemented via `computeCanonicalConceptId` to produce stable hashes across questions. |
| Mastery Audit & Replayability Engine | `MISSING` | Implemented via `getLearnerMasteryAudit` and `replayEvidenceMastery`. |
| Secure Audit API Endpoint | `MISSING` | Implemented via `GET /api/learner/mastery/audit`. |

---

## 2. Reused Functionality

1. **`calculateBKTUpdate(prior, isCorrect, params, credit)`**:
   Authoritative Bayesian Knowledge Tracing formula from `server/bktService.ts`. Correctly bounded in $[0.01, 0.99]$ with slip, guess, and transit transitions.
2. **`getDifficultyBKTParameters(difficulty)`**:
   Difficulty parameter mapping ('easy', 'medium', 'hard') setting appropriate priors, slip, and guess constants.
3. **`calculateConfidence(trials)`**:
   Asymptotic evidence-sufficiency formula $1 - e^{-0.14 \times \text{trials}}$.
4. **`gradeNumericalAnswer` & `gradeUniversalAnswer`**:
   Authoritative deterministic Phase 4 grading engines.

---

## 3. Gaps Discovered & Addressed

1. **Unverified Submission Penalties:** `processAssessmentIntelligence` now extracts canonical learner evidence and explicitly discards `invalid_format` and `unverifiable` evaluations, ensuring students are never penalized for unverified or ill-formatted items.
2. **Double-Counting Vulnerability:** Introduced deterministic idempotency keys (`idem_<userId>_<attemptId>_<questionId>`) on all learner evidence events. Re-submitting or retrying returns the existing state without mutating trial counts or posteriors.
3. **Concept Taxonomy Drift:** Introduced `computeCanonicalConceptId(topic, subtopic, conceptName)` ensuring questions testing the same concept collapse into identical canonical IDs (`c_<hash>`).
4. **Opaque Aggregates:** Implemented an end-to-end auditability engine that can replay historical events from initial prior $pL_0$ and prove mathematical reproducibility within $\epsilon \le 0.01$.

---

## 4. Canonical Learner Evidence Model

Located in `server/learnerTypes.ts` and `server/learnerEvidenceService.ts`:

```typescript
export interface CanonicalLearnerEvidence {
  evidence_id: string;              // Deterministic SHA-256 derived ID
  idempotency_key: string;          // idem_<userId>_<attemptId>_<questionId>
  user_id: string;                  // Server-authoritative learner ID
  tenant_id: string;                // Multi-tenant boundary
  attempt_id: string;               // Originating assessment attempt
  question_id: string;              // Authoritative question ID
  question_type: string;            // MCQ, NUMERICAL, SHORT_ANSWER, etc.
  topic: string;                    // Primary subject topic
  subtopic: string | null;          // Secondary subtopic
  concept_id: string;               // Canonical taxonomy ID (c_<hash>)
  concept_name: string;             // Human-readable concept title
  timestamp: string;                // ISO 8601 UTC timestamp
  classification: AnswerClassification; // correct, partially_correct, incorrect, invalid_format, unverifiable
  credit: number;                   // Bounded [0.0, 1.0]
  is_correct: boolean;              // Boolean correctness flag
  error_category: string | null;    // Misconception category from Phase 4
  difficulty: string;               // easy | medium | hard
  source_id?: string | null;        // Grounding source ID
  chunk_id?: string | null;         // Grounding chunk ID
  source_coordinate?: string | null;// Grounding citation coordinate
  validity: EvidenceValidity;       // VALID_EVIDENCE | DISCARDED_INVALID | DISCARDED_UNVERIFIABLE
}
```

---

## 5. Concept & Topic Identity

- **Normalization:** `normalizeConceptString()` converts text to lowercase, strips punctuation, and collapses consecutive whitespace.
- **Canonical Concept Key:** Combines `topic`, `subtopic`, and `concept_name` into a SHA-256 hash prefix (`c_<hash>`).
- **Multiple Questions Mapping:** Multiple questions generated across different sessions that test the same underlying concept deterministically map to the same `concept_id`, allowing cumulative evidence aggregation.

---

## 6. Deterministic Evidence Extraction & Ingestion

1. **Extraction:**
   `extractLearnerEvidence(evaluation, context)` translates Phase 4 evaluation output into `CanonicalLearnerEvidence`.
2. **Filtering:**
   - `classification === 'invalid_format'` $\to$ `validity = 'DISCARDED_INVALID'`
   - `classification === 'unverifiable'` $\to$ `validity = 'DISCARDED_UNVERIFIABLE'`
3. **Ingestion:**
   `recordLearnerEvidence(evidence)`:
   - If discarded: returns `{ applied: false, discarded: true }`. Mastery is **NOT** modified.
   - If duplicate idempotency key: returns `{ applied: false, duplicate: true }`. Mastery is **NOT** re-applied.
   - If valid: executes bounded BKT update, increments trial counts, updates `learner_mastery`, and appends to `learner_events`.

---

## 7. Initial Mastery Model & Update Semantics

- **Terminology:** `EVIDENCE_BASED_MASTERY` / `INITIAL_MASTERY_ESTIMATE` (Do NOT claim full BKT calibration until Phase 5 Step 2).
- **Bounds:** Strictly bounded within $[0.01, 0.99]$.
- **First Evidence:** Starts from difficulty prior $pL_0$ (0.15 for medium).
- **Correct Answer:** Increases mastery estimate via standard Bayesian update incorporating slip and transit probabilities.
- **Partial Credit:** Scaled proportionally between full correct and full incorrect (e.g. 0.5 credit updates with 0.5 observation weight).
- **Incorrect Answer:** Decreases mastery estimate gracefully without catastrophic collapse.
- **Determinism:** Identical sequence of evidence events always produces identical posterior mastery.

---

## 8. Confidence vs. Mastery Separation

Mastery ($pL$) and Confidence ($C$) are strictly independent dimensions:

$$\text{Confidence}(N) = 1 - e^{-0.14 \times N}$$

| Mastery Level | Evidence / Confidence | Semantic Meaning |
|---|---|---|
| High ($pL > 0.80$) | Low ($C < 0.40$) | Likely strong, but insufficient evidence (few trials). |
| High ($pL > 0.80$) | High ($C > 0.85$) | Mastered with high statistical confidence. |
| Low ($pL < 0.15$) | High ($C > 0.85$) | Consistently failing; proven struggle with high confidence. |
| Low ($pL < 0.15$) | Low ($C < 0.40$) | Early struggle; insufficient observations. |

---

## 9. Event Idempotency & Duplicate Protection

- Idempotency key format: `idem_${userId}_${attemptId}_${questionId}`
- Unique constraint: SQLite `learner_events_idempotency_idx` on `(userId, idempotencyKey)`
- Repeated submissions or retry requests detect the key, skip calculation, and return the current state without double-counting.

---

## 10. Zero-Trust Security & Multi-Tenant Isolation

1. **Client Identity:** Identity is strictly derived from server authentication session (`resolveContextUser`). Client cannot override `userId`.
2. **Mastery Overrides:** Client payloads cannot specify `masteryProbability`, `confidence`, or `credit`. The server computes updates exclusively from verified Phase 4 evaluations.
3. **Cross-Tenant Access:** Users cannot read or audit another user's mastery. `GET /api/learner/mastery/audit` queries strictly scoped by context user.

---

## 11. API Contract

### `GET /api/learner/mastery/audit`
- **Query Params:** `topic` (required), `subtopic` (optional)
- **Response:**
  ```json
  {
    "success": true,
    "audit": {
      "user_id": "usr_123",
      "topic": "Thermodynamics",
      "subtopic": "Carnot Engines",
      "mastery_estimate": 0.517,
      "confidence": 0.60,
      "evidence_count": 3,
      "reproducible": true,
      "replayed_posterior": 0.517,
      "events": [...]
    }
  }
  ```

### `POST /api/learner/update`
- Authenticated evidence ingestion endpoint with idempotency support and backward compatibility.

---

## 12. Test Coverage Summary

- **New Dedicated Test Suite:** `src/test/learnerEvidenceMastery.test.ts`
  - **43 tests** across 11 functional sections:
    1. Concept Taxonomy Normalization & Stability (5 tests)
    2. Deterministic Idempotency Key Generation (5 tests)
    3. Authoritative Evidence Extraction (5 tests)
    4. Discarded Evidence Filtering (2 tests)
    5. Initial Mastery Model & Update Semantics (8 tests)
    6. Confidence vs. Mastery Separation (4 tests)
    7. Event Idempotency & Duplicate Protection (3 tests)
    8. Mastery Auditability & Replayability (2 tests)
    9. Zero-Trust Security & Multi-Tenant Isolation (4 tests)
    10. Query & Audit API Contracts (3 tests)
    11. Integration with Phase 4 Grading Outputs (2 tests)
  - **Result:** 43 / 43 PASS.

- **Full Regression Baseline:**
  - `src/test/numericalAssessment.test.ts`: 78 / 78 PASS
  - `src/test/answerVerification.test.ts`: 40 / 40 PASS
  - `src/test/questionQualityValidation.test.ts`: 50 / 50 PASS
  - `src/test/groundingVerification.test.ts`: 30 / 30 PASS
  - `src/test/sourceNavigation.test.tsx`: 25 / 25 PASS
  - `src/test/productionSecurityAndIsolation.test.ts`: 23 / 23 PASS
  - `src/test/resourceStreaming.test.ts`: 22 / 22 PASS
  - `src/test/multimodalIngestion.test.ts`: 24 / 24 PASS
  - `src/test/productionSmokeIntegration.test.ts`: 17 / 17 PASS
  - `src/test/ragVectorStoreEquivalence.test.ts`: 8 / 8 PASS
  - `src/test/phase9AssessmentIntelligence.test.tsx`: 19 / 19 PASS
  - `src/test/learnerEvidenceMastery.test.ts`: 43 / 43 PASS
  - **Total Tests Passing:** **379 / 379 PASS**
- **TypeScript Check (`tsc --noEmit`):** 0 errors.
- **Production Build (`vite build`):** SUCCESS.

---

## 13. Known Limitations (Phase 5 Step 1 Scope Boundaries)

1. **BKT Calibration:** Standard literature priors ($pL_0=0.15, pT=0.10, pG=0.20, pS=0.10$) are used. Empirical student response calibration is reserved for Phase 5 Step 2+.
2. **Forgetting Curves:** Time-decay / retention curve modeling (Ebbinghaus decay) is not yet active.
3. **Adaptive Recommendations:** Dynamic selection of next practice topics is reserved for Phase 5 Step 2+ and Phase 6 (AI Study Agent).
4. **Autonomous Study Planning:** Automated goal-driven revision scheduling is reserved for Phase 6.
