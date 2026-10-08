/**
 * Canonical Phase 4 — Deterministic Numerical Answer Verifier
 *
 * ZERO-TRUST BOUNDARY:
 * - NO eval(), Function(), new Function(), or dynamic code execution.
 * - NO LLM in the grading path.
 * - All grading is pure, deterministic, server-authoritative arithmetic.
 * - Safe expression parser uses recursive descent with bounded depth.
 * - Unit normalization uses static equivalence tables.
 *
 * Responsibilities:
 * 1. Parse student answers (handle scientific notation, fractions, percentages, units)
 * 2. Normalize units to canonical forms
 * 3. Apply tolerance-band grading (exact, relative, absolute, significant figures)
 * 4. Detect error categories (sign, rounding, order-of-magnitude, unit mismatch)
 * 5. Verify generated questions (reject unverifiable numerical questions)
 * 6. Provide deterministic partial credit
 */

import type {
  TolerancePolicy,
  ToleranceMode,
  NumericalGradingResult,
  NumericalGradeClassification,
  NumericalAnswerSubmission,
  NumericalQuestion,
  VerifiabilityStatus,
  Token,
  TokenType,
} from './assessmentTypes.ts';

import {
  DEFAULT_TOLERANCE,
  PARTIAL_TOLERANCE,
  UNIT_EQUIVALENCES,
} from './assessmentTypes.ts';

// =========================================================================
// 1. Safe Numeric Parser (No eval, no dynamic code)
// =========================================================================

const MAX_EXPRESSION_DEPTH = 20;
const MAX_EXPRESSION_LENGTH = 500;

/**
 * Safely tokenize a numeric expression string.
 * Only allows: digits, decimal points, e/E (scientific), +, -, *, /, ^, (, )
 * Rejects any other characters (letters other than e/E, semicolons, etc.)
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Number (integer, decimal, scientific notation)
    if (ch >= '0' && ch <= '9' || (ch === '.' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9')) {
      let numStr = '';
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        numStr += s[i];
        i++;
      }
      // Scientific notation: e or E followed by optional +/- and digits
      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        numStr += s[i];
        i++;
        if (i < s.length && (s[i] === '+' || s[i] === '-')) {
          numStr += s[i];
          i++;
        }
        while (i < s.length && s[i] >= '0' && s[i] <= '9') {
          numStr += s[i];
          i++;
        }
      }
      const val = parseFloat(numStr);
      if (isNaN(val)) {
        throw new Error(`Invalid number: ${numStr}`);
      }
      tokens.push({ type: 'NUMBER', value: val });
      continue;
    }

    switch (ch) {
      case '+': tokens.push({ type: 'PLUS', value: null }); break;
      case '-': tokens.push({ type: 'MINUS', value: null }); break;
      case '*': tokens.push({ type: 'MULTIPLY', value: null }); break;
      case '/': tokens.push({ type: 'DIVIDE', value: null }); break;
      case '^': tokens.push({ type: 'POWER', value: null }); break;
      case '(': tokens.push({ type: 'LPAREN', value: null }); break;
      case ')': tokens.push({ type: 'RPAREN', value: null }); break;
      case '×': tokens.push({ type: 'MULTIPLY', value: null }); break;
      case '÷': tokens.push({ type: 'DIVIDE', value: null }); break;
      default:
        throw new Error(`Unexpected character in expression: '${ch}' at position ${i}`);
    }
    i++;
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

/**
 * Safe recursive-descent expression evaluator.
 * Grammar:
 *   expr   → term (('+' | '-') term)*
 *   term   → factor (('*' | '/') factor)*
 *   factor → base ('^' factor)?
 *   base   → NUMBER | '-' base | '(' expr ')'
 *
 * Bounded by MAX_EXPRESSION_DEPTH to prevent stack overflow.
 */
class SafeExpressionEvaluator {
  private tokens: Token[];
  private pos: number;
  private depth: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
    this.depth = 0;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: null };
  }

  private consume(expected?: TokenType): Token {
    const tok = this.peek();
    if (expected && tok.type !== expected) {
      throw new Error(`Expected ${expected} but got ${tok.type}`);
    }
    this.pos++;
    return tok;
  }

  private checkDepth(): void {
    this.depth++;
    if (this.depth > MAX_EXPRESSION_DEPTH) {
      throw new Error('Expression too deeply nested');
    }
  }

  evaluate(): number {
    const result = this.expr();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token after expression: ${this.peek().type}`);
    }
    return result;
  }

  private expr(): number {
    this.checkDepth();
    let left = this.term();
    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume();
      const right = this.term();
      left = op.type === 'PLUS' ? left + right : left - right;
    }
    this.depth--;
    return left;
  }

  private term(): number {
    this.checkDepth();
    let left = this.factor();
    while (this.peek().type === 'MULTIPLY' || this.peek().type === 'DIVIDE') {
      const op = this.consume();
      const right = this.factor();
      if (op.type === 'DIVIDE') {
        if (right === 0) throw new Error('Division by zero');
        left = left / right;
      } else {
        left = left * right;
      }
    }
    this.depth--;
    return left;
  }

  private factor(): number {
    this.checkDepth();
    let base = this.base();
    if (this.peek().type === 'POWER') {
      this.consume();
      const exp = this.factor(); // Right-associative
      base = Math.pow(base, exp);
    }
    this.depth--;
    return base;
  }

  private base(): number {
    this.checkDepth();
    const tok = this.peek();

    if (tok.type === 'NUMBER') {
      this.consume();
      this.depth--;
      return tok.value!;
    }

    if (tok.type === 'MINUS') {
      this.consume();
      const val = this.base();
      this.depth--;
      return -val;
    }

    if (tok.type === 'PLUS') {
      this.consume();
      const val = this.base();
      this.depth--;
      return val;
    }

    if (tok.type === 'LPAREN') {
      this.consume();
      const val = this.expr();
      this.consume('RPAREN');
      this.depth--;
      return val;
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }
}

/**
 * Safely evaluate a simple arithmetic expression without eval().
 * Returns the numeric result or null if the expression is invalid.
 */
export function safeEvaluateExpression(expression: string): number | null {
  if (!expression || expression.length > MAX_EXPRESSION_LENGTH) {
    return null;
  }

  try {
    const tokens = tokenize(expression);
    const evaluator = new SafeExpressionEvaluator(tokens);
    const result = evaluator.evaluate();
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// =========================================================================
// 2. Student Answer Parser
// =========================================================================

export interface ParsedStudentAnswer {
  value: number | null;
  unit: string | null;
  raw: string;
  isFraction: boolean;
  isPercentage: boolean;
  isScientificNotation: boolean;
  isExpression: boolean;
  parseError: string | null;
}

/**
 * Parse a raw student answer string into a numeric value and optional unit.
 * Handles:
 * - Plain numbers: "42", "3.14", "-7.5"
 * - Scientific notation: "6.022e23", "1.6 × 10^-19"
 * - Fractions: "3/4", "22/7"
 * - Percentages: "85%", "12.5 percent"
 * - Expressions: "2 * 3 + 1" (safe evaluation)
 * - Units: "9.8 m/s^2", "100 kg"
 * - Comma-separated thousands: "1,000,000"
 */
export function parseStudentAnswer(raw: string): ParsedStudentAnswer {
  const result: ParsedStudentAnswer = {
    value: null,
    unit: null,
    raw: raw,
    isFraction: false,
    isPercentage: false,
    isScientificNotation: false,
    isExpression: false,
    parseError: null,
  };

  if (!raw || typeof raw !== 'string') {
    result.parseError = 'Empty or invalid answer';
    return result;
  }

  let cleaned = raw.trim();

  // Remove leading/trailing quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (cleaned.length === 0) {
    result.parseError = 'Empty answer after cleanup';
    return result;
  }

  // Check for percentage
  if (cleaned.endsWith('%') || cleaned.toLowerCase().endsWith('percent') || cleaned.toLowerCase().endsWith('pct')) {
    result.isPercentage = true;
    cleaned = cleaned
      .replace(/%$/i, '')
      .replace(/\s*(percent|pct)$/i, '')
      .trim();
  }

  // Normalize Unicode multiplication signs to ASCII before parsing
  cleaned = cleaned.replace(/\u00d7/g, 'x').replace(/\u22c5/g, '*');

  // Handle scientific notation FIRST: "6.022 x 10^23", "1.6 x 10^-19", "6.022 * 10^23"
  const sciMatch = cleaned.match(/^([+\-]?\s*[\d.]+)\s*[x*]\s*10\s*\^\s*([+\-]?\d+)(.*)$/);
  if (sciMatch) {
    result.isScientificNotation = true;
    const mantissa = parseFloat(sciMatch[1].replace(/\s/g, ''));
    const exponent = parseInt(sciMatch[2], 10);
    const trailing = (sciMatch[3] || '').trim();
    if (trailing) {
      result.unit = normalizeUnit(trailing);
    }
    if (!isNaN(mantissa) && !isNaN(exponent)) {
      result.value = mantissa * Math.pow(10, exponent);
      return result;
    }
  }

  // Extract trailing unit (after the numeric part)
  const unitMatch = cleaned.match(/^([+\-]?\s*[\d.,]+(?:\s*[eE][+\-]?\d+)?(?:\s*\/\s*[\d.,]+)?)\s+(.+)$/);
  if (unitMatch) {
    cleaned = unitMatch[1].trim();
    result.unit = normalizeUnit(unitMatch[2].trim());
  }

  // Remove thousands separators
  cleaned = cleaned.replace(/,/g, '');

  // Handle fractions: "3/4", "22/7", "-1/3"
  const fractionMatch = cleaned.match(/^([+\-]?\s*[\d.]+)\s*\/\s*([\d.]+)$/);
  if (fractionMatch) {
    result.isFraction = true;
    const num = parseFloat(fractionMatch[1].replace(/\s/g, ''));
    const den = parseFloat(fractionMatch[2]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      result.value = num / den;
      return result;
    } else {
      result.parseError = 'Invalid fraction (division by zero or non-numeric)';
      return result;
    }
  }

  // Handle expressions with operators (but not plain negatives)
  const hasOperators = /[+\-*/^]/.test(cleaned.replace(/^[+\-]/, '').replace(/[eE][+\-]?\d+$/, ''));
  if (hasOperators && cleaned.length > 1) {
    result.isExpression = true;
    const val = safeEvaluateExpression(cleaned);
    if (val !== null) {
      result.value = val;
      return result;
    }
    // Fall through to plain parse
  }

  // Plain number (including scientific notation like 6.022e23)
  const plainVal = parseFloat(cleaned);
  if (!isNaN(plainVal) && isFinite(plainVal)) {
    result.value = plainVal;
    if (/[eE]/.test(cleaned)) {
      result.isScientificNotation = true;
    }
    return result;
  }

  result.parseError = `Could not parse "${raw}" as a number`;
  return result;
}

// =========================================================================
// 3. Unit Normalization
// =========================================================================

/**
 * Normalize a unit string to its canonical form using the equivalence table.
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return '';
  const lower = unit.toLowerCase().trim();

  for (const eq of UNIT_EQUIVALENCES) {
    if (lower === eq.canonical.toLowerCase()) return eq.canonical;
    for (const v of eq.variants) {
      if (lower === v.toLowerCase()) return eq.canonical;
    }
  }

  // Return as-is if not found in equivalences
  return unit.trim();
}

/**
 * Check if two unit strings are equivalent (after normalization).
 */
export function unitsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false; // One has a unit, the other doesn't → mismatch
  return normalizeUnit(a) === normalizeUnit(b);
}

// =========================================================================
// 4. Tolerance Checking
// =========================================================================

/**
 * Check if a student value is within a given tolerance of the correct value.
 */
export function isWithinTolerance(
  studentValue: number,
  correctValue: number,
  tolerance: TolerancePolicy
): boolean {
  const absDiff = Math.abs(studentValue - correctValue);

  switch (tolerance.mode) {
    case 'EXACT':
      return absDiff <= (tolerance.value || 1e-9);

    case 'RELATIVE': {
      const relThreshold = Math.abs(correctValue) * tolerance.value;
      const floor = tolerance.absoluteFloor ?? 0;
      const effectiveThreshold = Math.max(relThreshold, floor);
      return absDiff <= effectiveThreshold;
    }

    case 'ABSOLUTE':
      return absDiff <= tolerance.value;

    case 'SIGNIFICANT_FIGURES': {
      const sigFigs = Math.round(tolerance.value);
      if (sigFigs < 1) return false;
      if (correctValue === 0) return absDiff < Math.pow(10, -sigFigs);
      const magnitude = Math.floor(Math.log10(Math.abs(correctValue)));
      const precision = Math.pow(10, magnitude - sigFigs + 1);
      return absDiff < precision * 0.5;
    }

    default:
      return false;
  }
}

/**
 * Count significant figures in a number string.
 */
export function countSignificantFigures(numStr: string): number {
  const cleaned = numStr.replace(/[^0-9.eE+-]/g, '').trim();
  // Remove scientific notation suffix
  const mantissa = cleaned.replace(/[eE][+\-]?\d+$/, '');
  // Remove leading zeros and sign
  const unsigned = mantissa.replace(/^[+\-]/, '');

  if (unsigned.includes('.')) {
    // Remove leading zeros before significant digits
    const withoutLeading = unsigned.replace(/^0+/, '');
    if (withoutLeading.startsWith('.')) {
      // e.g., 0.00123 → 123 → 3 sig figs
      const afterDecimal = withoutLeading.replace(/^\.0*/, '');
      return afterDecimal.replace('.', '').length || 1;
    }
    return withoutLeading.replace('.', '').length || 1;
  } else {
    // Integer: trailing zeros are ambiguous, count all digits
    const withoutLeading = unsigned.replace(/^0+/, '');
    return withoutLeading.length || 1;
  }
}

// =========================================================================
// 5. Error Category Detection
// =========================================================================

export interface ErrorDetection {
  is_sign_error: boolean;
  is_magnitude_error: boolean;
  is_order_of_magnitude_error: boolean;
  error_category: 'SIGN_ERROR' | 'ROUNDING_ERROR' | 'ORDER_OF_MAGNITUDE' | 'UNIT_MISMATCH' | 'FORMULA_ERROR' | 'PARSE_ERROR' | 'NONE';
}

/**
 * Detect the category of numerical error between student and correct values.
 */
export function detectErrorCategory(
  studentValue: number | null,
  correctValue: number,
  unitMatch: boolean
): ErrorDetection {
  if (studentValue === null) {
    return {
      is_sign_error: false,
      is_magnitude_error: false,
      is_order_of_magnitude_error: false,
      error_category: 'PARSE_ERROR',
    };
  }

  if (!unitMatch) {
    return {
      is_sign_error: false,
      is_magnitude_error: false,
      is_order_of_magnitude_error: false,
      error_category: 'UNIT_MISMATCH',
    };
  }

  const isSignError = correctValue !== 0 && studentValue !== 0 &&
    Math.abs(Math.abs(studentValue) - Math.abs(correctValue)) / Math.max(Math.abs(correctValue), 1e-10) < 0.03;

  if (isSignError && Math.sign(studentValue) !== Math.sign(correctValue)) {
    return {
      is_sign_error: true,
      is_magnitude_error: false,
      is_order_of_magnitude_error: false,
      error_category: 'SIGN_ERROR',
    };
  }

  // Order of magnitude error: student differs by a factor of ~10, 100, 1000
  if (correctValue !== 0 && studentValue !== 0) {
    const ratio = Math.abs(studentValue / correctValue);
    const logRatio = Math.abs(Math.log10(ratio));
    if (logRatio >= 0.8 && logRatio <= 3.2) {
      // Roughly 1-3 orders of magnitude off
      const isExactOOM = Math.abs(logRatio - Math.round(logRatio)) < 0.15;
      if (isExactOOM) {
        return {
          is_sign_error: false,
          is_magnitude_error: false,
          is_order_of_magnitude_error: true,
          error_category: 'ORDER_OF_MAGNITUDE',
        };
      }
    }
  }

  // Rounding error: within 10% but outside 3%
  const relError = correctValue !== 0
    ? Math.abs(studentValue - correctValue) / Math.abs(correctValue)
    : Math.abs(studentValue - correctValue);

  if (relError > 0.03 && relError <= 0.10) {
    return {
      is_sign_error: false,
      is_magnitude_error: false,
      is_order_of_magnitude_error: false,
      error_category: 'ROUNDING_ERROR',
    };
  }

  // General formula/computation error
  if (relError > 0.10) {
    return {
      is_sign_error: false,
      is_magnitude_error: true,
      is_order_of_magnitude_error: false,
      error_category: 'FORMULA_ERROR',
    };
  }

  return {
    is_sign_error: false,
    is_magnitude_error: false,
    is_order_of_magnitude_error: false,
    error_category: 'NONE',
  };
}

// =========================================================================
// 6. Core Grading Function
// =========================================================================

/**
 * Grade a student's numerical answer against the correct answer.
 * Server-authoritative, deterministic, no LLM involvement.
 *
 * Grading algorithm:
 * 1. Parse student answer → numeric value + optional unit
 * 2. Normalize units
 * 3. Check exact tolerance → CORRECT (1.0 credit)
 * 4. Check sign error → PARTIALLY_CORRECT (0.5 credit)
 * 5. Check partial tolerance → PARTIALLY_CORRECT (0.5 credit)
 * 6. Otherwise → INCORRECT (0.0 credit)
 *
 * @param submission - Student's answer submission
 * @param question - The numerical question being graded
 * @param overrideTolerance - Optional custom tolerance (for testing)
 * @returns Deterministic NumericalGradingResult
 */
export function gradeNumericalAnswer(
  submission: NumericalAnswerSubmission,
  question: NumericalQuestion,
  overrideTolerance?: TolerancePolicy
): NumericalGradingResult {
  const tolerance = overrideTolerance || question.tolerance || DEFAULT_TOLERANCE;
  const partialTol = PARTIAL_TOLERANCE;
  const correctValue = question.correct_answer;

  // 1. Parse student answer
  const parsed = parseStudentAnswer(submission.raw_answer);

  // 2. Handle parse failure
  if (parsed.value === null) {
    return {
      question_id: question.question_id,
      classification: 'invalid_format',
      credit: 0.0,
      student_value: null,
      correct_value: correctValue,
      absolute_error: null,
      relative_error: null,
      student_unit: parsed.unit,
      expected_unit: question.expected_unit || null,
      unit_match: false,
      tolerance_applied: tolerance,
      within_tolerance: false,
      within_partial_tolerance: false,
      is_sign_error: false,
      is_magnitude_error: false,
      is_order_of_magnitude_error: false,
      feedback: `Could not parse your answer "${submission.raw_answer}" as a number. Please enter a numeric value.`,
      error_category: 'PARSE_ERROR',
    };
  }

  const studentValue = parsed.value;
  const absDiff = Math.abs(studentValue - correctValue);
  const relError = correctValue !== 0
    ? Math.abs(studentValue - correctValue) / Math.abs(correctValue)
    : (studentValue === 0 ? 0 : Infinity);

  // 3. Check unit match
  const unitOk = unitsMatch(parsed.unit, question.expected_unit);

  // 4. Detect error category
  const errorInfo = detectErrorCategory(studentValue, correctValue, unitOk);

  // 5. Check tolerances
  const withinTolerance = isWithinTolerance(studentValue, correctValue, tolerance);
  const withinPartial = isWithinTolerance(studentValue, correctValue, partialTol);

  // 6. Determine classification and credit
  let classification: NumericalGradeClassification;
  let credit: number;
  let feedback: string;

  const coordLabel = question.page_number
    ? `Page ${question.page_number}`
    : question.slide_number
    ? `Slide ${question.slide_number}`
    : question.timestamp_start != null
    ? `${Math.floor(question.timestamp_start / 60)}m${Math.floor(question.timestamp_start % 60)}s`
    : 'Course Material';

  if (withinTolerance && unitOk) {
    classification = 'correct';
    credit = 1.0;
    feedback = `Correct! Your answer ${studentValue} matches the expected value ${correctValue}` +
      (tolerance.mode === 'RELATIVE'
        ? ` (within ±${(tolerance.value * 100).toFixed(0)}% tolerance)`
        : ` (within ±${tolerance.value} tolerance)`) +
      `. Verified in ${coordLabel}.`;
  } else if (errorInfo.is_sign_error) {
    classification = 'partially_correct';
    credit = 0.5;
    feedback = `Sign error: Your answer ${studentValue} has the correct magnitude but wrong sign. ` +
      `Expected ${correctValue}. Check sign conventions at ${coordLabel}.`;
  } else if (withinPartial && unitOk) {
    classification = 'partially_correct';
    credit = 0.5;
    feedback = `Close: Your answer ${studentValue} is within ±10% of ${correctValue}` +
      ` but outside the ±${(tolerance.value * 100).toFixed(0)}% exact tolerance. ` +
      `Check rounding or precision at ${coordLabel}.`;
  } else if (!unitOk && withinTolerance) {
    // Value is right but unit is wrong
    classification = 'partially_correct';
    credit = 0.5;
    feedback = `Unit mismatch: Your numeric value ${studentValue} is correct, ` +
      `but the unit "${parsed.unit || '(none)'}" doesn't match the expected "${question.expected_unit || '(none)'}". ` +
      `Review unit requirements at ${coordLabel}.`;
  } else {
    classification = 'incorrect';
    credit = 0.0;
    if (errorInfo.is_order_of_magnitude_error) {
      const ratio = correctValue !== 0 ? Math.abs(studentValue / correctValue) : 0;
      const oom = Math.round(Math.log10(ratio));
      feedback = `Order of magnitude error: Your answer ${studentValue} is ~10^${oom > 0 ? oom : oom} times the expected value ${correctValue}. ` +
        `Check your calculation at ${coordLabel}.`;
    } else {
      feedback = `Incorrect. You answered ${studentValue}, but the verified answer is ${correctValue}. ` +
        `Review the solution at ${coordLabel}.`;
    }
  }

  return {
    question_id: question.question_id,
    classification,
    credit,
    student_value: studentValue,
    correct_value: correctValue,
    absolute_error: absDiff,
    relative_error: isFinite(relError) ? relError : null,
    student_unit: parsed.unit,
    expected_unit: question.expected_unit || null,
    unit_match: unitOk,
    tolerance_applied: tolerance,
    within_tolerance: withinTolerance,
    within_partial_tolerance: withinPartial,
    is_sign_error: errorInfo.is_sign_error,
    is_magnitude_error: errorInfo.is_magnitude_error,
    is_order_of_magnitude_error: errorInfo.is_order_of_magnitude_error,
    feedback,
    error_category: errorInfo.error_category,
  };
}

// =========================================================================
// 7. Question Verifiability Checker
// =========================================================================

/**
 * Verify that a generated numerical question has a valid, parseable correct answer.
 * Reject questions where the answer cannot be independently confirmed.
 *
 * Verification checks:
 * 1. correct_answer must be a finite number
 * 2. correct_answer_raw must be parseable to the same value
 * 3. If expected_unit is specified, it must be a recognized unit
 * 4. Question stem must reference a quantitative concept
 * 5. Tolerance must be well-formed
 *
 * @returns The verified question with updated verifiability status, or null if rejected
 */
export function verifyNumericalQuestion(
  question: NumericalQuestion
): { verified: NumericalQuestion | null; issues: string[] } {
  const issues: string[] = [];

  // 1. Check correct_answer is finite
  if (typeof question.correct_answer !== 'number' || !isFinite(question.correct_answer)) {
    issues.push(`correct_answer must be a finite number (got ${question.correct_answer})`);
  }

  // 2. Check correct_answer_raw is parseable
  if (question.correct_answer_raw) {
    const parsed = parseStudentAnswer(question.correct_answer_raw);
    if (parsed.value === null) {
      issues.push(`correct_answer_raw "${question.correct_answer_raw}" is not parseable`);
    } else if (question.correct_answer !== undefined && isFinite(question.correct_answer)) {
      // Check consistency: parsed raw should match correct_answer
      const diff = Math.abs(parsed.value - question.correct_answer);
      const threshold = Math.max(Math.abs(question.correct_answer) * 0.001, 1e-6);
      if (diff > threshold) {
        issues.push(`correct_answer_raw parses to ${parsed.value} but correct_answer is ${question.correct_answer}`);
      }
    }
  }

  // 3. Check unit recognition (if specified)
  if (question.expected_unit) {
    const normalized = normalizeUnit(question.expected_unit);
    // Unit is valid if it normalizes (we accept any unit, even unknown ones)
    if (!normalized || normalized.length === 0) {
      issues.push(`expected_unit "${question.expected_unit}" is empty after normalization`);
    }
  }

  // 4. Check question stem for quantitative concept
  const stem = question.question || '';
  if (stem.length < 15) {
    issues.push('Question stem too short (< 15 characters)');
  }
  const hasQuantitativeKeyword = /\b(calculate|compute|find|determine|value|how many|how much|what is the|measure|estimate|total|sum|average|rate|speed|velocity|force|energy|power|voltage|current|resistance|mass|weight|volume|area|distance|time|frequency|wavelength|pressure|temperature|density|concentration|percentage|ratio|proportion)\b/i.test(stem);
  if (!hasQuantitativeKeyword) {
    issues.push('Question stem lacks quantitative keywords (calculate, compute, find, etc.)');
  }

  // 5. Check tolerance is well-formed
  if (question.tolerance) {
    if (question.tolerance.value <= 0) {
      issues.push(`Tolerance value must be positive (got ${question.tolerance.value})`);
    }
    const validModes: ToleranceMode[] = ['EXACT', 'RELATIVE', 'ABSOLUTE', 'SIGNIFICANT_FIGURES'];
    if (!validModes.includes(question.tolerance.mode)) {
      issues.push(`Invalid tolerance mode: ${question.tolerance.mode}`);
    }
  }

  // 6. Check explanation
  if (!question.explanation || question.explanation.length < 10) {
    issues.push('Explanation is missing or too short (< 10 characters)');
  }

  // Determine verifiability
  if (issues.length > 0) {
    return {
      verified: null,
      issues,
    };
  }

  return {
    verified: {
      ...question,
      verifiability: 'VERIFIED',
    },
    issues: [],
  };
}

// =========================================================================
// 8. Batch Verification for Assessment Generation Pipeline
// =========================================================================

export interface BatchVerificationResult {
  verified: NumericalQuestion[];
  rejected: Array<{ question: NumericalQuestion; issues: string[] }>;
  totalGenerated: number;
  totalVerified: number;
  totalRejected: number;
}

/**
 * Verify a batch of generated numerical questions.
 * Only questions that pass verification are included in the output.
 * Rejected questions are logged with their specific issues.
 */
export function verifyNumericalQuestionBatch(
  questions: NumericalQuestion[]
): BatchVerificationResult {
  const verified: NumericalQuestion[] = [];
  const rejected: Array<{ question: NumericalQuestion; issues: string[] }> = [];

  for (const q of questions) {
    const result = verifyNumericalQuestion(q);
    if (result.verified) {
      verified.push(result.verified);
    } else {
      rejected.push({ question: q, issues: result.issues });
    }
  }

  return {
    verified,
    rejected,
    totalGenerated: questions.length,
    totalVerified: verified.length,
    totalRejected: rejected.length,
  };
}

// =========================================================================
// 9. Answer Normalization Utilities
// =========================================================================

/**
 * Normalize a correct_answer string from LLM output into a canonical numeric value.
 * Used during question generation to ensure the answer is well-formed before storage.
 */
export function normalizeCorrectAnswer(raw: string): {
  value: number | null;
  unit: string | null;
  raw: string;
  valid: boolean;
} {
  const parsed = parseStudentAnswer(raw);
  return {
    value: parsed.value,
    unit: parsed.unit,
    raw: raw.trim(),
    valid: parsed.value !== null && isFinite(parsed.value),
  };
}

/**
 * Compute a deterministic fingerprint for a numerical question
 * to prevent duplicate generation.
 */
export function computeNumericalFingerprint(
  question: string,
  correctAnswer: number,
  topic: string
): string {
  // Use a stable string hash combining question stem, answer, and topic
  const input = `${question.toLowerCase().trim()}|${correctAnswer}|${topic.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return `nq_${Math.abs(hash).toString(36)}`;
}
