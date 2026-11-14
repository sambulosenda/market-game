import { type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useStore } from 'zustand';

import { landmarkArt, shopArt, ui } from '../art';
import { content } from '../content';
import { GoodIcon } from './GoodIcon';
import { Button, CurrencyIcon, Popup, Txt } from './kit';
import { levelUpLines } from './levelUp';
import { strings } from './strings';
import { space } from './theme';
import { dismissLevelUp, uiStore } from './uiStore';

function iconFor(key: string): ReactNode {
  const [kind, id] = key.split(':');
  if (kind === 'gems') return <CurrencyIcon kind="gems" size={32} />;
  if (kind === 'recipe') return content.recipes[id] ? <GoodIcon good={content.recipes[id].output} size={32} /> : null;
  const art = kind === 'shop' ? shopArt(id, 1) : kind === 'landmark' ? landmarkArt(id, 3) : ui.ui_order_card;
  return art ? <Image source={art.source} style={styles.icon} resizeMode="contain" accessible={false} /> : null;
}

/** Shows each level-up once, listing exactly what it unlocked. */
export function LevelUpPopup() {
  const levelUp = useStore(uiStore, (s) => s.levelUps[0]);
  if (!levelUp) return null;
  const lines = levelUpLines(levelUp, content);
  return (
    <Popup
      key={levelUp.level}
      title={strings.levelUpTitle(levelUp.level)}
      onClose={dismissLevelUp}
      footer={<Button label={strings.ok} onPress={dismissLevelUp} />}
    >
      <Txt soft style={styles.centre}>
        {lines.length ? strings.levelUpBody : strings.levelUpNothing}
      </Txt>
      {lines.map((line) => (
        <View key={line.key} style={styles.row}>
          <View style={styles.iconBox}>{iconFor(line.key)}</View>
          <Txt variant="label" style={styles.text}>
            {line.text}
          </Txt>
        </View>
      ))}
    </Popup>
  );
}

const styles = StyleSheet.create({
  centre: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 36, height: 36 },
  text: { flex: 1 },
});
