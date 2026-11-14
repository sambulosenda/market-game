import { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Bouncy } from '../Bouncy';
import { colors, radius, space, TAP } from '../theme';
import { Txt } from './Txt';

type Props = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Shown after the label, for a price or an icon. */
  trailing?: ReactNode;
  small?: boolean;
  accessibilityLabel?: string;
  /** 'link' for a button that opens a web page. */
  accessibilityRole?: 'button' | 'link';
  /** Turn off when the action gives its own haptic. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The game's button, shaped like the painted ones: a rounded bar with a darker lower edge. */
export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  trailing,
  small,
  accessibilityLabel,
  accessibilityRole = 'button',
  haptic,
  style,
}: Props) {
  const look = disabled ? styles.disabled : kind === 'primary' ? styles.primary : styles.secondary;
  const onDark = kind === 'primary' && !disabled;
  return (
    <Bouncy
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      haptic={haptic}
      onPress={onPress}
      style={[styles.button, small && styles.small, look, style]}
    >
      <Txt variant="label" style={[onDark && styles.onDark, disabled && styles.disabledText]} numberOfLines={1}>
        {label}
      </Txt>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TAP + 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderBottomWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  small: { minHeight: TAP, paddingHorizontal: space.md },
  primary: { backgroundColor: colors.primary, borderColor: colors.primaryEdge },
  secondary: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondaryEdge,
  },
  disabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabledEdge,
  },
  onDark: { color: colors.inkOnDark },
  disabledText: { color: colors.inkSoft },
  trailing: { flexDirection: 'row', alignItems: 'center' },
});
