import { type ReactNode, type Ref, useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../strings';
import { colors, radius, space, TAP } from '../theme';
import { useReduceMotion } from '../useReduceMotion';
import { Txt } from './Txt';

type Props = {
  title: string;
  /** A short line under the title. */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Stays at the bottom of the sheet, below the scrolling content. */
  footer?: ReactNode;
  /** Gives the close button's view, for anything that needs to find it on screen. */
  closeRef?: Ref<React.ComponentRef<typeof View>>;
};

/**
 * A bottom sheet drawn above the street. It is an ordinary view, not a native
 * modal, so pop-ups and effects can sit above it. Mount it to open it and
 * unmount it to close it; it slides in and out by itself.
 */
export function Sheet({ title, subtitle, onClose, children, footer, closeRef }: Props) {
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={strings.close}
        />
      </Animated.View>
      <Animated.View
        entering={still ? FadeIn.duration(150) : SlideInDown.duration(220)}
        exiting={still ? FadeOut.duration(150) : SlideOutDown.duration(180)}
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
        accessibilityViewIsModal
      >
        <View style={styles.header}>
          <View style={styles.titles}>
            <Txt variant="title" accessibilityRole="header">
              {title}
            </Txt>
            {subtitle ? <Txt soft>{subtitle}</Txt> : null}
          </View>
          <Pressable
            ref={closeRef}
            onPress={onClose}
            style={styles.close}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.close}
          >
            <Txt variant="heading" soft>
              ✕
            </Txt>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 2,
    borderColor: colors.cardEdge,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
  },
  titles: { flex: 1, gap: 2 },
  close: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
});
