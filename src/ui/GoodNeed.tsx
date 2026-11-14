import { StyleSheet, View } from 'react-native';

import { content } from '../content';
import { GoodIcon } from './GoodIcon';
import { Txt } from './kit';
import { strings } from './strings';
import { colors, radius } from './theme';

/** A good with how many the player has against how many are needed. Green when there are enough. */
export function GoodNeed({
  good,
  owned,
  needed,
  size = 28,
}: {
  good: string;
  owned: number;
  needed: number;
  size?: number;
}) {
  const name = content.goods[good]?.name ?? good;
  const enough = owned >= needed;
  return (
    <View style={styles.chip} accessible accessibilityLabel={strings.a11y.need(name, owned, needed)}>
      <GoodIcon good={good} size={size} />
      <Txt variant="label" style={[styles.count, { color: enough ? colors.good : colors.bad }]}>
        {strings.have(Math.min(owned, 999), needed)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 2,
  },
  count: { fontVariant: ['tabular-nums'] },
});
