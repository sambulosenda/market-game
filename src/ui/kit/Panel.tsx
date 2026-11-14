import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, space } from '../theme';

/** A cream card with a brown edge, like the painted panel. */
export function Panel({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.panel, style]} />;
}

/** A sunken area inside a panel, for lists and slots. */
export function Well({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.well, style]} />;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.cardEdge,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: space.md,
  },
  well: {
    backgroundColor: colors.well,
    borderRadius: radius.sm,
    padding: space.sm,
  },
});
