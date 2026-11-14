/**
 * Turns game events into analytics events. Pure, so the list the PRD asks for
 * is checked by a test: tutorial step, batch started, batch collected, order
 * completed, order skipped, shop opened, shop upgraded, landmark stage
 * restored, level up and gems spent. "Purchase made" is sent by the purchase
 * layer, not from here.
 */
import type { Content } from '../content/schema';
import type { GameEvent, GameState } from '../core';

export type AnalyticsEvent = { name: string; props: Record<string, string | number | boolean> };

/** The onboarding funnel, in order. Each step is sent once, the first time it happens in a game. */
export type TutorialStep = 'first_batch' | 'first_collect' | 'first_order' | 'second_shop';

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

/**
 * `after` is the game just after the events happened. Every event carries the
 * player's level, so charts can be split by it.
 */
export function toAnalytics(events: GameEvent[], after: GameState, content: Content): AnalyticsEvent[] {
  const out: AnalyticsEvent[] = [];
  const add = (name: string, props: AnalyticsEvent['props'] = {}) =>
    out.push({ name, props: { ...props, player_level: after.level } });
  const step = (name: TutorialStep) => add('tutorial_step', { step: name });
  const collected = events.reduce((n, e) => (e.type === 'batchCollected' ? n + e.qty : n), 0);

  for (const e of events) {
    switch (e.type) {
      case 'batchStarted':
        add('batch_started', { shop: e.shop, recipe: e.recipe });
        if (e.batchId === 1) step('first_batch');
        break;
      case 'batchCollected':
        add('batch_collected', { shop: e.shop, good: e.good, qty: e.qty });
        break;
      case 'orderFilled':
        add('order_completed', { coins: e.coins, xp: e.xp });
        // XP comes only from orders, so this is the first order when it is all the XP there is.
        if (after.xp === e.xp) step('first_order');
        break;
      case 'orderSkipped':
        add('order_skipped');
        break;
      case 'shopBought':
        add('shop_opened', { shop: e.shop });
        if (Object.keys(after.shops).filter((id) => !content.shops[id]?.startsOwned).length === 1) step('second_shop');
        break;
      case 'shopUpgraded':
        add('shop_upgraded', { shop: e.shop, level: e.level });
        break;
      case 'landmarkStageRestored':
        add('landmark_stage_restored', { landmark: e.landmark, stage: e.stage, complete: e.complete });
        break;
      case 'levelUp':
        add('level_up', { level: e.level });
        break;
      case 'timerSkipped':
        add('gems_spent', { reason: 'skip_timer', gems: e.gems, shop: e.shop });
        break;
      case 'queueSlotBought':
        add('gems_spent', { reason: 'queue_slot', gems: e.gems, shop: e.shop });
        break;
      case 'dailyGoalClaimed':
        add('daily_goal_claimed', { kind: e.kind, coins: e.coins, gems: e.gems });
        break;
      case 'calendarGiftClaimed':
        add('calendar_gift_claimed', { day: e.day, coins: e.coins, gems: e.gems });
        break;
      case 'masteryStarEarned':
        add('mastery_star_earned', { good: e.good, stars: e.stars });
        break;
      case 'collectionSetClaimed':
        add('collection_set_claimed', { set: e.set, gems: e.gems });
        break;
      case 'purchaseGranted':
        // Sent as `purchase_made` by the shop, with the price.
        break;
      case 'customerTipped':
        // Tips are frequent and small; only a new customer for the album is worth a row.
        if (e.newLook !== undefined) add('customer_met', { look: e.newLook });
        break;
    }
  }
  // The first collection ever: everything made so far was collected just now.
  if (collected > 0 && sum(after.made) === collected) step('first_collect');
  return out;
}
