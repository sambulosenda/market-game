import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { content } from '../content';
import { canBuyProduct, findProduct } from '../core';
import { shop } from '../purchases';
import type { Listing } from '../purchases/shop';
import { useGame } from '../store';
import { haptics } from './haptics';
import { Amount, Button, Panel, Sheet, Txt } from './kit';
import { strings } from './strings';
import { space } from './theme';
import { closeSheet, toast } from './uiStore';

/** The gem shop: gem packs and the starter bundle, at the store's own prices. */
export function GemShopSheet() {
  const game = useGame((s) => s.game);
  // undefined while loading; null if the store could not be reached.
  const [listings, setListings] = useState<Listing[] | null | undefined>(undefined);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void shop.load().then((found) => {
      if (live) setListings(found);
    });
    return () => {
      live = false;
    };
  }, []);

  const buy = async (id: string) => {
    setBuying(id);
    const result = await shop.buy(id);
    setBuying(null);
    if (result === 'bought') {
      haptics.success();
      toast(strings.gemShop.thanks);
    } else if (result === 'failed') {
      haptics.warning();
      toast(strings.gemShop.failed);
    }
  };

  return (
    <Sheet title={strings.gemShop.title} subtitle={strings.gemShop.subtitle} onClose={closeSheet}>
      {listings === undefined && <Txt soft>{strings.gemShop.loading}</Txt>}
      {(listings === null || listings?.length === 0) && <Txt soft>{strings.gemShop.unreachable}</Txt>}
      {listings?.map((listing) => {
        const product = findProduct(content, listing.id);
        if (!product) return null;
        const owned = !canBuyProduct(game, content, listing.id);
        const name = product.once ? strings.gemShop.bundle : strings.gemShop.pack;
        return (
          <Panel key={listing.id} style={styles.row}>
            <View style={styles.grow}>
              <Txt variant="label">{name}</Txt>
              <View style={styles.amounts}>
                {product.gems > 0 && <Amount kind="gems" value={product.gems} />}
                {product.coins > 0 && <Amount kind="coins" value={product.coins} />}
              </View>
              {product.once && (
                <Txt variant="small" soft>
                  {strings.gemShop.once}
                </Txt>
              )}
            </View>
            <Button
              small
              label={owned ? strings.gemShop.owned : listing.price}
              accessibilityLabel={
                owned
                  ? strings.gemShop.owned
                  : strings.a11y.buyProduct(name, product.gems, product.coins, listing.price)
              }
              disabled={owned || buying !== null}
              haptic={false}
              onPress={() => void buy(listing.id)}
            />
          </Panel>
        );
      })}
      <Txt variant="small" soft>
        {strings.gemShop.note}
      </Txt>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, gap: space.xs },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
