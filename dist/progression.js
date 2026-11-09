import {eliminationXpMultiplier} from './events.js';
import {addSeasonRound} from './seasons.js';
const count = (value) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export const BADGES = [
  { id:"frontier-ace", name:"Frontier Ace", description:"Season 1 · earn 5,000 season XP", earned: () => false },
  { id: "weapon-master", name: "Weapon Master", description: "250 kills + 50 headshots with every rifle", earned: (p) => Object.keys(p.mastery || {}).length >= 8 && Object.values(p.mastery).filter((s) => count(s.kills) >= 250 && count(s.headshots) >= 50).length >= 8 },
  { id: "deadeye", name: "Deadeye", description: "500 kills, 300 headshots and a 2.0 career K/D", earned: (p) => count(p.kills) >= 500 && count(p.headshots) >= 300 && p.kills / Math.max(1, count(p.deaths)) >= 2 },
  { id: "untouchable", name: "Untouchable", description: "25-kill streak and 20 public wins", earned: (p) => count(p.best) >= 25 && count(p.wins) >= 20 },
  { id: "veteran", name: "Arena Legend", description: "100 wins across at least 200 public rounds", earned: (p) => count(p.wins) >= 100 && count(p.rounds) >= 200 },
];
export const DAILY_CHALLENGES = [
  { id: "quickscopes", name: "Quickscope 10 players", description: "Eliminate within 350ms of scoping", target: 10, xp: 1000, coins: 250, gems: 10 },
  { id: "airborneKills", name: "5 mid-air kills", description: "Land the shot while airborne", target: 5, xp: 1000, coins: 250, gems: 10 },
  { id: "wins", name: "Win 2 matches", description: "Finish first in public matches", target: 2, xp: 1500, coins: 400, gems: 20 },
];
export const dayKey = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);
export const WEEKLY_CHALLENGES = [
  {id:'kills',name:'Eliminate 150 players',description:'Public matches only',target:150,xp:5000,coins:5000,gems:30},
  {id:'headshots',name:'Land 50 headshots',description:'Precision across the week',target:50,xp:3500,coins:3000,gems:20},
  {id:'wins',name:'Win 5 matches',description:'Finish first in public matches',target:5,xp:5000,coins:5000,gems:50},
];
export function weekKey(at = Date.now()) {
  const date = new Date(at); date.setUTCHours(0,0,0,0);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,10);
}
export function weeklyProgress(profile, at = Date.now()) {
  return profile.weekly?.week === weekKey(at) ? profile.weekly : {week:weekKey(at),kills:0,headshots:0,wins:0,claimed:[]};
}
export function dailyProgress(profile, at = Date.now()) {
  return profile.daily?.day === dayKey(at) ? profile.daily : { day: dayKey(at), quickscopes: 0, airborneKills: 0, wins: 0, claimed: [] };
}
export function rifleMastery(profile, id) {
  const stats = profile.mastery?.[id] || { xp: 0, kills: 0, headshots: 0, shots: 0, hits: 0 };
  const gold = count(stats.kills) >= 500 && count(stats.headshots) >= 100 && count(stats.xp) >= 50000;
  return { ...stats, gold, tier: gold ? "Gold" : count(stats.kills) >= 250 ? "Silver" : count(stats.kills) >= 100 ? "Bronze" : "Unranked" };
}
export const earnedBadges = (profile) => BADGES.filter((badge) => profile.badges?.includes(badge.id) || badge.earned(profile));

// Called on verified completed public receipts; a completed round is credited once.
export function awardRound(profile, result, isPublic) {
  if (!isPublic || result.practice || !result.roundId || !result.completed) {
    return { applied: false, xp: 0, coins: 0 };
  }
  const awarded = Array.isArray(profile.awardedRounds) ? profile.awardedRounds : [];
  if (awarded.includes(result.roundId)) return { applied: false, xp: 0, coins: 0 };
  const kills = count(result.kills), deaths = count(result.deaths);
  profile.kills = count(profile.kills) + kills;
  profile.deaths = count(profile.deaths) + deaths;
  profile.rounds = count(profile.rounds) + 1;
  profile.best = Math.max(count(profile.best), count(result.streak));
  profile.wins = count(profile.wins) + Number(result.win === true);
  profile.shots = count(profile.shots) + count(result.shots);
  profile.hits = count(profile.hits) + Math.min(count(result.hits), count(result.shots));
  profile.headshots = count(profile.headshots) + Math.min(kills, count(result.headshots));
  profile.longestKill = Math.max(Number(profile.longestKill) || 0, Math.max(0, Number(result.longestKill) || 0));
  profile.mastery ||= {};
  for (const [id, stats] of Object.entries(result.weaponStats || {})) {
    if (!["sunbolt", "glacier", "prism", "cinder", "spectre", "volt", "rose", "ivory"].includes(id)) continue;
    const prior = profile.mastery[id] ||= { xp: 0, kills: 0, headshots: 0, shots: 0, hits: 0 };
    const weaponKills = count(stats.kills), heads = Math.min(weaponKills, count(stats.headshots));
    prior.xp = count(prior.xp) + weaponKills * 100 + heads * 25;
    for (const key of ["kills", "headshots", "shots", "hits"]) prior[key] = count(prior[key]) + count(stats[key]);
  }
  let xp = kills * 100 * eliminationXpMultiplier(result.finishedAt), coins = kills * 25;
  const resultDay = dayKey(result.finishedAt || Date.now());
  // A delayed older result still counts for career, but cannot roll today's challenges back.
  const daily = profile.daily?.day > resultDay ? null :
    (profile.daily = dailyProgress(profile, result.finishedAt || Date.now()));
  if (daily) {
  daily.quickscopes = count(daily.quickscopes) + Math.min(kills, count(result.quickscopes));
  daily.airborneKills = count(daily.airborneKills) + Math.min(kills, count(result.airborneKills));
  daily.wins = count(daily.wins) + Number(result.win === true);
  daily.claimed = Array.isArray(daily.claimed) ? daily.claimed : [];
  for (const challenge of DAILY_CHALLENGES) {
    if (daily[challenge.id] >= challenge.target && !daily.claimed.includes(challenge.id)) {
      daily.claimed.push(challenge.id); xp += challenge.xp; coins += challenge.coins;
      profile.gems = count(profile.gems) + challenge.gems;
    }
  }
  }
  const resultWeek = weekKey(result.finishedAt || Date.now());
  const weekly = profile.weekly?.week > resultWeek ? null : (profile.weekly = weeklyProgress(profile,result.finishedAt || Date.now()));
  if (weekly) {
    weekly.kills = count(weekly.kills) + kills;
    weekly.headshots = count(weekly.headshots) + Math.min(kills,count(result.headshots));
    weekly.wins = count(weekly.wins) + Number(result.win === true);
    weekly.claimed = Array.isArray(weekly.claimed) ? weekly.claimed : [];
    for (const challenge of WEEKLY_CHALLENGES) if (weekly[challenge.id] >= challenge.target && !weekly.claimed.includes(challenge.id)) {
      weekly.claimed.push(challenge.id); xp += challenge.xp; coins += challenge.coins;
      profile.gems = count(profile.gems) + challenge.gems;
    }
  }
  addSeasonRound(profile,result);
  profile.badges = earnedBadges(profile).map((badge) => badge.id);
  profile.xp = count(profile.xp) + xp;
  profile.coins = count(profile.coins) + coins;
  profile.awardedRounds = [...awarded, result.roundId];
  return { applied: true, xp, coins };
}

export function hasGoldFinish(profile,weapon) {
  return (profile.owned||[]).includes('gold-'+weapon)||rifleMastery(profile,weapon).gold;
}
