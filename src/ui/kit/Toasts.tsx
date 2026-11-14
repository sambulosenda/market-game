import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useStore } from 'zustand';

import { colors, radius, space } from '../theme';
import { useReduceMotion } from '../useReduceMotion';
import { uiStore } from '../uiStore';
import { Txt } from './Txt';

/** Short messages near the bottom of the screen. They never take touches and go away by themselves. */
export function Toasts() {
  const toasts = useStore(uiStore, (s) => s.toasts);
  const still = useReduceMotion();
  return (
    <View style={styles.layer} pointerEvents="none">
      {toasts.map((toast) => (
        <Animated.View
          key={toast.id}
          entering={still ? FadeIn.duration(180) : FadeInDown.duration(180)}
          exiting={FadeOut.duration(200)}
          style={styles.toast}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Txt variant="label" style={styles.text}>
            {toast.text}
          </Txt>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 96,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  toast: {
    backgroundColor: colors.toast,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { color: colors.inkOnDark, textAlign: 'center' },
});
