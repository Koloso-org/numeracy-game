import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme';
import { Level } from '../challenge/questions';
import { ChallengeRank, getChallengeTop, getMyChallengeRank } from '../challengeLeaderboard';
import { isSupabaseConfigured } from '../supabase';

const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', expert: 'Expert' };

export default function ChallengeLeaderboardScreen({
  level,
  username,
  onBack,
}: {
  level: Level;
  username: string | null;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<ChallengeRank[]>([]);
  const [me, setMe] = useState<ChallengeRank | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    (async () => {
      const [t, m] = await Promise.all([getChallengeTop(level, 20), getMyChallengeRank(level)]);
      if (!active) return;
      setTop(t);
      setMe(m);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [level]);

  const meInTop = me != null && top.some((e) => e.username === me.username);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>🏆 {LEVEL_LABEL[level]}</Text>
        <View style={{ width: 54 }} />
      </View>

      {!isSupabaseConfigured ? (
        <View style={styles.centered}>
          <Text style={styles.emptyBig}>Not connected yet</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.accent} size="large" /></View>
      ) : top.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyBig}>No scores yet</Text>
          <Text style={styles.emptyText}>Be the first on the {LEVEL_LABEL[level]} board!</Text>
        </View>
      ) : (
        <>
          <View style={styles.colHeader}>
            <Text style={[styles.colRank, styles.colHeadText]}>#</Text>
            <Text style={[styles.colName, styles.colHeadText]}>NAME</Text>
            <Text style={[styles.colScore, styles.colHeadText]}>SCORE</Text>
            <Text style={[styles.colTime, styles.colHeadText]}>TIME</Text>
          </View>
          <FlatList
            data={top}
            keyExtractor={(item) => item.username}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <Row entry={item} highlight={item.username === username} />}
          />
        </>
      )}

      {isSupabaseConfigured && me && !meInTop && (
        <View style={styles.pinned}><Row entry={me} highlight /></View>
      )}
    </View>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const bg = rank === 1 ? COLORS.accent : rank === 2 ? '#AEB6B1' : rank === 3 ? '#B46004' : null;
  if (bg == null) return <Text style={styles.rankPlain}>{rank}</Text>;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: rank === 1 ? COLORS.accentText : '#FFFFFF' }]}>{rank}</Text>
    </View>
  );
}

function Row({ entry, highlight }: { entry: ChallengeRank; highlight: boolean }) {
  return (
    <View style={[styles.row, highlight && styles.rowMe]}>
      <View style={styles.rankCell}><RankBadge rank={entry.rank} /></View>
      <Text style={styles.name} numberOfLines={1}>
        {entry.username}{highlight ? '  (You)' : ''}
      </Text>
      <Text style={styles.score}>{entry.best_score}/10</Text>
      <Text style={styles.time}>{(entry.best_time_ms / 1000).toFixed(1)}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  back: { color: COLORS.accent, fontSize: 17, fontWeight: '700', width: 54 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyBig: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center' },

  colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26, marginBottom: 6 },
  colHeadText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  colRank: { width: 40 },
  colName: { flex: 1 },
  colScore: { width: 62, textAlign: 'right' },
  colTime: { width: 62, textAlign: 'right' },

  list: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 8 },
  rowMe: { backgroundColor: COLORS.selectBg, borderLeftWidth: 5, borderLeftColor: COLORS.accent, paddingLeft: 5 },
  rankCell: { width: 40, justifyContent: 'center' },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 14, fontWeight: '800' },
  rankPlain: { width: 28, textAlign: 'center', color: COLORS.inkMuted, fontSize: 15, fontWeight: '800' },
  name: { flex: 1, color: COLORS.ink, fontSize: 16, fontWeight: '700' },
  score: { width: 62, textAlign: 'right', color: COLORS.correct, fontSize: 15, fontWeight: '800' },
  time: { width: 62, textAlign: 'right', color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  pinned: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
});
