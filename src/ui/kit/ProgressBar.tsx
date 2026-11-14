import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

/** A filled bar, 0 to 1. Decorative: say the numbers in text beside it. */
export function ProgressBar({
  progress,
  color = colors.ring,
  height = 8,
}: {
  progress: number;
  color?: string;
  height?: number;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${percent}%`, height, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.well,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
});
