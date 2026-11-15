import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ui } from '../art';
import { content, type Recipe } from '../content';
import {
  type GameState,
  pantrySpace,
  queueSlotCost,
  recipeAvailable,
  recipeDurationMs,
  recipeSpeedMultiplier,
  shopLevelConfig,
  skipTimerCost,
  viewMastery,
  viewShop,
} from '../core';
import { gameStore, useGame } from '../store';
import { Bouncy } from './Bouncy';
import { report } from './feedback';
import { GoodIcon } from './GoodIcon';
import { GoodNeed } from './GoodNeed';
import { Amount, Button, Popup, ProgressBar, Sheet, Stars, Txt, Well } from './kit';
import { strings } from './strings';
import { colors, radius, space, TAP } from './theme';
import { targetIds } from './tutorial/steps';
import { Target, useTargetRef } from './tutorial/targets';
import { closeSheet } from './uiStore';
import { useNow } from './useNow';

const recipesOf = (shopId: string) => Object.values(content.recipes).filter((r) => r.shop === shopId);

/** A shop: its queue, what it can make, and its upgrade. For a shop not yet owned, how to open it. */
export function ShopSheet({ shopId }: { shopId: string }) {
  const game = useGame((s) => s.game);
  const config = content.shops[shopId];
  if (!config) return null;
  return game.shops[shopId] ? <OwnedShop shopId={shopId} game={game} /> : <ShopForSale shopId={shopId} game={game} />;
}

function OwnedShop({ shopId, game }: { shopId: string; game: GameState }) {
  const closeRef = useTargetRef(targetIds.closeSheet);
  const now = useNow(500);
  const config = content.shops[shopId];
  const shop = game.shops[shopId];
  const view = viewShop(game, content, shopId, now);
  const level = shopLevelConfig(content, shopId, shop);
  const queueFull = view.batches.length >= view.queueSize;
  const next = config.levels[shop.level];
  const clock = Math.max(now, game.clock);
  // Spending gems always asks first.
  const [confirming, setConfirming] = useState<'skip' | 'slot' | null>(null);
  const skipCost = skipTimerCost(game, content, shopId, now);
  const slotCost = queueSlotCost(game, content, shopId);
  const baking = view.active ? content.goods[content.recipes[view.active.batch.recipe].output].name : '';
  const confirmCost = confirming === 'skip' ? skipCost : confirming === 'slot' ? slotCost : null;

  return (
    <>
      <Sheet
        title={config.name}
        subtitle={strings.shopLevel(shop.level, config.levels.length)}
        onClose={closeSheet}
        closeRef={closeRef}
        footer={
          view.readyCount > 0 ? (
            <>
              {pantrySpace(game, content) === 0 && (
                <Txt variant="small" soft style={styles.centre}>
                  {strings.pantryFull}
                </Txt>
              )}
              <Target id={targetIds.collect}>
                <Button
                  label={strings.collect(view.readyCount)}
                  haptic={false}
                  onPress={() => report(gameStore.getState().collect(shopId), 'success')}
                />
              </Target>
            </>
          ) : null
        }
      >
        <View style={styles.sectionHead}>
          <Txt variant="heading">{strings.queue(view.batches.length, view.queueSize)}</Txt>
        </View>
        <View style={styles.queue}>
          {Array.from({ length: view.queueSize }, (_, i) => {
            const b = view.batches[i];
            if (!b) {
              return (
                <View key={`e${i}`} style={[styles.slot, styles.slotEmpty]}>
                  <Txt variant="small" soft>
                    {strings.emptySlot}
                  </Txt>
                </View>
              );
            }
            const good = content.recipes[b.batch.recipe].output;
            const status =
              b.status === 'ready'
                ? strings.ready
                : b.status === 'baking'
                  ? strings.remaining(b.endsAt - clock)
                  : strings.waiting;
            return (
              <View
                key={b.batch.id}
                style={[styles.slot, b.status === 'ready' && styles.slotReady]}
                accessible
                accessibilityLabel={`${content.goods[good].name}, ${status}`}
              >
                <GoodIcon good={good} size={32} />
                <Txt variant="small" style={styles.tabular}>
                  {status}
                </Txt>
                {b.status === 'baking' && <ProgressBar progress={b.progress} height={5} />}
              </View>
            );
          })}
        </View>

        {(skipCost !== null || slotCost !== null) && (
          <View style={styles.gemRow}>
            {skipCost !== null && (
              <Button
                small
                kind="secondary"
                style={styles.gemButton}
                label={strings.gems.skip}
                accessibilityLabel={`${strings.gems.skip}, ${strings.a11y.amount.gems(skipCost)}`}
                trailing={<Amount kind="gems" value={skipCost} size={18} />}
                onPress={() => setConfirming('skip')}
              />
            )}
            {slotCost !== null && (
              <Button
                small
                kind="secondary"
                style={styles.gemButton}
                label={strings.gems.slot}
                accessibilityLabel={`${strings.gems.slot}, ${strings.a11y.amount.gems(slotCost)}`}
                trailing={<Amount kind="gems" value={slotCost} size={18} />}
                onPress={() => setConfirming('slot')}
              />
            )}
          </View>
        )}

        <Txt variant="heading">{strings.recipes}</Txt>
        <Txt variant="small" soft>
          {strings.mastery.hint(content.economy.mastery.speedPercentPerStar)}
        </Txt>
        {queueFull && (
          <Txt variant="small" soft>
            {strings.queueFull}
          </Txt>
        )}
        <View style={styles.recipes}>
          {recipesOf(shopId).map((recipe) => (
            <Target key={recipe.id} id={targetIds.recipe(recipe.id)}>
              <RecipeRow
                recipe={recipe}
                game={game}
                durationSec={
                  recipeDurationMs(content, recipe.id, level, recipeSpeedMultiplier(game, content, recipe.id)) / 1000
                }
                queueFull={queueFull}
              />
            </Target>
          ))}
        </View>

        <Well style={styles.upgrade}>
          {next ? (
            <>
              <View style={styles.upgradeText}>
                <Txt variant="label">{strings.shopLevel(shop.level + 1, config.levels.length)}</Txt>
                <Txt variant="small" soft>
                  {strings.upgradeShopGain(
                    next.queueSize,
                    Math.round((1 - next.durationMultiplier) * 100),
                    recipesOf(shopId)
                      .filter((r) => r.shopLevel === shop.level + 1)
                      .map((r) => content.goods[r.output].name),
                  )}
                </Txt>
              </View>
              <Button
                small
                kind="secondary"
                label={strings.upgrade}
                accessibilityLabel={`${strings.upgrade}, ${strings.a11y.cost(next.cost)}`}
                trailing={<Amount kind="coins" value={next.cost} size={18} />}
                disabled={game.wallet.coins < next.cost}
                haptic={false}
                onPress={() => report(gameStore.getState().upgradeShop(shopId), 'success')}
              />
            </>
          ) : (
            <Txt soft>{strings.shopMaxLevel}</Txt>
          )}
        </Well>
      </Sheet>
      {confirming && confirmCost !== null && (
        <Popup
          title={confirming === 'skip' ? strings.gems.skipTitle : strings.gems.slotTitle}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button
                label={strings.gems.spend}
                accessibilityLabel={`${strings.gems.spend}, ${strings.a11y.amount.gems(confirmCost)}`}
                trailing={<Amount kind="gems" value={confirmCost} size={18} textStyle={styles.onDark} />}
                disabled={game.wallet.gems < confirmCost}
                haptic={false}
                onPress={() => {
                  const store = gameStore.getState();
                  report(confirming === 'skip' ? store.skipTimer(shopId) : store.buyQueueSlot(shopId), 'success');
                  setConfirming(null);
                }}
              />
              <Button kind="secondary" label={strings.gems.keep} onPress={() => setConfirming(null)} />
            </>
          }
        >
          <Txt style={styles.centre}>
            {confirming === 'skip'
              ? strings.gems.skipBody(baking, confirmCost)
              : strings.gems.slotBody(config.name, confirmCost)}
          </Txt>
          {game.wallet.gems < confirmCost && (
            <Txt variant="small" style={[styles.centre, styles.short]}>
              {strings.gems.short(game.wallet.gems)}
            </Txt>
          )}
        </Popup>
      )}
    </>
  );
}

function RecipeRow({
  recipe,
  game,
  durationSec,
  queueFull,
}: {
  recipe: Recipe;
  game: GameState;
  durationSec: number;
  queueFull: boolean;
}) {
  const name = content.goods[recipe.output].name;
  const duration = strings.duration(durationSec);
  const shop = game.shops[recipe.shop];

  if (!recipeAvailable(game, content, recipe.id)) {
    const unlocksAt = content.unlockLevel.recipes[recipe.id];
    const why = game.level < unlocksAt ? strings.recipeAtLevel(unlocksAt) : strings.recipeAtShopLevel(recipe.shopLevel);
    return (
      <View
        style={[styles.recipe, styles.recipeLocked]}
        accessible
        accessibilityLabel={strings.a11y.lockedRecipe(name, why)}
      >
        <GoodIcon good={recipe.output} size={40} style={styles.dim} />
        <View style={styles.recipeText}>
          <Txt variant="label" soft>
            {name}
          </Txt>
          <Txt variant="small" soft>
            {why}
          </Txt>
        </View>
        <Image source={ui.ui_lock.source} style={styles.lock} resizeMode="contain" accessible={false} />
      </View>
    );
  }

  const hasInputs = recipe.inputs.every((i) => (game.pantry[i.good] ?? 0) >= i.qty);
  const blocked = queueFull || !hasInputs || !shop;
  const mastery = viewMastery(game, content, recipe.output);
  return (
    <Bouncy
      accessibilityRole="button"
      accessibilityLabel={`${strings.a11y.makeRecipe(name, duration)}. ${strings.mastery.a11y(mastery)}`}
      accessibilityState={{ disabled: blocked }}
      haptic={false}
      // A blocked recipe still takes the tap, so the player is told why.
      onPress={() => report(gameStore.getState().startBatch(recipe.shop, recipe.id))}
      style={[styles.recipe, blocked && styles.recipeBlocked]}
    >
      <GoodIcon good={recipe.output} size={40} />
      <View style={styles.recipeText}>
        <Txt variant="label">{name}</Txt>
        <Txt variant="small" soft>
          {duration}
        </Txt>
        <View style={styles.mastery}>
          <Stars earned={mastery.stars} max={mastery.maxStars} size={13} />
          {mastery.nextAt !== null && (
            <Txt variant="small" soft style={styles.tabular}>
              {strings.mastery.count(mastery.made, mastery.nextAt)}
            </Txt>
          )}
        </View>
      </View>
      {recipe.inputs.length > 0 && (
        <View style={styles.inputs}>
          {recipe.inputs.map((i) => (
            <GoodNeed key={i.good} good={i.good} owned={game.pantry[i.good] ?? 0} needed={i.qty} size={24} />
          ))}
        </View>
      )}
    </Bouncy>
  );
}

function ShopForSale({ shopId, game }: { shopId: string; game: GameState }) {
  const closeRef = useTargetRef(targetIds.closeSheet);
  const config = content.shops[shopId];
  const unlocksAt = content.unlockLevel.shops[shopId];
  const locked = game.level < unlocksAt;
  const cost = config.levels[0].cost;
  return (
    <Sheet
      title={config.name}
      subtitle={locked ? strings.shopLocked(unlocksAt) : strings.shopForSale}
      onClose={closeSheet}
      closeRef={closeRef}
      footer={
        locked ? null : (
          <Target id={targetIds.buyShop}>
            <Button
              label={strings.buyShop}
              accessibilityLabel={`${strings.buyShop}, ${strings.a11y.cost(cost)}`}
              trailing={
                <Amount kind="coins" value={cost} textStyle={game.wallet.coins >= cost ? styles.onDark : undefined} />
              }
              disabled={game.wallet.coins < cost}
              haptic={false}
              onPress={() => report(gameStore.getState().buyShop(shopId), 'success')}
            />
          </Target>
        )
      }
    >
      <Txt variant="heading">{strings.shopMakes}</Txt>
      <View style={styles.makes}>
        {recipesOf(shopId).map((r) => (
          <View key={r.id} style={styles.make} accessible accessibilityLabel={content.goods[r.output].name}>
            <GoodIcon good={r.output} size={40} />
            <Txt variant="small" numberOfLines={2} style={styles.centre}>
              {content.goods[r.output].name}
            </Txt>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  onDark: { color: colors.inkOnDark },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  queue: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gemRow: { flexDirection: 'row', gap: space.sm },
  gemButton: { flex: 1 },
  short: { color: colors.bad },
  slot: {
    flex: 1,
    // With slots bought for gems a queue can outgrow one row; it then wraps.
    minWidth: 60,
    minHeight: 76,
    borderRadius: radius.sm,
    padding: space.sm,
    gap: 2,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.panelEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotReady: { borderColor: colors.ring, borderWidth: 2.5 },
  slotEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  recipes: { gap: space.sm },
  recipe: {
    minHeight: TAP + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.cardEdge,
  },
  recipeBlocked: {
    backgroundColor: colors.well,
    borderColor: colors.disabledEdge,
  },
  recipeLocked: {
    backgroundColor: 'transparent',
    borderColor: colors.panelEdge,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
  },
  recipeText: { flex: 1 },
  mastery: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  inputs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: '45%',
  },
  dim: { opacity: 0.45 },
  lock: { width: 22, height: 28 },
  upgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  upgradeText: { flex: 1, gap: 2 },
  makes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  make: { width: 72, alignItems: 'center', gap: 2 },
});
