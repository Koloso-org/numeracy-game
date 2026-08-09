// Pure game logic for "Number Blitz" — a beat-the-clock mental-maths sprint.
// No React / React Native imports here so it can be unit-tested in isolation.

export type Operation = '+' | '-' | '×' | '÷';

export interface Question {
  /** Display string, e.g. "7 × 8". */
  prompt: string;
  answer: number;
  /** Four multiple-choice options including the correct answer, shuffled. */
  options: number[];
}

// ----- Tunable game settings -------------------------------------------------

/** Seconds on the clock at the start of a run. */
export const START_TIME = 30;
/** Seconds added to the clock for a correct answer. */
export const TIME_BONUS = 1.5;
/** Seconds removed from the clock for a wrong answer. */
export const TIME_PENALTY = 3;
/** Base points for a correct answer, before the combo multiplier. */
export const BASE_POINTS = 5;
/** Highest combo multiplier the player can reach. */
export const MAX_MULTIPLIER = 5;

/** Combo multiplier grows by 1 every this-many answers in a streak. */
const COMBO_STEP = 3;

// ----- Helpers ---------------------------------------------------------------

/** Inclusive random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** The score multiplier for a given combo (consecutive correct answers). */
export function multiplierForCombo(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));
}

/** Build four distinct, plausible multiple-choice options around the answer. */
export function buildOptions(answer: number): number[] {
  const options = new Set<number>([answer]);
  const spread = Math.max(3, Math.round(Math.abs(answer) * 0.25));
  let guard = 0;
  while (options.size < 4 && guard < 60) {
    guard += 1;
    const distractor = answer + randInt(-spread, spread);
    if (distractor >= 0 && distractor !== answer) options.add(distractor);
  }
  // Fallback if we couldn't find enough non-negative distractors.
  let filler = answer + 1;
  while (options.size < 4) {
    if (!options.has(filler)) options.add(filler);
    filler += 1;
  }
  return shuffle([...options]);
}

/**
 * Generate a question whose difficulty scales with how many the player has
 * already answered correctly this run. This keeps a single run interesting
 * across the whole 8–14 age range: gentle at first, tougher as the streak grows.
 */
export function generateQuestion(correctSoFar: number): Question {
  const tier = Math.min(3, Math.floor(correctSoFar / 5)); // 0,1,2,3
  const ops: Operation[] =
    tier === 0
      ? ['+', '-']
      : tier === 1
        ? ['+', '-', '×']
        : ['+', '-', '×', '÷'];
  const op = ops[randInt(0, ops.length - 1)];

  let a: number;
  let b: number;
  let answer: number;

  switch (op) {
    case '+': {
      const max = [12, 20, 50, 99][tier];
      a = randInt(1, max);
      b = randInt(1, max);
      answer = a + b;
      break;
    }
    case '-': {
      const max = [12, 20, 50, 99][tier];
      a = randInt(1, max);
      b = randInt(1, a); // keep the result non-negative
      answer = a - b;
      break;
    }
    case '×': {
      const max = [5, 10, 12, 12][tier];
      a = randInt(2, max);
      b = randInt(2, max);
      answer = a * b;
      break;
    }
    case '÷': {
      // Build from an exact division so the answer is always a whole number.
      const divisor = randInt(2, 12);
      const quotient = randInt(2, 12);
      a = divisor * quotient;
      b = divisor;
      answer = quotient;
      break;
    }
  }

  return { prompt: `${a} ${op} ${b}`, answer, options: buildOptions(answer) };
}
