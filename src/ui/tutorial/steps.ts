import type { Content } from '../../content/schema';
import { canFillOrder, type GameState, pantrySpace, recipeAvailable, viewShop } from '../../core';
import type { SheetState } from '../uiStore';

/**
 * The onboarding has no script and no saved progress. It looks at the game
 * and points at the one thing that moves a new player forward: make, collect,
 * fill an order, and at last open the second shop. It ends for good once a
 * second shop is owned, so an existing player never sees it.
 */
export type TutorialTarget =
  /** A shop's lot on the street. */
  | { kind: 'lot'; shop: string }
  /** A control that registered itself under this id. */
  | { kind: 'view'; id: string };

export const targetIds = {
  recipe: (recipeId: string) => `recipe:${recipeId}`,
  fill: (orderId: number) => `fill:${orderId}`,
  collect: 'collect',
  buyShop: 'buy-shop',
  closeSheet: 'close-sheet',
};

type Input = {
  game: GameState;
  content: Content;
  now: number;
  sheet: SheetState;
  /** A pop-up is showing, so nothing behind it should be pointed at. */
  popupOpen: boolean;
};

export function tutorialDone(game: GameState, content: Content): boolean {
  return Object.keys(game.shops).some((id) => !content.shops[id]?.startsOwned);
}

export function tutorialTarget({ game, content, now, sheet, popupOpen }: Input): TutorialTarget | null {
  if (popupOpen || tutorialDone(game, content)) return null;
  const starter = Object.values(content.shops).find((s) => s.startsOwned && game.shops[s.id]);
  const second = Object.values(content.shops)
    .filter((s) => !s.startsOwned)
    .sort((a, b) => content.unlockLevel.shops[a.id] - content.unlockLevel.shops[b.id])[0];
  if (!starter || !second) return null;

  const view = viewShop(game, content, starter.id, now);
  const canCollect = view.readyCount > 0 && pantrySpace(game, content) > 0;
  const queueHasRoom = view.batches.length < view.queueSize;
  const canBuy = game.level >= content.unlockLevel.shops[second.id] && game.wallet.coins >= second.levels[0].cost;
  const fillable = game.orders.slots.find((slot) => 'order' in slot && canFillOrder(game, slot.order));
  const close: TutorialTarget = { kind: 'view', id: targetIds.closeSheet };

  if (sheet?.kind === 'shop' && sheet.id === second.id) {
    return canBuy ? { kind: 'view', id: targetIds.buyShop } : close;
  }
  if (sheet?.kind === 'shop' && sheet.id === starter.id) {
    if (canCollect) return { kind: 'view', id: targetIds.collect };
    // Something outside the sheet is the next step.
    if (canBuy || fillable) return close;
    if (!queueHasRoom) return null;
    const recipe = recipeToMake(game, content, starter.id);
    return recipe ? { kind: 'view', id: targetIds.recipe(recipe) } : null;
  }
  // Any other sheet is the player exploring. Leave them to it.
  if (sheet) return null;

  if (canBuy) return { kind: 'lot', shop: second.id };
  if (fillable && 'order' in fillable) return { kind: 'view', id: targetIds.fill(fillable.order.id) };
  // A tap on the shop collects when something is ready, and opens it otherwise.
  if (canCollect || queueHasRoom) return { kind: 'lot', shop: starter.id };
  return null;
}

/** The recipe in the shop that an open order is short of, or failing that the first one available. */
function recipeToMake(game: GameState, content: Content, shopId: string): string | null {
  const recipes = Object.values(content.recipes).filter(
    (r) =>
      r.shop === shopId &&
      recipeAvailable(game, content, r.id) &&
      r.inputs.every((i) => (game.pantry[i.good] ?? 0) >= i.qty),
  );
  const coming: Record<string, number> = { ...game.pantry };
  for (const batch of game.shops[shopId]?.queue ?? []) {
    const good = content.recipes[batch.recipe].output;
    coming[good] = (coming[good] ?? 0) + 1;
  }
  for (const slot of game.orders.slots) {
    if (!('order' in slot)) continue;
    for (const item of slot.order.items) {
      const recipe = recipes.find((r) => r.output === item.good);
      if (recipe && (coming[item.good] ?? 0) < item.qty) return recipe.id;
    }
  }
  return recipes[0]?.id ?? null;
}
