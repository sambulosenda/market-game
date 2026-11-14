import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptics } from './haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** A light haptic on press. Turn off when the action gives its own. */
  haptic?: boolean;
};

/**
 * The game's tap feedback for buttons: a quick squash on press and a short
 * spring back on release, with a light haptic. Use for everything tappable
 * outside the street canvas. Reduce motion leaves this on by design.
 */
export function Bouncy({ style, haptic = true, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.set(withTiming(0.94, { duration: 70 }));
        if (haptic) haptics.light();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, { damping: 8, stiffness: 300 }));
        onPressOut?.(e);
      }}
    />
  );
}
