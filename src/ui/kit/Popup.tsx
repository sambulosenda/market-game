import { type ReactNode, useEffect } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { colors, radius, space } from '../theme';
import { Txt } from './Txt';

/** A card in the middle of the screen for news the player should see: a level-up, a welcome back. */
export function Popup({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
      <Animated.View entering={ZoomIn.duration(220)} style={styles.card} accessibilityViewIsModal>
        <Txt variant="title" style={styles.title} accessibilityRole="header">
          {title}
        </Txt>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </Animated.View>
    </Animated.View>
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
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    maxHeight: '80%',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.cardEdge,
    padding: space.xl,
    gap: space.md,
  },
  title: { textAlign: 'center' },
  scroll: { flexGrow: 0 },
  body: { gap: space.sm },
  footer: { gap: space.sm },
});
