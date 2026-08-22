import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { Level, Question, isCorrect, loadBank, pickQuestions } from '../challenge/questions';
import ChallengeVisual from '../challenge/ChallengeVisual';
import { supabase } from '../supabase';
import { ChallengeRank, getMyChallengeRank, submitChallenge } from '../challengeLeaderboard';

const GAME_SECONDS = 120;
const QUESTION_COUNT = 10;
const TICK_MS = 100;

const TIMER_GREEN = '#4E7D34';
const TIMER_AMBER = '#B4661F';
const TIMER_RED = '#A5321C';
const SKIP_BLUE = '#4E7FB0';
const CLEAR_RED = '#A5321C';
const KEY_ALT = '#7A2214';

const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', expert: 'Expert' };
const LEVEL_SUB: Record<Level, string> = {
  beginner: 'Upper primary · around Year 5',
  expert: 'Lower secondary · around Year 8',
};

export default function ChallengeScreen({
  username,
  onBack,
  onOpenLeaderboard,
}: {
  username: string | null;
  onBack: () => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  const [level, setLevel] = useState<Level | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!level) return;
    let cancelled = false;
    setQuestions(null);
    setLoadError(null);
    loadBank(level)
      .then((all) => {
        if (!cancelled) setQuestions(pickQuestions(all, QUESTION_COUNT, Math.random));
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load questions');
      });
    return () => {
      cancelled = true;
    };
  }, [level]);

  const backToLevels = () => {
    setLevel(null);
    setQuestions(null);
    setLoadError(null);
  };

  if (!level) {
    return <LevelSelect onBack={onBack} onPick={setLevel} onOpenLeaderboard={onOpenLeaderboard} />;
  }
  if (loadError) {
    return <LoadNotice message={loadError} isError onBack={backToLevels} />;
  }
  if (!questions) {
    return <LoadNotice message="Loading questions…" onBack={backToLevels} />;
  }
  return (
    <ChallengeGame
      key={level}
      level={level}
      questions={questions}
      username={username}
      onQuit={backToLevels}
      onOpenLeaderboard={onOpenLeaderboard}
    />
  );
}

function LoadNotice({
  message,
  isError,
  onBack,
}: {
  message: string;
  isError?: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.selectRoot}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>‹ Levels</Text>
      </Pressable>
      <View style={styles.loadCenter}>
        {isError ? (
          <Text style={styles.loadError}>{message}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadText}>{message}</Text>
          </>
        )}
        {isError ? (
          <Pressable onPress={onBack} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function LevelSelect({
  onBack,
  onPick,
  onOpenLeaderboard,
}: {
  onBack: () => void;
  onPick: (l: Level) => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  return (
    <View style={styles.selectRoot}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>‹ Games</Text>
      </Pressable>
      <Text style={styles.bigTitle}>Koloso Challenge</Text>
      <Text style={styles.selectSub}>10 questions · 2 minutes · answer or skip. Choose your level.</Text>

      {(['beginner', 'expert'] as Level[]).map((lvl) => (
        <View key={lvl} style={styles.levelCard}>
          <Pressable
            testID={`level-${lvl}`}
            onPress={() => onPick(lvl)}
            style={({ pressed }) => [styles.levelBtn, lvl === 'expert' && styles.levelBtnExpert, pressed && styles.pressed]}
          >
            <Text style={[styles.levelName, lvl === 'expert' && { color: '#fff' }]}>{LEVEL_LABEL[lvl]}</Text>
            <Text style={[styles.levelSub, lvl === 'expert' && { color: 'rgba(255,255,255,0.85)' }]}>{LEVEL_SUB[lvl]}</Text>
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

function ChallengeGame({
  level,
  questions,
  username,
  onQuit,
  onOpenLeaderboard,
}: {
  level: Level;
  questions: Question[];
  username: string | null;
  onQuit: () => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState<null | { ok: boolean; picked?: string }>(null);
  const [phase, setPhase] = useState<'count' | 'play' | 'result'>('count');
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);

  const timeRef = useRef(GAME_SECONDS);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== 'count') return;
    if (count <= 0) {
      const id = setTimeout(() => setPhase('play'), 450);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(id);
  }, [count, phase]);

  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - TICK_MS / 1000);
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('result');
  };

  const nextQuestion = () => {
    setFeedback(null);
    setEntry('');
    if (index + 1 >= questions.length) finish();
    else setIndex((i) => i + 1);
  };

  const answer = (given: string, pickedOption?: string) => {
    if (feedback || doneRef.current) return;
    const q = questions[index];
    const ok = isCorrect(q, given);
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
    }
    setFeedback({ ok, picked: pickedOption });
    setTimeout(nextQuestion, ok ? 450 : 750);
  };

  const skip = () => {
    if (feedback || doneRef.current) return;
    nextQuestion();
  };

  const onKey = (k: string) => {
    if (feedback || doneRef.current) return;
    if (k === 'CLEAR') setEntry('');
    else if (k === 'DEL') setEntry((e) => e.slice(0, -1));
    else if (k === 'SIGN') setEntry((e) => (e.startsWith('-') ? e.slice(1) : '-' + e));
    else if (k === '.') setEntry((e) => (e.includes('.') ? e : e + '.'));
    else if (k === 'ENTER') { if (entry.trim()) answer(entry); }
    else setEntry((e) => (e.replace('-', '').replace('.', '').length < 6 ? e + k : e));
  };

  if (phase === 'count') {
    return (
      <View style={styles.countWrap}>
        <Text style={styles.countLabel}>{LEVEL_LABEL[level]} · get ready…</Text>
        <Text style={styles.countNumber}>{count > 0 ? count : 'Go!'}</Text>
      </View>
    );
  }

  if (phase === 'result') {
    const timeTaken = Math.round((GAME_SECONDS - timeRef.current) * 10) / 10;
    return (
      <ChallengeResult
        level={level}
        score={correctRef.current}
        total={questions.length}
        timeTaken={timeTaken}
        username={username}
        onPlayAgain={onQuit}
        onOpenLeaderboard={onOpenLeaderboard}
      />
    );
  }

  const q = questions[index];
  const seconds = Math.ceil(timeLeft);
  const timeStr = seconds >= 60 ? `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}` : `${seconds}`;
  const timerColor = seconds <= 10 ? TIMER_RED : seconds <= 30 ? TIMER_AMBER : TIMER_GREEN;
  const elapsedPct = ((GAME_SECONDS - timeLeft) / GAME_SECONDS) * 100;

  return (
    <View style={styles.root}>
      <View style={styles.headerZone}>
        <View style={styles.topBar}>
          <View style={styles.pill}><Text style={styles.pillText}>Q{index + 1} of {questions.length}</Text></View>
          <View style={[styles.timer, { backgroundColor: timerColor }]}><Text style={styles.timerText}>{timeStr}</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Score {correct}</Text></View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${elapsedPct}%` }]} />
        </View>
      </View>

      <View style={styles.middleContainer}>
        <View style={styles.qCard}>
          <Text style={q.visual || q.image ? styles.qPromptSmall : styles.qPromptBig}>{q.prompt}</Text>
          {q.visual && <ChallengeVisual visual={q.visual} />}
          {q.image ? <Image source={{ uri: q.image }} style={styles.qImage} resizeMode="contain" /> : null}
        </View>

        <View style={styles.answerZone}>
        {q.type === 'mc' ? (
          <View style={styles.options}>
            {q.options!.map((opt, oi) => {
              const picked = feedback?.picked === opt;
              const showRight = feedback && opt === q.answer;
              const showWrong = feedback && picked && !feedback.ok;
              return (
                <Pressable
                  key={opt}
                  testID={`opt-${oi}`}
                  disabled={!!feedback}
                  onPress={() => answer(opt, opt)}
                  style={({ pressed }) => [
                    styles.option,
                    showRight && styles.optionRight,
                    showWrong && styles.optionWrong,
                    pressed && !feedback && styles.pressed,
                  ]}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <View style={[
              styles.answerBox,
              feedback?.ok === true && styles.answerRight,
              feedback?.ok === false && styles.answerWrong,
            ]}>
              <Text style={styles.answerText}>{entry}</Text>
              {!feedback && <View style={styles.cursor} />}
              {q.unit ? <Text style={styles.answerUnit}>{q.unit}</Text> : null}
            </View>
            <NumericKeypad onKey={onKey} />
          </>
        )}
        <Pressable testID="cq-skip" onPress={skip} disabled={!!feedback} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <Text style={styles.skipText}>SKIP</Text>
        </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const KEYS: [string, string, 'num' | 'clear' | 'alt' | 'enter'][][] = [
  [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['CLEAR', 'CLEAR', 'clear']],
  [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['⌫', 'DEL', 'alt']],
  [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+/−', 'SIGN', 'alt']],
  [['0', '0', 'num'], ['.', '.', 'num'], ['ENTER', 'ENTER', 'enter']],
];

function NumericKeypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.kpRow}>
          {row.map(([label, val, kind]) => (
            <Pressable
              key={val}
              testID={`k-${val}`}
              onPress={() => onKey(val)}
              style={({ pressed }) => [styles.key, kind === 'enter' && styles.keyEnter, pressed && styles.keyPressed]}
            >
              <Text style={[
                styles.keyText,
                kind === 'clear' && styles.keyClear,
                kind === 'alt' && styles.keyAlt,
                kind === 'enter' && styles.keyEnterText,
              ]}>
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

function ChallengeResult({
  level,
  score,
  total,
  timeTaken,
  username,
  onPlayAgain,
  onOpenLeaderboard,
}: {
  level: Level;
  score: number;
  total: number;
  timeTaken: number;
  username: string | null;
  onPlayAgain: () => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  const [saving, setSaving] = useState<boolean>(!!username && !!supabase);
  const [rank, setRank] = useState<ChallengeRank | null>(null);

  useEffect(() => {
    let active = true;
    if (username && supabase) {
      (async () => {
        await submitChallenge(level, score, Math.round(timeTaken * 1000));
        const mine = await getMyChallengeRank(level);
        if (active) {
          setRank(mine);
          setSaving(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [level, score, timeTaken, username]);

  return (
    <View style={styles.resultRoot}>
      <Text style={styles.resultLevel}>{LEVEL_LABEL[level]} Challenge</Text>
      <View style={styles.resultCard}>
        <Text style={styles.resultScore}>{score}<Text style={styles.resultOutOf}> / {total}</Text></Text>
        <Text style={styles.resultTime}>Time {timeTaken.toFixed(1)}s</Text>
      </View>

      {username ? (
        saving ? (
          <View style={styles.rankRow}><ActivityIndicator color={COLORS.accent} /><Text style={styles.resultSub}>  Saving…</Text></View>
        ) : rank ? (
          <Text style={styles.resultSub}>🏆 Best {rank.best_score}/10 · Rank #{rank.rank}</Text>
        ) : null
      ) : (
        <Text style={styles.resultSub}>Log in to save your score & join the leaderboard.</Text>
      )}

      <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onPlayAgain}>
        <Text style={styles.primaryText}>Play again</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.outline, pressed && styles.pressed]} onPress={() => onOpenLeaderboard(level)}>
        <Text style={styles.outlineText}>🏆 {LEVEL_LABEL[level]} leaderboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', top: 16, left: 16, padding: 6, zIndex: 2 },
  backText: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.75 },

  // Level select
  selectRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadCenter: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadText: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  loadError: { color: COLORS.text, fontSize: 17, fontWeight: '700', textAlign: 'center', maxWidth: 300 },
  retryBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
  retryText: { color: COLORS.accentText, fontSize: 16, fontWeight: '800' },
  bigTitle: { color: COLORS.accent, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  selectSub: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 22, paddingHorizontal: 10 },
  levelCard: { width: '100%', maxWidth: 340, marginBottom: 16, alignItems: 'center' },
  levelBtn: { width: '100%', backgroundColor: COLORS.accent, borderRadius: 18, paddingVertical: 20, paddingHorizontal: 20, alignItems: 'center' },
  levelBtnExpert: { backgroundColor: '#3E6FA0' },
  levelName: { color: COLORS.accentText, fontSize: 24, fontWeight: '900' },
  levelSub: { color: 'rgba(32,48,32,0.7)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  lbLink: { paddingVertical: 8 },
  lbLinkText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '700' },

  // Countdown
  countWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countLabel: { color: COLORS.textMuted, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  countNumber: { color: COLORS.accent, fontSize: 120, fontWeight: '800' },

  // Play — top bar
  // Header stays anchored at the top; the question and answer zones distribute
  // evenly in the space below it (leaving a matching gap under SKIP).
  root: { flex: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerZone: { flexShrink: 0 },
  middleContainer: { flex: 1, justifyContent: 'space-evenly' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  pillText: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  timer: { width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  timerText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.accent },

  // Play — body
  qCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minHeight: 88, flexShrink: 1 },
  qPromptBig: { color: COLORS.ink, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  qPromptSmall: { color: COLORS.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  qImage: { width: 168, height: 148, marginTop: 10 },

  // Answer zone is a compact grouped unit (options / keypad + SKIP); the root
  // spreads it evenly with the header and question zones.
  answerZone: { flexShrink: 1 },
  options: { gap: 12 },
  option: { height: 58, minHeight: 42, flexShrink: 1, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'transparent', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionText: { color: COLORS.ink, fontSize: 21, fontWeight: '800' },
  optionRight: { borderColor: COLORS.correct, backgroundColor: COLORS.correctBg },
  optionWrong: { borderColor: COLORS.wrong, backgroundColor: COLORS.wrongBg },

  answerBox: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'transparent', borderRadius: 14, height: 60, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  answerRight: { borderColor: COLORS.correct, backgroundColor: COLORS.correctBg },
  answerWrong: { borderColor: COLORS.wrong, backgroundColor: COLORS.wrongBg },
  answerText: { color: COLORS.ink, fontSize: 30, fontWeight: '800' },
  cursor: { width: 3, height: 30, backgroundColor: COLORS.inkMuted, marginLeft: 2, borderRadius: 2 },
  answerUnit: { color: COLORS.inkMuted, fontSize: 18, fontWeight: '800', marginLeft: 8 },

  keypad: { marginTop: 10, gap: 8 },
  kpRow: { height: 54, minHeight: 40, flexShrink: 1, flexDirection: 'row', gap: 8 },
  key: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { opacity: 0.7 },
  keyText: { color: COLORS.ink, fontSize: 24, fontWeight: '800' },
  keyClear: { color: CLEAR_RED, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  keyAlt: { color: KEY_ALT, fontSize: 20, fontWeight: '900' },
  keyEnter: { flex: 2, backgroundColor: COLORS.accent },
  keyEnterText: { color: COLORS.accentText, fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  skip: { backgroundColor: SKIP_BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  skipText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  // Result
  resultRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultLevel: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  resultCard: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 48, alignItems: 'center' },
  resultScore: { color: COLORS.ink, fontSize: 76, fontWeight: '900' },
  resultOutOf: { color: COLORS.inkMuted, fontSize: 34, fontWeight: '800' },
  resultTime: { color: COLORS.inkMuted, fontSize: 17, fontWeight: '700' },
  resultSub: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 14 },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  primary: { backgroundColor: COLORS.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, marginTop: 18, width: '100%', maxWidth: 320, alignItems: 'center' },
  primaryText: { color: COLORS.accentText, fontSize: 20, fontWeight: '800' },
  outline: { borderWidth: 2, borderColor: COLORS.textMuted, borderRadius: 14, paddingVertical: 13, marginTop: 12, width: '100%', maxWidth: 320, alignItems: 'center' },
  outlineText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
