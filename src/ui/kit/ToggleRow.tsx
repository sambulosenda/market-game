import { StyleSheet, Switch, View } from 'react-native';

import { colors, space, TAP } from '../theme';
import { Txt } from './Txt';

/** A setting with a switch. The whole row reads as one switch to a screen reader. */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  /** A short line under the label, for a setting that needs explaining. */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text} accessible={false} importantForAccessibility="no-hide-descendants">
        <Txt variant="label">{label}</Txt>
        {hint ? (
          <Txt variant="small" soft>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={hint}
        trackColor={{ false: colors.disabledEdge, true: colors.ring }}
        thumbColor={colors.panel}
        ios_backgroundColor={colors.disabledEdge}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TAP + 8, flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
});
