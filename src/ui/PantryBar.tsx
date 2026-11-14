import { StyleSheet, Text, View } from 'react-native';

import { content } from '../content';
import { useGame } from '../store';
import { strings } from './strings';
import { colors } from './theme';

/** Goods the player owns. The full pantry screen with capacity comes with T2.6 and T4.4. */
export function PantryBar() {
  const pantry = useGame((s) => s.game.pantry);
  const items = Object.entries(pantry).filter(([, n]) => n > 0);
  return (
    <View style={styles.bar} accessibilityRole="summary">
      <Text style={styles.label}>{strings.pantry}</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{strings.pantryEmpty}</Text>
      ) : (
        <View style={styles.items}>
          {items.map(([good, n]) => (
            <View key={good} style={styles.chip}>
              <Text style={styles.chipText}>
                {content.goods[good]?.name ?? good} × {n}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: colors.panel,
    borderBottomWidth: 2,
    borderColor: colors.panelEdge,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { fontSize: 15, color: colors.inkSoft },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.panelEdge },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: '600' },
});
