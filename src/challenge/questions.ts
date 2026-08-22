// Koloso Challenge — question bank and answer checking.
//
// A game shows 10 questions from the chosen level; the player answers or skips
// each. Score = number correct (0–10); ties on the leaderboard break on time.
//
// The live bank is the Koloso Foundation (FND26) curriculum, shipped as static
// JSON (public/foundation-<level>.json) and fetched on demand when a level is
// chosen — FND26.1 → beginner, FND26.2 → expert. It is not bundled into the
// app so the menu and the other games stay fast to load.

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
  /** Curriculum topic key (domain + topic), e.g. "N1" — used to spread a quiz
   *  across topics. */
  topic: string;
  /** Learning-objective key (domain.topic.subtopic.objective). A single quiz
   *  never repeats a learning objective. */
  lo?: string;
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
  /** Data-URI image (SVG) shown above the prompt — from the Koloso bank. */
  image?: string;
}

/** Normalise a typed answer for comparison: lowercase, drop spaces, brackets,
 *  trailing units, and thousands-commas. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '') // thousands separators: "1,000" == "1000"
    .replace(/[()]/g, '')
    .replace(/[°%]/g, '')
    .replace(/(cm3|cm²|cm2|cm|m²|m2|units?)$/g, '');
}

export function isCorrect(q: Question, given: string): boolean {
  if (q.type === 'mc') return given === q.answer;
  const g = normalise(given);
  if (g.length === 0) return false;
  const accepted = [q.answer, ...(q.accept ?? [])].map(normalise);
  return accepted.includes(g);
}

function shuffled<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Loading the live bank

const cache: Partial<Record<Level, Question[]>> = {};

/** Fetch (and cache) a level's question bank from the static JSON asset. */
export async function loadBank(level: Level): Promise<Question[]> {
  const cached = cache[level];
  if (cached) return cached;
  const res = await fetch(`/foundation-${level}.json`);
  if (!res.ok) throw new Error(`Could not load questions (${res.status})`);
  const data = (await res.json()) as Question[];
  cache[level] = data;
  return data;
}

// ---------------------------------------------------------------------------
// Choosing a quiz

const loOf = (q: Question): string => q.lo ?? q.id;
const topicOf = (q: Question): string => q.topic || q.id;

/** Draw `count` questions from a loaded bank for a single quiz.
 *
 *  Rules: never two questions from the same learning objective, and spread
 *  across as many different topics as possible; the specific question within a
 *  topic/objective is chosen at random. Multiple-choice options are shuffled so
 *  the correct answer isn't always in the same position.
 */
export function pickQuestions(all: readonly Question[], count: number, rand: () => number): Question[] {
  const pool = shuffled(all, rand);
  const usedLo = new Set<string>();
  const usedTopic = new Set<string>();
  const chosen: Question[] = [];

  // Pass 1: distinct topic AND distinct learning objective.
  for (const q of pool) {
    if (chosen.length >= count) break;
    const lo = loOf(q);
    const topic = topicOf(q);
    if (usedLo.has(lo) || usedTopic.has(topic)) continue;
    usedLo.add(lo);
    usedTopic.add(topic);
    chosen.push(q);
  }

  // Pass 2 (safety net if a level has fewer topics than `count`): keep the
  // distinct-objective rule but allow a topic to repeat.
  if (chosen.length < count) {
    const picked = new Set(chosen);
    for (const q of pool) {
      if (chosen.length >= count) break;
      if (picked.has(q) || usedLo.has(loOf(q))) continue;
      usedLo.add(loOf(q));
      picked.add(q);
      chosen.push(q);
    }
  }

  return chosen.map((q) =>
    q.type === 'mc' && q.options ? { ...q, options: shuffled(q.options, rand) } : q,
  );
}
