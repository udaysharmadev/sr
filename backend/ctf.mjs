// Server-owned Capture the Flag state. Positions are authoritative player poses.
const teams = ['blue', 'orange'];
const otherTeam = team => team === 'blue' ? 'orange' : 'blue';
const nearby = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) <= 1.5 && Math.abs((a.y || 0) - (b.y || 0)) <= 2;
const homeFlag = flag => Object.assign(flag, {x:flag.home.x, y:flag.home.y, z:flag.home.z, carrier:null, droppedAt:null});

export function createFlags(map) {
  const home = team => {
    const candidates = map.spawns.filter(s => team === 'blue' ? s.z > 0 : s.z < 0);
    const spawn = candidates.reduce((best, s) => !best || Math.abs(s.z) > Math.abs(best.z) ? s : best, null);
    if (!spawn) throw new Error('Map needs opposing flag spawns');
    return {x:spawn.x, y:spawn.y || 0, z:spawn.z};
  };
  return Object.fromEntries(teams.map(team => {const position=home(team); return [team,{home:position,...position,carrier:null,droppedAt:null}];}));
}

export function dropFlags(flags, player, now) {
  for (const team of teams) {
    const flag=flags[team];
    if (flag.carrier !== player.id) continue;
    Object.assign(flag,{x:player.x,y:player.y || 0,z:player.z,carrier:null,droppedAt:now});
  }
}

// Events describe completed state changes; caller handles score limit and broadcasts.
export function updateFlags(flags, players, scores, now) {
  const events=[];
  const active=players.filter(p=>p.alive && !p.spectator && teams.includes(p.team));
  for (const team of teams) {
    const flag=flags[team];
    if (flag.carrier) {
      const carrier=active.find(p=>p.id===flag.carrier);
      if (!carrier) { homeFlag(flag); events.push({type:'flag-return',team}); }
      else Object.assign(flag,{x:carrier.x,y:carrier.y || 0,z:carrier.z});
    } else if (flag.droppedAt !== null && now-flag.droppedAt >= 15000) {
      homeFlag(flag);events.push({type:'flag-return',team});
    }
  }
  for (const p of active) {
    const own=flags[p.team], enemy=flags[otherTeam(p.team)];
    if (!own.carrier && own.droppedAt !== null && nearby(p,own)) {
      homeFlag(own);events.push({type:'flag-return',team:p.team,player:p.id});
    }
    if (!enemy.carrier && nearby(p,enemy)) {
      enemy.carrier=p.id;enemy.droppedAt=null;events.push({type:'flag-pickup',team:otherTeam(p.team),player:p.id});
    }
    if (enemy.carrier===p.id && !own.carrier && own.droppedAt===null && nearby(p,own.home)) {
      scores[p.team]=(scores[p.team] || 0)+1;homeFlag(enemy);
      events.push({type:'flag-capture',team:p.team,player:p.id});
    }
  }
  return events;
}
