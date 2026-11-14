import { Image, type StyleProp, StyleSheet, type TextStyle, View } from 'react-native';

import { ui } from '../../art';
import { strings } from '../strings';
import { Txt } from './Txt';

const icons = { coins: ui.ui_coin, gems: ui.ui_gem, xp: ui.ui_xp_star };

export type AmountKind = keyof typeof icons;

/** A painted currency icon, fitted in a square. Decorative: pair it with a number or label. */
export function CurrencyIcon({ kind, size = 20 }: { kind: AmountKind; size?: number }) {
  return (
    <Image
      source={icons[kind].source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** A currency icon with a number, read aloud as "120 coins". */
export function Amount({
  kind,
  value,
  prefix = '',
  size = 20,
  textStyle,
}: {
  kind: AmountKind;
  value: number;
  prefix?: string;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={strings.a11y.amount[kind](value)}>
      <CurrencyIcon kind={kind} size={size} />
      <Txt variant="label" style={[styles.number, textStyle]}>
        {prefix}
        {strings.number(value)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  number: { fontVariant: ['tabular-nums'] },
});
