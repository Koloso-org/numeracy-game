// Pure game logic for the number-property game.
//
// A round shows a 2- or 3-digit number and four "rules" (properties). At least
// one rule is true for the number; the player selects every rule they believe
// is true. Scoring (per round), applied on submit:
//   +1  for each TRUE rule the player selected
//   -1  for each FALSE rule the player selected
//   -1  for each TRUE rule the player missed (did not select)
//   (correctly leaving a false rule unselected scores 0)
//
// No React / React Native imports here so it can be unit-tested in isolation.

export interface Rule {
  id: string;
  label: string;
  /** Ground truth: does this rule actually hold for the round's number? */
  holds: boolean;
}

export interface Round {
  number: number;
  rules: Rule[];
}

/** Length of a full game, in seconds. */
export const GAME_SECONDS = 120;

// ----- Scoring ---------------------------------------------------------------

export function scoreRound(rules: Rule[], selected: Set<string>): number {
  let delta = 0;
  for (const rule of rules) {
    const picked = selected.has(rule.id);
    if (rule.holds && picked) delta += 1; // true, correctly selected
    else if (rule.holds && !picked) delta -= 1; // true, missed
    else if (!rule.holds && picked) delta -= 1; // false, wrongly selected
    // false & not picked -> 0
  }
  return delta;
}

/** Points won by a round, split into the plus points and the penalty points. */
export interface RoundScore {
  plus: number; // +1 for each true rule correctly selected
  minus: number; // 1 for each false rule picked, and each true rule missed
}

export function scoreBreakdown(rules: Rule[], selected: Set<string>): RoundScore {
  let plus = 0;
  let minus = 0;
  for (const rule of rules) {
    const picked = selected.has(rule.id);
    if (rule.holds && picked) plus += 1;
    else if (rule.holds && !picked) minus += 1;
    else if (!rule.holds && picked) minus += 1;
  }
  return { plus, minus };
}

// ----- Small maths helpers ---------------------------------------------------

/** Inclusive random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isPerfectSquare(n: number): boolean {
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

export function digitSum(n: number): number {
  return String(n)
    .split('')
    .reduce((s, d) => s + Number(d), 0);
}

// Characters used in labels (kept as constants so the test verifier can match).
const TIMES = '×'; // U+00D7
const MINUS = '−'; // U+2212

// ----- Rule factories --------------------------------------------------------
// Each factory tries to produce a rule whose truth equals `want`. It returns
// null if it cannot (e.g. "perfect square" can't be made true for a non-square).

type Built = { label: string; holds: boolean } | null;
interface Factory {
  type: string;
  make: (n: number, want: boolean) => Built;
}

const DIVISORS = [2, 3, 4, 5, 6, 9, 10];

const FACTORIES: Factory[] = [
  {
    type: 'divisible',
    make: (n, want) => {
      const candidates = DIVISORS.filter((k) => (n % k === 0) === want);
      if (candidates.length === 0) return null;
      const k = pick(candidates);
      const phrase = pick([`Divisible by ${k}`, `A multiple of ${k}`]);
      return { label: phrase, holds: want };
    },
  },
  {
    type: 'greater',
    make: (n, want) => {
      const x = want ? Math.max(1, n - randInt(1, 50)) : n + randInt(0, 50);
      return { label: `Greater than ${x}`, holds: want };
    },
  },
  {
    type: 'less',
    make: (n, want) => {
      const x = want ? n + randInt(1, 50) : Math.max(1, n - randInt(0, 50));
      return { label: `Less than ${x}`, holds: want };
    },
  },
  {
    type: 'between',
    make: (n, want) => {
      if (want) {
        const lo = Math.max(1, n - randInt(1, 40));
        const hi = n + randInt(1, 40);
        return { label: `Between ${lo} and ${hi}`, holds: true };
      }
      // A range that does NOT contain n, either entirely below or above it.
      if (randInt(0, 1) === 0) {
        const hi = n - randInt(1, 20);
        const lo = hi - randInt(3, 30);
        if (lo < 1 || hi < 1) return null;
        return { label: `Between ${lo} and ${hi}`, holds: false };
      }
      const lo = n + randInt(1, 20);
      const hi = lo + randInt(3, 30);
      return { label: `Between ${lo} and ${hi}`, holds: false };
    },
  },
  {
    type: 'sum',
    make: (n, want) => {
      let target = n;
      if (!want) {
        target = n + pick([-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        if (target < 2) target = n + randInt(1, 9);
      }
      const a = randInt(1, target - 1);
      const b = target - a;
      return { label: `Equal to ${a} + ${b}`, holds: want };
    },
  },
  {
    type: 'product',
    make: (n, want) => {
      if (want) {
        const pairs: [number, number][] = [];
        for (let a = 2; a * a <= n; a += 1) {
          if (n % a === 0 && n / a >= 2) pairs.push([a, n / a]);
        }
        if (pairs.length === 0) return null;
        const [a, b] = pick(pairs);
        return { label: `Equal to ${a} ${TIMES} ${b}`, holds: true };
      }
      const a = randInt(2, 12);
      let b = Math.max(2, Math.round(n / a));
      if (a * b === n) b += 1;
      return { label: `Equal to ${a} ${TIMES} ${b}`, holds: false };
    },
  },
  {
    type: 'diff',
    make: (n, want) => {
      let target = n;
      if (!want) {
        target = n + pick([-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        if (target < 1) target = n + randInt(1, 9);
      }
      const b = randInt(1, 30);
      const a = target + b;
      return { label: `Equal to ${a} ${MINUS} ${b}`, holds: want };
    },
  },
  {
    type: 'ends',
    make: (n, want) => {
      const last = n % 10;
      if (want) return { label: `Ends in ${last}`, holds: true };
      let d = randInt(0, 9);
      while (d === last) d = randInt(0, 9);
      return { label: `Ends in ${d}`, holds: false };
    },
  },
  {
    type: 'digitsum',
    make: (n, want) => {
      const s = digitSum(n);
      if (want) return { label: `Digits add up to ${s}`, holds: true };
      let wrong = s + pick([-3, -2, -1, 1, 2, 3]);
      if (wrong < 1) wrong = s + randInt(1, 3);
      return { label: `Digits add up to ${wrong}`, holds: false };
    },
  },
  {
    type: 'ndigits',
    make: (n, want) => {
      const isThree = n >= 100;
      // A true rule states the real digit-count; a false rule states the other.
      const stateThree = want ? isThree : !isThree;
      return {
        label: stateThree ? 'A 3-digit number' : 'A 2-digit number',
        holds: want,
      };
    },
  },
  {
    type: 'parity',
    make: (n, want) => {
      const even = n % 2 === 0;
      const stateEven = want ? even : !even;
      return { label: stateEven ? 'An even number' : 'An odd number', holds: want };
    },
  },
  {
    type: 'square',
    make: (n, want) => {
      if (isPerfectSquare(n) !== want) return null;
      return { label: 'A perfect square', holds: want };
    },
  },
  {
    // "Square root of X" — is the shown number the square root of X? (n² === X)
    // Only offered for small numbers so squaring stays mental-maths friendly.
    type: 'sqrtof',
    make: (n, want) => {
      if (n < 2 || n > 31) return null;
      if (want) return { label: `Square root of ${n * n}`, holds: true };
      // A neighbouring square makes a fair "false" (√ of it isn't n).
      let m = n + pick([-3, -2, -1, 1, 2, 3]);
      if (m < 2) m = n + randInt(1, 3);
      return { label: `Square root of ${m * m}`, holds: false };
    },
  },
  {
    // "A factor of Y" — does the shown number divide Y exactly? (Y % n === 0)
    type: 'factorof',
    make: (n, want) => {
      if (n < 2 || n > 300) return null;
      if (want) {
        const maxK = Math.floor(999 / n);
        if (maxK < 2) return null;
        const y = n * randInt(2, maxK);
        return { label: `A factor of ${y}`, holds: true };
      }
      // A multiple-of-n plus a non-zero remainder is guaranteed not divisible.
      const base = n * randInt(1, Math.max(1, Math.floor(980 / n)));
      const y = base + randInt(1, n - 1);
      return { label: `A factor of ${y}`, holds: false };
    },
  },
];

// ----- Round generation ------------------------------------------------------

function buildOne(
  n: number,
  want: boolean,
  usedTypes: Set<string>,
  usedLabels: Set<string>,
): { label: string; holds: boolean } {
  const order = shuffle(FACTORIES);
  // First choice: a rule type we haven't used yet this round.
  for (const f of order) {
    if (usedTypes.has(f.type)) continue;
    const r = f.make(n, want);
    if (r && !usedLabels.has(r.label)) {
      usedTypes.add(f.type);
      return r;
    }
  }
  // Second choice: allow reusing a type (different parameters).
  for (const f of order) {
    const r = f.make(n, want);
    if (r && !usedLabels.has(r.label)) return r;
  }
  // Guaranteed fallback: "Greater than X" can always be made true or false.
  for (let off = 1; off < 60; off += 1) {
    const x = want ? n - off : n + off;
    const label = `Greater than ${x}`;
    if (x >= 1 && !usedLabels.has(label)) return { label, holds: want };
  }
  return { label: `Greater than ${want ? 0 : 999}`, holds: want };
}

export function generateRound(): Round {
  const n = randInt(10, 999);
  // Weighted number of true rules — usually 1–3, occasionally all 4.
  const trueCount = pick([1, 1, 2, 2, 2, 3, 3, 4]);
  const wants = shuffle([
    ...Array(trueCount).fill(true),
    ...Array(4 - trueCount).fill(false),
  ]) as boolean[];

  const usedTypes = new Set<string>();
  const usedLabels = new Set<string>();
  const rules: Rule[] = wants.map((want, i) => {
    const built = buildOne(n, want, usedTypes, usedLabels);
    usedLabels.add(built.label);
    return { id: `r${i}`, label: built.label, holds: built.holds };
  });

  // Shuffle display order and re-key ids so position doesn't leak the answer.
  return {
    number: n,
    rules: shuffle(rules).map((r, i) => ({ ...r, id: `r${i}` })),
  };
}
