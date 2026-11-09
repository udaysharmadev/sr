import { dayKey } from './progression.js';

export const COIN_PACKS = [
  { id: 'pouch', coins: 1000, gems: 10 },
  { id: 'crate', coins: 6000, gems: 50 },
  { id: 'vault', coins: 14000, gems: 100 },
];
export const WHEEL_PRIZES = {
  daily: [250, 500, 750, 1000, 1500, 2000, 3000, 10000],
  golden: [5, 10, 15, 20, 30, 50, 10, 25],
};
export const EXTRA_SPIN_GEMS = 25;
const balance = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const WEEK = 7 * 86400000;
export function canClaimCoins(profile, at = Date.now()) {
  return !profile.dailyCoinsAt || profile.dailyCoinsAt < dayKey(at);
}
export function claimDailyCoins(profile, at = Date.now()) {
  if (!canClaimCoins(profile, at)) return false;
  profile.coins = balance(profile.coins) + 200;
  profile.dailyCoinsAt = dayKey(at);
  return true;
}
export function exchangeCoins(profile, id) {
  const pack = COIN_PACKS.find(pack => pack.id === id);
  if (!pack || balance(profile.gems) < pack.gems) return false;
  profile.gems = balance(profile.gems) - pack.gems;
  profile.coins = balance(profile.coins) + pack.coins;
  return true;
}
export function wheelStatus(profile, kind, at = Date.now()) {
  if (!WHEEL_PRIZES[kind]) return { ready: false, remaining: 0 };
  const last = kind === 'golden' ? profile.wheels?.goldenAt : profile.wheels?.dailyAt;
  const remaining = last == null ? 0 : kind === 'golden' ? Math.max(0, last + WEEK - at)
    : Math.max(0, Date.parse(last + 'T00:00:00Z') + 86400000 - at);
  return { ready: remaining === 0 && !profile.wheels?.pending, remaining };
}
export function spinWheel(profile, kind, at = Date.now(), random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296, paid = false) {
  if (paid ? kind !== 'daily' || profile.wheels?.pending || balance(profile.gems) < EXTRA_SPIN_GEMS : !wheelStatus(profile, kind, at).ready) return null;
  const unit = random();
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) return null;
  const index = Math.floor(unit * WHEEL_PRIZES[kind].length), amount = WHEEL_PRIZES[kind][index];
  const currency = kind === 'golden' ? 'gems' : 'coins';
  const prize = { kind, index, amount, currency, at, ...(paid ? {cost:EXTRA_SPIN_GEMS} : {}) };
  profile.wheels ||= {};
  if (paid) profile.gems = balance(profile.gems) - EXTRA_SPIN_GEMS;
  else profile.wheels[kind === 'golden' ? 'goldenAt' : 'dailyAt'] = kind === 'golden' ? at : dayKey(at);
  profile[currency] = balance(profile[currency]) + amount;
  // Commit before the animation. Reloading can reveal this prize, never reroll it.
  profile.wheels.pending = prize;
  return prize;
}
export function collectWheelPrize(profile) {
  if (!profile.wheels?.pending) return false;
  delete profile.wheels.pending;
  return true;
}
