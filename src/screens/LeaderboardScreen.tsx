import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS } from '../theme';
import { LeaderboardEntry, getMyRank, getTopScores } from '../leaderboard';
import { isSupabaseConfigured } from '../supabase';

export default function LeaderboardScreen({
  username,
  onBack,
}: {
  username: string | null;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [t, m] = await Promise.all([getTopScores(20), getMyRank()]);
      if (!active) return;
      setTop(t);
      setMe(m);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const meInTop = me != null && top.some((e) => e.username === me.username);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <View style={{ width: 54 }} />
      </View>

      {!isSupabaseConfigured ? (
        <View style={styles.centered}>
          <Text style={styles.emptyBig}>Not connected yet</Text>
          <Text style={styles.emptyText}>
            The leaderboard turns on once the game is linked to its Supabase project.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : top.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyBig}>No scores yet</Text>
          <Text style={styles.emptyText}>Be the first to get on the board!</Text>
        </View>
      ) : (
        <FlatList
          data={top}
          keyExtractor={(item) => item.username}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Row entry={item} highlight={item.username === username} />
          )}
        />
      )}

      {/* If the player is ranked but outside the top 20, show their row pinned. */}
      {isSupabaseConfigured && me && !meInTop && (
        <View style={styles.pinned}>
          <Row entry={me} highlight />
        </View>
      )}
    </View>
  );
}

function Row({ entry, highlight }: { entry: LeaderboardEntry; highlight: boolean }) {
  return (
    <View style={[styles.row, highlight && styles.rowMe]}>
      <Text style={[styles.rank, highlight && styles.textMe]}>#{entry.rank}</Text>
      <Text style={[styles.name, highlight && styles.textMe]} numberOfLines={1}>
        {entry.username}
        {highlight ? '  (you)' : ''}
      </Text>
      <Text style={[styles.score, highlight && styles.textMe]}>{entry.best_score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  back: { color: COLORS.accent, fontSize: 17, fontWeight: '700', width: 54 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyBig: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowMe: { backgroundColor: COLORS.selectBg, borderWidth: 2, borderColor: COLORS.accent },
  rank: { color: COLORS.inkMuted, fontSize: 16, fontWeight: '800', width: 52 },
  name: { color: COLORS.ink, fontSize: 18, fontWeight: '700', flex: 1 },
  score: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
  textMe: { color: COLORS.correct },
  pinned: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
});
