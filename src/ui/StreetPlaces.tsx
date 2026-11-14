import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native';

import { content } from '../content';
import { type GameState, landmarkStage, viewShop } from '../core';
import { useGame } from '../store';
import { Button } from './kit';
import { lotContent, tapLot } from './lotActions';
import { strings } from './strings';
import { colors, space } from './theme';
import { useNow } from './useNow';

/** True while VoiceOver or TalkBack is on. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => current && setOn(value));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return on;
}

function label(lot: number, game: GameState, now: number): string | null {
  const here = lotContent(lot);
  if (!here) return null;
  if (here.kind === 'shop') {
    const shop = content.shops[here.id];
    if (game.shops[here.id]) return strings.a11y.shopLot(shop.name, viewShop(game, content, here.id, now).readyCount);
    const unlocksAt = content.unlockLevel.shops[here.id];
    return game.level >= unlocksAt
      ? strings.a11y.shopForSale(shop.name, shop.levels[0].cost)
      : strings.a11y.shopLocked(shop.name, unlocksAt);
  }
  const landmark = content.landmarks[here.id];
  const unlocksAt = content.unlockLevel.landmarks[here.id];
  return game.level >= unlocksAt
    ? strings.a11y.landmark(landmark.name, landmarkStage(game, here.id), landmark.stages.length)
    : strings.a11y.landmarkLocked(landmark.name, unlocksAt);
}

/**
 * The street as a row of buttons, shown only while a screen reader is on.
 * The street itself is one drawing, which a screen reader cannot look inside,
 * so each place gets a button that does what tapping it on the street does.
 */
export function StreetPlaces() {
  const screenReader = useScreenReader();
  if (!screenReader) return null;
  return <Places />;
}

function Places() {
  const game = useGame((s) => s.game);
  const now = useNow(1000);
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      contentContainerStyle={styles.row}
      accessibilityRole="menu"
      accessibilityLabel={strings.a11y.places}
    >
      {Array.from({ length: content.street.lotCount }, (_, lot) => {
        const text = label(lot, game, now);
        return text ? (
          <Button key={lot} small kind="secondary" label={text} haptic={false} onPress={() => tapLot(lot)} />
        ) : null;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, backgroundColor: colors.panel, borderBottomWidth: 2, borderColor: colors.panelEdge },
  row: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
});
