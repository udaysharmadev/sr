// Configured UTC windows; rewards are granted only by the profile authority.
export const SEASONS = [{
  id:'precision-1', number:1, name:'Precision Frontier',
  startsAt:Date.parse('2026-11-01T00:00:00Z'), endsAt:Date.parse('2027-02-01T00:00:00Z'),
  missions:[{id:'kills',name:'Eliminate 50 players',target:50,xp:500},{id:'headshots',name:'Land 20 headshots',target:20,xp:500},{id:'wins',name:'Win 3 public matches',target:3,xp:750}],
  tiers:[{xp:500,coins:500,gems:0},{xp:1500,coins:1000,gems:5},{xp:3500,coins:2000,gems:15},{xp:5000,coins:0,gems:0,badge:'frontier-ace'},{xp:7500,coins:0,gems:0,finish:'sunbolt-frontier-vanguard',finishName:'Frontier Vanguard M24'}]
}];
export const SEASON_CLAIM_GRACE = 7*24*60*60*1000;
export const seasonAt = at => SEASONS.find(s=>at>=s.startsAt&&at<s.endsAt) || null;
export const claimableSeasons = at => SEASONS.filter(s=>at>=s.startsAt&&at<s.endsAt+SEASON_CLAIM_GRACE);
export const seasonForClaim = (id,at) => claimableSeasons(at).find(s=>s.id===id) || null;
export function seasonProgress(profile,season) {
  const saved=profile.seasons?.[season.id];
  const count=n=>Math.max(0,Math.floor(Number(n)||0));
  return {xp:count(saved?.xp),claimed:Array.isArray(saved?.claimed)?saved.claimed:[],kills:count(saved?.kills),headshots:count(saved?.headshots),wins:count(saved?.wins),missionClaims:Array.isArray(saved?.missionClaims)?saved.missionClaims:[]};
}
export function addSeasonRound(profile,result) {
  const season=seasonAt(result.finishedAt), kills=Math.max(0,Math.floor(Number(result.kills)||0));
  if(!season)return;
  profile.seasons ||= {};
  const progress=profile.seasons[season.id] ||= {xp:0,claimed:[]};
  progress.xp=Math.max(0,Math.floor(Number(progress.xp)||0))+200+30*kills+(result.win===true?100:0);
  progress.kills=Math.max(0,Math.floor(Number(progress.kills)||0))+kills;
  progress.headshots=Math.max(0,Math.floor(Number(progress.headshots)||0))+Math.min(kills,Math.max(0,Math.floor(Number(result.headshots)||0)));
  progress.wins=Math.max(0,Math.floor(Number(progress.wins)||0))+Number(result.win===true);
}
export function claimSeasonTier(profile,id,tier,now) {
  const season=seasonForClaim(id,now);
  if(!season||!Number.isInteger(tier)||tier<0||tier>=season.tiers.length)return false;
  const progress=seasonProgress(profile,season),reward=season.tiers[tier];
  if(progress.xp<reward.xp||progress.claimed.includes(tier))return false;
  profile.seasons ||= {};profile.seasons[id]={...progress,claimed:[...progress.claimed,tier]};
  profile.coins=Math.max(0,Math.floor(Number(profile.coins)||0))+reward.coins;
  profile.gems=Math.max(0,Math.floor(Number(profile.gems)||0))+reward.gems;
  if(reward.badge) profile.badges=[...new Set([...(profile.badges||[]),reward.badge])];
  if(reward.finish) profile.owned=[...new Set([...(profile.owned||[]),'wrap-'+reward.finish])];
  return {coins:reward.coins,gems:reward.gems,badge:reward.badge||null,finish:reward.finish||null,tier};
}

export function claimSeasonMission(profile,id,missionId,now) {
  const season=seasonForClaim(id,now), mission=season?.missions.find(m=>m.id===missionId);
  if(!season||!mission)return false;
  const progress=seasonProgress(profile,season);
  if(progress[mission.id]<mission.target||progress.missionClaims.includes(mission.id))return false;
  profile.seasons ||= {};profile.seasons[id]={...progress,xp:progress.xp+mission.xp,missionClaims:[...progress.missionClaims,mission.id]};
  return {mission:mission.id,xp:mission.xp};
}
