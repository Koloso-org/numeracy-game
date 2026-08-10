import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

// "Marked exercise book" palette (from the Cross-Number concept note).
const CN = {
  ink: '#1F2A3A',
  red: '#C23616',
  green: '#36771D',
  paper: '#FFFDF4',
  cream: '#FFF2CC',
  muted: '#8A8064',
  selected: '#FFE49B',
  page: '#F4ECD6',
  lockBg: '#E7F0DD',
};

// ---- Reference puzzle: Cross-Number No. 2 (theme: powers) ------------------
// Solution grid, '#' = black. Entries & numbering are DERIVED from this at
// runtime by the standard crossword scan — never hand-maintained.
const SOLUTION = [
  '1964#1764',
  '7#2#1#8#0',
  '22500#169',
  '8###8#2#6',
  '#484#150#',
  '2#6#5###1',
  '444#12345',
  '0#0#2#4#2',
  '1600#1331',
];
const N = 9;

const ACROSS_CLUES: Record<number, string> = {
  1: 'The year Zambia became independent',
  3: '42 squared',
  7: '150 × 150',
  8: '13 × 13',
  9: '22 squared',
  11: 'The number of minutes in two and a half hours',
  15: 'Four, plus forty, plus four hundred',
  16: 'The first five counting numbers, in order',
  18: 'The number of metres in 1.6 kilometres',
  19: 'A palindrome: 11 × 11 × 11',
};
const DOWN_CLUES: Record<number, string> = {
  1: '12 × 12 × 12',
  2: 'The number of small squares on a 25 × 25 grid',
  4: '5 × 5 × 5 × 5 × 5 × 5 × 5',
  5: 'Multiply twelve 2s together',
  6: '12 × 9',
  10: 'The number of seconds in one day',
  12: '7 × 7 × 7 × 7',
  13: '8 cubed',
  14: '39 squared',
  17: '7 cubed',
};

type Dir = 'across' | 'down';
interface Cell { r: number; c: number; }
interface Entry {
  key: string;
  number: number;
  dir: Dir;
  cells: Cell[];
  answer: string;
  clue: string;
}

const keyOf = (r: number, c: number) => `${r},${c}`;

function buildStructure() {
  const grid = SOLUTION.map((row) => row.split(''));
  const isBlack = (r: number, c: number) =>
    r < 0 || c < 0 || r >= N || c >= N || grid[r][c] === '#';

  const numberAt: Record<string, number> = {};
  const across: Entry[] = [];
  const down: Entry[] = [];
  let num = 0;

  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      if (isBlack(r, c)) continue;
      const startA = isBlack(r, c - 1) && !isBlack(r, c + 1);
      const startD = isBlack(r - 1, c) && !isBlack(r + 1, c);
      if (startA || startD) {
        num += 1;
        numberAt[keyOf(r, c)] = num;
      }
      if (startA) {
        const cells: Cell[] = [];
        let cc = c;
        let ans = '';
        while (!isBlack(r, cc)) { cells.push({ r, c: cc }); ans += grid[r][cc]; cc += 1; }
        across.push({ key: `${num}A`, number: num, dir: 'across', cells, answer: ans, clue: ACROSS_CLUES[num] ?? '' });
      }
      if (startD) {
        const cells: Cell[] = [];
        let rr = r;
        let ans = '';
        while (!isBlack(rr, c)) { cells.push({ r: rr, c }); ans += grid[rr][c]; rr += 1; }
        down.push({ key: `${num}D`, number: num, dir: 'down', cells, answer: ans, clue: DOWN_CLUES[num] ?? '' });
      }
    }
  }
  return { grid, isBlack, numberAt, across, down, ordered: [...across, ...down] };
}

export default function CrossNumberScreen({ onBack }: { onBack: () => void }) {
  const S = useMemo(buildStructure, []);
  const { width } = useWindowDimensions();
  const cell = Math.max(30, Math.floor((Math.min(width, 400) - 28) / N));

  const [values, setValues] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Cell | null>(null);
  const [dir, setDir] = useState<Dir>('across');
  const [markCount, setMarkCount] = useState(0);

  const entryAt = (r: number, c: number, d: Dir): Entry | undefined =>
    (d === 'across' ? S.across : S.down).find((e) => e.cells.some((x) => x.r === r && x.c === c));

  const current: Entry | undefined = sel ? entryAt(sel.r, sel.c, dir) ?? entryAt(sel.r, sel.c, dir === 'across' ? 'down' : 'across') : undefined;

  const solvedCount = S.ordered.filter((e) => e.cells.every((x) => locked.has(keyOf(x.r, x.c)))).length;
  const isSolved = S.ordered.every((e) => e.cells.every((x) => values[keyOf(x.r, x.c)] === S.grid[x.r][x.c]));

  const selectCell = (r: number, c: number) => {
    if (S.isBlack(r, c)) return;
    const hasA = !!entryAt(r, c, 'across');
    const hasD = !!entryAt(r, c, 'down');
    if (sel && sel.r === r && sel.c === c && hasA && hasD) {
      setDir((d) => (d === 'across' ? 'down' : 'across'));
      return;
    }
    setSel({ r, c });
    setDir(hasA && (dir === 'across' || !hasD) ? 'across' : hasD ? 'down' : 'across');
  };

  const selectEntry = (e: Entry) => {
    const firstEmpty = e.cells.find((x) => !values[keyOf(x.r, x.c)] && !locked.has(keyOf(x.r, x.c)));
    const target = firstEmpty ?? e.cells[0];
    setSel({ r: target.r, c: target.c });
    setDir(e.dir);
  };

  const advance = () => {
    if (!current || !sel) return;
    const idx = current.cells.findIndex((x) => x.r === sel.r && x.c === sel.c);
    for (let i = idx + 1; i < current.cells.length; i += 1) {
      const x = current.cells[i];
      if (!locked.has(keyOf(x.r, x.c))) { setSel({ r: x.r, c: x.c }); return; }
    }
  };

  const inputDigit = (d: string) => {
    if (!sel) return;
    const k = keyOf(sel.r, sel.c);
    if (locked.has(k)) { advance(); return; }
    setValues((v) => ({ ...v, [k]: d }));
    setWrong((w) => { if (!w.has(k)) return w; const n = new Set(w); n.delete(k); return n; });
    advance();
  };

  const backspace = () => {
    if (!sel || !current) return;
    const k = keyOf(sel.r, sel.c);
    if (values[k]) {
      if (locked.has(k)) return;
      setValues((v) => { const n = { ...v }; delete n[k]; return n; });
      return;
    }
    const idx = current.cells.findIndex((x) => x.r === sel.r && x.c === sel.c);
    for (let i = idx - 1; i >= 0; i -= 1) {
      const x = current.cells[i];
      if (!locked.has(keyOf(x.r, x.c))) {
        setSel({ r: x.r, c: x.c });
        setValues((v) => { const n = { ...v }; delete n[keyOf(x.r, x.c)]; return n; });
        return;
      }
    }
  };

  const clearAll = () => {
    setValues((v) => {
      const n: Record<string, string> = {};
      for (const kk of Object.keys(v)) if (locked.has(kk)) n[kk] = v[kk];
      return n;
    });
    setWrong(new Set());
  };

  const markIt = () => {
    const newWrong = new Set<string>();
    const newLocked = new Set(locked);
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        if (S.isBlack(r, c)) continue;
        const k = keyOf(r, c);
        const val = values[k];
        if (val && val !== S.grid[r][c]) newWrong.add(k);
      }
    }
    for (const e of S.ordered) {
      if (e.cells.every((x) => values[keyOf(x.r, x.c)] === S.grid[x.r][x.c])) {
        for (const x of e.cells) newLocked.add(keyOf(x.r, x.c));
      }
    }
    setWrong(newWrong);
    setLocked(newLocked);
    setMarkCount((m) => m + 1);
  };

  const revealCurrent = () => {
    if (!current) return;
    setValues((v) => {
      const n = { ...v };
      for (const x of current.cells) n[keyOf(x.r, x.c)] = S.grid[x.r][x.c];
      return n;
    });
    setLocked((l) => {
      const n = new Set(l);
      for (const x of current.cells) n.add(keyOf(x.r, x.c));
      return n;
    });
    setWrong((w) => {
      const n = new Set(w);
      for (const x of current.cells) n.delete(keyOf(x.r, x.c));
      return n;
    });
  };

  const inEntry = (r: number, c: number) =>
    current?.cells.some((x) => x.r === r && x.c === c) ?? false;

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Games</Text>
        </Pressable>
        <Text style={styles.wordmark}>KOLOSO</Text>
        <Text style={styles.headerMeta}>MATHS · No. 2</Text>
      </View>
      <Text style={styles.gameTitle}>Cross-Number</Text>
      <Text style={styles.strap}>Every answer is a number. Where answers cross, the digits match.</Text>

      {/* Clue bar */}
      <View style={styles.clueBar}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (!current) return;
            const i = S.ordered.findIndex((e) => e.key === current.key);
            selectEntry(S.ordered[(i - 1 + S.ordered.length) % S.ordered.length]);
          }}
        >
          <Text style={styles.clueArrow}>‹</Text>
        </Pressable>
        <View style={styles.clueTextWrap}>
          {current ? (
            <>
              <Text style={styles.clueRef}>
                {current.number} {current.dir === 'across' ? 'Across' : 'Down'} ({current.answer.length})
              </Text>
              <Text style={styles.clueText}>{current.clue}</Text>
            </>
          ) : (
            <Text style={styles.clueText}>Tap a cell to begin.</Text>
          )}
        </View>
        <Pressable
          testID="clue-next"
          hitSlop={10}
          onPress={() => {
            if (!current) return;
            const i = S.ordered.findIndex((e) => e.key === current.key);
            selectEntry(S.ordered[(i + 1) % S.ordered.length]);
          }}
        >
          <Text style={styles.clueArrow}>›</Text>
        </Pressable>
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        <View style={[styles.grid, { width: cell * N + 2 }]}>
          {Array.from({ length: N }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: N }).map((__, c) => {
                if (S.isBlack(r, c)) {
                  return <View key={c} style={[styles.black, { width: cell, height: cell }]} />;
                }
                const k = keyOf(r, c);
                const selected = sel?.r === r && sel?.c === c;
                const highlighted = inEntry(r, c);
                const isLocked = locked.has(k);
                const isWrong = wrong.has(k);
                const number = S.numberAt[k];
                return (
                  <Pressable
                    key={c}
                    testID={`cell-${r}-${c}`}
                    onPress={() => selectCell(r, c)}
                    style={[
                      styles.cell,
                      { width: cell, height: cell },
                      highlighted && styles.cellHighlight,
                      selected && styles.cellSelected,
                      isLocked && styles.cellLocked,
                    ]}
                  >
                    {number != null && <Text style={styles.cellNum}>{number}</Text>}
                    <Text
                      style={[
                        styles.cellDigit,
                        { fontSize: cell * 0.5 },
                        isLocked && { color: CN.green },
                      ]}
                    >
                      {values[k] ?? ''}
                    </Text>
                    {isWrong && <View style={[styles.wrongMark, { width: cell * 0.86, height: cell * 0.72 }]} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {isSolved && (
            <View style={styles.solvedWrap} pointerEvents="none">
              <View style={styles.solvedStamp}>
                <Text style={styles.solvedText}>SOLVED ✓</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.progress}>
          {solvedCount} of {S.ordered.length} solved{markCount > 0 ? `  ·  marked ${markCount}×` : ''}
        </Text>
        <View style={styles.toolButtons}>
          <Pressable testID="btn-reveal" onPress={revealCurrent} style={styles.revealBtn}>
            <Text style={styles.revealText}>Reveal</Text>
          </Pressable>
          <Pressable testID="btn-mark" onPress={markIt} style={styles.markBtn}>
            <Text style={styles.markText}>Mark it ✓</Text>
          </Pressable>
        </View>
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {keypad.map((d) => (
          <Pressable key={d} testID={`key-${d}`} onPress={() => inputDigit(d)} style={[styles.key, { width: cell * 1.15, height: cell * 1.05 }]}>
            <Text style={styles.keyText}>{d}</Text>
          </Pressable>
        ))}
        <Pressable testID="key-dir" onPress={() => setDir((x) => (x === 'across' ? 'down' : 'across'))} style={[styles.keyWide, { height: cell * 1.05 }]}>
          <Text style={styles.keyAlt}>⇄ {dir === 'across' ? 'Across' : 'Down'}</Text>
        </Pressable>
        <Pressable testID="key-del" onPress={backspace} style={[styles.keyWide, { height: cell * 1.05 }]}>
          <Text style={styles.keyAlt}>⌫ Delete</Text>
        </Pressable>
        <Pressable testID="key-clear" onPress={clearAll} style={[styles.keyWide, { height: cell * 1.05 }]}>
          <Text style={styles.keyAlt}>Clear all</Text>
        </Pressable>
      </View>

      {/* Clue lists */}
      <View style={styles.clueLists}>
        <ClueList title="Across" entries={S.across} current={current} locked={locked} grid={S.grid} onPick={selectEntry} />
        <ClueList title="Down" entries={S.down} current={current} locked={locked} grid={S.grid} onPick={selectEntry} />
      </View>
      <Text style={styles.footer}>Better learning outcomes. Built for African schools.</Text>
    </View>
  );
}

function ClueList({
  title, entries, current, locked, grid, onPick,
}: {
  title: string;
  entries: Entry[];
  current: Entry | undefined;
  locked: Set<string>;
  grid: string[][];
  onPick: (e: Entry) => void;
}) {
  return (
    <View style={styles.listCol}>
      <Text style={styles.listTitle}>{title}</Text>
      {entries.map((e) => {
        const done = e.cells.every((x) => locked.has(keyOf(x.r, x.c)));
        const active = current?.key === e.key;
        return (
          <Pressable key={e.key} onPress={() => onPick(e)} style={[styles.clueItem, active && styles.clueItemActive]}>
            <Text style={[styles.clueItemText, done && styles.clueItemDone]}>
              <Text style={styles.clueItemNum}>{e.number}</Text> {e.clue} ({e.answer.length}){done ? '  ✓' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CN.page, paddingHorizontal: 12, paddingTop: 44 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: CN.red, fontSize: 16, fontWeight: '800' },
  wordmark: { color: CN.red, fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  headerMeta: { color: CN.muted, fontSize: 12, fontWeight: '700' },
  gameTitle: { color: CN.ink, fontSize: 26, fontWeight: '900', marginTop: 6 },
  strap: { color: CN.muted, fontSize: 13, marginBottom: 8 },

  clueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CN.cream,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(31,42,58,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  clueArrow: { color: CN.ink, fontSize: 26, fontWeight: '900', paddingHorizontal: 6 },
  clueTextWrap: { flex: 1, paddingHorizontal: 6 },
  clueRef: { color: CN.red, fontSize: 12, fontWeight: '800' },
  clueText: { color: CN.ink, fontSize: 15, fontWeight: '600' },

  gridWrap: { alignItems: 'center' },
  grid: {
    borderWidth: 1,
    borderColor: CN.ink,
    backgroundColor: CN.ink,
    position: 'relative',
  },
  black: { backgroundColor: CN.ink },
  cell: {
    backgroundColor: CN.paper,
    borderWidth: 0.5,
    borderColor: 'rgba(31,42,58,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHighlight: { backgroundColor: CN.cream },
  cellSelected: { backgroundColor: CN.selected },
  cellLocked: { backgroundColor: CN.lockBg },
  cellNum: { position: 'absolute', top: 1, left: 2, fontSize: 9, color: CN.muted, fontWeight: '700' },
  cellDigit: { color: CN.ink, fontWeight: '800' },
  wrongMark: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: CN.red,
    borderRadius: 100,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.9,
  },

  solvedWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  solvedStamp: {
    borderWidth: 3,
    borderColor: CN.red,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(255,253,244,0.82)',
    transform: [{ rotate: '-8deg' }],
  },
  solvedText: { color: CN.red, fontSize: 30, fontWeight: '900', letterSpacing: 2 },

  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  progress: { color: CN.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  toolButtons: { flexDirection: 'row', gap: 8 },
  revealBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1.5, borderColor: CN.muted },
  revealText: { color: CN.ink, fontSize: 14, fontWeight: '700' },
  markBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: CN.red },
  markText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' },
  key: {
    backgroundColor: CN.paper,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(31,42,58,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: CN.ink, fontSize: 22, fontWeight: '800' },
  keyWide: {
    backgroundColor: CN.cream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(31,42,58,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    flexGrow: 1,
  },
  keyAlt: { color: CN.ink, fontSize: 15, fontWeight: '700' },

  clueLists: { flexDirection: 'row', gap: 12, marginTop: 16 },
  listCol: { flex: 1 },
  listTitle: { color: CN.red, fontSize: 14, fontWeight: '900', marginBottom: 6, letterSpacing: 1 },
  clueItem: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 6 },
  clueItemActive: { backgroundColor: CN.cream },
  clueItemText: { color: CN.ink, fontSize: 12.5, lineHeight: 17 },
  clueItemNum: { fontWeight: '900' },
  clueItemDone: { color: CN.green, textDecorationLine: 'line-through' },

  footer: { color: CN.muted, fontSize: 11, textAlign: 'center', marginTop: 18, marginBottom: 8 },
});
