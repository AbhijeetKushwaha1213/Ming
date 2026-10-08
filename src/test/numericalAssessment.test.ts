/**
 * Canonical Phase 4 — Step 1 Test Suite
 * Numerical Question Generation & Deterministic Answer Verification
 *
 * 30+ tests covering:
 * 1. Safe expression evaluation (no eval/Function)
 * 2. Student answer parsing (plain, scientific, fractions, expressions, units)
 * 3. Unit normalization and equivalence
 * 4. Tolerance-band grading (exact, relative, absolute, significant figures)
 * 5. Error category detection (sign, rounding, OOM, unit mismatch, formula)
 * 6. Full grading pipeline (correct, partial, incorrect, invalid format)
 * 7. Question verification (accept valid, reject unverifiable)
 * 8. Batch verification
 * 9. Integration with assessmentIntelligenceService
 * 10. Numerical fingerprinting and deduplication
 */

import { describe, it, expect } from 'vitest';
import {
  safeEvaluateExpression,
  parseStudentAnswer,
  normalizeUnit,
  unitsMatch,
  isWithinTolerance,
  countSignificantFigures,
  detectErrorCategory,
  gradeNumericalAnswer,
  verifyNumericalQuestion,
  verifyNumericalQuestionBatch,
  normalizeCorrectAnswer,
  computeNumericalFingerprint,
} from '../../server/numericalVerifier.ts';
import type {
  NumericalQuestion,
  NumericalAnswerSubmission,
  TolerancePolicy,
} from '../../server/assessmentTypes.ts';
import { DEFAULT_TOLERANCE, PARTIAL_TOLERANCE } from '../../server/assessmentTypes.ts';

// =========================================================================
// Helper: Build a standard NumericalQuestion for testing
// =========================================================================

function makeQuestion(overrides: Partial<NumericalQuestion> = {}): NumericalQuestion {
  return {
    question_id: 'q_test_001',
    type: 'NUMERICAL',
    topic: 'Physics',
    subtopic: 'Kinematics',
    difficulty: 'medium',
    question: 'Calculate the velocity of the object after 5 seconds.',
    correct_answer: 50.0,
    correct_answer_raw: '50',
    tolerance: DEFAULT_TOLERANCE,
    verifiability: 'VERIFIED',
    explanation: 'Using v = u + at, where u=0, a=10, t=5: v = 0 + 10*5 = 50 m/s.',
    ...overrides,
  };
}

function makeSubmission(raw: string, questionId = 'q_test_001'): NumericalAnswerSubmission {
  return {
    question_id: questionId,
    raw_answer: raw,
  };
}

// =========================================================================
// 1. Safe Expression Evaluation (No eval/Function)
// =========================================================================

describe('Phase 4 Step 1: Safe Expression Evaluator', () => {
  it('evaluates simple arithmetic: addition', () => {
    expect(safeEvaluateExpression('2 + 3')).toBe(5);
  });

  it('evaluates operator precedence: multiplication before addition', () => {
    expect(safeEvaluateExpression('2 + 3 * 4')).toBe(14);
  });

  it('evaluates parenthesized expressions', () => {
    expect(safeEvaluateExpression('(2 + 3) * 4')).toBe(20);
  });

  it('evaluates division', () => {
    expect(safeEvaluateExpression('10 / 4')).toBe(2.5);
  });

  it('evaluates power/exponentiation', () => {
    expect(safeEvaluateExpression('2 ^ 10')).toBe(1024);
  });

  it('evaluates unary minus', () => {
    expect(safeEvaluateExpression('-5 + 3')).toBe(-2);
  });

  it('rejects division by zero', () => {
    expect(safeEvaluateExpression('10 / 0')).toBeNull();
  });

  it('rejects invalid expressions with letters', () => {
    expect(safeEvaluateExpression('2 + abc')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(safeEvaluateExpression('')).toBeNull();
  });

  it('rejects overly long input', () => {
    const longExpr = '1 + '.repeat(200) + '1';
    expect(safeEvaluateExpression(longExpr)).toBeNull();
  });

  it('handles nested parentheses', () => {
    expect(safeEvaluateExpression('((2 + 3) * (4 - 1))')).toBe(15);
  });

  it('handles scientific notation in expression', () => {
    expect(safeEvaluateExpression('1.5e3')).toBe(1500);
  });
});

// =========================================================================
// 2. Student Answer Parsing
// =========================================================================

describe('Phase 4 Step 1: Student Answer Parser', () => {
  it('parses plain integer', () => {
    const r = parseStudentAnswer('42');
    expect(r.value).toBe(42);
    expect(r.parseError).toBeNull();
  });

  it('parses decimal number', () => {
    const r = parseStudentAnswer('3.14');
    expect(r.value).toBeCloseTo(3.14);
  });

  it('parses negative number', () => {
    const r = parseStudentAnswer('-7.5');
    expect(r.value).toBe(-7.5);
  });

  it('parses scientific notation (standard)', () => {
    const r = parseStudentAnswer('6.022e23');
    expect(r.value).toBeCloseTo(6.022e23);
    expect(r.isScientificNotation).toBe(true);
  });

  it('parses scientific notation (× 10^ format)', () => {
    const r = parseStudentAnswer('1.6 × 10^-19');
    expect(r.value).toBeCloseTo(1.6e-19);
    expect(r.isScientificNotation).toBe(true);
  });

  it('parses fraction 3/4', () => {
    const r = parseStudentAnswer('3/4');
    expect(r.value).toBeCloseTo(0.75);
    expect(r.isFraction).toBe(true);
  });

  it('parses fraction 22/7', () => {
    const r = parseStudentAnswer('22/7');
    expect(r.value).toBeCloseTo(3.142857, 4);
    expect(r.isFraction).toBe(true);
  });

  it('parses percentage', () => {
    const r = parseStudentAnswer('85%');
    expect(r.value).toBe(85);
    expect(r.isPercentage).toBe(true);
  });

  it('parses answer with trailing unit', () => {
    const r = parseStudentAnswer('9.8 m/s^2');
    expect(r.value).toBeCloseTo(9.8);
    expect(r.unit).toBeTruthy();
  });

  it('parses comma-separated thousands', () => {
    const r = parseStudentAnswer('1,000,000');
    expect(r.value).toBe(1000000);
  });

  it('returns parse error for non-numeric input', () => {
    const r = parseStudentAnswer('hello world');
    expect(r.value).toBeNull();
    expect(r.parseError).toBeTruthy();
  });

  it('returns parse error for empty input', () => {
    const r = parseStudentAnswer('');
    expect(r.value).toBeNull();
    expect(r.parseError).toBeTruthy();
  });
});

// =========================================================================
// 3. Unit Normalization & Equivalence
// =========================================================================

describe('Phase 4 Step 1: Unit Normalization', () => {
  it('normalizes "kilogram" to "kg"', () => {
    expect(normalizeUnit('kilogram')).toBe('kg');
  });

  it('normalizes "meters" to "m"', () => {
    expect(normalizeUnit('meters')).toBe('m');
  });

  it('normalizes "percent" to "%"', () => {
    expect(normalizeUnit('percent')).toBe('%');
  });

  it('preserves unrecognized units', () => {
    expect(normalizeUnit('foo_unit')).toBe('foo_unit');
  });

  it('detects equivalent units', () => {
    expect(unitsMatch('kg', 'kilogram')).toBe(true);
    expect(unitsMatch('m', 'meters')).toBe(true);
  });

  it('detects non-equivalent units', () => {
    expect(unitsMatch('kg', 'm')).toBe(false);
  });

  it('null units match each other', () => {
    expect(unitsMatch(null, null)).toBe(true);
    expect(unitsMatch(undefined, undefined)).toBe(true);
  });
});

// =========================================================================
// 4. Tolerance Checking
// =========================================================================

describe('Phase 4 Step 1: Tolerance Checking', () => {
  it('EXACT tolerance: accepts identical values', () => {
    const tol: TolerancePolicy = { mode: 'EXACT', value: 1e-9 };
    expect(isWithinTolerance(42.0, 42.0, tol)).toBe(true);
  });

  it('EXACT tolerance: rejects small difference', () => {
    const tol: TolerancePolicy = { mode: 'EXACT', value: 1e-9 };
    expect(isWithinTolerance(42.001, 42.0, tol)).toBe(false);
  });

  it('RELATIVE 3% tolerance: accepts 2% off', () => {
    const tol: TolerancePolicy = { mode: 'RELATIVE', value: 0.03, absoluteFloor: 0.01 };
    expect(isWithinTolerance(102, 100, tol)).toBe(true);
  });

  it('RELATIVE 3% tolerance: rejects 5% off', () => {
    const tol: TolerancePolicy = { mode: 'RELATIVE', value: 0.03, absoluteFloor: 0.01 };
    expect(isWithinTolerance(105, 100, tol)).toBe(false);
  });

  it('ABSOLUTE tolerance: accepts within threshold', () => {
    const tol: TolerancePolicy = { mode: 'ABSOLUTE', value: 0.5 };
    expect(isWithinTolerance(42.3, 42.0, tol)).toBe(true);
  });

  it('SIGNIFICANT_FIGURES tolerance: 3 sig figs', () => {
    const tol: TolerancePolicy = { mode: 'SIGNIFICANT_FIGURES', value: 3 };
    // 3.14 and 3.14159 should match to 3 sig figs
    expect(isWithinTolerance(3.14, 3.14159, tol)).toBe(true);
  });
});

// =========================================================================
// 5. Error Category Detection
// =========================================================================

describe('Phase 4 Step 1: Error Category Detection', () => {
  it('detects sign error', () => {
    const r = detectErrorCategory(-50, 50, true);
    expect(r.is_sign_error).toBe(true);
    expect(r.error_category).toBe('SIGN_ERROR');
  });

  it('detects order of magnitude error (10x)', () => {
    const r = detectErrorCategory(500, 50, true);
    expect(r.is_order_of_magnitude_error).toBe(true);
    expect(r.error_category).toBe('ORDER_OF_MAGNITUDE');
  });

  it('detects unit mismatch', () => {
    const r = detectErrorCategory(50, 50, false);
    expect(r.error_category).toBe('UNIT_MISMATCH');
  });

  it('detects parse error when value is null', () => {
    const r = detectErrorCategory(null, 50, true);
    expect(r.error_category).toBe('PARSE_ERROR');
  });

  it('detects rounding error (5% off)', () => {
    const r = detectErrorCategory(52.5, 50, true);
    expect(r.error_category).toBe('ROUNDING_ERROR');
  });

  it('detects formula error (large difference)', () => {
    const r = detectErrorCategory(200, 50, true);
    expect(r.error_category).toBe('FORMULA_ERROR');
  });

  it('returns NONE for exact match', () => {
    const r = detectErrorCategory(50, 50, true);
    expect(r.error_category).toBe('NONE');
  });
});

// =========================================================================
// 6. Full Grading Pipeline
// =========================================================================

describe('Phase 4 Step 1: Numerical Grading Pipeline', () => {
  it('grades exact correct answer as CORRECT with 1.0 credit', () => {
    const q = makeQuestion({ correct_answer: 50 });
    const s = makeSubmission('50');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('correct');
    expect(r.credit).toBe(1.0);
    expect(r.within_tolerance).toBe(true);
  });

  it('grades answer within 3% as CORRECT', () => {
    const q = makeQuestion({ correct_answer: 100 });
    const s = makeSubmission('102');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('correct');
    expect(r.credit).toBe(1.0);
  });

  it('grades sign error as PARTIALLY_CORRECT with 0.5 credit', () => {
    const q = makeQuestion({ correct_answer: 50 });
    const s = makeSubmission('-50');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('partially_correct');
    expect(r.credit).toBe(0.5);
    expect(r.is_sign_error).toBe(true);
  });

  it('grades answer within 10% as PARTIALLY_CORRECT', () => {
    const q = makeQuestion({ correct_answer: 100 });
    const s = makeSubmission('108');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('partially_correct');
    expect(r.credit).toBe(0.5);
  });

  it('grades wildly wrong answer as INCORRECT with 0.0 credit', () => {
    const q = makeQuestion({ correct_answer: 50 });
    const s = makeSubmission('200');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('incorrect');
    expect(r.credit).toBe(0.0);
  });

  it('grades unparseable answer as INVALID_FORMAT', () => {
    const q = makeQuestion({ correct_answer: 50 });
    const s = makeSubmission('not a number');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('invalid_format');
    expect(r.credit).toBe(0.0);
  });

  it('grades answer with correct value but wrong unit as PARTIALLY_CORRECT', () => {
    const q = makeQuestion({ correct_answer: 9.8, expected_unit: 'm' });
    const s = makeSubmission('9.8 kg');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('partially_correct');
    expect(r.credit).toBe(0.5);
    expect(r.unit_match).toBe(false);
  });

  it('grades fraction answer correctly', () => {
    const q = makeQuestion({ correct_answer: 0.75 });
    const s = makeSubmission('3/4');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('correct');
    expect(r.credit).toBe(1.0);
  });

  it('grades scientific notation answer correctly', () => {
    const q = makeQuestion({ correct_answer: 6.022e23 });
    const s = makeSubmission('6.022e23');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('correct');
    expect(r.credit).toBe(1.0);
  });

  it('detects order of magnitude error in grading', () => {
    const q = makeQuestion({ correct_answer: 50 });
    const s = makeSubmission('500');
    const r = gradeNumericalAnswer(s, q);
    expect(r.classification).toBe('incorrect');
    expect(r.is_order_of_magnitude_error).toBe(true);
  });

  it('provides coordinate-aware feedback', () => {
    const q = makeQuestion({ correct_answer: 50, page_number: 7 });
    const s = makeSubmission('50');
    const r = gradeNumericalAnswer(s, q);
    expect(r.feedback).toContain('Page 7');
  });

  it('provides slide-aware feedback', () => {
    const q = makeQuestion({ correct_answer: 50, slide_number: 3, page_number: undefined });
    const s = makeSubmission('50');
    const r = gradeNumericalAnswer(s, q);
    expect(r.feedback).toContain('Slide 3');
  });
});

// =========================================================================
// 7. Question Verification
// =========================================================================

describe('Phase 4 Step 1: Question Verification', () => {
  it('accepts a well-formed numerical question', () => {
    const q = makeQuestion();
    const r = verifyNumericalQuestion(q);
    expect(r.verified).not.toBeNull();
    expect(r.issues).toHaveLength(0);
    expect(r.verified?.verifiability).toBe('VERIFIED');
  });

  it('rejects question with NaN correct_answer', () => {
    const q = makeQuestion({ correct_answer: NaN });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('rejects question with Infinity correct_answer', () => {
    const q = makeQuestion({ correct_answer: Infinity });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
  });

  it('rejects question with too-short stem', () => {
    const q = makeQuestion({ question: 'x=?' });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
    expect(r.issues.some(i => i.includes('too short'))).toBe(true);
  });

  it('rejects question with no quantitative keywords', () => {
    const q = makeQuestion({ question: 'Describe the philosophical implications of existentialism in modern literature and society.' });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
    expect(r.issues.some(i => i.includes('quantitative'))).toBe(true);
  });

  it('rejects question with missing explanation', () => {
    const q = makeQuestion({ explanation: '' });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
  });

  it('rejects question with negative tolerance value', () => {
    const q = makeQuestion({ tolerance: { mode: 'RELATIVE', value: -0.1 } });
    const r = verifyNumericalQuestion(q);
    expect(r.verified).toBeNull();
    expect(r.issues.some(i => i.includes('positive'))).toBe(true);
  });
});

// =========================================================================
// 8. Batch Verification
// =========================================================================

describe('Phase 4 Step 1: Batch Verification', () => {
  it('processes a mixed batch of valid and invalid questions', () => {
    const valid = makeQuestion({ question_id: 'q1' });
    const invalid1 = makeQuestion({ question_id: 'q2', correct_answer: NaN });
    const invalid2 = makeQuestion({ question_id: 'q3', question: 'x?' });

    const r = verifyNumericalQuestionBatch([valid, invalid1, invalid2]);
    expect(r.totalGenerated).toBe(3);
    expect(r.totalVerified).toBe(1);
    expect(r.totalRejected).toBe(2);
    expect(r.verified).toHaveLength(1);
    expect(r.rejected).toHaveLength(2);
  });

  it('accepts all questions in an all-valid batch', () => {
    const q1 = makeQuestion({ question_id: 'q1' });
    const q2 = makeQuestion({ question_id: 'q2', correct_answer: 3.14, correct_answer_raw: '3.14' });
    const r = verifyNumericalQuestionBatch([q1, q2]);
    expect(r.totalVerified).toBe(2);
    expect(r.totalRejected).toBe(0);
  });
});

// =========================================================================
// 9. Answer Normalization & Fingerprinting
// =========================================================================

describe('Phase 4 Step 1: Answer Normalization & Fingerprinting', () => {
  it('normalizes a valid numeric string', () => {
    const r = normalizeCorrectAnswer('42.5');
    expect(r.valid).toBe(true);
    expect(r.value).toBe(42.5);
  });

  it('normalizes a string with units', () => {
    const r = normalizeCorrectAnswer('100 kg');
    expect(r.valid).toBe(true);
    expect(r.value).toBe(100);
  });

  it('rejects unparseable answer', () => {
    const r = normalizeCorrectAnswer('not a number');
    expect(r.valid).toBe(false);
    expect(r.value).toBeNull();
  });

  it('generates deterministic fingerprints', () => {
    const fp1 = computeNumericalFingerprint('Calculate the velocity', 50, 'Physics');
    const fp2 = computeNumericalFingerprint('Calculate the velocity', 50, 'Physics');
    expect(fp1).toBe(fp2);
    expect(fp1.startsWith('nq_')).toBe(true);
  });

  it('generates different fingerprints for different questions', () => {
    const fp1 = computeNumericalFingerprint('Calculate velocity', 50, 'Physics');
    const fp2 = computeNumericalFingerprint('Calculate acceleration', 10, 'Physics');
    expect(fp1).not.toBe(fp2);
  });
});

// =========================================================================
// 10. Significant Figures
// =========================================================================

describe('Phase 4 Step 1: Significant Figures', () => {
  it('counts sig figs in "3.14"', () => {
    expect(countSignificantFigures('3.14')).toBe(3);
  });

  it('counts sig figs in "0.00123"', () => {
    expect(countSignificantFigures('0.00123')).toBe(3);
  });

  it('counts sig figs in "1000"', () => {
    expect(countSignificantFigures('1000')).toBe(4);
  });

  it('counts sig figs in "1.0"', () => {
    expect(countSignificantFigures('1.0')).toBe(2);
  });
});

// =========================================================================
// 11. Zero-Trust Safety Guarantees
// =========================================================================

describe('Phase 4 Step 1: Zero-Trust Safety', () => {
  it('safeEvaluateExpression does NOT use eval', () => {
    // Attempting code injection should fail safely
    expect(safeEvaluateExpression('console.log("hacked")')).toBeNull();
    expect(safeEvaluateExpression('process.exit(1)')).toBeNull();
    expect(safeEvaluateExpression('require("fs")')).toBeNull();
  });

  it('rejects expressions with function-like syntax', () => {
    expect(safeEvaluateExpression('Math.pow(2, 10)')).toBeNull();
    expect(safeEvaluateExpression('eval("2+2")')).toBeNull();
  });

  it('rejects semicolon-separated statements', () => {
    expect(safeEvaluateExpression('2+2; 3+3')).toBeNull();
  });

  it('grading is deterministic: same inputs always produce same output', () => {
    const q = makeQuestion({ correct_answer: 42 });
    const s = makeSubmission('43');
    const r1 = gradeNumericalAnswer(s, q);
    const r2 = gradeNumericalAnswer(s, q);
    expect(r1.classification).toBe(r2.classification);
    expect(r1.credit).toBe(r2.credit);
    expect(r1.absolute_error).toBe(r2.absolute_error);
    expect(r1.feedback).toBe(r2.feedback);
  });
});
