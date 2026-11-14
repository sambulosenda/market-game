import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, MAX_FONT_SCALE } from '../theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'small';

/** All text in the game. Scales with the system text size, up to 130%. */
export function Txt({ variant = 'body', soft, style, ...rest }: TextProps & { variant?: Variant; soft?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[styles.base, styles[variant], soft && styles.soft, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.ink },
  soft: { color: colors.inkSoft },
  title: { fontSize: 24, fontWeight: '800' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16 },
  label: { fontSize: 15, fontWeight: '700' },
  small: { fontSize: 13 },
});
