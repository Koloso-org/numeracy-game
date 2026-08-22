import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../theme';
import { Level, Question, isCorrect, pickQuestions } from '../challenge/questions';
import ChallengeVisual from '../challenge/ChallengeVisual';
import { supabase } from '../supabase';
import { ChallengeRank, getMyChallengeRank, submitChallenge } from '../challengeLeaderboard';

const GAME_SECONDS = 120;
const QUESTION_COUNT = 10;
const TICK_MS = 100;

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

  if (!level) {
    return <LevelSelect onBack={onBack} onPick={setLevel} onOpenLeaderboard={onOpenLeaderboard} />;
  }
  return (
    <ChallengeGame
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
  onPick: (l: Level) => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  return (
    <View style={styles.selectRoot}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>‹ Games</Text>
      </Pressable>
      <Text style={styles.bigTitle}>Koloso Challenge</Text>
      <Text style={styles.selectSub}>
        10 questions · 2 minutes · answer or skip. Choose your level.
      </Text>

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
  username,
  onQuit,
  onOpenLeaderboard,
}: {
  level: Level;
  username: string | null;
  onQuit: () => void;
  onOpenLeaderboard: (level: Level) => void;
}) {
  const [questions] = useState<Question[]>(() => pickQuestions(level, QUESTION_COUNT, Math.random));
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

  // 3-2-1 countdown, then start.
  useEffect(() => {
    if (phase !== 'count') return;
    if (count <= 0) {
      const id = setTimeout(() => setPhase('play'), 450);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCount((c) => c - 1), 750);
    return () => clearTimeout(id);
  }, [count, phase]);

  // Game timer.
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
    if (index + 1 >= questions.length) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
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
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timeColor = seconds <= 10 ? COLORS.wrong : seconds <= 30 ? COLORS.warn : COLORS.correct;

  return (
    <View style={styles.playRoot}>
      <View style={styles.topRow}>
        <Text style={styles.progressText}>
          {index + 1} / {questions.length}
        </Text>
        <Text style={styles.correctText}>✓ {correct}</Text>
        <Text style={[styles.timeText, { color: timeColor }]}>
          {mm}:{ss.toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.dots}>
        {questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < index && styles.dotDone,
              i === index && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {q.visual && <ChallengeVisual visual={q.visual} />}
        <Text style={styles.prompt}>{q.prompt}</Text>

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
          <View style={styles.entryWrap}>
            <View style={styles.entryRow}>
              <TextInput
                testID="cq-input"
                style={[
                  styles.input,
                  feedback?.ok === true && styles.inputRight,
                  feedback?.ok === false && styles.inputWrong,
                ]}
                value={entry}
                onChangeText={setEntry}
                editable={!feedback}
                placeholder="Type your answer"
                placeholderTextColor={COLORS.inkMuted}
                autoFocus
                onSubmitEditing={() => entry.trim() && answer(entry)}
                returnKeyType="done"
              />
              {q.unit ? <Text style={styles.unit}>{q.unit}</Text> : null}
            </View>
            {feedback && !feedback.ok && (
              <Text style={styles.answerReveal}>Answer: {q.answer}</Text>
            )}
            <Pressable
              testID="cq-submit"
              disabled={!!feedback || !entry.trim()}
              onPress={() => answer(entry)}
              style={({ pressed }) => [
                styles.submit,
                (!entry.trim() || feedback) && styles.submitOff,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Pressable testID="cq-skip" onPress={skip} disabled={!!feedback} style={styles.skip} hitSlop={8}>
        <Text style={styles.skipText}>Skip ›</Text>
      </Pressable>
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
      <Text style={styles.resultScore}>{score}<Text style={styles.resultOutOf}> / {total}</Text></Text>
      <Text style={styles.resultTime}>Time: {timeTaken.toFixed(1)}s</Text>

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
  back: { position: 'absolute', top: 16, left: 16, padding: 6 },
  backText: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.7 },

  // Level select
  selectRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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

  // Play
  playRoot: { flex: 1, paddingTop: 56, paddingHorizontal: 18, paddingBottom: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  correctText: { color: COLORS.correct, fontSize: 18, fontWeight: '800' },
  timeText: { fontSize: 22, fontWeight: '800' },
  dots: { flexDirection: 'row', gap: 5, marginTop: 10, justifyContent: 'center' },
  dot: { width: 14, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotDone: { backgroundColor: COLORS.correct },
  dotCurrent: { backgroundColor: COLORS.accent },

  body: { paddingTop: 18, paddingBottom: 8, alignItems: 'stretch' },
  prompt: { color: COLORS.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8, marginBottom: 18, lineHeight: 30 },

  options: { gap: 12 },
  option: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.cardBorder, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  optionText: { color: COLORS.ink, fontSize: 20, fontWeight: '700' },
  optionRight: { borderColor: COLORS.correct, backgroundColor: COLORS.correctBg },
  optionWrong: { borderColor: COLORS.wrong, backgroundColor: COLORS.wrongBg },

  entryWrap: { alignItems: 'center', gap: 12 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.cardBorder, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16, fontSize: 22, fontWeight: '800', color: COLORS.ink,
    minWidth: 200, textAlign: 'center',
  },
  inputRight: { borderColor: COLORS.correct, backgroundColor: COLORS.correctBg },
  inputWrong: { borderColor: COLORS.wrong, backgroundColor: COLORS.wrongBg },
  unit: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  answerReveal: { color: COLORS.warn, fontSize: 15, fontWeight: '700' },
  submit: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  submitOff: { backgroundColor: 'rgba(255,255,255,0.15)' },
  submitText: { color: COLORS.accentText, fontSize: 18, fontWeight: '800' },

  skip: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, marginTop: 4 },
  skipText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '700' },

  // Result
  resultRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  resultLevel: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  resultScore: { color: COLORS.accent, fontSize: 88, fontWeight: '900', marginTop: 4 },
  resultOutOf: { color: COLORS.textMuted, fontSize: 40, fontWeight: '800' },
  resultTime: { color: COLORS.textMuted, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  resultSub: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  primary: { backgroundColor: COLORS.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, marginTop: 16, width: '100%', maxWidth: 320, alignItems: 'center' },
  primaryText: { color: COLORS.accentText, fontSize: 20, fontWeight: '800' },
  outline: { borderWidth: 2, borderColor: COLORS.textMuted, borderRadius: 14, paddingVertical: 13, marginTop: 12, width: '100%', maxWidth: 320, alignItems: 'center' },
  outlineText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
