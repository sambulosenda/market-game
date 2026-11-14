import economy from './data/economy.json';
import goods from './data/goods.json';
import landmarks from './data/landmarks.json';
import levels from './data/levels.json';
import recipes from './data/recipes.json';
import shops from './data/shops.json';
import street from './data/street.json';
import { loadContent } from './load';

export type { Content, Economy, Good, GoodQty, Landmark, LandmarkBonus, Level, Recipe, Shop, ShopLevel } from './schema';
export { ContentError, loadContent } from './load';

/** The bundled game content, validated once when first imported. */
export const content = loadContent({ goods, recipes, shops, landmarks, levels, economy, street });
