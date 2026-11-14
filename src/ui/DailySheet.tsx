import { StyleSheet, View } from 'react-native';

import { content } from '../content';
import { type DailyGoal, msUntilNextDay, viewCalendar } from '../core';
import { gameStore, useGame } from '../store';
import { report } from './feedback';
import { Amount, Button, Panel, ProgressBar, Sheet, Txt, Well } from './kit';
import { strings } from './strings';
import { colors, radius, space } from './theme';
import { closeSheet } from './uiStore';
import { useNow } from './useNow';

const timezoneOffsetMin = (at: number) => new Date(at).getTimezoneOffset();

/** Today's three goals and the 7-day gift calendar. */
export function DailySheet() {
  const game = useGame((s) => s.game);
  const now = useNow(1000);
  const offset = timezoneOffsetMin(now);
  const calendar = viewCalendar(game, content, now, offset);
  const { goals, bonusClaimed } = game.daily;
  const claimedGoals = goals.filter((g) => g.claimed).length;
  const bonus = content.economy.daily.allGoalsGems;

  return (
    <Sheet
      title={strings.daily.title}
      subtitle={strings.daily.newIn(strings.remaining(msUntilNextDay(now, offset)))}
      onClose={closeSheet}
    >
      {goals.map((goal, index) => (
        <GoalRow key={goal.kind} goal={goal} index={index} />
      ))}

      {bonus > 0 && (
        <Well style={styles.bonus}>
          <View style={styles.grow}>
            <Txt variant="label">{bonusClaimed ? strings.daily.bonusDone : strings.daily.bonus}</Txt>
            <Txt variant="small" soft>
              {strings.daily.bonusCount(claimedGoals, goals.length)}
            </Txt>
          </View>
          <Amount kind="gems" value={bonus} prefix="+" />
        </Well>
      )}

      <Txt variant="heading" accessibilityRole="header" style={styles.heading}>
        {strings.daily.calendarTitle}
      </Txt>
      <Txt variant="small" soft>
        {strings.daily.calendarHint}
      </Txt>
      <View style={styles.week}>
        {calendar.gifts.map((gift, i) => {
          const taken = i < calendar.taken;
          const next = i === calendar.taken && calendar.canClaim;
          return (
            <View
              key={i}
              style={[styles.day, taken && styles.dayTaken, next && styles.dayNext]}
              accessible
              accessibilityLabel={strings.a11y.calendarDay(i + 1, gift.coins, gift.gems, taken)}
            >
              <Txt variant="small" soft>
                {strings.daily.day(i + 1)}
              </Txt>
              {taken ? (
                <Txt variant="label" style={styles.tick}>
                  ✓
                </Txt>
              ) : (
                <View style={styles.gift}>
                  {gift.coins > 0 && <Amount kind="coins" value={gift.coins} size={14} textStyle={styles.giftText} />}
                  {gift.gems > 0 && <Amount kind="gems" value={gift.gems} size={14} textStyle={styles.giftText} />}
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Button
        label={calendar.canClaim ? strings.daily.claimGift : strings.daily.giftTaken}
        disabled={!calendar.canClaim}
        haptic={false}
        onPress={() => report(gameStore.getState().claimCalendarGift(), 'success')}
      />
    </Sheet>
  );
}

function GoalRow({ goal, index }: { goal: DailyGoal; index: number }) {
  const done = goal.progress >= goal.target;
  const label = strings.daily.goal[goal.kind](goal.target);
  return (
    <Panel style={styles.goal}>
      <View
        style={styles.grow}
        accessible
        accessibilityLabel={strings.a11y.dailyGoal(label, goal.progress, goal.target)}
      >
        <Txt variant="label">{label}</Txt>
        <ProgressBar progress={goal.progress / goal.target} color={done ? colors.good : colors.ring} height={10} />
        <Txt variant="small" soft style={styles.tabular}>
          {strings.have(goal.progress, goal.target)}
        </Txt>
      </View>
      {goal.claimed ? (
        <Txt variant="label" style={styles.claimed}>
          {strings.daily.claimed}
        </Txt>
      ) : (
        <Button
          small
          label={strings.daily.claim}
          accessibilityLabel={`${strings.daily.claim}, ${strings.a11y.amount.coins(goal.coins)}`}
          trailing={<Amount kind="coins" value={goal.coins} size={18} textStyle={done ? styles.onDark : undefined} />}
          disabled={!done}
          haptic={false}
          onPress={() => report(gameStore.getState().claimDailyGoal(index), 'success')}
        />
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  claimed: { color: colors.good },
  onDark: { color: colors.inkOnDark },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  heading: { marginTop: space.sm },
  week: { flexDirection: 'row', gap: space.xs },
  day: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.panelEdge,
  },
  dayTaken: { backgroundColor: colors.well },
  dayNext: { borderColor: colors.primary, borderWidth: 2.5 },
  gift: { alignItems: 'center', gap: 2 },
  giftText: { fontSize: 12 },
  tick: { color: colors.good },
});
