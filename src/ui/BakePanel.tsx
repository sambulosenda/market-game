import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { content } from '../content';
import { viewShop } from '../core';
import { gameStore, useGame } from '../store';
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
  const recipes = Object.values(content.recipes).filter((r) => r.shop === shopId);

  const bake = (recipeId: string) => {
    const failed = gameStore.getState().startBatch(shopId, recipeId);
    if (failed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.panel}>
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
              <Text style={styles.slotName} numberOfLines={1}>
                {name}
              </Text>
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
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.collect, pressed && styles.pressed]}
          onPress={() => {
            if (gameStore.getState().collect(shopId) === null)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Text style={styles.buttonText}>{strings.collect(view.readyCount)}</Text>
        </Pressable>
      )}

      <View style={styles.recipes}>
        {recipes.map((r) => {
          const duration = strings.duration(r.durationSec);
          const name = content.goods[r.output].name;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={strings.a11y.bakeRecipe(name, duration)}
              accessibilityState={{ disabled: full }}
              disabled={full}
              onPress={() => bake(r.id)}
              style={({ pressed }) => [styles.recipe, full && styles.recipeDisabled, pressed && styles.pressed]}
            >
              <Text style={styles.recipeName} numberOfLines={2}>
                {name}
              </Text>
              <Text style={styles.recipeTime}>{duration}</Text>
            </Pressable>
          );
        })}
      </View>
      {full && <Text style={styles.hint}>{strings.queueFull}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderTopWidth: 2,
    borderColor: colors.panelEdge,
    padding: 16,
    gap: 12,
    flex: 1,
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
  slotName: { fontSize: 15, fontWeight: '600', color: colors.ink },
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
    justifyContent: 'center',
  },
  recipeDisabled: { backgroundColor: colors.buttonDisabled },
  recipeName: { color: colors.buttonText, fontSize: 16, fontWeight: '700' },
  recipeTime: { color: colors.buttonText, fontSize: 13, opacity: 0.9 },
  buttonText: { color: colors.buttonText, fontSize: 17, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  hint: { textAlign: 'center', color: colors.inkSoft, fontSize: 14 },
});
