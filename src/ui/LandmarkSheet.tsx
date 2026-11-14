import { Image, StyleSheet, View } from 'react-native';

import { landmarkArt } from '../art';
import { content, type LandmarkBonus } from '../content';
import { landmarkStage } from '../core';
import { gameStore, useGame } from '../store';
import { report } from './feedback';
import { GoodNeed } from './GoodNeed';
import { Amount, Button, Sheet, Txt, Well } from './kit';
import { strings } from './strings';
import { colors, space } from './theme';
import { closeSheet } from './uiStore';

export function bonusText(bonus: LandmarkBonus): string {
  switch (bonus.type) {
    case 'order_coins':
      return strings.bonus.order_coins(bonus.percent);
    case 'batch_speed':
      return strings.bonus.batch_speed(bonus.percent);
    case 'order_slots':
      return strings.bonus.order_slots(bonus.slots);
  }
}

/** A landmark: how far its restoration has come, what the next stage costs, and what it gives. */
export function LandmarkSheet({ landmarkId }: { landmarkId: string }) {
  const game = useGame((s) => s.game);
  const config = content.landmarks[landmarkId];
  if (!config) return null;
  const done = landmarkStage(game, landmarkId);
  const total = config.stages.length;
  const cost = config.stages[done];
  const art = landmarkArt(landmarkId, done);
  const canPay =
    !!cost && game.wallet.coins >= cost.coins && cost.goods.every((g) => (game.pantry[g.good] ?? 0) >= g.qty);

  return (
    <Sheet
      title={config.name}
      subtitle={cost ? strings.landmarkStage(done, total) : strings.landmarkRestored}
      onClose={closeSheet}
      footer={
        cost ? (
          <Button
            label={strings.landmarkRestore}
            disabled={!canPay}
            haptic={false}
            onPress={() => report(gameStore.getState().restoreLandmark(landmarkId), 'success')}
          />
        ) : null
      }
    >
      {art && (
        <Image
          source={art.source}
          style={[styles.art, { aspectRatio: art.w / art.h }]}
          resizeMode="contain"
          accessible={false}
        />
      )}
      <View style={styles.pips} accessible accessibilityLabel={strings.landmarkStagesDone(done, total)}>
        {config.stages.map((_, i) => (
          <View key={i} style={[styles.pip, i < done && styles.pipDone]} />
        ))}
      </View>

      {cost && (
        <>
          <Txt variant="heading">{strings.landmarkCost}</Txt>
          <View style={styles.cost}>
            <View style={styles.coins}>
              <Amount
                kind="coins"
                value={cost.coins}
                textStyle={{
                  color: game.wallet.coins >= cost.coins ? colors.good : colors.bad,
                }}
              />
            </View>
            {cost.goods.map((g) => (
              <GoodNeed key={g.good} good={g.good} owned={game.pantry[g.good] ?? 0} needed={g.qty} />
            ))}
          </View>
        </>
      )}

      <Well style={styles.bonus}>
        <Txt variant="small" soft>
          {cost ? strings.landmarkGives : strings.landmarkRestored}
        </Txt>
        <Txt variant="label">{bonusText(config.bonus)}</Txt>
      </Well>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  art: { height: 150, alignSelf: 'center' },
  pips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  pip: {
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.well,
    borderWidth: 1,
    borderColor: colors.panelEdge,
  },
  pipDone: { backgroundColor: colors.ring, borderColor: colors.ring },
  cost: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  coins: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bonus: { padding: space.md, gap: 2 },
});
