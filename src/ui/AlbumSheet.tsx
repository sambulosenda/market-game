import { Image, StyleSheet, View } from 'react-native';

import { customerArt } from '../art';
import { content } from '../content';
import { type CollectionSetView, collectionsWaiting, viewCollections } from '../core';
import { gameStore, useGame } from '../store';
import { report } from './feedback';
import { GoodIcon } from './GoodIcon';
import { Amount, Button, Panel, PillButton, Sheet, Txt } from './kit';
import { strings } from './strings';
import { colors, radius, space } from './theme';
import { closeSheet, openSheet } from './uiStore';

/** Opens the album. A badge counts the finished sets with a reward waiting. */
export function AlbumButton() {
  const waiting = useGame((s) => collectionsWaiting(s.game, content));
  return (
    <PillButton
      label={strings.album.button}
      badge={waiting}
      accessibilityLabel={strings.a11y.albumButton(waiting)}
      onPress={() => openSheet({ kind: 'album' })}
    />
  );
}

/** The album: every good by shop and every customer, with what has been found and each set's reward. */
export function AlbumSheet() {
  const game = useGame((s) => s.game);
  const sets = viewCollections(game, content);
  const found = sets.reduce((n, s) => n + s.found, 0);
  const total = sets.reduce((n, s) => n + s.items.length, 0);
  return (
    <Sheet title={strings.album.title} subtitle={strings.album.found(found, total)} onClose={closeSheet}>
      <Txt variant="small" soft>
        {strings.album.hint}
      </Txt>
      {sets.map((set) => (
        <SetPanel key={set.id} set={set} />
      ))}
    </Sheet>
  );
}

function SetPanel({ set }: { set: CollectionSetView }) {
  const name = set.shop ? content.shops[set.shop].name : strings.album.customers;
  return (
    <Panel style={styles.set}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Txt variant="label" accessibilityRole="header">
            {name}
          </Txt>
          <Txt variant="small" soft style={styles.tabular}>
            {strings.have(set.found, set.items.length)}
          </Txt>
        </View>
        {set.claimed ? (
          <Txt variant="label" style={styles.claimed}>
            {strings.album.claimed}
          </Txt>
        ) : (
          <Button
            small
            label={strings.album.claim}
            accessibilityLabel={`${strings.album.claim}, ${strings.a11y.amount.gems(set.gems)}`}
            trailing={
              <Amount kind="gems" value={set.gems} size={18} textStyle={set.complete ? styles.onDark : undefined} />
            }
            disabled={!set.complete}
            haptic={false}
            onPress={() => report(gameStore.getState().claimCollectionSet(set.id), 'success')}
          />
        )}
      </View>
      <View style={styles.grid}>
        {set.items.map((item) =>
          set.kind === 'goods' ? (
            <View
              key={item.id}
              style={styles.item}
              accessible
              accessibilityLabel={strings.a11y.albumItem(content.goods[item.id].name, item.found)}
            >
              <GoodIcon good={item.id} size={40} style={item.found ? undefined : styles.missing} />
              <Txt variant="small" soft={!item.found} numberOfLines={2} style={styles.centre}>
                {item.found ? content.goods[item.id].name : strings.album.unknown}
              </Txt>
            </View>
          ) : (
            <Customer key={item.id} look={Number(item.id)} found={item.found} />
          ),
        )}
      </View>
    </Panel>
  );
}

const CUSTOMER_HEIGHT = 64;

function Customer({ look, found }: { look: number; found: boolean }) {
  const art = customerArt(look, 'stand');
  return (
    <View
      style={styles.item}
      accessible
      accessibilityLabel={strings.a11y.albumItem(strings.album.customer(look), found)}
    >
      {art && (
        <Image
          source={art.source}
          style={[{ height: CUSTOMER_HEIGHT, width: (CUSTOMER_HEIGHT * art.w) / art.h }, !found && styles.missing]}
          resizeMode="contain"
          accessible={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  centre: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  onDark: { color: colors.inkOnDark },
  claimed: { color: colors.good },
  set: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  item: { width: '25%', alignItems: 'center', gap: 2, paddingHorizontal: 2, borderRadius: radius.sm },
  // Not found yet: a dark shape, so there is something to look forward to.
  missing: { tintColor: colors.disabledEdge, opacity: 0.7 },
});
