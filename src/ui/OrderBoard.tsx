import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { content } from '../content';
import { canFillOrder, type Order, orderCoins } from '../core';
import { gameStore, useGame } from '../store';
import { Bouncy } from './Bouncy';
import { report } from './feedback';
import { setRewardOrigin } from './fx/RewardFx';
import { GoodIcon } from './GoodIcon';
import { GearIcon } from './kit/GearIcon';
import { Amount, Button, Panel, Txt } from './kit';
import { strings } from './strings';
import { colors, radius, space, TAP } from './theme';
import { openSheet } from './uiStore';
import { targetIds } from './tutorial/steps';
import { Target } from './tutorial/targets';
import { useNow } from './useNow';

/** The order board: every open order with what it asks for and what it pays. */
export function OrderBoard() {
  const slots = useGame((s) => s.game.orders.slots);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      <View style={styles.head}>
        <Txt variant="heading" accessibilityRole="header">
          {strings.orders}
        </Txt>
        <Bouncy
          accessibilityRole="button"
          accessibilityLabel={strings.a11y.settingsButton}
          onPress={() => openSheet({ kind: 'settings' })}
          style={styles.gear}
          hitSlop={6}
        >
          <GearIcon />
        </Bouncy>
      </View>
      {slots.map((slot, i) =>
        'order' in slot ? (
          <OrderCard key={`o${slot.order.id}`} order={slot.order} />
        ) : (
          <WaitingSlot key={`w${i}`} refillAt={slot.refillAt} />
        ),
      )}
      <Txt variant="small" soft style={styles.hint}>
        {strings.ordersHint}
      </Txt>
    </ScrollView>
  );
}

function OrderCard({ order }: { order: Order }) {
  const game = useGame((s) => s.game);
  const card = useRef<React.ComponentRef<typeof View>>(null);
  const canFill = canFillOrder(game, order);
  const coins = orderCoins(game, content, order);

  const fill = () => {
    const run = () => report(gameStore.getState().fillOrder(order.id), 'success');
    const node = card.current;
    if (!node) return void run();
    // The reward bursts from the middle of this card.
    node.measureInWindow((x, y, w, h) => {
      setRewardOrigin({ x: x + w / 2, y: y + h / 2 });
      run();
    });
  };

  return (
    <View ref={card} collapsable={false}>
      <Panel style={styles.card}>
        <View style={styles.items}>
          {order.items.map((item) => {
            const owned = game.pantry[item.good] ?? 0;
            const name = content.goods[item.good]?.name ?? item.good;
            return (
              <View
                key={item.good}
                style={styles.item}
                accessible
                accessibilityLabel={strings.a11y.orderItem(name, item.qty, owned)}
              >
                <GoodIcon good={item.good} size={36} />
                <View>
                  <Txt variant="label" numberOfLines={1}>
                    {name}
                  </Txt>
                  <Txt
                    variant="small"
                    style={{
                      color: owned >= item.qty ? colors.good : colors.bad,
                    }}
                  >
                    {strings.have(Math.min(owned, 999), item.qty)}
                  </Txt>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.side}>
          <View style={styles.reward}>
            <Amount kind="coins" value={coins} size={18} />
            <Amount kind="xp" value={order.xp} size={18} />
          </View>
          <View style={styles.actions}>
            <Button
              small
              kind="secondary"
              label={strings.skip}
              accessibilityLabel={strings.a11y.skipOrder}
              onPress={() => report(gameStore.getState().skipOrder(order.id))}
            />
            <Target id={targetIds.fill(order.id)}>
              <Button
                small
                label={strings.fill}
                accessibilityLabel={strings.a11y.fillOrder(coins, order.xp)}
                disabled={!canFill}
                haptic={false}
                onPress={fill}
              />
            </Target>
          </View>
        </View>
      </Panel>
    </View>
  );
}

/** A slot left empty by a skipped order, counting down to the next one. */
function WaitingSlot({ refillAt }: { refillAt: number }) {
  const now = useNow(1000);
  const due = now >= refillAt;
  useEffect(() => {
    if (due) gameStore.getState().refreshOrders();
  }, [due, now]);
  return (
    <View style={styles.waiting}>
      <Txt soft>{strings.nextOrderIn(strings.remaining(refillAt - now))}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.page },
  list: { padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gear: {
    width: TAP,
    height: TAP,
    borderRadius: TAP / 2,
    backgroundColor: colors.well,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  items: { flex: 1, gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: { alignItems: 'flex-end', gap: space.sm },
  reward: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  waiting: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.panelEdge,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.md,
  },
  hint: { textAlign: 'center', marginTop: space.xs },
});
