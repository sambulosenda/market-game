/**
 * The gem shop's logic, apart from any store library: list what is for sale,
 * buy, and restore. The app wires in RevenueCat; tests use a fake. With no
 * backend the shop is closed and the game shows no way into it.
 */
export type ShopBackend = {
  /** The products the store knows, with their prices as the store words them (such as "£1.99"). */
  products(ids: string[]): Promise<{ id: string; price: string }[]>;
  /** Runs the store's payment sheet. Resolves once the player has paid or backed out; rejects on failure. */
  buy(id: string): Promise<'bought' | 'cancelled'>;
  /** Every product id this store account has bought, for restoring. */
  owned(): Promise<string[]>;
};

export type Listing = { id: string; price: string };
export type BuyResult = 'bought' | 'cancelled' | 'failed';

export type ShopOptions = {
  backend: ShopBackend | null;
  /** The products to offer, in order. */
  productIds: () => string[];
  /** Gives the player a product that was paid for. Returns false if the game refused it. */
  grant: (productId: string) => boolean;
  /** Gives back once-only products the store says are owned. Returns the ones given. */
  restore: (ownedProductIds: string[]) => string[];
  onPurchase?: (listing: Listing) => void;
  onError?: (error: unknown) => void;
};

export function createShop({ backend, productIds, grant, restore, onPurchase, onError }: ShopOptions) {
  let listings: Listing[] | null = null;
  let buying = false;

  const load = async (): Promise<Listing[] | null> => {
    if (!backend) return null;
    if (listings) return listings;
    try {
      const ids = productIds();
      const found = await backend.products(ids);
      // In the game's order, and only what the store really has.
      const sorted = ids.flatMap((id) => found.filter((p) => p.id === id));
      if (sorted.length > 0) listings = sorted;
      return sorted;
    } catch (error) {
      onError?.(error);
      return null;
    }
  };

  return {
    /** False when no store is set up, so nothing in the game should lead to the shop. */
    available: backend !== null,

    /** What is for sale, or null if the store could not be reached. Remembered once it has loaded. */
    load,

    /** Pays for a product and gives it to the player. One purchase at a time. */
    async buy(productId: string): Promise<BuyResult> {
      if (!backend || buying) return 'failed';
      buying = true;
      try {
        if ((await backend.buy(productId)) === 'cancelled') return 'cancelled';
        if (!grant(productId)) return 'failed';
        const listing = (await load())?.find((l) => l.id === productId);
        onPurchase?.(listing ?? { id: productId, price: '' });
        return 'bought';
      } catch (error) {
        onError?.(error);
        return 'failed';
      } finally {
        buying = false;
      }
    },

    /** Gives back what the store account owns. Resolves to the products given, or null if the store failed. */
    async restore(): Promise<string[] | null> {
      if (!backend) return null;
      try {
        return restore(await backend.owned());
      } catch (error) {
        onError?.(error);
        return null;
      }
    },
  };
}

export type Shop = ReturnType<typeof createShop>;
