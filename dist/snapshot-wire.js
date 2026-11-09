// Versioned field dictionary removes repeated names without rounding physics.
const playerFields = 'id name weapon gear ready team spectator joined liveSince alive kills deaths shots hits streak bestStreak headshots quickscopes airborneKills longestKill weaponStats badge ping scoreAt inputSeq shotSeq equipmentSeq x y z yaw pitch vx vy vz grounded slideTime slideCooldown coyote jumpBuffer eyeHeight lean life spawnedAt respawnAt shieldUntil ammo reloadUntil lastShot scoped scopeSince equipment grenades health knifeHits grenadePrimedAt meleeReadyAt finish armsKills'.split(' ');
const remoteFields = new Set('id name weapon gear ready team spectator alive kills deaths shots hits streak bestStreak badge ping scoreAt x y z yaw pitch grounded eyeHeight lean life shieldUntil equipment grenadePrimedAt finish armsKills'.split(' '));

export function packSnapshot(state, ownId) {
  const full = state.phase !== 'live' && state.phase !== 'warmup';
  const players = state.players.map(player => {
    const masks=[0,0],values=[];
    playerFields.forEach((key,index)=>{
      if(Object.hasOwn(player,key) && (full || player.id===ownId || remoteFields.has(key))){
        masks[Math.floor(index/30)]|=1<<(index%30);values.push(player[key]);
      }
    });
    return [...masks,...values];
  });
  return {...state, wire:1, players};
}

export function unpackSnapshot(state) {
  if(!state?.wire)return state;
  if(state.wire!==1)throw Object.assign(new Error('Arena version changed. Reload the game.'),{status:409});
  const players=state.players.map(row=>{
    const player={};let offset=2;
    playerFields.forEach((key,index)=>{if(row[Math.floor(index/30)]&(1<<(index%30)))player[key]=row[offset++];});
    return player;
  });
  const {wire,...rest}=state;return {...rest,players};
}
