import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';

import { analytics } from '../analytics';
import { content } from '../content';
import { gameStore } from '../store';
import { createShop, type ShopBackend } from './shop';

/**
 * Purchases go through RevenueCat when its public SDK key for this platform
 * is set (see .env.example). With no key the shop is closed: the gem counter
 * is not a button and the settings show no "Restore purchases".
 */
const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

function revenueCat(apiKey: string): ShopBackend {
  let configured = false;
  const ready = () => {
    if (configured) return;
    Purchases.configure({ apiKey });
    configured = true;
  };
  const known = new Map<string, PurchasesStoreProduct>();
  const fetch = async (ids: string[]) => {
    ready();
    const products = await Purchases.getProducts(ids, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    for (const p of products) known.set(p.identifier, p);
    return products;
  };
  return {
    products: async (ids) => (await fetch(ids)).map((p) => ({ id: p.identifier, price: p.priceString })),
    buy: async (id) => {
      const product = known.get(id) ?? (await fetch([id])).find((p) => p.identifier === id);
      if (!product) throw new Error(`The store has no product ${id}`);
      try {
        await Purchases.purchaseStoreProduct(product);
        return 'bought';
      } catch (error) {
        if ((error as { userCancelled?: boolean | null }).userCancelled) return 'cancelled';
        throw error;
      }
    },
    owned: async () => {
      ready();
      const info = await Purchases.restorePurchases();
      return info.nonSubscriptionTransactions.map((t) => t.productIdentifier);
    },
  };
}

export const shop = createShop({
  backend: KEY ? revenueCat(KEY) : null,
  productIds: () => content.economy.products.map((p) => p.id),
  grant: (productId) => gameStore.getState().grantPurchase(productId) === null,
  restore: (owned) => gameStore.getState().restorePurchases(owned),
  onPurchase: (listing) => analytics.capture('purchase_made', { product: listing.id, price: listing.price }),
  onError: (error) => {
    console.warn('[shop]', error);
    analytics.error(error, 'shop');
  },
});
