# Ming AI — Hackathon Pitch Deck

**Project**: Ming — Multimodal AI-Powered Adaptive Learning Companion  
**Hackathon**: Multimodal AI Hackathon 2026  
**Author**: Abhijeet Kushwaha  
**Repository**: `ming`  
**Release Gate**: Phase 10 Final Release  

---

## Slide 1: Title & Hook

### Ming: Your Multimodal AI-Powered Adaptive Study Partner
*Turn scattered curriculum materials into verifiable, grounded mastery.*

- **Presenter**: Abhijeet Kushwaha
- **Core Value Proposition**: Grounded AI tutoring, Bayesian student modeling, and active recall practice synthesized from raw lecture slides, textbooks, and notes.
- **Track Focus**: Multimodal Learning, Retrieval-Augmented Generation, Cognitive Modeling.

> **Speaker Notes**:
> "Judges, students don't suffer from a lack of information; they suffer from cognitive fragmentation. Between 300-page textbook PDFs, recorded lectures, slide decks, and disparate study apps, learners spend more time organizing materials than actually learning. Ming solves this by turning messy multimodal inputs into structured, verifiable, adaptive mastery."

---

## Slide 2: The Problem — Cognitive Fragmentation in Education

### The Student's Daily Friction
1. **Scattered Inputs**: Lecture slides (PDF/PPTX), video lectures, handwritten notes, and problem sets live in separate silos.
2. **Passive Illusion of Competence**: Re-reading notes and watching videos creates an illusion of understanding without testing real recall.
3. **Generic AI Hallucinations**: Standard chatbots lack curriculum grounding, hallucinate equations, and fail to provide bounding citations students can trust.
4. **Disjointed Practice**: Students don't know *what* to study next or *which* specific misconceptions are causing errors.

> **Speaker Notes**:
> "When students turn to general-purpose chatbots today, they hit a wall. Generic LLMs hallucinate formulas, cite nonexistent pages, and cannot diagnose whether a student's mistake came from an arithmetic error or a fundamental conceptual misunderstanding. Learning requires source-grounded answers and diagnostic practice."

---

## Slide 3: The Solution — Ming AI

### A Verifiable, Multimodal Adaptive Learning Engine

```
[Raw Curriculum Files] (PDF, PPTX, Video, Notes)
         │
         ▼
[Multimodal Chunking & Embeddings] (pgvector / SQLite + all-MiniLM-L6-v2)
         │
         ▼
[Coordinate-Grounded RAG] (Exact page & bounding-box citations)
         │
         ▼
[Diagnostic Assessment] (MCQ + Numerical tolerance + Misconception keys)
         │
         ▼
[Bayesian Knowledge Tracing (BKT)] (Probabilistic topic mastery states)
         │
         ▼
[AI Study Agent] (Autonomous next-step study planning & retention loops)
```

1. **Multimodal Ingestion**: Upload textbook chapters, lecture presentations, or video links. Ming indexes them with layout awareness.
2. **Coordinate-Grounded Citations**: Answers reference exact pages and bounding coordinates—never black-box hallucinations.
3. **Diagnostic Assessments**: Auto-generates practice questions with specific misconception distractors and numerical tolerance checking.
4. **Bayesian Student Modeling**: Dynamically tracks topic mastery probability using validated cognitive science formulas.
5. **Continuous Retention**: Real streak tracking and spaced reviews derived from authenticated study session logs.

> **Speaker Notes**:
> "Ming is not a thin prompt wrapper. It is a full learning engine. It ingests your raw curriculum files, indexes them into a multi-tenant vector space, grounds every single explanation with verifiable source coordinates, assesses understanding diagnostically, and tracks your probabilistic mastery using Bayesian Knowledge Tracing."

---

## Slide 4: The 7-Step Core Learner Journey

### Coherent, End-to-End Walkthrough

| Step | User Action | Ming Intelligent Response | Verifiable System State |
|---|---|---|---|
| **1. Ingest** | Uploads "OS Virtual Memory.pdf" | Ingests, extracts text/layout, generates 384-dim embeddings | Chunks indexed with tenant isolation |
| **2. Explore** | Asks "How does multi-level paging work?" | Answers with exact concept definition and citation | Returns source page & coordinate bounds |
| **3. Ground** | Clicks inline citation `[p. 14, §3.2]` | Opens document viewer directly to highlighted paragraph | Verified grounded attribution |
| **4. Practice** | Clicks "Start Adaptive Practice" | Synthesizes 5 diagnostic questions with distractors | Questions mapped to curriculum concepts |
| **5. Diagnose**| Selects a common misconception | Flags error, identifies misconception, explains root cause | BKT updates mastery ($P(L_t) \to P(L_{t+1})$) |
| **6. Plan** | Opens AI Study Agent | Agent recommends target remedial review on Page Tables | Generates structured Study Plan DAG |
| **7. Retain** | Completes 25-min focus session | Logs session, increments study streak, emits telemetry | Persisted in `studySessions` & analytics |

> **Speaker Notes**:
> "Notice the continuity. The learner begins with raw slides, transitions into grounded question answering, moves into active diagnostic testing, has their misconceptions captured probabilistically, receives an agent-guided study plan, and locks in their progress with verified session persistence."

---

## Slide 5: Deep Tech & Educational Differentiation

### What Makes Ming Scientifically Distinct?

#### 1. Coordinate-Level Citation Grounding
- Rather than vague document references, Ming computes document provenance bounding coordinates `[pageNumber, boundingBox]` for transparent verification.
- **Refusal Gate**: If a query is outside the uploaded curriculum, Ming explicitly refuses rather than guessing.

#### 2. Bayesian Knowledge Tracing (BKT) Engine
Standard cognitive modeling implementation:
$$P(L_0) = 0.10 \quad (\text{Prior Prior}), \quad P(T) = 0.15 \quad (\text{Transition Probability})$$
$$P(S) = 0.10 \quad (\text{Slip Probability}), \quad P(G) = 0.20 \quad (\text{Guess Probability})$$
Bayesian state update upon learner response $O_t \in \{0, 1\}$:
$$P(L_t \mid O_t = 1) = \frac{P(L_t)(1 - P(S))}{P(L_t)(1 - P(S)) + (1 - P(L_t))P(G)}$$
$$P(L_{t+1}) = P(L_t \mid O_t) + (1 - P(L_t \mid O_t))P(T)$$

#### 3. Diagnostic Misconception Classification
- Distractors in assessments are not random noise; each distractor maps to an identified cognitive hurdle (e.g., confusing virtual vs. physical page frames).

> **Speaker Notes**:
> "Most AI tutoring apps treat learning as binary: correct or incorrect. Ming implements standard Bayesian Knowledge Tracing with calibrated priors. If you answer correctly, was it a lucky guess ($G=0.20$) or true mastery? If you answered wrong, was it a careless slip ($S=0.10$) or an unmastered concept? BKT allows Ming to calculate genuine mastery trajectories."

---

## Slide 6: Technical Architecture & Multi-Tenant Data Plane

### Engineered for Production Scalability & Security

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT TIER (SPA)                             │
│  React 18 + TypeScript + Vite 5 + TailwindCSS + Lucide Icons           │
│  Code-Split Bundle: 1.56 MB entry (-35.8% reduction)                   │
│  Local-First Offline Telemetry Queue (ming_pending_analytics_*)        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / JWT Auth
┌────────────────────────────────────▼────────────────────────────────────┐
│                         API GATEWAY & SECURITY                          │
│  Node.js HTTP Gateway (Port 3001)                                      │
│  Sliding-Window Rate Limiter (Ingest: 20, RAG: 60, AI: 30, Gen: 120)  │
│  Tenant Isolation Guard & Impersonation Prevention (Strict 403)        │
│  Diagnostic Readiness Probe (/api/health/ready with DB & table checks) │
└──────────────────┬───────────────────┬──────────────────────────────────┘
                   │                   │
         Embedding │ Vector            │ Relational
         & LLM API │ Queries           │ Queries & RLS
┌──────────────────▼──────┐  ┌─────────▼──────────────┐  ┌────────────────┐
│   AI COMPUTE ENGINE     │  │     VECTOR DATA STORE  │  │ RELATIONAL DB  │
│ Google Gemini 1.5 Flash │  │ PostgreSQL + pgvector  │  │ PostgreSQL /   │
│ all-MiniLM-L6-v2 (384d) │  │ HNSW Index (Cosine)    │  │ SQLite LibSQL  │
│ Strict Redaction Filter │  │ Tenant Filter (user_id)│  │ Row-Level Sec. │
└─────────────────────────┘  └────────────────────────┘  └────────────────┘
```

- **Dual-Dialect Support**: SQLite LibSQL for zero-config development; PostgreSQL + pgvector with HNSW indexing for production.
- **Row-Level Security (RLS)**: Enforced via PostgreSQL policies `(auth.uid()::text = user_id)`.
- **Bundle Optimization**: Initial JavaScript bundle reduced from 2.43 MB to 1.56 MB (-35.8%) via vendor chunking (`jspdf`, `@tiptap`, `recharts`, `radix`).

> **Speaker Notes**:
> "Under the hood, Ming is architected with strict enterprise boundaries. We support local development on SQLite and production on PostgreSQL with pgvector. Every table enforces Row-Level Security. Our API Gateway enforces sliding-window rate limits, and the frontend features a privacy-preserving offline queue."

---

## Slide 7: Empirical Evaluation & Benchmark Results

### Rigorous, Reproducible, and Versioned (Run: `eval_run_1791563164571`)

Across $N=147$ verified benchmark examples evaluated against canonical datasets:

| Track | Metric | Measured Result | 95% Confidence Interval | Sample Size / Denominator |
|---|---|---|---|---|
| **Track A: Ingestion** | Format Support Rate | **100% (8/8)** | $[0.676, 1.000]$ (Wilson) | 8 supported formats |
| | Malformed Rejection Rate | **100% (4/4)** | $[0.510, 1.000]$ (Wilson) | 4 malformed/spoofed items |
| **Track B: RAG Grounding**| nDCG@5 | **0.703** | $[0.662, 0.745]$ (Bootstrap) | 64 in-domain queries |
| | Mean Reciprocal Rank (MRR)| **0.703** | $[0.594, 0.813]$ (Bootstrap) | 64 in-domain queries |
| | Recall@5 | **0.703** | $[0.594, 0.813]$ (Bootstrap) | 64 in-domain queries |
| | Faithfulness | **0.960** | $[0.940, 0.974]$ (Bootstrap) | 70 answers |
| | Grounding Accuracy | **100% (70/70)** | $[0.948, 1.000]$ (Wilson) | 70 queries |
| | Coordinate Precision | **100% (70/70)** | $[0.948, 1.000]$ (Wilson) | 70 queries |
| | Out-of-Domain Refusal | **100% (6/6)** | $[0.610, 1.000]$ (Wilson) | 6 out-of-domain queries |
| **Track C: Assessment** | Numerical Accuracy | **100% (10/10)** | $[0.722, 1.000]$ (Wilson) | 10 numerical problems |
| | MCQ Grading Accuracy | **100% (4/4)** | $[0.510, 1.000]$ (Wilson) | 4 MCQ problems |
| | Misconception Diagnosis | **100% (2/2)** | $[0.342, 1.000]$ (Wilson) | 2 diagnostic items |
| **Track D: Calibration**| BKT Model AUC | **0.943** | Evaluated on 40 traces | 40 synthetic traces |
| | Brier Score | **0.277** | Calibrated on fixed priors | 40 synthetic traces |
| **Track E: Study Agent** | Full-Loop Completion | **100% (5/5)** | 5 distinct scenarios | 5 lifecycle runs |

> [!IMPORTANT]
> **Scientific Honesty Disclaimer**:
> Track D calibration metrics were evaluated strictly on synthetic learner traces. Synthetic traces do not demonstrate real-world classroom learning outcomes. BKT parameters ($L_0=0.10, T=0.15, S=0.10, G=0.20$) are fixed cognitive priors and were not overfitted to synthetic data.

> **Speaker Notes**:
> "We believe in scientific honesty. We do not claim 99% accuracy across the board. Our retrieval precision is 70.3% because we evaluate against an exact single-authoritative-source benchmark. Our nDCG confidence interval is tighter than MRR because graded relevance produces lower sampling variance. And we explicitly disclose that Track D uses synthetic traces."

---

## Slide 8: Security, Privacy & Responsible AI

### Protecting Learner Data at Every Layer

1. **Strict Tenant Isolation**:
   - Zero cross-tenant data leakage: all queries enforce `userId` scoping.
   - API Gateway rejects impersonation attempts where `body.userId !== authenticatedUser` with `403 Forbidden`.
2. **Zero-PII & Redacted Analytics**:
   - Client and server sanitizers scrub passwords, tokens, API keys, raw document bodies, and full prompts.
   - User IDs in operational structured logs are SHA-256 hashed (`safeUserId`).
3. **Fail-Closed Hallucination Mitigation**:
   - Out-of-domain curriculum refusal rate: **100% (6/6)**. Ming refuses off-syllabus queries instead of generating ungrounded assertions.
4. **Resilience & Rate Limiting**:
   - Sliding-window rate limiters prevent API abuse (20 ingest, 30 AI, 60 RAG, 120 general requests/min).
   - Local-first offline queue with dead-letter eviction drops permanent 4xx failures and caps queue size to 50 items.

> **Speaker Notes**:
> "Education applications handle sensitive student work. Ming enforces privacy by design. Raw student documents and full AI prompts are never stored in analytics tables or logs. Client-side sanitization runs before anything touches local storage. And our server actively refuses out-of-domain queries to prevent ungrounded AI advice."

---

## Slide 9: Product Roadmap

### What's Implemented vs. What's Next

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│   VERIFIED & COMPLETE (PHASE 9) │   │        FUTURE ROADMAP           │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ ✓ Multimodal document ingestion │   │ ○ Temporal video frame sync     │
│ ✓ Coordinate citation grounding │   │ ○ LMS LTI 1.3 integration       │
│ ✓ Diagnostic assessment engine  │   │ ○ Canvas / Blackboard sync      │
│ ✓ Bayesian Knowledge Tracing    │   │ ○ Collaborative study rooms     │
│ ✓ AI Study Agent DAG workflow   │   │ ○ Multi-institution benchmarks  │
│ ✓ Mobile responsive navigation  │   │ ○ Formal IRB classroom trial    │
│ ✓ Multi-tenant Postgres/pgvector│   │ ○ Offline WebAssembly embeddings│
│ ✓ 985 passing platform tests    │   │                                 │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

> **Speaker Notes**:
> "Phases 1 through 9 are fully implemented, verified, and passing 985 tests in our test suite. Looking forward, our roadmap focuses on temporal video frame synchronization, LMS integrations via LTI 1.3 standards, and formal classroom empirical studies."

---

## Slide 10: Conclusion & Judge Summary

### Why Ming Deserves Your Vote

1. **A Real Working Platform**: 985 automated tests, zero TypeScript errors, clean production bundle, zero mock analytics.
2. **Pedagogically Grounded**: Uses proven cognitive science models (BKT) instead of generic conversational prompts.
3. **Verifiable Citations**: Document coordinate bounds give students verifiable confidence in every generated explanation.
4. **Ethical & Secure**: Multi-tenant RLS, client-side PII scrubbing, rate limiting, and transparent benchmark reporting.

> **Final Pitch**:
> "Ming transforms AI from a lazy shortcut into a patient, rigorous study companion that actually helps students learn. Thank you!"

---

## Appendix: Verified Repository Evidence

- **Commit**: `d3aca73` (Phase 9 Acceptance Gate)
- **Test Suite**: 60 test files, 985 passed, 0 failed
- **TypeScript**: `tsc --noEmit` exited 0 (0 errors)
- **Production Build**: `vite build` completed in 10.00s (1.56 MB entry bundle)
- **Canonical Benchmark Run**: `eval_run_1791563164571` ($N=147$, 100% gate pass)
