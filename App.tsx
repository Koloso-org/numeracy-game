import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GAME_SECONDS, Round, generateRound, scoreRound } from './src/rules';
import { loadHighScore, saveHighScore } from './src/storage';
import { COLORS } from './src/theme';
import { currentUsername, signOut } from './src/auth';
import { supabase } from './src/supabase';
import { LeaderboardEntry, getMyRank, submitScore } from './src/leaderboard';
import AccountScreen from './src/screens/AccountScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';

type Screen = 'home' | 'playing' | 'gameover' | 'account' | 'leaderboard';
const TICK_MS = 100;

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [highScore, setHighScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    loadHighScore().then(setHighScore);
  }, []);

  // Track login state.
  useEffect(() => {
    if (!supabase) return;
    currentUsername().then(setUsername);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const meta = session?.user?.user_metadata as { username?: string } | undefined;
      setUsername(meta?.username ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setLastScore(finalScore);
    saveHighScore(finalScore).then(setHighScore);
    setScreen('gameover');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {screen === 'home' && (
        <HomeScreen
          username={username}
          highScore={highScore}
          onPlay={() => setScreen('playing')}
          onLeaderboard={() => setScreen('leaderboard')}
          onAccount={() => setScreen('account')}
          onLogout={async () => {
            await signOut();
            setUsername(null);
          }}
        />
      )}
      {screen === 'playing' && <PlayScreen onGameOver={handleGameOver} />}
      {screen === 'gameover' && (
        <GameOverScreen
          score={lastScore}
          highScore={highScore}
          username={username}
          onPlayAgain={() => setScreen('playing')}
          onHome={() => setScreen('home')}
          onLeaderboard={() => setScreen('leaderboard')}
          onLogin={() => setScreen('account')}
        />
      )}
      {screen === 'account' && (
        <AccountScreen
          onAuthed={() => setScreen('home')}
          onGuest={() => setScreen('home')}
        />
      )}
      {screen === 'leaderboard' && (
        <LeaderboardScreen username={username} onBack={() => setScreen('home')} />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function HomeScreen({
  username,
  highScore,
  onPlay,
  onLeaderboard,
  onAccount,
  onLogout,
}: {
  username: string | null;
  highScore: number;
  onPlay: () => void;
  onLeaderboard: () => void;
  onAccount: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Image
        source={require('./assets/koloso-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Number Rules</Text>
      <Text style={styles.subtitle}>Pick every rule that's true for the number.</Text>

      <View style={styles.rulesCard}>
        <Text style={styles.rulesLine}>➕ <Text style={styles.bold}>+1</Text> for each true rule you pick</Text>
        <Text style={styles.rulesLine}>➖ <Text style={styles.bold}>−1</Text> for a false rule you pick</Text>
        <Text style={styles.rulesLine}>➖ <Text style={styles.bold}>−1</Text> for a true rule you miss</Text>
        <Text style={styles.rulesLine}>⏱️ Score as much as you can in <Text style={styles.bold}>2 minutes</Text></Text>
      </View>

      {highScore !== 0 && (
        <View style={styles.bestPill}>
          <Text style={styles.bestPillText}>🏆 Your best: {highScore}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={onPlay}
      >
        <Text style={styles.primaryButtonText}>Play</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        onPress={onLeaderboard}
      >
        <Text style={styles.outlineButtonText}>🏆 Leaderboard</Text>
      </Pressable>

      {username ? (
        <View style={styles.authRow}>
          <Text style={styles.authText}>Signed in as {username}</Text>
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.authLink}>Log out</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onAccount} style={styles.linkButton}>
          <Text style={styles.authLink}>Log in / Sign up to join the leaderboard</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

function PlayScreen({ onGameOver }: { onGameOver: (score: number) => void }) {
  const [round, setRound] = useState<Round>(() => generateRound());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);

  const timeRef = useRef(GAME_SECONDS);
  const scoreRef = useRef(0);
  const overRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - TICK_MS / 1000);
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0 && !overRef.current) {
        overRef.current = true;
        clearInterval(id);
        onGameOver(scoreRef.current);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [onGameOver]);

  const toggle = (id: string) => {
    if (revealed || overRef.current) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (revealed || overRef.current) return;
    const delta = scoreRound(round.rules, selected);
    scoreRef.current += delta;
    setScore(scoreRef.current);
    setLastDelta(delta);
    setRevealed(true);

    setTimeout(() => {
      if (overRef.current) return;
      setRound(generateRound());
      setSelected(new Set());
      setRevealed(false);
      setLastDelta(null);
    }, 1100);
  };

  const seconds = Math.ceil(timeLeft);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timePct = Math.max(0, Math.min(1, timeLeft / GAME_SECONDS));
  const timeColor = seconds <= 10 ? COLORS.wrong : seconds <= 30 ? COLORS.warn : COLORS.correct;

  return (
    <View style={styles.playRoot}>
      <View style={styles.topRow}>
        <Text style={styles.scoreText}>{score}</Text>
        <Text style={[styles.timeText, { color: timeColor }]}>
          {mm}:{ss.toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.timeBarTrack}>
        <View style={[styles.timeBarFill, { width: `${timePct * 100}%`, backgroundColor: timeColor }]} />
      </View>

      <View style={styles.numberWrap}>
        <Text style={styles.number}>{round.number}</Text>
        {revealed && lastDelta !== null && (
          <Text style={[styles.delta, { color: lastDelta >= 0 ? COLORS.correct : COLORS.wrong }]}>
            {lastDelta >= 0 ? `+${lastDelta}` : lastDelta}
          </Text>
        )}
      </View>

      <View style={styles.ruleList}>
        {round.rules.map((rule) => {
          const isSelected = selected.has(rule.id);
          const rowStyles: StyleProp<ViewStyle>[] = [styles.ruleRow];
          let mark = '';
          if (!revealed) {
            if (isSelected) rowStyles.push(styles.ruleSelected);
          } else if (rule.holds && isSelected) {
            rowStyles.push(styles.ruleCorrect);
            mark = '✓';
          } else if (rule.holds && !isSelected) {
            rowStyles.push(styles.ruleMissed);
            mark = '✓';
          } else if (!rule.holds && isSelected) {
            rowStyles.push(styles.ruleWrong);
            mark = '✗';
          } else {
            rowStyles.push(styles.ruleFalseOk);
          }
          return (
            <Pressable
              key={rule.id}
              disabled={revealed}
              onPress={() => toggle(rule.id)}
              style={({ pressed }) => [...rowStyles, pressed && !revealed && styles.pressed]}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.ruleLabel}>{rule.label}</Text>
              {mark !== '' && <Text style={styles.ruleMark}>{mark}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={revealed}
        onPress={submit}
        style={({ pressed }) => [
          styles.submitButton,
          revealed && styles.submitDisabled,
          pressed && !revealed && styles.pressed,
        ]}
      >
        <Text style={styles.submitText}>{revealed ? '…' : 'Submit'}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

function GameOverScreen({
  score,
  highScore,
  username,
  onPlayAgain,
  onHome,
  onLeaderboard,
  onLogin,
}: {
  score: number;
  highScore: number;
  username: string | null;
  onPlayAgain: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
  onLogin: () => void;
}) {
  const [saving, setSaving] = useState<boolean>(!!username && !!supabase);
  const [rank, setRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    let active = true;
    if (username && supabase) {
      (async () => {
        await submitScore(score);
        const mine = await getMyRank();
        if (active) {
          setRank(mine);
          setSaving(false);
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [score, username]);

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Time's up! ⏱️</Text>
      <Text style={styles.finalScore}>{score}</Text>

      {username ? (
        saving ? (
          <View style={styles.rankRow}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.subtitle}>  Saving your score…</Text>
          </View>
        ) : rank ? (
          <Text style={styles.subtitle}>
            🏆 Best: {rank.best_score}  ·  Rank #{rank.rank}
          </Text>
        ) : (
          <Text style={styles.subtitle}>🏆 Your best: {highScore}</Text>
        )
      ) : (
        <Pressable onPress={onLogin} style={styles.linkButton}>
          <Text style={styles.authLink}>Log in to save your score & join the leaderboard</Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={onPlayAgain}
      >
        <Text style={styles.primaryButtonText}>Play again</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
        onPress={onLeaderboard}
      >
        <Text style={styles.outlineButtonText}>🏆 Leaderboard</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        onPress={onHome}
      >
        <Text style={styles.secondaryButtonText}>Home</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  logo: { width: 150, height: 63, marginBottom: 18 },
  title: { fontSize: 34, fontWeight: '800', color: COLORS.accent, textAlign: 'center' },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 10,
    marginBottom: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  bold: { color: COLORS.ink, fontWeight: '800' },

  rulesCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    padding: 18,
    gap: 8,
    marginBottom: 8,
    width: '100%',
    maxWidth: 340,
  },
  rulesLine: { color: COLORS.ink, fontSize: 15 },

  bestPill: {
    backgroundColor: COLORS.selectBg,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginVertical: 14,
  },
  bestPillText: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },

  primaryButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: { color: COLORS.accentText, fontSize: 22, fontWeight: '800' },
  outlineButton: {
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginTop: 48,
  },
  outlineButtonText: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryButtonText: { color: COLORS.textMuted, fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  pressed: { opacity: 0.7 },

  authRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  authText: { color: COLORS.textMuted, fontSize: 15 },
  authLink: { color: COLORS.accent, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  // Play screen
  playRoot: { flex: 1, paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreText: { color: COLORS.text, fontSize: 36, fontWeight: '800' },
  timeText: { fontSize: 28, fontWeight: '800' },
  timeBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
    overflow: 'hidden',
  },
  timeBarFill: { height: '100%', borderRadius: 5 },

  numberWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  number: { color: COLORS.text, fontSize: 76, fontWeight: '800' },
  delta: { fontSize: 24, fontWeight: '800', marginTop: 2 },

  ruleList: { flex: 1, justifyContent: 'center', gap: 12 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  ruleSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.selectBg },
  ruleCorrect: { borderColor: COLORS.correct, backgroundColor: COLORS.correctBg },
  ruleMissed: { borderColor: COLORS.warn, backgroundColor: COLORS.missBg },
  ruleWrong: { borderColor: COLORS.wrong, backgroundColor: COLORS.wrongBg },
  ruleFalseOk: { opacity: 0.55 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.inkMuted,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  checkboxTick: { color: COLORS.accentText, fontSize: 16, fontWeight: '900' },
  ruleLabel: { color: COLORS.ink, fontSize: 19, fontWeight: '600', flex: 1 },
  ruleMark: { color: COLORS.ink, fontSize: 20, fontWeight: '800', marginLeft: 8 },

  submitButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  submitText: { color: COLORS.accentText, fontSize: 20, fontWeight: '800' },

  finalScore: { color: COLORS.accent, fontSize: 72, fontWeight: '800', marginVertical: 6 },
});
