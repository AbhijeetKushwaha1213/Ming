/**
 * Canonical Phase 4 — Assessment Data Contracts
 * 
 * Defines server-authoritative types for:
 * 1. NumericalQuestion: Generated numerical questions with verifiability metadata
 * 2. NumericalAnswer: Student answer submission with raw value preservation
 * 3. NumericalGradingResult: Deterministic grading output with tolerance and unit handling
 * 4. TolerancePolicy: Configurable tolerance bands for numerical answer verification
 * 5. UnitNormalization: Canonical unit equivalence mapping
 * 6. VerifiabilityStatus: Whether a generated question passes server-side independent verification
 *
 * ZERO-TRUST BOUNDARY:
 * - The LLM must NEVER sit in the critical grading path.
 * - All numerical grading is deterministic, server-authoritative.
 * - No eval(), Function(), or dynamic code execution.
 * - If a generated question cannot be independently verified → reject it.
 */

import type { SourceType, ExtractionMethod } from './ingestionTypes.ts';

// =========================================================================
// Tolerance Policies
// =========================================================================

/**
 * Tolerance mode for numerical answer verification.
 * - EXACT: Must match within floating-point epsilon (1e-9)
 * - RELATIVE: Within a percentage of the correct answer (default 3%)
 * - ABSOLUTE: Within a fixed absolute difference
 * - SIGNIFICANT_FIGURES: Correct to N significant figures
 */
export type ToleranceMode = 'EXACT' | 'RELATIVE' | 'ABSOLUTE' | 'SIGNIFICANT_FIGURES';

export interface TolerancePolicy {
  mode: ToleranceMode;
  /** For RELATIVE: fraction (e.g. 0.03 = 3%). For ABSOLUTE: max absolute diff. For SIG_FIGS: number of sig figs. */
  value: number;
  /** Secondary absolute floor to prevent zero-crossing issues with relative tolerance */
  absoluteFloor?: number;
}

/** Default tolerance: 3% relative with 0.01 absolute floor */
export const DEFAULT_TOLERANCE: TolerancePolicy = {
  mode: 'RELATIVE',
  value: 0.03,
  absoluteFloor: 0.01,
};

/** Partial-credit tolerance: 10% relative with 0.05 absolute floor */
export const PARTIAL_TOLERANCE: TolerancePolicy = {
  mode: 'RELATIVE',
  value: 0.10,
  absoluteFloor: 0.05,
};

// =========================================================================
// Unit Normalization
// =========================================================================

/**
 * Canonical unit equivalence groups. Each group maps variant spellings/symbols
 * to a canonical unit name. Used for pre-grading normalization.
 */
export interface UnitEquivalence {
  canonical: string;
  variants: string[];
}

export const UNIT_EQUIVALENCES: UnitEquivalence[] = [
  { canonical: 'kg', variants: ['kilogram', 'kilograms', 'kgs', 'kg.'] },
  { canonical: 'g', variants: ['gram', 'grams', 'gm', 'gms'] },
  { canonical: 'm', variants: ['meter', 'meters', 'metre', 'metres'] },
  { canonical: 'cm', variants: ['centimeter', 'centimeters', 'centimetre', 'centimetres'] },
  { canonical: 'mm', variants: ['millimeter', 'millimeters', 'millimetre', 'millimetres'] },
  { canonical: 'km', variants: ['kilometer', 'kilometers', 'kilometre', 'kilometres'] },
  { canonical: 's', variants: ['sec', 'secs', 'second', 'seconds'] },
  { canonical: 'ms', variants: ['millisecond', 'milliseconds', 'msec', 'msecs'] },
  { canonical: 'min', variants: ['minute', 'minutes', 'mins'] },
  { canonical: 'hr', variants: ['hour', 'hours', 'hrs', 'h'] },
  { canonical: 'J', variants: ['joule', 'joules'] },
  { canonical: 'kJ', variants: ['kilojoule', 'kilojoules'] },
  { canonical: 'W', variants: ['watt', 'watts'] },
  { canonical: 'kW', variants: ['kilowatt', 'kilowatts'] },
  { canonical: 'V', variants: ['volt', 'volts'] },
  { canonical: 'A', variants: ['amp', 'amps', 'ampere', 'amperes'] },
  { canonical: 'Ω', variants: ['ohm', 'ohms', 'omega'] },
  { canonical: 'Hz', variants: ['hertz'] },
  { canonical: 'N', variants: ['newton', 'newtons'] },
  { canonical: 'Pa', variants: ['pascal', 'pascals'] },
  { canonical: 'mol', variants: ['mole', 'moles'] },
  { canonical: 'L', variants: ['liter', 'liters', 'litre', 'litres'] },
  { canonical: 'mL', variants: ['milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  { canonical: '%', variants: ['percent', 'percentage', 'pct'] },
  { canonical: '°C', variants: ['celsius', 'degrees celsius', 'deg c', '°c', 'degc'] },
  { canonical: '°F', variants: ['fahrenheit', 'degrees fahrenheit', 'deg f', '°f', 'degf'] },
  { canonical: 'K', variants: ['kelvin'] },
  { canonical: 'rad', variants: ['radian', 'radians'] },
  { canonical: '°', variants: ['degree', 'degrees', 'deg'] },
  { canonical: 'bit', variants: ['bits'] },
  { canonical: 'byte', variants: ['bytes', 'B'] },
  { canonical: 'KB', variants: ['kilobyte', 'kilobytes', 'kbyte'] },
  { canonical: 'MB', variants: ['megabyte', 'megabytes', 'mbyte'] },
  { canonical: 'GB', variants: ['gigabyte', 'gigabytes', 'gbyte'] },
];

// =========================================================================
// Verifiability Status
// =========================================================================

/**
 * Whether a generated numerical question has been independently verified
 * by the server-side verifier before being presented to a student.
 */
export type VerifiabilityStatus =
  | 'VERIFIED'         // Answer independently verified by server computation
  | 'SELF_CONSISTENT'  // Answer matches a restated/extracted value from source
  | 'REJECTED'         // Could not verify — question suppressed
  | 'PENDING';         // Not yet verified

// =========================================================================
// Numerical Question
// =========================================================================

export interface NumericalQuestion {
  question_id: string;
  assessment_id?: string;
  type: 'NUMERICAL';
  topic: string;
  subtopic?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  
  // Source provenance (from Phase 2 ingestion)
  source_id?: string | null;
  chunk_id?: string | null;
  page_number?: number | null;
  slide_number?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  
  // Question content
  question: string;
  correct_answer: number;
  correct_answer_raw: string;     // Original string form before parsing
  expected_unit?: string | null;  // Canonical unit (e.g. 'kg', 'm/s')
  
  // Verification metadata
  tolerance: TolerancePolicy;
  verifiability: VerifiabilityStatus;
  verification_method?: string;   // How it was verified (e.g. 'source_extraction', 'formula_recomputation')
  
  // Explanation and fingerprinting
  explanation: string;
  fingerprint?: string;
  normalized_question?: string;
}

// =========================================================================
// Numerical Answer Submission
// =========================================================================

export interface NumericalAnswerSubmission {
  question_id: string;
  raw_answer: string;       // Exact student input as typed
  parsed_value?: number;    // Server-parsed numeric value
  parsed_unit?: string;     // Server-parsed unit
}

// =========================================================================
// Numerical Grading Result
// =========================================================================

export type NumericalGradeClassification = 'correct' | 'partially_correct' | 'incorrect' | 'invalid_format';

export interface NumericalGradingResult {
  question_id: string;
  classification: NumericalGradeClassification;
  credit: number;  // 1.0, 0.5, 0.0
  
  // Values
  student_value: number | null;
  correct_value: number;
  absolute_error: number | null;
  relative_error: number | null;
  
  // Unit handling
  student_unit: string | null;
  expected_unit: string | null;
  unit_match: boolean;
  
  // Tolerance
  tolerance_applied: TolerancePolicy;
  within_tolerance: boolean;
  within_partial_tolerance: boolean;
  
  // Sign error detection
  is_sign_error: boolean;
  is_magnitude_error: boolean;
  is_order_of_magnitude_error: boolean;
  
  // Feedback
  feedback: string;
  error_category?: 'SIGN_ERROR' | 'ROUNDING_ERROR' | 'ORDER_OF_MAGNITUDE' | 'UNIT_MISMATCH' | 'FORMULA_ERROR' | 'PARSE_ERROR' | 'NONE';
}

// =========================================================================
// Safe Expression Evaluation Types
// =========================================================================

/**
 * Parsed numeric expression token for the safe evaluator.
 * Only supports: numbers, +, -, *, /, ^, (, ), unary minus.
 * NO function calls, NO variable lookups, NO dynamic code.
 */
export type TokenType =
  | 'NUMBER'
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'POWER'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: number | null;
}
