// Number Ladder — endless chain-calculation streak.
//
// You start with a simple expression (e.g. "14 × 3"), type its answer, then
// keep applying one operation at a time to your own running total ("Add 26",
// "Halve it", "Find 20% of it", …). Every correct answer climbs one rung; a
// wrong answer — or running out of time — ends the run. The ladder never ends;
// the clock is what tightens.
//
// Hard rule: EVERY value in the chain is a positive whole number. Division,
// halving, fractions and percentages are only ever offered when the current
// running value divides exactly, so the player never meets a fraction. This is
// enforced here and re-checked independently in the verifier.

export type LadderLevel = 'beginner' | 'expert';

export interface Rung {
  /** What the player reads, e.g. "14 × 3" (starter) or "Add 26" (a step). */
  label: string;
  /** The value the player must type: running total AFTER this rung. */
  result: number;
}

interface Cfg {
  min: number;
  max: number;
  mulMax: number;
  addMax: number;
  startA: [number, number];
  startB: [number, number];
  fracDen: number[];
  pcts: number[];
  allowIncreasePct: boolean;
  allowAddHalf: boolean;
}

const CONFIG: Record<LadderLevel, Cfg> = {
  beginner: {
    min: 2,
    max: 200,
    mulMax: 3,
    addMax: 30,
    startA: [2, 12],
    startB: [2, 9],
    fracDen: [2, 3, 4, 5, 10],
    pcts: [10, 20, 25, 50, 75],
    allowIncreasePct: false,
    allowAddHalf: false,
  },
  expert: {
    min: 2,
    max: 1000,
    mulMax: 4,
    addMax: 80,
    startA: [3, 15],
    startB: [3, 12],
    fracDen: [2, 3, 4, 5, 6, 8, 10],
    pcts: [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80],
    allowIncreasePct: true,
    allowAddHalf: true,
  },
};

// ---- timing curve ----
export const START_SECONDS = 10;
export const MIN_SECONDS = 3;

/** Seconds allowed for a step, given how many steps are already cleared:
 *  10s for steps 1–10, 9s for 11–20, …, floored at 3s. */
export function stepSeconds(stepsCleared: number): number {
  return Math.max(MIN_SECONDS, START_SECONDS - Math.floor(stepsCleared / 10));
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

type Rand = () => number;
const randInt = (rand: Rand, lo: number, hi: number): number =>
  lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(rand: Rand, arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const shuffle = <T>(rand: Rand, arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// A candidate operation: given the current value, either produce the next rung
// or return null when it can't keep the value a whole number within bounds.
type OpFactory = (v: number, cfg: Cfg, rand: Rand) => Rung | null;

const OPS: OpFactory[] = [
  (v, cfg, rand) => {
    const room = cfg.max - v;
    if (room < 1) return null;
    const n = randInt(rand, 1, Math.min(cfg.addMax, room));
    return { label: `Add ${n}`, result: v + n };
  },
  (v, cfg, rand) => {
    const room = v - cfg.min;
    if (room < 1) return null;
    const n = randInt(rand, 1, Math.min(cfg.addMax, room));
    return { label: `Subtract ${n}`, result: v - n };
  },
  (v, cfg, rand) => {
    const nMax = Math.min(cfg.mulMax, Math.floor(cfg.max / v));
    if (nMax < 2) return null;
    const n = randInt(rand, 2, nMax);
    if (n === 2) return { label: 'Double it', result: v * 2 };
    return { label: `Multiply by ${n}`, result: v * n };
  },
  (v, cfg) => {
    if (v % 2 !== 0) return null;
    const r = v / 2;
    if (r < cfg.min) return null;
    return { label: 'Halve it', result: r };
  },
  (v, cfg, rand) => {
    const ks = cfg.fracDen.filter((k) => k >= 3 && v % k === 0 && v / k >= cfg.min);
    if (ks.length === 0) return null;
    const k = pick(rand, ks);
    return { label: `Divide by ${k}`, result: v / k };
  },
  (v, cfg, rand) => {
    const dens = cfg.fracDen.filter((b) => b >= 2 && v % b === 0);
    if (dens.length === 0) return null;
    const b0 = pick(rand, dens);
    const a0 = randInt(rand, 1, b0 - 1);
    const r = (v * a0) / b0;
    if (r < cfg.min) return null;
    // Show the fraction in lowest terms (e.g. 2/10 → 1/5, 1/2 → "Halve it").
    const g = gcd(a0, b0);
    const a = a0 / g;
    const b = b0 / g;
    if (a === 1 && b === 2) return { label: 'Halve it', result: r };
    return { label: `Find ${a}/${b} of it`, result: r };
  },
  (v, cfg, rand) => {
    const ps = cfg.pcts.filter((p) => (v * p) % 100 === 0 && (v * p) / 100 >= cfg.min);
    if (ps.length === 0) return null;
    const p = pick(rand, ps);
    return { label: `Find ${p}% of it`, result: (v * p) / 100 };
  },
  (v, cfg, rand) => {
    if (!cfg.allowIncreasePct) return null;
    const ps = cfg.pcts.filter((p) => (v * p) % 100 === 0 && v + (v * p) / 100 <= cfg.max);
    if (ps.length === 0) return null;
    const p = pick(rand, ps);
    return { label: `Increase by ${p}%`, result: v + (v * p) / 100 };
  },
  (v, cfg) => {
    if (!cfg.allowAddHalf || v % 2 !== 0) return null;
    const r = v + v / 2;
    if (r > cfg.max) return null;
    return { label: 'Add half of it', result: r };
  },
];

/** The opening rung: a product the player must evaluate, within bounds. */
export function makeStarter(level: LadderLevel, rand: Rand): Rung {
  const cfg = CONFIG[level];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const a = randInt(rand, cfg.startA[0], cfg.startA[1]);
    const b = randInt(rand, cfg.startB[0], cfg.startB[1]);
    const r = a * b;
    if (r >= cfg.min && r <= cfg.max) return { label: `${a} × ${b}`, result: r };
  }
  const a = cfg.startA[0];
  const b = cfg.startB[0];
  return { label: `${a} × ${b}`, result: a * b };
}

/** The next rung for a running value. `prevLabel` avoids an immediate repeat. */
export function nextStep(level: LadderLevel, value: number, rand: Rand, prevLabel = ''): Rung {
  const cfg = CONFIG[level];
  for (const op of shuffle(rand, OPS)) {
    const cand = op(value, cfg, rand);
    if (cand && cand.label !== prevLabel && cand.result !== value) return cand;
  }
  // Fallback that always works and keeps the value in bounds.
  if (cfg.max - value >= 1) return { label: 'Add 1', result: value + 1 };
  return { label: 'Subtract 1', result: value - 1 };
}
