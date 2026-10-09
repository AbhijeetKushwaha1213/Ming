# Ming — Deterministic Demo Setup & Pre-Flight Environment Guide

**Target Environment:** Local Demonstration & Staging Evaluation  
**Platform Version:** Ming v1.0.0 (Phase 9 Release `d3aca73`)  
**Security Notice:** Never insert production credentials, live payment keys, or real student PII into presentation environments or recordings.

---

## 1. Pre-Flight Verification Checklist

Execute this checklist in order before starting any live demonstration, video recording, or judging session:

| # | Step | Command / Inspection | Expected Outcome |
| :---: | :--- | :--- | :--- |
| **1** | **Node.js Runtime** | `node -v` | `>= v20.0.0` |
| **2** | **Dependencies** | `npm ls --depth=0` | All dependencies installed cleanly |
| **3** | **Type Safety** | `npx tsc --noEmit` | Clean exit (0 errors) |
| **4** | **Test Suite** | `npx vitest run` | 60 test suites passing (985 tests) |
| **5** | **Vite Bundle Build** | `npm run build` | Clean production build in `dist/` |
| **6** | **Backend Gateway** | `curl -f http://localhost:3001/api/health` | `{"status":"ok", ...}` |
| **7** | **Prometheus Metrics**| `curl -f http://localhost:3001/metrics` | HTTP 200 with Prometheus counters |
| **8** | **Frontend Client** | Open `http://localhost:5173` | Dark-mode dashboard loads instantly |

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Ensure the following deterministic configuration is set for the demo:

```env
# Server & Client Hosts
APP_ENV="development"
NODE_ENV="development"
API_PORT="3001"
API_HOST="127.0.0.1"
CORS_ORIGIN="http://localhost:5173"

# Relational Persistence (Local SQLite LibSQL)
DATABASE_URL="file:./prisma/dev.db"

# Vector Store Engine
# 'chroma' for local zero-dependency demo; 'pgvector' for cloud demo
VECTOR_STORE="chroma"
CHROMA_DATA_PATH="./chroma_data"

# AI Inference Provider (Google Gemini)
# Obtain a demo API key from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY="AIzaSyYourDemoKeyHere"
VITE_GEMINI_API_KEY="AIzaSyYourDemoKeyHere"

# Fallback Mock Mode (Set to 'true' if presenting in offline/air-gapped environments)
VITE_USE_MOCK_AI="false"

# Security Boundary
ALLOW_DEV_AUTH_BYPASS="false"
```

> [!CAUTION]
> Ensure `.env` is listed in `.gitignore`. Never push API keys or service role tokens to version control.

---

## 3. Database Schema & Migration Prerequisites

### A. Local Development (SQLite / LibSQL)
Ensure Prisma schema clients are compiled and local database is initialized:

```bash
# 1. Generate multi-schema Prisma client
npm run prisma:generate

# 2. Push schema to local dev database (non-destructive)
npx prisma db push --schema=prisma/schema.prisma
```

### B. Production PostgreSQL / Supabase (Optional Cloud Staging)
If presenting against a remote PostgreSQL database:

```bash
# Apply Phase 2 & Phase 9 migrations
psql "$DATABASE_URL" -f supabase/migrations/20261008000000_production_data_plane_postgres_and_pgvector.sql
psql "$DATABASE_URL" -f supabase/migrations/20261009000000_analytics_events_table_and_rls.sql
```

---

## 4. Test Accounts & Authentication Setup

For predictable, repeatable demo execution, Ming provides deterministic seeded demo profiles:

| Account Type | Email | Password | Role / Purpose |
| :--- | :--- | :--- | :--- |
| **Primary Learner** | `demo@ming.internal` | `DemoPass2026!` | Standard student profile with active courses and streak history |
| **Fresh Learner** | `new_student@ming.internal` | `DemoPass2026!` | Clean empty state for demonstrating first-time onboarding |
| **Isolated Peer** | `peer_tenant@ming.internal` | `DemoPass2026!` | Separate tenant for demonstrating zero-leakage RLS isolation |

> [!NOTE]
> Ming strictly derives the user ID from the cryptographically verified JWT session token. Manually injected client `userId` fields are rejected by the gateway.

---

## 5. Representative Demo Materials

All demo materials are vetted, permitted, and self-contained within the repository:

1. **Raft Distributed Consensus Lecture Notes:**
   - Location: `docs/demo/sample_materials/raft_consensus_notes.md`
   - Content: Distributed consensus, leader election quorums, split-brain prevention, and log matching invariants.
   - Grounding Ground-Truth: 14 semantic chunks with verifiable facts.

2. **Multimodal Technical Document Fixtures:**
   - Location: `test_fixtures/multimodal/`
   - Files: `text.pdf`, `mixed.pdf`, `table_math.pdf`, `diagram.pdf`, `chart.png`.
   - Permitted synthetic fixtures for testing PDF and tabular parsing.

---

## 6. Starting the Platform Services

Launch both the API gateway and the frontend development server concurrently:

```bash
# Launch both backend (Port 3001) and frontend (Port 5173)
npm run dev
```

Alternatively, run in separate terminal tabs if you wish to inspect individual process logs:

```bash
# Tab 1: Start API Gateway (Port 3001 with hot reload)
npm run dev:api

# Tab 2: Start Vite Dev Server (Port 5173)
npm run dev:vite
```

Verify service readiness:
- Frontend: Navigate to `http://localhost:5173`
- Backend API: `curl -I http://localhost:3001/api/health` (Expect `200 OK`)
- Interactive Pitch Deck: Navigate to `http://localhost:5173/pitch.html`

---

## 7. Deterministic Reset & Teardown Procedures

To reset the demo environment back to a clean baseline between presentations:

```bash
# 1. Clear local in-memory session queues and transient sqlite tables
rm -f prisma/dev.db*
npx prisma db push --schema=prisma/schema.prisma

# 2. Reset vector embeddings if re-testing ingestion from scratch
rm -rf chroma_data/
mkdir -p chroma_data

# 3. Clear browser state
# In Chrome: Open DevTools > Application > Clear site data (Local Storage, IndexedDB, Cookies)
```

---

## 8. Live Network Contingency & Fail-Safe Modes

If external network connectivity degrades during judging:

1. **Google Gemini LLM Rate Limits / Outages:**
   - In `.env`, set `VITE_USE_MOCK_AI="true"`.
   - Restart the server. Ming will use the local deterministic response simulator for Raft Q&A and diagnostic assessment generation without making external WAN requests.
   - **Evaluation Transparency**: Always disclose to judges if the mock simulator is active; do not present simulated/cached outputs as live model inferences.
2. **Slow Embedding Processing:**
   - The sample note `raft_consensus_notes.md` is pre-chunked in the demo seed. If vectorization takes longer than 3 seconds on constrained hardware, select the pre-indexed Raft card already present in the workspace (seeded demonstration data).
3. **Backup Visual Artifacts:**
   - Interactive Pitch Deck is self-contained and operates completely offline at `public/pitch.html`.
   - Pre-rendered slide deck is also available as markdown at `docs/pitch/PITCH_DECK.md`.
