import { StyleSheet, View } from 'react-native';

import { content } from '../content';
import { gameStore, useGame } from '../store';
import { GoodIcon } from './GoodIcon';
import { Button, Popup, Txt } from './kit';
import { strings } from './strings';
import { space } from './theme';

const close = () => gameStore.getState().dismissWelcomeBack();

/** Lists what finished while the player was away. */
export function WelcomeBack() {
  const summary = useGame((s) => s.welcomeBack);
  if (!summary) return null;
  return (
    <Popup title={strings.welcomeBackTitle} onClose={close} footer={<Button label={strings.ok} onPress={close} />}>
      <Txt soft style={styles.centre}>
        {strings.welcomeBackBody}
      </Txt>
      {Object.entries(summary.finished).map(([good, n]) => (
        <View key={good} style={styles.row}>
          <GoodIcon good={good} size={32} />
          <Txt variant="label">{strings.goodTimes(content.goods[good]?.name ?? good, n)}</Txt>
        </View>
      ))}
    </Popup>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
