import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  BASE_POINTS,
  Question,
  START_TIME,
  TIME_BONUS,
  TIME_PENALTY,
  generateQuestion,
  multiplierForCombo,
} from './src/game';
import { loadHighScore, saveHighScore } from './src/storage';

type Screen = 'home' | 'playing' | 'gameover';
type Feedback = 'correct' | 'wrong' | null;

const TICK_MS = 100; // timer resolution

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [highScore, setHighScore] = useState(0);

  // Load the saved best score once on start-up.
  useEffect(() => {
    loadHighScore().then(setHighScore);
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    saveHighScore(finalScore).then(setHighScore);
    setScreen('gameover');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {screen === 'home' && (
        <HomeScreen highScore={highScore} onStart={() => setScreen('playing')} />
      )}
      {screen === 'playing' && <PlayScreen onGameOver={handleGameOver} />}
      {screen === 'gameover' && (
        <GameOverScreen
          highScore={highScore}
          onPlayAgain={() => setScreen('playing')}
          onHome={() => setScreen('home')}
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function HomeScreen({
  highScore,
  onStart,
}: {
  highScore: number;
  onStart: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.logo}>⚡</Text>
      <Text style={styles.title}>Number Blitz</Text>
      <Text style={styles.subtitle}>How many can you solve before time runs out?</Text>

      {highScore > 0 && (
        <View style={styles.bestPill}>
          <Text style={styles.bestPillText}>🏆 Best: {highScore}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={onStart}
      >
        <Text style={styles.primaryButtonText}>Play</Text>
      </Pressable>

      <Text style={styles.hint}>
        ✅ Correct = +time & bigger combo{'\n'}❌ Wrong = −time & combo lost
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

function PlayScreen({ onGameOver }: { onGameOver: (score: number) => void }) {
  const [question, setQuestion] = useState<Question>(() => generateQuestion(0));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Refs so the interval callback always sees current values without resetting.
  const timeRef = useRef(START_TIME);
  const correctCountRef = useRef(0);
  const scoreRef = useRef(0);
  const overRef = useRef(false);

  // Countdown loop.
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

  const answer = (choice: number) => {
    if (selected !== null || overRef.current) return;
    setSelected(choice);
    const isCorrect = choice === question.answer;

    if (isCorrect) {
      const nextCombo = combo + 1;
      const gained = BASE_POINTS * multiplierForCombo(nextCombo);
      scoreRef.current += gained;
      correctCountRef.current += 1;
      timeRef.current = Math.min(START_TIME, timeRef.current + TIME_BONUS);
      setScore(scoreRef.current);
      setCombo(nextCombo);
      setFeedback('correct');
    } else {
      timeRef.current = Math.max(0, timeRef.current - TIME_PENALTY);
      setCombo(0);
      setFeedback('wrong');
    }
    setTimeLeft(timeRef.current);

    // Brief feedback flash, then the next question.
    setTimeout(() => {
      if (overRef.current) return;
      setSelected(null);
      setFeedback(null);
      setQuestion(generateQuestion(correctCountRef.current));
    }, 250);
  };

  const multiplier = multiplierForCombo(combo);
  const timePct = Math.max(0, Math.min(1, timeLeft / START_TIME));
  const timeColor = timeLeft <= 5 ? COLORS.wrong : timeLeft <= 10 ? COLORS.warn : COLORS.accent;

  return (
    <View style={styles.playRoot}>
      <View style={styles.topRow}>
        <Text style={styles.scoreText}>{score}</Text>
        {combo >= 2 && (
          <Text style={styles.comboText}>🔥 {combo} · ×{multiplier}</Text>
        )}
      </View>

      {/* Time bar */}
      <View style={styles.timeBarTrack}>
        <View
          style={[
            styles.timeBarFill,
            { width: `${timePct * 100}%`, backgroundColor: timeColor },
          ]}
        />
      </View>
      <Text style={[styles.timeText, { color: timeColor }]}>
        {timeLeft.toFixed(1)}s
      </Text>

      <View style={styles.promptWrap}>
        <Text style={styles.prompt}>{question.prompt}</Text>
      </View>

      <View style={styles.optionsGrid}>
        {question.options.map((option) => {
          const answered = selected !== null;
          const isCorrect = option === question.answer;
          const isChosen = option === selected;
          return (
            <Pressable
              key={option}
              disabled={answered}
              onPress={() => answer(option)}
              style={({ pressed }) => [
                styles.optionButton,
                pressed && styles.pressed,
                answered && isCorrect && styles.optionCorrect,
                answered && isChosen && !isCorrect && styles.optionWrong,
              ]}
            >
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.feedbackSlot}>
        <Text style={styles.feedbackText}>
          {feedback === 'correct' ? '✅' : feedback === 'wrong' ? '❌' : ' '}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function GameOverScreen({
  highScore,
  onPlayAgain,
  onHome,
}: {
  highScore: number;
  onPlayAgain: () => void;
  onHome: () => void;
}) {
  // We only reach here after saveHighScore has run, so `highScore` is current.
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Time's up! ⏱️</Text>
      <View style={styles.bestPill}>
        <Text style={styles.bestPillText}>🏆 Best: {highScore}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        onPress={onPlayAgain}
      >
        <Text style={styles.primaryButtonText}>Play again</Text>
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

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  accent: '#38bdf8',
  warn: '#f59e0b',
  text: '#f8fafc',
  muted: '#94a3b8',
  correct: '#22c55e',
  wrong: '#ef4444',
};

// `Animated` is imported for future polish (e.g. tile pop); referenced here so
// the import isn't flagged as unused while we iterate.
void Animated;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  bestPill: {
    backgroundColor: COLORS.card,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginVertical: 12,
  },
  bestPillText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 16,
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 28,
  },

  // Play screen
  playRoot: {
    flex: 1,
    paddingTop: 70,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreText: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
  },
  comboText: {
    color: COLORS.warn,
    fontSize: 18,
    fontWeight: '800',
  },
  timeBarTrack: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    marginTop: 16,
    overflow: 'hidden',
  },
  timeBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  promptWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  prompt: {
    fontSize: 64,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  optionButton: {
    backgroundColor: COLORS.card,
    width: 140,
    height: 84,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCorrect: {
    backgroundColor: COLORS.correct,
  },
  optionWrong: {
    backgroundColor: COLORS.wrong,
  },
  optionText: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '800',
  },
  feedbackSlot: {
    height: 48,
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 32,
  },
});
