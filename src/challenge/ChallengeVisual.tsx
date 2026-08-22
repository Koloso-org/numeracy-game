import { StyleSheet, Text, View } from 'react-native';
import { Visual } from './questions';

const INK = '#203020';
const LINE = 'rgba(32,48,32,0.35)';
const FILL = '#EAF2E3';
const DOT = '#B4341A';

export default function ChallengeVisual({ visual }: { visual: Visual }) {
  return (
    <View style={styles.card}>
      {visual.kind === 'rectangle' && <RectVisual {...visual} />}
      {visual.kind === 'coordinate' && <CoordVisual {...visual} />}
      {visual.kind === 'net' && <NetVisual {...visual} />}
    </View>
  );
}

function RectVisual({ w, h, unit }: { w: number; h: number; unit: string }) {
  const maxPx = 150;
  const scale = maxPx / Math.max(w, h);
  const W = Math.round(w * scale);
  const H = Math.round(h * scale);
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.dim}>{w} {unit}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.rect, { width: W, height: H }]} />
        <Text style={[styles.dim, { marginLeft: 8 }]}>{h} {unit}</Text>
      </View>
    </View>
  );
}

function CoordVisual({ size, point }: { size: number; point: [number, number] }) {
  const cell = 22;
  const pad = 16;
  const gw = size * cell;
  const nums = Array.from({ length: size + 1 });
  return (
    <View style={{ width: gw + pad + 8, height: gw + pad + 8 }}>
      {nums.map((_, i) => (
        <View key={`v${i}`} style={{ position: 'absolute', left: pad + i * cell, top: 0, width: 1, height: gw, backgroundColor: LINE }} />
      ))}
      {nums.map((_, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', left: pad, top: i * cell, width: gw, height: 1, backgroundColor: LINE }} />
      ))}
      {/* axes emphasised */}
      <View style={{ position: 'absolute', left: pad, top: 0, width: 2, height: gw, backgroundColor: INK }} />
      <View style={{ position: 'absolute', left: pad, top: gw - 1, width: gw, height: 2, backgroundColor: INK }} />
      {nums.map((_, i) => (
        <Text key={`x${i}`} style={{ position: 'absolute', left: pad + i * cell - 3, top: gw + 3, fontSize: 9, color: INK }}>{i}</Text>
      ))}
      {nums.map((_, i) => (
        <Text key={`y${i}`} style={{ position: 'absolute', left: 2, top: (size - i) * cell - 6, fontSize: 9, color: INK }}>{i}</Text>
      ))}
      <View style={{ position: 'absolute', left: pad + point[0] * cell - 6, top: (size - point[1]) * cell - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: DOT, borderWidth: 2, borderColor: '#fff' }} />
    </View>
  );
}

function NetVisual({ grid }: { grid: string[] }) {
  const cell = 30;
  return (
    <View>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, ci) => (
            <View key={ci} style={c === '#' ? styles.netCell : { width: cell, height: cell }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const CELL = 30;
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  rect: { borderWidth: 2, borderColor: INK, backgroundColor: FILL },
  dim: { color: INK, fontSize: 13, fontWeight: '800' },
  netCell: { width: CELL, height: CELL, borderWidth: 2, borderColor: INK, backgroundColor: FILL },
});
