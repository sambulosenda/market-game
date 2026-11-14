import { StyleSheet, View } from 'react-native';

import { content } from '../content';
import { pantryCapacity, pantryCount } from '../core';
import { gameStore, useGame } from '../store';
import { report } from './feedback';
import { GoodIcon } from './GoodIcon';
import { Amount, Button, ProgressBar, Sheet, Txt, Well } from './kit';
import { strings } from './strings';
import { colors, radius, space } from './theme';
import { closeSheet } from './uiStore';

/** Everything the player owns, how full the pantry is, and its upgrade. */
export function PantrySheet() {
  const game = useGame((s) => s.game);
  const count = pantryCount(game);
  const capacity = pantryCapacity(game, content);
  const next = content.economy.pantry.levels[game.pantryLevel];
  // In the order goods are listed in the content, so the grid does not jump around.
  const goods = Object.keys(content.goods).filter((g) => (game.pantry[g] ?? 0) > 0);

  return (
    <Sheet title={strings.pantry} subtitle={strings.pantryCount(count, capacity)} onClose={closeSheet}>
      <ProgressBar progress={count / capacity} color={count >= capacity ? colors.bad : colors.ring} height={10} />
      {count >= capacity && (
        <Txt variant="small" style={{ color: colors.bad }}>
          {strings.pantryFull}
        </Txt>
      )}

      {goods.length === 0 ? (
        <Txt soft>{strings.pantryEmpty}</Txt>
      ) : (
        <View style={styles.grid}>
          {goods.map((good) => {
            const name = content.goods[good].name;
            return (
              <View
                key={good}
                style={styles.cell}
                accessible
                accessibilityLabel={strings.a11y.pantryItem(name, game.pantry[good])}
              >
                <GoodIcon good={good} size={44} />
                <Txt variant="label" style={styles.tabular}>
                  {game.pantry[good]}
                </Txt>
                <Txt variant="small" soft numberOfLines={1}>
                  {name}
                </Txt>
              </View>
            );
          })}
        </View>
      )}

      <Well style={styles.upgrade}>
        {next ? (
          <>
            <View style={styles.upgradeText}>
              <Txt variant="label">{strings.pantryUpgradeGain(next.capacity)}</Txt>
            </View>
            <Button
              small
              kind="secondary"
              label={strings.upgrade}
              accessibilityLabel={`${strings.upgrade}, ${strings.a11y.cost(next.cost)}`}
              trailing={<Amount kind="coins" value={next.cost} size={18} />}
              disabled={game.wallet.coins < next.cost}
              haptic={false}
              onPress={() => report(gameStore.getState().upgradePantry(), 'success')}
            />
          </>
        ) : (
          <Txt soft>{strings.pantryMaxLevel}</Txt>
        )}
      </Well>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    width: '23%',
    flexGrow: 1,
    maxWidth: '32%',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.panelEdge,
  },
  upgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  upgradeText: { flex: 1 },
});
