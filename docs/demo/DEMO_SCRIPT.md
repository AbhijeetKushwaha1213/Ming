# Ming — Demo Script & Video Recording Plan

**Target Video Duration:** 4 minutes 30 seconds (270 seconds)  
**Topic Domain:** Computer Systems & Distributed Systems (MIT 6.824 / Raft Consensus)  
**Persona:** Alex Rivera, University Engineering Student preparing for exams  
**Platform Version:** Ming v1.0.0 (Phase 9 Release `d3aca73`)

---

## 1. Demo Execution Checklist & Setup Prerequisites

Before beginning recording or presenting live:

| Requirement | Target State | Verification Command / Check |
| :--- | :--- | :--- |
| **Backend Server** | Running on port 3001 | `curl -f http://localhost:3001/api/health` |
| **Frontend Dev Client** | Running on port 5173 | Browser navigated to `http://localhost:5173` |
| **Seed Test User** | Authenticated as Demo User | Clean demo profile: `demo@ming.internal` (Workspace: `Personal Workspace`) |
| **Seed Documents** | Pre-staged note | `raft_consensus_notes.md` (Distributed Consensus, Raft Leader Election, Heartbeats) | **Database** | LibSQL / PostgreSQL | All migrations applied; zero corrupted session states |
| **Configured AI Model** | Google Gemini 2.5 Flash | `gemini-2.5-flash` (fallback: `gemini-flash-latest`) |
| **Display Resolution** | 1920×1080 (16:9), 60 FPS | Browser zoom set to 100%, Dark Theme enabled |
| **Audio Setup** | Directional USB microphone | Gain calibrated; zero ambient background hum |

---

## 2. Timed Scene Breakdown & Demonstration Steps

Target Duration: **4 minutes 30 seconds (270 seconds)**

```
[00:00 - 00:30] Scene 1: The Problem & Opening Hook (30s)
[00:30 - 01:10] Scene 2: Multimodal Ingestion & Document Processing (40s)
[01:10 - 01:55] Scene 3: Grounded Retrieval & Source Citation (45s)
[01:55 - 02:40] Scene 4: Adaptive Practice & Diagnostic Feedback (45s)
[02:40 - 03:25] Scene 5: Bayesian Knowledge Tracing & AI Study Agent (45s)
[03:25 - 04:00] Scene 6: Session Retention & Persisted Analytics (35s)
[04:00 - 04:30] Scene 7: Architectural Integrity & Hackathon Closing (30s)
Total: 30s + 40s + 45s + 45s + 45s + 35s + 30s = 270s (4m 30s)
```

---

### Scene 1: The Problem & Opening Hook (0:00 – 0:30)

- **Duration:** 30 seconds
- **Starting Screen:** Ming Landing Page / Dashboard with clear dark-mode aesthetics.
- **Computation Type:** **Live Application Rendering** (React 18 SPA, client-side dashboard state).
- **Visual Action:**
  - Mouse hovers over the dashboard navigation bar.
  - Camera zooms slightly into the headline: "Transform dense coursework into verifiable mastery."
- **Voiceover Script:**
  > *"Every student today faces the same dilemma: exams are approaching, lecture slides and papers are piling up, and generic AI chatbots produce confident, hallucinated answers with zero source accountability. Meanwhile, standard flashcard apps don't understand how your brain learns.*  
  > *Meet **Ming**: the multimodal, grounded adaptive learning platform designed to take you from raw syllabus documents to mathematically verified mastery without ever losing your source of truth."*
- **Observable Result:**
  - Clean UI loads instantly with zero layout shifts; metrics dashboard displays active course modules.
- **Fail-safe / Recovery:**
  - If frontend fails to load, refresh browser cache (`Cmd + Shift + R`). If port 5173 is occupied, verify Vite status in terminal.

---

### Scene 2: Multimodal Ingestion & Document Processing (0:30 – 1:10)

- **Duration:** 40 seconds
- **Starting Screen:** Documents / Ingestion view (`/documents` or Knowledge Base tab).
- **Computation Type:** **Live Application Compute** (Text extraction, 600-token semantic chunking, and local `all-MiniLM-L6-v2` 384-d vector embeddings).
- **Visual Action:**
  1. Click **"Upload Study Material"** or select the pre-loaded file: `raft_consensus_notes.md`.
  2. Drag and drop the lecture note or click **"Ingest Document"**.
  3. Processing indicator illuminates: Document text extracted, chunked via semantic chunking (600 tokens with 120-token overlap), and embedded via `all-MiniLM-L6-v2`.
  4. Document card appears in status list marked with a green badge: **"Indexed — 14 Chunks"**.
- **Voiceover Script:**
  > *"It starts with your actual course materials. Here, we ingest a 14-page lecture document on the Raft Distributed Consensus algorithm. Instead of blindly sending the raw text into a context window, Ming's ingestion pipeline extracts the text, runs semantic paragraph-aware chunking, generates local embeddings, and stores them in our high-performance vector index.*  
  > *Within two seconds, our material is indexed, structured, and ready for grounded retrieval."*
- **Observable Result:**
  - Document status updates to `Processed` with chunk count (14 chunks) and topic tags: `#DistributedSystems #Raft #LeaderElection`.
- **Fail-safe / Recovery:**
  - *Slow embedding service fallback:* Pre-ingested demo document is already cached in database. If upload times out (>5s), click directly on the pre-processed "Raft Consensus Lecture" document already listed in the table. (Seeded demonstration data).

---

### Scene 3: Grounded Retrieval & Source Citation (1:10 – 1:55)

- **Duration:** 45 seconds
- **Starting Screen:** Ming Study Assistant / Grounded Q&A Interface.
- **Computation Type:** **Live Application & Model Inference** (PostgreSQL/Chroma vector retrieval + Google Gemini `gemini-2.5-flash` model generation with citation grounding).
- **Visual Action:**
  1. In the prompt input box, enter:
     `"How does Raft prevent split-brain during a leader election, and what role do randomized election timeouts play?"`
  2. Hit **Enter / Submit**.
  3. Response streams in real-time.
  4. The response cites specific paragraphs with clickable badge: `[Source: raft_consensus_notes.md § 3.2]`.
  5. Click the citation badge; a side inspection drawer opens, highlighting the exact chunk from the uploaded lecture note.
- **Voiceover Script:**
  > *"Now, let's ask a nuanced technical question: How does Raft avoid split-brain elections, and what role do randomized timeouts play?*  
  > *Notice the response: Ming doesn't give a vague summary. It specifically explains the majority quorum mechanism (N/2 + 1) and randomized timeouts between 150 and 300 milliseconds. More importantly, every claim is accompanied by an interactive citation badge.*  
  > *Clicking the badge opens the exact source paragraph from our notes. In our rigorous evaluation benchmarks across 147 test scenarios, Ming achieved a 96% Faithfulness rate and 100% Out-Of-Domain refusal across all 6 off-curriculum test queries."*
- **Observable Result:**
  - Grounded answer displayed with markdown headings and inline citation pills. Side panel highlights exact matching text chunk.
- **Fail-safe / Recovery:**
  - If LLM API provider experiences network latency >3s, rely on client cached response for this exact demo prompt stored in test runner state. (Clearly disclose as cached fallback if triggered).

---

### Scene 4: Adaptive Practice & Diagnostic Feedback (1:55 – 2:40)

- **Duration:** 45 seconds
- **Starting Screen:** Practice Hub / Flashcards (`/flashcards/review` or Assessment view).
- **Computation Type:** **Live Application Compute** (SuperMemo SM-2 interval scheduling, numerical tolerance verification, rubric grading).
- **Visual Action:**
  1. Click **"Start Practice Session"** generated from the active Raft module.
  2. Card 1 appears:
     - Front: *"Under what conditions does a Candidate node in Raft step down back into the Follower state?"*
  3. Click **"Show Answer"** to reveal back of card with rubric criteria:
     - Back: *"1. If it receives an AppendEntries RPC from a legitimate Leader with Term >= Candidate's Term. 2. If it discovers a higher Term in any RPC response."*
  4. Click confidence evaluation rating: **"Good"** (Score 4/5).
  5. Next Question appears as a conceptual multiple choice quiz:
     - Prompt: *"If a cluster has 5 nodes, what is the minimum quorum required to commit an entry?"*
     - Click option: **"3 nodes (floor(5/2) + 1)"**.
  6. Instant diagnostic feedback reveals green confirmation with explanation badge.
- **Voiceover Script:**
  > *"Grounded reading is only half the battle; retention requires deliberate retrieval practice. Ming automatically generates diagnostic assessments directly from your verified notes.*  
  > *When we review this flashcard on candidate step-down conditions, we don't just guess—Ming provides clear rubric scoring criteria. When we answer correctly, our response isn't just stored as a simple tick mark: it is fed directly into our cognitive engine."*
- **Observable Result:**
  - Smooth card flip transition; confidence rating buttons trigger immediate score animation; next card slides in smoothly.
- **Fail-safe / Recovery:**
  - If card animations stutter, disable transitions in CSS or use keyboard shortcuts `Space` (flip) and `3` (Good).

---

### Scene 5: Bayesian Knowledge Tracing & AI Study Agent (2:40 – 3:25)

- **Duration:** 45 seconds
- **Starting Screen:** Mastery Radar & AI Study Agent Dashboard (`/agent` or `/dashboard`).
- **Computation Type:** **Live Application Compute** (Bayesian Knowledge Tracing with $L_0=0.15, T=0.10, G=0.20, S=0.10$; Study Agent 5-factor priority calculation).
- **Visual Action:**
  1. Navigate to the **Mastery Analytics** tab.
  2. The Knowledge Component radar graph shows:
     - `Raft Leader Election`: **88%** (Mastered)
     - `Log Replication Quorum`: **42%** (Needs Reinforcement)
     - `Safety & Joint Consensus`: **15%** (Novice)
  3. AI Study Agent card pulses with an action recommendation:
     - *"Recommendation: You have mastered Leader Election, but your mastery probability for Log Replication Quorum is low ($P(L_t) = 0.42$). Let's complete a 3-question targeted drill on Log Matching."*
  4. Click **"Accept Recommendation"**; agent immediately launches the targeted practice drill.
- **Voiceover Script:**
  > *"Under the hood, Ming implements standard Bayesian Knowledge Tracing (BKT) with slip and guess parameter modeling. Rather than generic flashcard repetition, Ming calculates your exact latent mastery probability, $P(L_t)$, for every atomic skill.*  
  > *Notice our radar chart: Leader Election is at 88% mastery, but Log Replication Quorum is flagged at 42%. Ming's autonomous Study Agent analyzes this state and proactively generates an intervention: a targeted 3-question drill focusing specifically on our weak spots."*
- **Observable Result:**
  - Interactive mastery bar/radar chart reflects updated probability calculation; Study Agent recommendation card displays actionable primary button.
- **Fail-safe / Recovery:**
  - If BKT state calculation does not refresh instantaneously, trigger recalculation button or reload analytics tab.

---

### Scene 6: Session Retention & Persisted Analytics (3:25 – 4:00)

- **Duration:** 35 seconds
- **Starting Screen:** Session Summary & Profile Analytics (`/analytics` or Profile View).
- **Computation Type:** **Live Application Compute & Persisted Telemetry** (Computed review count: 12/12, session accuracy: 92%, persisted SQLite/PostgreSQL activity log, and live offline queue sync). Prior streak days (Day 4) represent seeded demonstration account baseline.
- **Visual Action:**
  1. Click **"Complete Study Session"**.
  2. Session completion modal displays genuine application metrics:
     - Cards Reviewed: **12 / 12**
     - Session Accuracy: **92% (11/12 correct)**
     - Activity Logged: **Session persisted & streak incremented to Day 5**
  3. Toggle browser DevTools Network tab briefly to demonstrate offline resilience: offline event sync queue successfully flushes queued analytics events to the server.
- **Voiceover Script:**
  > *"When the session finishes, Ming persists the study session and analytics events to our secure database with tenant isolation and row-level security. Even if a student loses connectivity mid-study, our client-side offline queue holds the telemetry and automatically synchronizes when reconnected.*  
  > *Your session statistics, mastery trajectories, and spaced-repetition schedules are permanently preserved and visualized on your learning dashboard."*
- **Observable Result:**
  - Completion modal displays exact session stats (12 cards, 92% accuracy); streak counter increments; offline queue status badge indicates synchronized state.
- **Fail-safe / Recovery:**
  - Modal can be dismissed with `Esc` or the close icon if needed; session data is backed by local IndexedDB/localStorage fallback.

---

### Scene 7: Architectural Integrity & Hackathon Closing (4:00 – 4:30)

- **Duration:** 30 seconds
- **Starting Screen:** Architecture slide / Evaluation summary dashboard (`/evaluation` or Pitch Deck slide 5).
- **Computation Type:** **Static Architecture & Verified Benchmark Review** (Live test run artifacts).
- **Visual Action:**
  1. Screen switches to Architecture / Evaluation Overview showing:
     - 60 Vitest Suites / 985 Automated Tests Passing
     - Multi-Tier Architecture Diagram (React 18 SPA + Node.js API Gateway + PostgreSQL/LibSQL Vector Store)
     - Clean Benchmark Metrics: 96% Faithfulness, 100% OOD Refusal on tested cases, BKT Brier Score 0.277.
  2. Final slide displays Ming logo, GitHub repository link, and team credits.
- **Voiceover Script:**
  > *"Ming is not a superficial AI wrapper. It is an end-to-end, enterprise-grade learning system backed by 985 passing unit and integration tests, strict tenant isolation, and scientifically calibrated cognitive models.*  
  > *Grounded AI. Mathematical mastery tracking. Verifiable source citations. This is the future of intelligent education.*  
  > *Thank you, and welcome to Ming."*
- **Observable Result:**
  - Crisp, professional closing slide with project links and documentation QR/URL.

---

## 3. Production & Recording Guidelines

### Recording Specifications
- **Format:** MP4 (H.264, 60fps, 1080p, 16:9).
- **Audio Bitrate:** 320 kbps AAC, stereo.
- **Screen Resolution:** 1920×1080 with browser navigation bar hidden (F11 Fullscreen) or zoomed cleanly to emphasize relevant cards.
- **Cursor Settings:** High-visibility pointer with subtle click ripple animation enabled.

### Fail-Safe Contingency Matrix

| Failure Mode | Root Cause | Immediate Backup Action |
| :--- | :--- | :--- |
| **LLM Rate Limit (429)** | Exceeded provider quota during Q&A | Switch `.env` fallback to local mock engine (`VITE_USE_MOCK_AI=true`) which returns deterministic Raft Q&A responses. |
| **Ingestion Stalling** | Document PDF parsing error | Use the pre-converted `.md` file or click the pre-indexed sample document in the workspace table. |
| **Database Disconnection** | Local SQLite lock or remote timeout | Server automatically falls back to in-memory store for session continuity without UI crash. |
| **Network Interruption** | Wi-Fi drop during live demo | Demonstrate client-side offline queueing in Action! Show that practice cards still work offline and sync on reconnect. |

---

## 4. Post-Production Editing Notes
- **Jump Cuts:** Trim out any typing delays longer than 1.5 seconds.
- **Callout Annotations:** Add subtle animated boxes highlighting the inline citation pill in Scene 3 and the BKT radar chart in Scene 5.
- **Subtitles:** Add burned-in or CC captions for all voiceover lines for accessibility and silent video review.
