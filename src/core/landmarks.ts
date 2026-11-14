import type { Content } from '../content/schema';
import { effectiveNow } from './clock';
import { refreshOrders } from './orders';
import type { ActionResult, GameState } from './types';
import { spend } from './wallet';

export function landmarkStage(state: GameState, landmarkId: string): number {
  return state.landmarks[landmarkId]?.stage ?? 0;
}

/**
 * Restores the landmark's next stage, paid in coins and goods. Finishing the
 * last stage turns on the landmark's bonus for good.
 */
export function restoreLandmark(state: GameState, content: Content, landmarkId: string, now: number): ActionResult {
  const config = content.landmarks[landmarkId];
  if (!config) return { ok: false, reason: 'unknown_landmark' };
  if (state.level < content.unlockLevel.landmarks[landmarkId]) return { ok: false, reason: 'level_too_low' };
  const done = landmarkStage(state, landmarkId);
  const cost = config.stages[done];
  if (!cost) return { ok: false, reason: 'already_restored' };
  if (state.wallet.coins < cost.coins) return { ok: false, reason: 'not_enough_coins' };
  if (!cost.goods.every((g) => (state.pantry[g.good] ?? 0) >= g.qty)) return { ok: false, reason: 'missing_goods' };

  const t = effectiveNow(state, now);
  const wallet = spend(state.wallet, 'coins', cost.coins, 'restore_landmark', t);
  if (!wallet) return { ok: false, reason: 'not_enough_coins' };
  const pantry = { ...state.pantry };
  for (const g of cost.goods) {
    pantry[g.good] -= g.qty;
    if (pantry[g.good] === 0) delete pantry[g.good];
  }
  const stage = done + 1;
  const next: GameState = {
    ...state,
    clock: t,
    wallet,
    pantry,
    landmarks: { ...state.landmarks, [landmarkId]: { stage } },
  };
  return {
    ok: true,
    // A finished landmark can add order slots, so top the board up.
    state: refreshOrders(next, content, t),
    events: [{ type: 'landmarkStageRestored', landmark: landmarkId, stage, complete: stage >= config.stages.length }],
  };
}
