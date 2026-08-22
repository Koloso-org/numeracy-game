import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import {
  LadderLevel,
  Rung,
  makeStarter,
  nextStep,
  stepSeconds,
} from '../ladder/generator';
import { supabase } from '../supabase';
import { LadderRank, getLadderTopScore, getMyLadderRank, submitLadder } from '../ladderLeaderboard';

// Number Ladder — an endless chain-calculation streak.
//
// Evaluate the starter (e.g. "14 × 3"), then keep applying one operation at a
// time to your own running total. Each correct answer climbs a rung; a wrong
// answer, or running out of time, ends the run. The per-step clock starts at
// 10s and drops 1s every 10 rungs (floored at 3s), so it tightens as you climb.

const TICK_MS = 100;
const LADDER_ACCENT = '#227C72'; // teal — the game's signature colour
const CLEAR_RED = '#A5321C';
const KEY_ALT = '#7A2214';
const SKIP_BLUE = '#4E7FB0';
const SKIP_EVERY = 10; // earn one free skip per this many rungs climbed

const LEVEL_LABEL: Record<LadderLevel, string> = { beginner: 'Beginner', expert: 'Expert' };
const LEVEL_SUB: Record<LadderLevel, string> = {
  beginner: 'Whole numbers, ×, +/−, halves & simple fractions',
  expert: 'Bigger numbers, %, fractions & harder chains',
};

export default function NumberLadderScreen({
  onBack,
  username,
  onOpenLeaderboard,
}: {
  onBack: () => void;
  username: string | null;
  onOpenLeaderboard: (level: LadderLevel) => void;
}) {
  const [level, setLevel] = useState<LadderLevel | null>(null);
  if (!level) {
    return <LevelSelect onBack={onBack} onPick={setLevel} onOpenLeaderboard={onOpenLeaderboard} />;
  }
  return (
    <LadderGame
      key={level}
      level={level}
      username={username}
      onQuit={() => setLevel(null)}
      onOpenLeaderboard={onOpenLeaderboard}
    />
  );
}

// ---------------------------------------------------------------------------

function LevelSelect({
  onBack,
  onPick,
  onOpenLeaderboard,
}: {
  onBack: () => void;
  onPick: (l: LadderLevel) => void;
  onOpenLeaderboard: (level: LadderLevel) => void;
}) {
  return (
    <View style={styles.selectRoot}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>‹ Games</Text>
      </Pressable>
      <Text style={styles.bigTitle}>Number Ladder</Text>
      <Text style={styles.selectSub}>
        Keep the chain going: answer each step to climb. One wrong answer — or the clock — ends
        your run. The higher you go, the less time you get. Every 10 rungs earns a free skip.
      </Text>

      {(['beginner', 'expert'] as LadderLevel[]).map((lvl) => (
        <View key={lvl} style={styles.levelCard}>
          <Pressable
            testID={`ladder-level-${lvl}`}
            onPress={() => onPick(lvl)}
            style={({ pressed }) => [
              styles.levelBtn,
              lvl === 'expert' && styles.levelBtnExpert,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.levelName, lvl === 'expert' && { color: '#fff' }]}>
              {LEVEL_LABEL[lvl]}
            </Text>
            <Text
              style={[styles.levelSub, lvl === 'expert' && { color: 'rgba(255,255,255,0.85)' }]}
            >
              {LEVEL_SUB[lvl]}
            </Text>
          </Pressable>
          <Pressable onPress={() => onOpenLeaderboard(lvl)} hitSlop={8} style={styles.lbLink}>
            <Text style={styles.lbLinkText}>🏆 {LEVEL_LABEL[lvl]} leaderboard</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

const bestKey = (level: LadderLevel) => `ladder_best_${level}`;
type Best = { steps: number; timeMs: number };

function readBest(level: LadderLevel): Best | null {
  try {
    const raw = globalThis.localStorage?.getItem(bestKey(level));
    if (!raw) return null;
    const b = JSON.parse(raw) as Best;
    return typeof b?.steps === 'number' ? b : null;
  } catch {
    return null;
  }
}
function writeBest(level: LadderLevel, b: Best) {
  try {
    globalThis.localStorage?.setItem(bestKey(level), JSON.stringify(b));
  } catch {
    /* storage unavailable — ignore */
  }
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

// ---------------------------------------------------------------------------

function LadderGame({
  level,
  username,
  onQuit,
  onOpenLeaderboard,
}: {
  level: LadderLevel;
  username: string | null;
  onQuit: () => void;
  onOpenLeaderboard: (level: LadderLevel) => void;
}) {
  const randRef = useRef<() => number>(Math.random);
  const [phase, setPhase] = useState<'count' | 'play' | 'over'>('count');
  const [count, setCount] = useState(3);
  const [topScore, setTopScore] = useState<number | null>(null);

  // Fetch the current #1 (rungs) so the score-bar medal has a target.
  useEffect(() => {
    let active = true;
    getLadderTopScore(level).then((t) => {
      if (active) setTopScore(t);
    });
    return () => {
      active = false;
    };
  }, [level]);

  const [current, setCurrent] = useState<Rung>(() => makeStarter(level, randRef.current));
  const [climbed, setClimbed] = useState(0); // rungs cleared so far
  const [runningValue, setRunningValue] = useState<number | null>(null); // total feeding this rung
  const [entry, setEntry] = useState('');
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [pbSteps] = useState<number | null>(() => readBest(level)?.steps ?? null);
  const [limit, setLimit] = useState(stepSeconds(0));
  const [timeLeft, setTimeLeft] = useState(stepSeconds(0));

  const timeRef = useRef(stepSeconds(0));
  const startRef = useRef<number>(0);
  const overRef = useRef(false);
  const [result, setResult] = useState<{ steps: number; timeMs: number; best: Best | null } | null>(null);

  // Countdown 3-2-1 before the first step.
  useEffect(() => {
    if (phase !== 'count') return;
    if (count <= 0) {
      const id = setTimeout(() => {
        startRef.current = Date.now();
        setPhase('play');
      }, 450);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(id);
  }, [count, phase]);

  // Per-step clock.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - TICK_MS / 1000);
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) endRun();
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current]);

  const resetTimer = (cleared: number) => {
    const lim = stepSeconds(cleared);
    setLimit(lim);
    timeRef.current = lim;
    setTimeLeft(lim);
  };

  const endRun = () => {
    if (overRef.current) return;
    overRef.current = true;
    const timeMs = Date.now() - startRef.current;
    const prevBest = readBest(level);
    const isBest =
      !prevBest ||
      climbed > prevBest.steps ||
      (climbed === prevBest.steps && timeMs < prevBest.timeMs);
    if (isBest && climbed > 0) writeBest(level, { steps: climbed, timeMs });
    setResult({ steps: climbed, timeMs, best: isBest && climbed > 0 ? null : prevBest });
    setPhase('over');
  };

  const submit = () => {
    if (phase !== 'play' || flash) return;
    const given = Number(entry);
    if (entry.trim() === '' || Number.isNaN(given)) return;
    if (given === current.result) {
      const cleared = climbed + 1;
      setClimbed(cleared);
      setFlash('ok');
      setTimeout(() => {
        const prevValue = current.result;
        // `runningValue` is the total before this answer; forbid the next step
        // from returning to it, so we never chain an operation and its inverse.
        const avoid = runningValue ?? undefined;
        const next = nextStep(level, prevValue, randRef.current, current.label, avoid);
        setRunningValue(prevValue);
        setCurrent(next);
        setEntry('');
        setFlash(null);
        resetTimer(cleared);
      }, 220);
    } else {
      setFlash('bad');
      setTimeout(endRun, 400);
    }
  };

  const skipsAvailable = Math.floor(climbed / SKIP_EVERY) - skipsUsed;

  const useSkip = () => {
    if (phase !== 'play' || flash || skipsAvailable <= 0 || runningValue === null) return;
    setSkipsUsed((n) => n + 1);
    const next = nextStep(level, runningValue, randRef.current, current.label);
    setCurrent(next);
    setEntry('');
    resetTimer(climbed);
  };

  const onKey = (k: string) => {
    if (phase !== 'play' || flash) return;
    if (k === 'DEL') setEntry((e) => e.slice(0, -1));
    else if (k === 'CLEAR') setEntry('');
    else if (k === 'ENTER') submit();
    else if (/[0-9]/.test(k)) setEntry((e) => (e.length < 7 ? e + k : e));
    // '.' and '+/−' are inert: ladder answers are always whole and positive.
  };

  if (phase === 'count') {
    return (
      <View style={[styles.root, styles.centerAll]}>
        <Text style={styles.readyText}>Get ready…</Text>
        <Text style={styles.countNum}>{count > 0 ? count : 'Go!'}</Text>
        <Text style={styles.readyHint}>Answer each step. One slip ends the run.</Text>
      </View>
    );
  }

  if (phase === 'over' && result) {
    return (
      <LadderResult
        level={level}
        username={username}
        result={result}
        onPlayAgain={onQuit}
        onGames={onQuit}
        onOpenLeaderboard={onOpenLeaderboard}
      />
    );
  }

  const frac = limit > 0 ? timeLeft / limit : 0;
  const ringColor = frac > 0.5 ? '#3E8E5A' : frac > 0.25 ? '#B4661F' : '#A5321C';
  const isStarter = runningValue === null;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Rungs {climbed}</Text>
        </View>
        <View style={[styles.timer, { borderColor: ringColor }]}>
          <Text style={[styles.timerText, { color: ringColor }]}>{Math.ceil(timeLeft)}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{limit}s each</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${Math.max(0, frac) * 100}%`, backgroundColor: ringColor }]} />
      </View>

      <View style={styles.body}>
      <View style={styles.middle}>
        <View
          style={[
            styles.card,
            flash === 'ok' && styles.cardOk,
            flash === 'bad' && styles.cardBad,
          ]}
        >
          {isStarter ? (
            <>
              <Text style={styles.cardKicker}>Start the ladder</Text>
              <Text style={styles.starterExpr}>{current.label}</Text>
            </>
          ) : (
            <>
              <Text style={styles.cardKicker}>Your total</Text>
              <Text style={styles.runningValue}>{runningValue}</Text>
              <Text style={styles.opLabel}>{current.label}</Text>
            </>
          )}
        </View>

        <View style={styles.answerZone}>
          <View
            style={[
              styles.answerBox,
              flash === 'ok' && styles.answerBoxOk,
              flash === 'bad' && styles.answerBoxBad,
            ]}
          >
            <Text style={styles.answerText}>{entry || ' '}</Text>
            <View style={styles.caret} />
          </View>
          <Keypad onKey={onKey} />
          <Pressable
            testID="ladder-skip"
            onPress={useSkip}
            disabled={skipsAvailable <= 0}
            style={[styles.skip, skipsAvailable <= 0 && styles.skipOff]}
          >
            <Text style={[styles.skipText, skipsAvailable <= 0 && styles.skipTextOff]}>
              {skipsAvailable > 0 ? `SKIP${skipsAvailable > 1 ? ` ×${skipsAvailable}` : ''}` : 'SKIP'}
            </Text>
            {skipsAvailable <= 0 && (
              <Text style={styles.skipHint}>
                {SKIP_EVERY - (climbed % SKIP_EVERY)} more to unlock
              </Text>
            )}
          </Pressable>
        </View>
      </View>
        <ScoreBar value={climbed} pb={pbSteps} top={topScore} />
      </View>

      <Pressable onPress={endRun} hitSlop={8} style={styles.quitRow}>
        <Text style={styles.quitText}>End run</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

// Vertical score bar: a gold fill that rises with the rungs climbed, marked
// with the player's personal best (PB) and — once an online leaderboard exists
// — the current #1 (gold-medal) position, both as targets to beat.
function ScoreBar({ value, pb, top }: { value: number; pb: number | null; top: number | null }) {
  const highest = Math.max(value, pb ?? 0, top ?? 0);
  const max = Math.max(20, Math.ceil((highest + 4) / 10) * 10);
  const pct = (v: number): DimensionValue => `${Math.min(1, v / max) * 100}%`;
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += 10) ticks.push(t);

  return (
    <View style={styles.barWrap}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: pct(value) }]} />
        {ticks.map((t) => (
          <View key={`g${t}`} style={[styles.barGrid, { bottom: pct(t) }]} />
        ))}
        {pb != null && pb > 0 && (
          <View style={[styles.barMark, { bottom: pct(pb) }]}>
            <View style={styles.barMarkLine} />
            <Text style={styles.barMarkLabel}>PB</Text>
          </View>
        )}
        {top != null && top > 0 && (
          <View style={[styles.barMedalWrap, { bottom: pct(top) }]}>
            <View style={styles.barMedal}>
              <Text style={styles.barMedalNum}>1</Text>
            </View>
          </View>
        )}
      </View>
      <View style={styles.barScale}>
        {ticks.map((t) => (
          <Text key={t} style={[styles.barTick, { bottom: pct(t) }]}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

// Same layout as the Koloso Challenge keypad.
const KEYS: [string, string, 'num' | 'clear' | 'alt' | 'enter'][][] = [
  [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['CLEAR', 'CLEAR', 'clear']],
  [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['⌫', 'DEL', 'alt']],
  [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+/−', 'SIGN', 'alt']],
  [['0', '0', 'num'], ['.', '.', 'num'], ['ENTER', 'ENTER', 'enter']],
];

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.kpRow}>
          {row.map(([label, val, kind]) => (
            <Pressable
              key={val}
              testID={`lk-${val}`}
              onPress={() => onKey(val)}
              style={({ pressed }) => [
                styles.key,
                kind === 'enter' && styles.keyEnter,
                pressed && styles.keyPressed,
              ]}
            >
              <Text
                style={[
                  styles.keyText,
                  kind === 'clear' && styles.keyClear,
                  kind === 'alt' && styles.keyAlt,
                  kind === 'enter' && styles.keyEnterText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

function LadderResult({
  level,
  username,
  result,
  onPlayAgain,
  onGames,
  onOpenLeaderboard,
}: {
  level: LadderLevel;
  username: string | null;
  result: { steps: number; timeMs: number; best: Best | null };
  onPlayAgain: () => void;
  onGames: () => void;
  onOpenLeaderboard: (level: LadderLevel) => void;
}) {
  const newBest = result.best === null && result.steps > 0;
  const [saving, setSaving] = useState<boolean>(!!username && !!supabase && result.steps > 0);
  const [rank, setRank] = useState<LadderRank | null>(null);

  useEffect(() => {
    let active = true;
    if (username && supabase && result.steps > 0) {
      (async () => {
        await submitLadder(level, result.steps, result.timeMs);
        const mine = await getMyLadderRank(level);
        if (active) {
          setRank(mine);
          setSaving(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [level, result.steps, result.timeMs, username]);

  return (
    <View style={[styles.root, styles.centerAll]}>
      <Text style={styles.overTitle}>Run over</Text>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreBig}>{result.steps}</Text>
        <Text style={styles.scoreLabel}>rungs climbed</Text>
        <Text style={styles.scoreTime}>in {fmtTime(result.timeMs)}</Text>
        {newBest ? (
          <Text style={styles.newBest}>★ New personal best!</Text>
        ) : result.best ? (
          <Text style={styles.prevBest}>
            Best: {result.best.steps} rungs · {fmtTime(result.best.timeMs)}
          </Text>
        ) : null}
      </View>

      {username ? (
        saving ? (
          <View style={styles.rankRow}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.rankText}>  Saving…</Text>
          </View>
        ) : rank ? (
          <Text style={styles.rankText}>🏆 Best {rank.best_score} rungs · Rank #{rank.rank}</Text>
        ) : null
      ) : (
        <Text style={styles.rankText}>Log in to save your run & join the leaderboard.</Text>
      )}

      <Pressable
        onPress={onPlayAgain}
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>Play again</Text>
      </Pressable>
      <Pressable
        onPress={() => onOpenLeaderboard(level)}
        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
      >
        <Text style={styles.outlineText}>🏆 {LEVEL_LABEL[level]} leaderboard</Text>
      </Pressable>
      <Pressable onPress={onGames} hitSlop={8} style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>‹ Back to games</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  centerAll: { alignItems: 'center', justifyContent: 'center' },

  // Level select
  selectRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { position: 'absolute', top: 16, left: 16, padding: 6, zIndex: 2 },
  backText: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  bigTitle: { color: COLORS.text, fontSize: 30, fontWeight: '900', marginBottom: 10 },
  selectSub: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 330,
    marginBottom: 22,
  },
  levelCard: { width: '100%', maxWidth: 340, marginTop: 14, alignItems: 'center' },
  levelBtn: {
    backgroundColor: LADDER_ACCENT,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
  },
  levelBtnExpert: { backgroundColor: '#164A44' },
  levelName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  levelSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  lbLink: { marginTop: 8, padding: 4 },
  lbLinkText: { color: COLORS.accent, fontSize: 14, fontWeight: '800' },

  // Countdown
  readyText: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700' },
  countNum: { color: COLORS.accent, fontSize: 90, fontWeight: '900', marginVertical: 8 },
  readyHint: { color: COLORS.textMuted, fontSize: 14 },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 84,
    alignItems: 'center',
  },
  pillText: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  timer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: { fontSize: 20, fontWeight: '900' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3 },

  // Middle
  body: { flex: 1, flexDirection: 'row', gap: 8 },
  middle: { flex: 1, justifyContent: 'space-evenly' },

  // Score bar (right side)
  barWrap: { width: 52, flexDirection: 'row' },
  barTrack: {
    width: 14,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 7,
    overflow: 'visible',
    marginTop: 8,
    marginBottom: 8,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.accent,
    borderRadius: 7,
  },
  barGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(32,48,32,0.18)',
  },
  barMark: { position: 'absolute', left: -3, right: -3, alignItems: 'flex-start', justifyContent: 'center' },
  barMarkLine: { height: 3, alignSelf: 'stretch', backgroundColor: COLORS.accent, borderRadius: 2 },
  barMarkLabel: { position: 'absolute', left: 24, color: COLORS.accent, fontSize: 12, fontWeight: '900' },
  barMedalWrap: { position: 'absolute', left: 20, alignItems: 'center', justifyContent: 'center' },
  barMedal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#B8860B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -11,
  },
  barMedalNum: { color: '#5a3a00', fontSize: 12, fontWeight: '900' },
  barScale: { flex: 1, marginLeft: 4, alignSelf: 'stretch', marginTop: 8, marginBottom: 8 },
  barTick: { position: 'absolute', left: 0, color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginBottom: -8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOk: { borderColor: COLORS.correct },
  cardBad: { borderColor: COLORS.wrong },
  cardKicker: { color: COLORS.inkMuted, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  starterExpr: { color: COLORS.ink, fontSize: 46, fontWeight: '900', marginTop: 8 },
  runningValue: { color: COLORS.ink, fontSize: 44, fontWeight: '900', marginTop: 2 },
  opLabel: { color: LADDER_ACCENT, fontSize: 30, fontWeight: '900', marginTop: 12 },

  // Answer + keypad
  answerZone: { gap: 10 },
  answerBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 14,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBoxOk: { borderColor: COLORS.correct },
  answerBoxBad: { borderColor: COLORS.wrong },
  answerText: { color: COLORS.ink, fontSize: 26, fontWeight: '800' },
  caret: { width: 2, height: 26, backgroundColor: COLORS.inkMuted, marginLeft: 2 },
  keypad: { marginTop: 10, gap: 8 },
  kpRow: { height: 54, minHeight: 40, flexShrink: 1, flexDirection: 'row', gap: 8 },
  key: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { opacity: 0.7 },
  keyText: { color: COLORS.ink, fontSize: 24, fontWeight: '800' },
  keyClear: { color: CLEAR_RED, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  keyAlt: { color: KEY_ALT, fontSize: 20, fontWeight: '900' },
  keyEnter: { flex: 2, backgroundColor: COLORS.accent },
  keyEnterText: { color: COLORS.accentText, fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  skip: { backgroundColor: SKIP_BLUE, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  skipOff: { backgroundColor: 'rgba(255,255,255,0.14)' },
  skipText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  skipTextOff: { color: 'rgba(255,255,255,0.45)' },
  skipHint: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },

  quitRow: { alignSelf: 'center', paddingVertical: 8 },
  quitText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },

  // Result
  overTitle: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: 16 },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreBig: { color: LADDER_ACCENT, fontSize: 64, fontWeight: '900' },
  scoreLabel: { color: COLORS.ink, fontSize: 16, fontWeight: '700', marginTop: -4 },
  scoreTime: { color: COLORS.inkMuted, fontSize: 15, marginTop: 6 },
  newBest: { color: COLORS.correct, fontSize: 16, fontWeight: '900', marginTop: 12 },
  prevBest: { color: COLORS.inkMuted, fontSize: 14, marginTop: 12 },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  primaryText: { color: COLORS.accentText, fontSize: 18, fontWeight: '900' },
  outlineBtn: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  outlineText: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  secondaryBtn: { marginTop: 14, padding: 8 },
  secondaryText: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rankText: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  levelTag: { color: COLORS.textMuted, fontSize: 13, marginTop: 18 },
});
