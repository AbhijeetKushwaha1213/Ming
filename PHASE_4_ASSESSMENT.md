# PHASE 4 — ASSESSMENT
## Step 1: Numerical Question Generation & Deterministic Answer Verification

**Status:** COMPLETE ✅  
**Phase:** 4 of 7 (Canonical Roadmap)  
**Prerequisite:** Phase 3 — Grounding (COMPLETE)

---

## Objective

Build a **server-authoritative, deterministic numerical answer verification engine** that:

1. Safely parses student numerical answers (no `eval()`, `Function()`, or dynamic execution)
2. Normalizes units across equivalent representations
3. Grades answers using configurable tolerance bands
4. Detects specific error categories (sign, rounding, OOM, unit mismatch)
5. Verifies generated numerical questions before presenting to students
6. Rejects unverifiable questions (zero-trust: if can't verify → reject)

---

## Zero-Trust Grading Boundary

> **The LLM must NEVER sit in the critical grading path.**

| Guarantee | Implementation |
|-----------|---------------|
| No `eval()` | Safe recursive-descent expression parser with bounded depth |
| No `Function()` | Tokenizer only allows: digits, operators (+−×÷*/^), parentheses |
| No dynamic code | All grading is pure arithmetic comparison |
| Server-authoritative | `gradeNumericalAnswer()` is the single source of truth |
| Deterministic | Same inputs → identical outputs, always |
| Verifiable questions | `verifyNumericalQuestion()` rejects unverifiable NUMERICAL questions |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Assessment Generation Pipeline                  │
│                                                                    │
│  LLM generates question + correct_answer                          │
│           │                                                        │
│           ▼                                                        │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐  │
│  │ normalizeCorrectAnswer  │───▶│ verifyNumericalQuestion      │  │
│  │ (parse LLM output)      │    │ (reject if unverifiable)     │  │
│  └─────────────────────────┘    └──────────┬───────────────────┘  │
│                                             │                      │
│                              VERIFIED ─────▶│◀───── REJECTED       │
│                              (present)       │      (suppress)     │
│                                              ▼                     │
│                                    Student sees question           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   Answer Grading Pipeline                          │
│                                                                    │
│  Student types answer                                              │
│           │                                                        │
│           ▼                                                        │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐  │
│  │ parseStudentAnswer      │───▶│ gradeNumericalAnswer         │  │
│  │ (safe parser, no eval)  │    │ (tolerance + unit + error)   │  │
│  └─────────────────────────┘    └──────────┬───────────────────┘  │
│                                             │                      │
│                                             ▼                      │
│                                   NumericalGradingResult           │
│                                   { classification, credit,        │
│                                     error_category, feedback }     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| `server/assessmentTypes.ts` | Canonical Phase 4 data contracts (NumericalQuestion, NumericalGradingResult, TolerancePolicy, unit equivalences, verifiability) |
| `server/numericalVerifier.ts` | Deterministic numerical answer verification engine (safe parser, grading, verification, batch processing) |
| `src/test/numericalAssessment.test.ts` | 78 tests covering all verification components |
| `PHASE_4_ASSESSMENT.md` | This document |

### Modified Files

| File | Change |
|------|--------|
| `server/assessmentIntelligenceService.ts` | NUMERICAL branch now delegates to `gradeNumericalAnswer()` from Phase 4 verifier |
| `server/ragHandler.ts` | Assessment generation pipeline verifies NUMERICAL questions server-side before persisting |

---

## Components

### 1. Safe Expression Evaluator (`safeEvaluateExpression`)

Recursive-descent parser supporting:
- Arithmetic: `+`, `-`, `*`, `/`, `^`
- Parenthesized grouping
- Unary minus/plus
- Scientific notation (`1.5e3`)

**Safety bounds:**
- Max expression length: 500 characters
- Max nesting depth: 20 levels
- Division by zero → returns `null`
- Invalid characters → returns `null`

### 2. Student Answer Parser (`parseStudentAnswer`)

Parses raw student input into structured `ParsedStudentAnswer`:

| Format | Example | Handling |
|--------|---------|----------|
| Plain number | `42`, `3.14`, `-7.5` | `parseFloat` |
| Scientific notation | `6.022e23` | Standard JS parsing |
| × 10^ notation | `1.6 × 10^-19` | Unicode-normalized, custom parser |
| Fractions | `3/4`, `22/7` | Numerator ÷ denominator |
| Percentages | `85%`, `12.5 percent` | Value extracted, flag set |
| Expressions | `2 * 3 + 1` | Safe recursive-descent evaluator |
| With units | `9.8 m/s^2` | Value + unit separated |
| Thousands | `1,000,000` | Commas stripped |

### 3. Unit Normalization

35 canonical unit groups covering SI, imperial, computing, and scientific units.
Each group maps variant spellings to a canonical form:

```
kilogram, kilograms, kgs → kg
meter, meters, metre → m
percent, percentage, pct → %
celsius, degrees celsius → °C
megabyte, megabytes → MB
```

### 4. Tolerance-Band Grading

Four tolerance modes:

| Mode | Description | Default |
|------|-------------|---------|
| `EXACT` | Within floating-point epsilon | 1e-9 |
| `RELATIVE` | Within % of correct value | 3% (with 0.01 floor) |
| `ABSOLUTE` | Within fixed absolute difference | Configurable |
| `SIGNIFICANT_FIGURES` | Correct to N sig figs | Configurable |

**Grading cascade:**
1. Within 3% tolerance → **CORRECT** (1.0 credit)
2. Sign error detected → **PARTIALLY_CORRECT** (0.5 credit)
3. Within 10% tolerance → **PARTIALLY_CORRECT** (0.5 credit)
4. Correct value, wrong unit → **PARTIALLY_CORRECT** (0.5 credit)
5. Unparseable input → **INVALID_FORMAT** (0.0 credit)
6. Otherwise → **INCORRECT** (0.0 credit)

### 5. Error Category Detection

| Category | Detection Logic |
|----------|-----------------|
| `SIGN_ERROR` | Magnitude within 3% but sign is inverted |
| `ROUNDING_ERROR` | Within 3–10% relative error |
| `ORDER_OF_MAGNITUDE` | Ratio ≈ 10^n (n=1,2,3) |
| `UNIT_MISMATCH` | Value correct, unit wrong |
| `FORMULA_ERROR` | >10% relative error |
| `PARSE_ERROR` | Could not parse student input |

### 6. Question Verification

Before any NUMERICAL question is presented to a student, the server verifies:

1. `correct_answer` is a finite number
2. `correct_answer_raw` parses to the same value (consistency check)
3. `expected_unit` is recognized (if specified)
4. Question stem contains quantitative keywords
5. Tolerance is well-formed (positive value, valid mode)
6. Explanation is present and substantive

**Rejected questions are logged and suppressed — never shown to students.**

---

## Test Suite Summary

**78 tests across 11 describe blocks:**

| Block | Tests | Coverage |
|-------|-------|----------|
| Safe Expression Evaluator | 12 | Arithmetic, precedence, parentheses, unary, division-by-zero, injection rejection |
| Student Answer Parser | 12 | Plain, decimal, negative, scientific, fractions, percentages, units, thousands, errors |
| Unit Normalization | 7 | Canonical mapping, equivalence, null handling |
| Tolerance Checking | 6 | Exact, relative, absolute, significant figures |
| Error Category Detection | 7 | Sign, OOM, unit mismatch, parse, rounding, formula, exact match |
| Numerical Grading Pipeline | 12 | Full grading cascade: correct, partial, incorrect, invalid, units, fractions, sci notation, OOM, coordinate feedback |
| Question Verification | 7 | Accept valid, reject NaN/Infinity/short/non-quantitative/no-explanation/negative-tolerance |
| Batch Verification | 2 | Mixed batch, all-valid batch |
| Normalization & Fingerprinting | 5 | Valid/invalid normalization, deterministic fingerprints |
| Significant Figures | 4 | Various formats |
| Zero-Trust Safety | 4 | Code injection rejection, function syntax, semicolons, determinism proof |

---

## Integration Points

### With Phase 2 (Knowledge Ingestion)
- Questions reference `source_id`, `chunk_id`, `page_number`, `slide_number`, `timestamp_start`
- Source provenance types (`SourceType`, `ExtractionMethod`) are re-exported from `ingestionTypes.ts`

### With Phase 3 (Grounding)
- Question verification uses the same coordinate-label pattern as `VerifiedCitation`
- Feedback references source coordinates for student review

### With Assessment Intelligence Service
- NUMERICAL branch of `evaluateSingleAnswer()` now delegates to `gradeNumericalAnswer()`
- Misconception detection benefits from structured error categories

### With RAG Handler Pipeline
- Assessment generation (`POST /api/rag/assessment/generate`) now runs numerical verification
- Unverifiable NUMERICAL questions are rejected before persistence

---

## Definition of Done (Step 1)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `assessmentTypes.ts` defines NumericalQuestion, TolerancePolicy, NumericalGradingResult | ✅ |
| 2 | Safe expression evaluator: no eval/Function/dynamic code | ✅ |
| 3 | Student answer parser handles 8+ formats | ✅ |
| 4 | Unit normalization with 35 equivalence groups | ✅ |
| 5 | 4 tolerance modes (exact, relative, absolute, sig figs) | ✅ |
| 6 | Error category detection (6 categories) | ✅ |
| 7 | Full grading pipeline with deterministic partial credit | ✅ |
| 8 | Question verification rejects unverifiable questions | ✅ |
| 9 | Batch verification for generation pipeline | ✅ |
| 10 | Answer normalization for LLM output | ✅ |
| 11 | Deterministic fingerprinting for deduplication | ✅ |
| 12 | Integration with assessmentIntelligenceService | ✅ |
| 13 | Integration with ragHandler generation pipeline | ✅ |
| 14 | 78 numerical assessment tests pass | ✅ |
| 15 | Existing regression suites pass | ✅ |
| 16 | TypeScript: 0 errors | ✅ |
| 17 | Documentation complete | ✅ |
