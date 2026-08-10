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

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

export function isPerfectCube(n: number): boolean {
  const r = Math.round(Math.cbrt(n));
  return r * r * r === n;
}

const ROMAN_MAP: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
  [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'],
  [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Whole number (1–3999) to its Roman numeral, e.g. 147 -> "CXLVII". */
export function toRoman(num: number): string {
  let n = num;
  let out = '';
  for (const [v, s] of ROMAN_MAP) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
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
  {
    // Percentage comparison: "The same as / More than / Less than X% of Y".
    // X% of Y is always a whole number here (Y is a multiple of 20).
    type: 'percentof',
    make: (n, want) => {
      const NICE_X = [5, 10, 20, 25, 50, 75];
      const comp = pick(['same', 'more', 'less']);
      if (comp === 'same') {
        if (want) {
          // Need X% of Y = n exactly, with Y a sensible whole number.
          const opts = NICE_X.filter((x) => (100 * n) % x === 0 && (100 * n) / x <= 500);
          if (opts.length === 0) return null;
          const x = pick(opts);
          return { label: `The same as ${x}% of ${(100 * n) / x}`, holds: true };
        }
        const y = 20 * randInt(1, 20);
        const x = pick(NICE_X);
        if ((x * y) / 100 === n) return null;
        return { label: `The same as ${x}% of ${y}`, holds: false };
      }
      for (let i = 0; i < 40; i += 1) {
        const y = 20 * randInt(1, 20);
        const x = pick(NICE_X);
        const target = (x * y) / 100;
        const holds = comp === 'more' ? n > target : n < target;
        if (holds === want) {
          const word = comp === 'more' ? 'More than' : 'Less than';
          return { label: `${word} ${x}% of ${y}`, holds: want };
        }
      }
      return null;
    },
  },
  {
    // Fraction comparison: "Equal to / More than / Less than A/B of Z".
    // A/B of Z is always a whole number here (Z is a multiple of B).
    type: 'fractionof',
    make: (n, want) => {
      const FRACS: [number, number][] = [
        [1, 2], [1, 3], [2, 3], [1, 4], [3, 4],
        [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10],
      ];
      const comp = pick(['equal', 'more', 'less']);
      if (comp === 'equal') {
        if (want) {
          // Need A/B of Z = n exactly → Z = n*B/A, a sensible whole number.
          const opts = FRACS.filter(
            ([a, b]) => (n * b) % a === 0 && (n * b) / a <= 600 && (n * b) / a >= b,
          );
          if (opts.length === 0) return null;
          const [a, b] = pick(opts);
          return { label: `Equal to ${a}/${b} of ${(n * b) / a}`, holds: true };
        }
        const [a, b] = pick(FRACS);
        const z = b * randInt(2, 30);
        if ((a * z) / b === n) return null;
        return { label: `Equal to ${a}/${b} of ${z}`, holds: false };
      }
      for (let i = 0; i < 40; i += 1) {
        const [a, b] = pick(FRACS);
        const z = b * randInt(2, 30);
        const target = (a * z) / b;
        const holds = comp === 'more' ? n > target : n < target;
        if (holds === want) {
          const word = comp === 'more' ? 'More than' : 'Less than';
          return { label: `${word} ${a}/${b} of ${z}`, holds: want };
        }
      }
      return null;
    },
  },
  {
    // Weights & measures — mass: "... Y packets of Z kg each" (target = Y × Z).
    type: 'masspackets',
    make: (n, want) => {
      const comp = pick(['same', 'more', 'less']);
      if (comp === 'same') {
        if (want) {
          const pairs: [number, number][] = [];
          for (let y = 2; y <= 12; y += 1) {
            if (n % y === 0 && n / y >= 2 && n / y <= 20) pairs.push([y, n / y]);
          }
          if (pairs.length === 0) return null;
          const [y, z] = pick(pairs);
          return { label: `The same as ${y} packets of ${z} kg each`, holds: true };
        }
        const y = randInt(2, 12);
        const z = randInt(2, 20);
        if (y * z === n) return null;
        return { label: `The same as ${y} packets of ${z} kg each`, holds: false };
      }
      for (let i = 0; i < 40; i += 1) {
        const y = randInt(2, 12);
        const z = randInt(2, 20);
        const target = y * z;
        const holds = comp === 'more' ? n > target : n < target;
        if (holds === want) {
          const word = comp === 'more' ? 'More than' : 'Less than';
          return { label: `${word} ${y} packets of ${z} kg each`, holds: want };
        }
      }
      return null;
    },
  },
  {
    // Weights & measures — length: "... M m minus Z cm" (target = M×100 − Z cm).
    type: 'lengthcm',
    make: (n, want) => {
      const comp = pick(['same', 'more', 'less']);
      // k is tenths of a metre (10 → 1.0 m); shown with no trailing ".0".
      const fmt = (k: number) => (k % 10 === 0 ? String(k / 10) : (k / 10).toFixed(1));
      if (comp === 'same') {
        if (want) {
          const opts: [number, number][] = [];
          for (let k = 10; k <= 30; k += 1) {
            const z = 10 * k - n;
            if (z >= 5 && z <= 90) opts.push([k, z]);
          }
          if (opts.length === 0) return null;
          const [k, z] = pick(opts);
          return { label: `The same as ${fmt(k)} m minus ${z} cm`, holds: true };
        }
        const k = randInt(10, 30);
        const z = randInt(5, 90);
        if (10 * k - z === n) return null;
        return { label: `The same as ${fmt(k)} m minus ${z} cm`, holds: false };
      }
      for (let i = 0; i < 40; i += 1) {
        const k = randInt(10, 30);
        const z = randInt(5, 90);
        const target = 10 * k - z;
        const holds = comp === 'more' ? n > target : n < target;
        if (holds === want) {
          const word = comp === 'more' ? 'More than' : 'Less than';
          return { label: `${word} ${fmt(k)} m minus ${z} cm`, holds: want };
        }
      }
      return null;
    },
  },
  {
    // "Rounds to X to the nearest 10." True X is the actual rounding; a false
    // one is a different, nearby multiple of 10. (Halves round up, as taught.)
    type: 'roundten',
    make: (n, want) => {
      const correct = Math.round(n / 10) * 10;
      if (want) return { label: `Rounds to ${correct} to the nearest 10`, holds: true };
      const x = correct + pick([-20, -10, 10, 20]);
      if (x < 10 || x === correct) return null;
      return { label: `Rounds to ${x} to the nearest 10`, holds: false };
    },
  },
  {
    // "Rounds to X to the nearest 100." Skipped for small numbers that would
    // round to 0. (Halves round up, e.g. 250 -> 300.)
    type: 'roundhundred',
    make: (n, want) => {
      if (n < 50) return null;
      const correct = Math.round(n / 100) * 100;
      if (want) return { label: `Rounds to ${correct} to the nearest 100`, holds: true };
      const x = correct + pick([-200, -100, 100, 200]);
      if (x < 100 || x === correct) return null;
      return { label: `Rounds to ${x} to the nearest 100`, holds: false };
    },
  },
  {
    type: 'prime',
    make: (n, want) => {
      if (isPrime(n) !== want) return null;
      return { label: 'A prime number', holds: want };
    },
  },
  {
    type: 'cube',
    make: (n, want) => {
      if (isPerfectCube(n) !== want) return null;
      return { label: 'A cube number', holds: want };
    },
  },
  {
    // Place value: "The tens digit is X" / "The hundreds digit is X".
    type: 'digitvalue',
    make: (n, want) => {
      const tens = Math.floor(n / 10) % 10;
      const hundreds = Math.floor(n / 100) % 10;
      const place = pick(n >= 100 ? ['tens', 'hundreds'] : ['tens']);
      const actual = place === 'tens' ? tens : hundreds;
      if (want) return { label: `The ${place} digit is ${actual}`, holds: true };
      let d = randInt(0, 9);
      while (d === actual) d = randInt(0, 9);
      return { label: `The ${place} digit is ${d}`, holds: false };
    },
  },
  {
    // "Double X" (2·X = n) and "Half of Y" (Y ÷ 2 = n). Both stay whole numbers.
    type: 'doublehalf',
    make: (n, want) => {
      if (pick(['double', 'half']) === 'half') {
        if (want) return { label: `Half of ${2 * n}`, holds: true };
        let m = n + pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
        if (m < 1) m = n + randInt(1, 5);
        if (m === n) return null;
        return { label: `Half of ${2 * m}`, holds: false };
      }
      if (want) {
        if (n % 2 !== 0) return null;
        return { label: `Double ${n / 2}`, holds: true };
      }
      let k = Math.round(n / 2) + pick([-3, -2, -1, 1, 2, 3]);
      if (k < 1) k = randInt(1, 20);
      if (2 * k === n) return null;
      return { label: `Double ${k}`, holds: false };
    },
  },
  {
    // "Equal to <Roman numeral>" — is n written in Roman numerals this way?
    type: 'roman',
    make: (n, want) => {
      if (want) return { label: `Equal to ${toRoman(n)}`, holds: true };
      let m = n + pick([-10, -3, -2, -1, 1, 2, 3, 10]);
      if (m < 1) m = n + randInt(1, 5);
      if (m === n) return null;
      return { label: `Equal to ${toRoman(m)}`, holds: false };
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
