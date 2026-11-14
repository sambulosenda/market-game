import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { goodArt } from '../art';

/** A good's painted icon, fitted inside a square of `size` points. Decorative: pair it with the good's name. */
export function GoodIcon({ good, size = 32, style }: { good: string; size?: number; style?: StyleProp<ImageStyle> }) {
  const art = goodArt(good);
  if (!art) return null;
  return (
    <Image
      source={art.source}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
