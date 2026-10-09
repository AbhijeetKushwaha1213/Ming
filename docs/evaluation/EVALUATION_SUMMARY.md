# Ming — Evaluation Summary & Scientific Integrity Report

**Canonical Evaluation Run:** `eval_run_1791563164571`  
**Evaluation Harness Version:** Phase 8 Canonical Harness (`9d57e6d` / `f00b2d0`)  
**Total Evaluated Items:** **147 items** across 5 formal evaluation tracks  
**Gate Pass Rate:** **100.0%** (147 / 147 test conditions satisfied)

---

## 1. Operating Principles of Scientific Honesty

In accordance with strict academic and evaluation standards:
1. **Measured Reality vs. Claims:** We report strictly what is measured in reproducible artifacts. We do not conflate unit-test pass rates with model intelligence, nor software correctness with educational efficacy.
2. **Denominators and Confidence Intervals:** Every reported metric includes its explicit sample size ($N$), denominator, and 95% confidence interval (Wilson score for binomial proportions, non-parametric percentile bootstrap for continuous ranking metrics).
3. **Synthetic Evidence Disclaimers:** Cognitive modeling (Track D) is calibrated on synthetic student simulation traces. **Synthetic traces do not establish real-world classroom learning outcomes or pedagogical superiority.**
4. **Historical Comparability:** Historical Phase 7 metrics are classified as `NOT_COMPARABLE / UNVERIFIED` due to divergent denominators, unrecorded random seeds, and differing metric formulations.

---

## 2. Canonical Run Metadata

- **Run Identifier:** `eval_run_1791563164571`
- **Artifact Path:** `benchmarks/results/eval_run_1791563164571.json`
- **Execution Timestamp:** `2026-10-09T16:26:04.570Z`
- **Controlled PRNG Seed:** `1790950000`
- **Environment:** Node.js `v24.11.0`, darwin arm64
- **Runtime Duration:** 112.36 seconds
- **Dataset Fingerprint (RAG):** SHA-256 `1152512659dc5730587073089bb2dd5b3d12536de070aa01d90073659e5425ed`

---

## 3. Results by Evaluation Track

### Track A: Multimodal Ingestion Robustness ($N=12$)
Evaluates file header magic-byte verification, coordinate extraction, and rejection of adversarial/malformed payloads.

| Metric | Sample Size ($N$) | Measured Value | 95% Confidence Interval (Wilson) | Target Bound | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Processing Success Rate** | 8 | **100.0%** (8/8) | [67.6%, 100.0%] | $\ge 95.0\%$ | **PASSED** |
| **Text Extraction Accuracy** | 8 | **100.0%** (8/8) | [67.6%, 100.0%] | $\ge 90.0\%$ | **PASSED** |
| **Provenance Coordinate Accuracy** | 8 | **100.0%** (8/8) | [67.6%, 100.0%] | $\ge 95.0\%$ | **PASSED** |
| **Malformed Payload Rejection** | 3 | **100.0%** (3/3) | [43.8%, 100.0%] | $100.0\%$ | **PASSED** |
| **Oversized Payload Rejection** | 1 | **100.0%** (1/1) | [20.7%, 100.0%] | $100.0\%$ | **PASSED** |

---

### Track B: Information Retrieval & Source Grounding ($N=70$)
Evaluates hybrid dense/lexical search, citation precision, coordinate alignment, and hallucination refusal over 70 curriculum questions (64 in-domain, 6 out-of-domain).

| Metric | Sample Size ($N$) | Measured Value | 95% Confidence Interval | Method | Target Bound | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Mean Reciprocal Rank (MRR)** | 64 | **0.703** | **[0.594, 0.813]** | Bootstrap ($B=1000$) | $\ge 0.600$ | **PASSED** |
| **Recall@5** | 64 | **70.3%** | **[59.4%, 81.3%]** | Bootstrap ($B=1000$) | $\ge 60.0\%$ | **PASSED** |
| **nDCG@5** | 64 | **0.703** | **[0.662, 0.745]** | Bootstrap ($B=1000$) | $\ge 0.600$ | **PASSED** |
| **Context Recall (RAGAS)** | 64 | **82.5%** | **[74.5%, 86.4%]** | Bootstrap ($B=1000$) | $\ge 80.0\%$ | **PASSED** |
| **Faithfulness** | 64 | **96.0%** | **[94.0%, 97.4%]** | Bootstrap ($B=1000$) | $\ge 85.0\%$ | **PASSED** |
| **Answer Relevancy** | 64 | **85.1%** | - | Point estimate | $\ge 80.0\%$ | **PASSED** |
| **Grounding Accuracy** | 70 | **100.0%** | [94.8%, 100.0%] | Wilson Score | $\ge 90.0\%$ | **PASSED** |
| **Out-of-Domain Refusal** | **6** | **100.0%** (6/6) | **[61.0%, 100.0%]** | Wilson Score | $100.0\%$ | **PASSED** |
| **Tenant Leakage Count** | 70 | **0 Leaks** (0/70) | [0.0%, 5.1%] | Wilson Score | 0 Leaks | **PASSED** |

---

### Track C: Assessment Correctness & Verifier Precision ($N=20$)
Evaluates deterministic mathematical grading, tolerance windows, unit conversions, and prompt injection defense.

| Metric | Sample Size ($N$) | Measured Value | 95% Confidence Interval (Wilson) | Target Bound | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Numerical Answer Verification** | 10 | **100.0%** (10/10) | [72.2%, 100.0%] | $100.0\%$ | **PASSED** |
| **Tolerance Band Handling** | 10 | **100.0%** (10/10) | [72.2%, 100.0%] | $100.0\%$ | **PASSED** |
| **Unit Normalization & Conversion** | 10 | **100.0%** (10/10) | [72.2%, 100.0%] | $100.0\%$ | **PASSED** |
| **Multiple Choice Grading** | 4 | **100.0%** (4/4) | [51.0%, 100.0%] | $100.0\%$ | **PASSED** |
| **Malicious Prompt Quarantine** | 4 | **100.0%** (4/4) | [51.0%, 100.0%] | $100.0\%$ | **PASSED** |
| **Misconception Classification** | 2 | **100.0%** (2/2) | [34.2%, 100.0%] | $100.0\%$ | **PASSED** |

---

### Track D: Learner-State Calibration ($N=40$ Synthetic Traces)
Evaluates Bayesian Knowledge Tracing (BKT) probabilistic prediction error across 40 chronological interaction steps.

> [!WARNING]
> **SYNTHETIC DATA RESTRICTION:**
> Evaluated strictly against synthetic student simulation traces generated by archetypal Markov scripts. These metrics reflect algorithmic consistency and convergence, **not human classroom outcomes**.

| Metric | Sample Size ($N$) | Measured Value | Target Bound | Metric Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **Brier Score** | 40 | **0.277** | $\le 0.300$ | Mean squared probabilistic prediction error. Lower is better. |
| **Log Loss (Cross-Entropy)** | 40 | **0.799** | $\le 0.850$ | Penalizes confident incorrect predictions ($\epsilon = 10^{-15}$). |
| **Expected Calibration Error (ECE)** | 40 | **0.316** | $\le 0.400$ | Calibration disparity across 10 equal-width bins. |
| **Recommendation Determinism** | 40 | **100.0%** | $100.0\%$ | Identical learner states yield identical next actions. |
| **Cold-Start Prior Preservation** | 40 | **PASSED** | $P(L_0) = 0.15$ | Unattempted skills remain at $0.15$ baseline prior. |
| **Directional Monotonicity** | 40 | **PASSED** | $\Delta > 0$ on success | Correct answers increase mastery; incorrect answers decrease mastery. |

---

### Track E: Autonomous Study Agent Lifecycle ($N=5$)
Evaluates the 6-stage autonomous agent execution loop across 5 operational scenarios.

| Scenario | Objective | Execution Outcome | Status |
| :--- | :--- | :--- | :---: |
| **Scenario 1** | Exam Urgency Prioritization | High-urgency pending module selected first | **PASSED** |
| **Scenario 2** | High Mastery Retention | Spaced review schedule triggered for decayed topics | **PASSED** |
| **Scenario 3** | Low Mastery Remediation | Remedial guided practice drill generated ($P(L) < 0.5$) | **PASSED** |
| **Scenario 4** | Retry Idempotency Verification | Duplicate student submissions safely deduplicated | **PASSED** |
| **Scenario 5** | Tenant Isolation Preservation | Cross-tenant learner states completely quarantined | **PASSED** |

---

## 4. Methodological Findings & Statistical Disclosures

### Why MRR Equals Recall@5 in This Benchmark
In the canonical run, MRR and Recall@5 are both reported as **0.703** ($70.3\%$). This identity is an empirical property of the test corpus structure:
- Across the 64 in-domain curriculum queries, each query targeted a single authoritative source ($totalExpected = 1$).
- In this index, the retriever either matched the expected source at rank 1 (45 queries: $\text{RR} = 1.0$, $\text{Recall} = 1.0$) or missed it completely from top-5 (19 queries: $\text{RR} = 0.0$, $\text{Recall} = 0.0$).
- $45 / 64 = 0.703125 \approx \mathbf{0.703}$.
- The underlying mathematical implementations are completely distinct and diverge under multi-source retrieval.

### Why nDCG@5 Has a Narrower Confidence Interval Than MRR
Although nDCG@5 shares the same point estimate ($0.703$) as MRR, their 95% bootstrap confidence intervals differ significantly:
- **MRR 95% CI:** $[0.594, 0.813]$ (width = $0.219$)
- **nDCG@5 95% CI:** $[0.662, 0.745]$ (width = $0.083$, $\mathbf{2.62\times}$ narrower)

**Mathematical Rationale:**
- MRR is evaluated over an extreme bimodal distribution containing only binary outcomes $\{0.0, 1.0\}$, yielding high sample variance ($s^2 = 0.21205$).
- nDCG@5 evaluates graded relevance judgments ($2, 1, 0$) across continuous rank positions, producing continuous query scores tightly clustered around the mean ($s^2 = 0.03104$, $6.83\times$ lower variance).
- Lower sampling variance mathematically results in a substantially tighter confidence band under standard bootstrap resampling ($B=1000$).

### Out-of-Domain Refusal Denominator ($n=6$)
The canonical dataset `rag_eval_dataset.json` contains exactly 6 off-material questions (Quantum Computing, Culinary Arts, Marine Biology, Sports Science, Macroeconomics, and Automotive Engineering). All 6 were evaluated; all 6 were successfully refused by the cosine similarity threshold gate ($100.0\%$, Wilson 95% CI: $[61.0\%, 100.0\%]$).
Early drafts containing references to "$n=10$" were unverified historical placeholders and have been corrected across all documentation and test assertions.

### Bayesian Knowledge Tracing (BKT) Parameter Reconciliation
- **Runtime Defaults in Production Code:** Both `server/bktService.ts` and `src/utils/bkt.ts` implement $P(L_0) = 0.15, P(T) = 0.10, P(G) = 0.20, P(S) = 0.10$, established in Phase 4 (`cb671c6`).
- **Canonical Evaluation Verification (`eval_run_1791563164571`):** In `server/evaluationEngine.ts` (lines 1426, 1810, 1917), the evaluation test harness verified directional evidence monotonicity and idempotent state updates using `{ pL0: 0.15, pT: 0.10, pG: 0.20, pS: 0.10 }`.
- **Synthetic Trace Calibration (Track D):** Track D calibration metrics (Brier Score: 0.277, Log Loss: 0.799, ECE: 0.316) were computed over 40 synthetic student transitions (`benchmarks/data/learner_traces_eval_dataset.json`) where initial trace priors range from $0.15$ to $0.50$ (median 0.20).
- **Historical Text Discrepancy:** Earlier Phase 8 markdown drafts contained references to $L_0 = 0.10, T = 0.15, G = 0.20, S = 0.10$. This discrepancy arose because illustrative introductory writeups cited textbook literature values (Corbett & Anderson baseline) rather than the active production constants. All documentation has been reconciled to distinguish historical literature citations from active runtime defaults while preserving canonical evaluation records.

---

## 5. Scope & Limitations Summary

1. **Benchmark is Offline:** Results reflect batch execution against static academic corpora. Live multi-user latency and concurrent token limits may differ.
2. **Synthetic Learner Caveat:** Bayesian Knowledge Tracing calibration metrics (Brier Score, Log Loss, ECE) reflect synthetic student trace simulations, not human student retention over months.
3. **Curriculum Scope:** Current academic evaluations are restricted to 4 core computer science domains (Operating Systems, Computer Networks, Database Systems, Algorithms & Data Structures). Performance on qualitative, humanities, or open-ended creative tasks has not been evaluated.
