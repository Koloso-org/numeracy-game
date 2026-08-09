// Pure game logic for the numeracy game.
// Kept free of React/React Native so it can be unit-tested in isolation.

export type Operation = '+' | '-' | '×';

export interface Question {
  a: number;
  b: number;
  op: Operation;
  answer: number;
  /** Multiple-choice options including the correct answer, shuffled. */
  options: number[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  maxOperand: number;
  operations: Operation[];
}

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { maxOperand: 10, operations: ['+', '-'] },
  medium: { maxOperand: 20, operations: ['+', '-', '×'] },
  hard: { maxOperand: 50, operations: ['+', '-', '×'] },
};

/** Inclusive random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function compute(a: number, b: number, op: Operation): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
  }
}

/** Build a set of 4 plausible, distinct multiple-choice options. */
export function buildOptions(answer: number): number[] {
  const options = new Set<number>([answer]);
  let guard = 0;
  while (options.size < 4 && guard < 50) {
    guard += 1;
    const spread = Math.max(3, Math.round(Math.abs(answer) * 0.25));
    const distractor = answer + randInt(-spread, spread);
    if (distractor !== answer) {
      options.add(distractor);
    }
  }
  // Fallback in the rare case the loop couldn't find enough distractors.
  let filler = answer + 1;
  while (options.size < 4) {
    if (!options.has(filler)) options.add(filler);
    filler += 1;
  }
  return shuffle([...options]);
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

/** Generate a single question for the given difficulty. */
export function generateQuestion(difficulty: Difficulty): Question {
  const { maxOperand, operations } = DIFFICULTY[difficulty];
  const op = operations[randInt(0, operations.length - 1)];

  let a = randInt(1, maxOperand);
  let b = randInt(1, maxOperand);

  // Keep subtraction results non-negative for young learners.
  if (op === '-' && b > a) {
    [a, b] = [b, a];
  }
  // Keep multiplication approachable regardless of difficulty ceiling.
  if (op === '×') {
    a = randInt(2, 12);
    b = randInt(2, 12);
  }

  const answer = compute(a, b, op);
  return { a, b, op, answer, options: buildOptions(answer) };
}

export const POINTS_PER_CORRECT = 10;
export const ROUND_LENGTH = 10; // questions per round
