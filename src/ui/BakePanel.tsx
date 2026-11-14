import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { content } from '../content';
import { pantrySpace, recipeAvailable, viewShop } from '../core';
import { gameStore, useGame } from '../store';
import { Bouncy } from './Bouncy';
import { GoodIcon } from './GoodIcon';
import { strings } from './strings';
import { colors } from './theme';
import { useNow } from './useNow';

/**
 * A minimal panel for the one shop on the street: its recipes and its queue.
 * This is a stand-in until the full shop sheet (T4.2) arrives.
 */
export function BakePanel({ shopId }: { shopId: string }) {
  const game = useGame((s) => s.game);
  const now = useNow(500);
  const shop = content.shops[shopId];
  if (!game.shops[shopId]) return null;
  const view = viewShop(game, content, shopId, now);
  const full = view.batches.length >= view.queueSize;
  const recipes = Object.values(content.recipes).filter((r) => r.shop === shopId && recipeAvailable(game, content, r.id));
  const pantryFull = pantrySpace(game, content) === 0;

  const bake = (recipeId: string) => {
    const failed = gameStore.getState().startBatch(shopId, recipeId);
    if (failed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{shop.name}</Text>
        <Text style={styles.meta}>{strings.queue(view.batches.length, view.queueSize)}</Text>
      </View>

      <View style={styles.queue}>
        {Array.from({ length: view.queueSize }, (_, i) => {
          const b = view.batches[i];
          if (!b) {
            return (
              <View key={i} style={[styles.slot, styles.slotEmpty]}>
                <Text style={styles.slotEmptyText}>{strings.emptySlot}</Text>
              </View>
            );
          }
          const name = content.goods[content.recipes[b.batch.recipe].output].name;
          const status =
            b.status === 'ready'
              ? strings.ready
              : b.status === 'baking'
                ? strings.remaining(b.endsAt - Math.max(now, game.clock))
                : strings.waiting;
          return (
            <View key={b.batch.id} style={[styles.slot, b.status === 'ready' && styles.slotReady]}>
              <View style={styles.slotHead}>
                <GoodIcon good={content.recipes[b.batch.recipe].output} size={24} />
                <Text style={styles.slotName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              <Text style={styles.slotStatus}>{status}</Text>
              {b.status === 'baking' && (
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.round(b.progress * 100)}%` }]} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {view.readyCount > 0 && (
        <Bouncy
          accessibilityRole="button"
          haptic={false}
          style={styles.collect}
          onPress={() => {
            const failed = gameStore.getState().collect(shopId);
            Haptics.notificationAsync(
              failed ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
            );
          }}
        >
          <Text style={styles.buttonText}>{strings.collect(view.readyCount)}</Text>
        </Bouncy>
      )}

      {view.readyCount > 0 && pantryFull && <Text style={styles.hint}>{strings.pantryFull}</Text>}

      <View style={styles.recipes}>
        {recipes.map((r) => {
          const duration = strings.duration(r.durationSec);
          const name = content.goods[r.output].name;
          return (
            <Bouncy
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={strings.a11y.bakeRecipe(name, duration)}
              accessibilityState={{ disabled: full }}
              disabled={full}
              haptic={false}
              onPress={() => bake(r.id)}
              style={[styles.recipe, full && styles.recipeDisabled]}
            >
              <GoodIcon good={r.output} size={36} />
              <View style={styles.recipeText}>
                <Text style={styles.recipeName} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={styles.recipeTime}>{duration}</Text>
              </View>
            </Bouncy>
          );
        })}
      </View>
      {full && <Text style={styles.hint}>{strings.queueFull}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.panel, borderTopWidth: 2, borderColor: colors.panelEdge },
  panel: {
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 15, color: colors.inkSoft },
  queue: { flexDirection: 'row', gap: 8 },
  slot: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.panelEdge,
    justifyContent: 'center',
  },
  slotReady: { borderColor: colors.ring, borderWidth: 2 },
  slotEmpty: { borderStyle: 'dashed', alignItems: 'center' },
  slotEmptyText: { color: colors.inkSoft, fontSize: 14 },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotName: { fontSize: 15, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  slotStatus: { fontSize: 14, color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.panelEdge, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 5, backgroundColor: colors.ring },
  collect: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  recipes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipe: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.button,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeText: { flex: 1 },
  recipeDisabled: { backgroundColor: colors.buttonDisabled },
  recipeName: { color: colors.buttonText, fontSize: 16, fontWeight: '700' },
  recipeTime: { color: colors.buttonText, fontSize: 13, opacity: 0.9 },
  buttonText: { color: colors.buttonText, fontSize: 17, fontWeight: '700' },
  hint: { textAlign: 'center', color: colors.inkSoft, fontSize: 14 },
});
