import { WEAPONS } from './weapons.js';

export const ARMS_KILLS_PER_RIFLE = 2;
export const ARMS_FINAL_KILLS = WEAPONS.length * ARMS_KILLS_PER_RIFLE;
export function armsStage(kills = 0) {
  const earned = Math.max(0, Math.min(ARMS_FINAL_KILLS + 1, Number.isSafeInteger(kills) ? kills : 0));
  const index = Math.min(WEAPONS.length, Math.floor(earned / ARMS_KILLS_PER_RIFLE));
  const final = index === WEAPONS.length;
  return { index, final, weapon: WEAPONS[Math.min(index, WEAPONS.length - 1)].id,
    name: final ? 'Field knife' : WEAPONS[index].name,
    progress: final ? earned - ARMS_FINAL_KILLS : earned % ARMS_KILLS_PER_RIFLE,
    target: final ? 1 : ARMS_KILLS_PER_RIFLE, complete: earned > ARMS_FINAL_KILLS };
}
export const compareArmsPlayers = (a, b) => (b.armsKills || 0) - (a.armsKills || 0);
