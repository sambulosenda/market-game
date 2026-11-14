import { content } from '../content';
import { gameStore } from '../store';
import { haptics } from './haptics';
import { failText, strings } from './strings';
import { openSheet, toast } from './uiStore';

const shopByLot = new Map<number, string>();
const landmarkByLot = new Map<number, string>();
for (const shop of Object.values(content.shops)) shopByLot.set(shop.lot, shop.id);
for (const landmark of Object.values(content.landmarks)) landmarkByLot.set(landmark.lot, landmark.id);

export type LotContent = { kind: 'shop'; id: string } | { kind: 'landmark'; id: string } | null;

/** What stands on a lot, from the content config. */
export function lotContent(lot: number): LotContent {
  const shop = shopByLot.get(lot);
  if (shop) return { kind: 'shop', id: shop };
  const landmark = landmarkByLot.get(lot);
  return landmark ? { kind: 'landmark', id: landmark } : null;
}

/**
 * What a tap on a lot does. A shop with something ready is collected, so the
 * loop runs without opening a menu; otherwise the tap opens the right sheet.
 * Used by the street and by the screen reader's list of places.
 */
export function tapLot(lot: number) {
  const store = gameStore.getState();
  const here = lotContent(lot);
  if (here?.kind === 'shop') {
    const failed = store.game.shops[here.id] ? store.collect(here.id) : 'shop_not_owned';
    if (failed === null) {
      haptics.success();
    } else if (failed === 'pantry_full') {
      haptics.warning();
      toast(failText(failed));
    } else {
      haptics.select();
      openSheet({ kind: 'shop', id: here.id });
    }
    return;
  }
  haptics.select();
  if (here?.kind !== 'landmark') return;
  const unlocksAt = content.unlockLevel.landmarks[here.id];
  if (store.game.level >= unlocksAt) openSheet({ kind: 'landmark', id: here.id });
  else toast(strings.landmarkLocked(content.landmarks[here.id].name, unlocksAt));
}
