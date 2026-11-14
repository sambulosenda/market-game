import type { Content } from '../content/schema';
import { strings } from './strings';
import type { LevelUp } from './uiStore';

/** One thing a level-up brought. `key` is "gems", "slot", or a kind and id such as "shop:dairy". */
export type LevelUpLine = { key: string; text: string };

/** Everything a level-up brought, in the order the player will meet it. */
export function levelUpLines(levelUp: LevelUp, content: Content): LevelUpLine[] {
  const { level, gems, unlocks } = levelUp;
  const lines: LevelUpLine[] = [];
  if (gems > 0) lines.push({ key: 'gems', text: strings.levelUpGems(gems) });
  for (const id of unlocks.shops) {
    // A shop the player has had from the start is not news.
    if (!content.shops[id]?.startsOwned)
      lines.push({ key: `shop:${id}`, text: strings.unlockedShop(content.shops[id]?.name ?? id) });
  }
  for (const id of unlocks.recipes) {
    const good = content.recipes[id]?.output;
    lines.push({ key: `recipe:${id}`, text: strings.unlockedRecipe(content.goods[good]?.name ?? id) });
  }
  for (const id of unlocks.landmarks)
    lines.push({ key: `landmark:${id}`, text: strings.unlockedLandmark(content.landmarks[id]?.name ?? id) });
  const slots = content.levels[level - 1]?.orderSlots ?? 0;
  const before = content.levels[level - 2]?.orderSlots ?? slots;
  if (slots > before) lines.push({ key: 'slot', text: strings.unlockedSlot });
  return lines;
}
