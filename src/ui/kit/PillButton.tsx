import { StyleSheet, View } from 'react-native';

import { Bouncy } from '../Bouncy';
import { colors, radius, space, TAP } from '../theme';
import { Txt } from './Txt';

/** A small rounded button for a header, with an optional badge counting what is waiting behind it. */
export function PillButton({
  label,
  badge = 0,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  badge?: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.button}
      hitSlop={6}
    >
      <Txt variant="label">{label}</Txt>
      {badge > 0 && (
        <View style={styles.badge}>
          <Txt variant="small" style={styles.badgeText}>
            {badge}
          </Txt>
        </View>
      )}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.well,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.inkOnDark, fontVariant: ['tabular-nums'] },
});
