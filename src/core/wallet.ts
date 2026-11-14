import type { Currency, TransactionReason, Wallet } from './types';

/** How many transactions the save keeps. */
export const WALLET_LOG_SIZE = 100;

function change(wallet: Wallet, currency: Currency, amount: number, reason: TransactionReason, at: number): Wallet {
  if (amount === 0) return wallet;
  const balance = wallet[currency] + amount;
  const log = [...wallet.log, { at, currency, amount, reason, balance }].slice(-WALLET_LOG_SIZE);
  return { ...wallet, [currency]: balance, log };
}

/** Every coin and gem enters the wallet here, so each one is logged with a reason. */
export function earn(wallet: Wallet, currency: Currency, amount: number, reason: TransactionReason, at: number): Wallet {
  return change(wallet, currency, Math.max(0, amount), reason, at);
}

/** Every coin and gem leaves the wallet here. Returns null if the wallet is short. */
export function spend(wallet: Wallet, currency: Currency, amount: number, reason: TransactionReason, at: number): Wallet | null {
  if (amount < 0 || wallet[currency] < amount) return null;
  return change(wallet, currency, -amount, reason, at);
}
