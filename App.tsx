import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Difficulty,
  POINTS_PER_CORRECT,
  Question,
  ROUND_LENGTH,
  generateQuestion,
} from './src/game';

type Screen = 'home' | 'playing' | 'results';

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const startRound = (level: Difficulty) => {
    setDifficulty(level);
    setScore(0);
    setQuestionNumber(1);
    setSelected(null);
    setQuestion(generateQuestion(level));
    setScreen('playing');
  };

  const handleAnswer = (choice: number) => {
    if (selected !== null || !question) return; // ignore taps after answering
    setSelected(choice);
    if (choice === question.answer) setScore((s) => s + POINTS_PER_CORRECT);

    // Brief pause so the learner sees the correct/incorrect feedback.
    setTimeout(() => {
      if (questionNumber >= ROUND_LENGTH) {
        setScreen('results');
        return;
      }
      setQuestionNumber((n) => n + 1);
      setSelected(null);
      setQuestion(generateQuestion(difficulty));
    }, 700);
  };

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.title}>🔢 Numeracy Game</Text>
        <Text style={styles.subtitle}>Sharpen your mental maths</Text>
        <Text style={styles.prompt}>Choose a difficulty</Text>
        {DIFFICULTIES.map(({ key, label }) => (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.levelButton, pressed && styles.pressed]}
            onPress={() => startRound(key)}
          >
            <Text style={styles.levelButtonText}>{label}</Text>
          </Pressable>
        ))}
      </SafeAreaView>
    );
  }

  if (screen === 'results') {
    const maxScore = ROUND_LENGTH * POINTS_PER_CORRECT;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.title}>Round complete! 🎉</Text>
        <Text style={styles.score}>
          {score} / {maxScore}
        </Text>
        <Text style={styles.subtitle}>
          {score === maxScore
            ? 'Perfect score!'
            : score >= maxScore * 0.7
              ? 'Great work!'
              : 'Keep practising!'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.levelButton, pressed && styles.pressed]}
          onPress={() => startRound(difficulty)}
        >
          <Text style={styles.levelButtonText}>Play again</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.secondaryButtonText}>Change difficulty</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // screen === 'playing'
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.hud}>
        <Text style={styles.hudText}>
          Question {questionNumber}/{ROUND_LENGTH}
        </Text>
        <Text style={styles.hudText}>Score {score}</Text>
      </View>

      {question && (
        <>
          <Text style={styles.question}>
            {question.a} {question.op} {question.b}
          </Text>
          <View style={styles.optionsGrid}>
            {question.options.map((option) => {
              const isAnswered = selected !== null;
              const isCorrect = option === question.answer;
              const isChosen = option === selected;
              return (
                <Pressable
                  key={option}
                  disabled={isAnswered}
                  onPress={() => handleAnswer(option)}
                  style={({ pressed }) => [
                    styles.optionButton,
                    pressed && styles.pressed,
                    isAnswered && isCorrect && styles.optionCorrect,
                    isAnswered && isChosen && !isCorrect && styles.optionWrong,
                  ]}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  accent: '#38bdf8',
  text: '#f8fafc',
  muted: '#94a3b8',
  correct: '#22c55e',
  wrong: '#ef4444',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  prompt: {
    fontSize: 14,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  levelButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    marginVertical: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  levelButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  hud: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  question: {
    fontSize: 56,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 40,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  optionButton: {
    backgroundColor: COLORS.card,
    width: 130,
    height: 90,
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
    fontSize: 32,
    fontWeight: '700',
  },
  score: {
    fontSize: 64,
    fontWeight: '800',
    color: COLORS.accent,
    marginVertical: 8,
  },
});
