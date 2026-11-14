import goods from './data/goods.json';
import recipes from './data/recipes.json';
import shops from './data/shops.json';
import street from './data/street.json';
import { loadContent } from './load';

export type { Content, Good, Recipe, Shop, ShopLevel } from './schema';
export { ContentError, loadContent } from './load';

/** The bundled game content, validated once when first imported. */
export const content = loadContent({ goods, recipes, shops, street });
