// Koloso Challenge — question bank and answer checking.
//
// A game shows 10 questions from the chosen level; the player answers or skips
// each. Score = number correct (0–10); ties on the leaderboard break on time.
//
// Every answer here is independently re-derived in challenge.verify.ts.

export type Level = 'beginner' | 'expert';
export type QType = 'mc' | 'entry';

/** Optional diagram drawn above the prompt. All are pure geometry so the
 *  correct answer is computable from these fields (see the verifier). */
export type Visual =
  | { kind: 'rectangle'; w: number; h: number; measure: 'area' | 'perimeter'; unit: string }
  | { kind: 'coordinate'; size: number; point: [number, number] }
  | { kind: 'net'; grid: string[]; solid: string };

export interface Question {
  id: string;
  level: Level;
  topic: string;
  prompt: string;
  type: QType;
  /** Options for multiple-choice (must include the correct answer). */
  options?: string[];
  /** Canonical correct answer, as displayed. */
  answer: string;
  /** Extra accepted spellings for typed answers (compared after normalising). */
  accept?: string[];
  /** Short unit hint shown next to the entry box, e.g. "cm²". */
  unit?: string;
  visual?: Visual;
}

// Cross-shaped cube net (six equal squares) used by the "net" visual.
const CUBE_NET = ['.#..', '####', '.#..'];

const BEGINNER: Question[] = [
  // Multiple choice
  { id: 'b1', level: 'beginner', topic: 'fractions', type: 'mc',
    prompt: 'What is 3/4 of 20?', options: ['15', '16', '12', '24'], answer: '15' },
  { id: 'b2', level: 'beginner', topic: 'multiples', type: 'mc',
    prompt: 'Which of these is a multiple of 6?', options: ['24', '14', '20', '32'], answer: '24' },
  { id: 'b3', level: 'beginner', topic: 'rounding', type: 'mc',
    prompt: 'Round 486 to the nearest 100.', options: ['500', '400', '480', '490'], answer: '500' },
  { id: 'b4', level: 'beginner', topic: 'percentages', type: 'mc',
    prompt: 'What is 25% of 80?', options: ['20', '25', '40', '16'], answer: '20' },
  { id: 'b5', level: 'beginner', topic: 'shapes', type: 'mc',
    prompt: 'How many sides does a pentagon have?', options: ['5', '6', '4', '8'], answer: '5' },
  { id: 'b6', level: 'beginner', topic: 'place value', type: 'mc',
    prompt: 'In 4,732 what is the value of the 7?', options: ['700', '70', '7', '7000'], answer: '700' },
  { id: 'b7', level: 'beginner', topic: 'decimals', type: 'mc',
    prompt: 'Which decimal is the largest?', options: ['0.7', '0.65', '0.09', '0.58'], answer: '0.7' },
  { id: 'b8', level: 'beginner', topic: 'factors', type: 'mc',
    prompt: 'Which of these is a factor of 24?', options: ['8', '5', '7', '9'], answer: '8' },

  // Typed entry
  { id: 'b9', level: 'beginner', topic: 'times tables', type: 'entry',
    prompt: '8 × 7 = ?', answer: '56' },
  { id: 'b10', level: 'beginner', topic: 'division', type: 'entry',
    prompt: '144 ÷ 12 = ?', answer: '12' },
  { id: 'b11', level: 'beginner', topic: 'addition', type: 'entry',
    prompt: '367 + 248 = ?', answer: '615' },
  { id: 'b12', level: 'beginner', topic: 'fractions', type: 'mc',
    prompt: 'What is 1/4 + 1/2?', options: ['3/4', '2/6', '1/6', '1/2'], answer: '3/4' },
  { id: 'b13', level: 'beginner', topic: 'time', type: 'entry',
    prompt: 'How many minutes are there in 2½ hours?', answer: '150' },
  { id: 'b14', level: 'beginner', topic: 'doubling', type: 'entry',
    prompt: 'What is double 68?', answer: '136' },
  { id: 'b15', level: 'beginner', topic: 'halving', type: 'entry',
    prompt: 'What is half of 250?', answer: '125' },

  // Visual
  { id: 'b16', level: 'beginner', topic: 'area', type: 'entry', unit: 'cm²',
    prompt: 'Find the area of this rectangle.', answer: '40',
    visual: { kind: 'rectangle', w: 8, h: 5, measure: 'area', unit: 'cm' } },
  { id: 'b17', level: 'beginner', topic: 'perimeter', type: 'entry', unit: 'cm',
    prompt: 'Find the perimeter of this rectangle.', answer: '26',
    visual: { kind: 'rectangle', w: 9, h: 4, measure: 'perimeter', unit: 'cm' } },
  { id: 'b18', level: 'beginner', topic: 'coordinates', type: 'mc',
    prompt: 'Which are the coordinates of the point?',
    options: ['(3,2)', '(2,3)', '(3,3)', '(2,2)'], answer: '(3,2)',
    visual: { kind: 'coordinate', size: 6, point: [3, 2] } },
  { id: 'b19', level: 'beginner', topic: 'nets', type: 'mc',
    prompt: 'Which 3D shape does this net fold into?',
    options: ['Cube', 'Cuboid', 'Cylinder', 'Cone'], answer: 'Cube',
    visual: { kind: 'net', grid: CUBE_NET, solid: 'Cube' } },
];

const EXPERT: Question[] = [
  // Multiple choice
  { id: 'e1', level: 'expert', topic: 'powers', type: 'mc',
    prompt: 'What is 2⁶?', options: ['64', '32', '128', '12'], answer: '64' },
  { id: 'e2', level: 'expert', topic: 'algebra', type: 'mc',
    prompt: 'Expand 3(x + 4).', options: ['3x + 12', '3x + 4', 'x + 12', '3x + 7'], answer: '3x + 12' },
  { id: 'e3', level: 'expert', topic: 'roots', type: 'mc',
    prompt: 'What is √196?', options: ['14', '16', '13', '12'], answer: '14' },
  { id: 'e4', level: 'expert', topic: 'primes', type: 'mc',
    prompt: 'Which of these is a prime number?', options: ['61', '51', '57', '69'], answer: '61' },
  { id: 'e5', level: 'expert', topic: 'percentages', type: 'mc',
    prompt: 'What is 15% of 240?', options: ['36', '30', '40', '45'], answer: '36' },
  { id: 'e6', level: 'expert', topic: 'sequences', type: 'mc',
    prompt: 'What comes next: 2, 6, 18, 54, …?', options: ['162', '108', '216', '150'], answer: '162' },
  { id: 'e7', level: 'expert', topic: 'fractions', type: 'mc',
    prompt: 'What is 3/8 as a decimal?', options: ['0.375', '0.38', '0.3', '0.125'], answer: '0.375' },
  { id: 'e8', level: 'expert', topic: 'angles', type: 'mc',
    prompt: 'The interior angles of a triangle add up to…', options: ['180°', '360°', '90°', '270°'], answer: '180°' },

  // Typed entry
  { id: 'e9', level: 'expert', topic: 'powers', type: 'entry',
    prompt: 'What is 7³?', answer: '343' },
  { id: 'e10', level: 'expert', topic: 'algebra', type: 'entry',
    prompt: 'Solve for x:  x + 17 = 45', answer: '28' },
  { id: 'e11', level: 'expert', topic: 'algebra', type: 'entry',
    prompt: 'Solve for x:  4x = 52', answer: '13' },
  { id: 'e12', level: 'expert', topic: 'powers', type: 'entry',
    prompt: '12 × 12 × 12 = ?', answer: '1728' },
  { id: 'e13', level: 'expert', topic: 'fractions', type: 'entry',
    prompt: 'What is 3/5 of 200?', answer: '120' },
  { id: 'e14', level: 'expert', topic: 'squares', type: 'entry',
    prompt: 'What is 39²?', answer: '1521' },
  { id: 'e15', level: 'expert', topic: 'area', type: 'entry', unit: 'cm²',
    prompt: 'A triangle has base 10 cm and height 6 cm. What is its area?', answer: '30' },

  // Visual
  { id: 'e16', level: 'expert', topic: 'area', type: 'entry', unit: 'cm²',
    prompt: 'Find the area of this rectangle.', answer: '78',
    visual: { kind: 'rectangle', w: 13, h: 6, measure: 'area', unit: 'cm' } },
  { id: 'e17', level: 'expert', topic: 'perimeter', type: 'entry', unit: 'cm',
    prompt: 'Find the perimeter of this rectangle.', answer: '48',
    visual: { kind: 'rectangle', w: 15, h: 9, measure: 'perimeter', unit: 'cm' } },
  { id: 'e18', level: 'expert', topic: 'coordinates', type: 'mc',
    prompt: 'Which are the coordinates of the point?',
    options: ['(5,7)', '(7,5)', '(5,5)', '(7,7)'], answer: '(5,7)',
    visual: { kind: 'coordinate', size: 8, point: [5, 7] } },
  { id: 'e19', level: 'expert', topic: 'nets', type: 'mc',
    prompt: 'How many faces does the solid made from this net have?',
    options: ['6', '4', '8', '5'], answer: '6',
    visual: { kind: 'net', grid: CUBE_NET, solid: 'Cube' } },
];

export const BANK: Record<Level, Question[]> = { beginner: BEGINNER, expert: EXPERT };

/** Normalise a typed answer for comparison: lowercase, drop spaces, brackets,
 *  trailing units, and unify the fraction slash. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .replace(/[°]/g, '')
    .replace(/(cm2|cm²|cm|units?)$/g, '');
}

export function isCorrect(q: Question, given: string): boolean {
  if (q.type === 'mc') return given === q.answer;
  const g = normalise(given);
  if (g.length === 0) return false;
  const accepted = [q.answer, ...(q.accept ?? [])].map(normalise);
  return accepted.includes(g);
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw `count` questions from a level, shuffled, without repeats in one game.
 *  Multiple-choice options are also shuffled so the correct answer isn't
 *  always in the same position. */
export function pickQuestions(level: Level, count: number, rand: () => number): Question[] {
  const chosen = shuffled(BANK[level], rand).slice(0, Math.min(count, BANK[level].length));
  return chosen.map((q) =>
    q.type === 'mc' && q.options ? { ...q, options: shuffled(q.options, rand) } : q,
  );
}
