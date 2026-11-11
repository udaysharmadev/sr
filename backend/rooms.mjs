import { clearPosition, MAPS, TRAINING_MAP } from "../dist/maps.js";
import { canChangeWeapon, CHAMBER_MS, WEAPONS, cosmeticLoadout } from "../dist/weapons.js";
import { EQUIPMENT, KNIFE_RANGE, KNIFE_MS, FUSE_MS, CHARGE_MS, MAX_HEALTH, KNIFE_DAMAGE, blastDamage, damagePlayer, grenadeLaunch, stepGrenade, playerAlias, rifleHitboxes, eyeOrigin } from "../dist/equipment.js";
import { movePlayer, resetPlayerMotion } from "../dist/movement.js";
import { takeRecentMovementFrames } from "../dist/input-queue.js";
import { armsStage, compareArmsPlayers } from '../dist/arms-race.js';
import { createFlags, dropFlags, updateFlags } from './ctf.mjs';

const getMap = (id) => MAPS.find((m) => m.id === id);
const arenaFor = r => r.public && r.phase === 'warmup' ? TRAINING_MAP : getMap(r.map);
const requireRule = (ok, reason, status = 409) => {
  if (!ok) throw Object.assign(new Error(reason), { status });
};
const teamGame = mode => mode === 'tdm' || mode === 'ctf';
const livePlayers = (r) => r.players.filter((p) => !p.spectator);
const countTeam = (r, team) =>
  livePlayers(r).filter((p) => p.team === team).length;
const timeouts = { vote: 10000, warmup: 10000, results: 18000 };
const uuid = () => crypto.randomUUID();
export const codeForRoom = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32],
  ).join("");
const defaultRoomSettings = (isPublic) => ({
  mode: "ffa",
  duration: 10,
  capacity: isPublic ? 15 : 4,
  map: MAPS[0].id,
  locked: false,
  autoAssign: true,
  spectators: false,
  firstToTen: true,
  duelRule: "points",
  targetPoints: 10,
});

export function newRoom(code, isPublic) {
  return {
    id: uuid(),
    code,
    public: isPublic,
    phase: "waiting",
    host: null,
    endsAt: 0,
    map: MAPS[0].id,
    round: 0,
    history: [],
    players: [],
    events: [],
    grenades: [],
    banned: [],
    votes: {},
    eventId: 0,
    eventResetId: 0,
    scores: { blue: 0, orange: 0 },
    settings: defaultRoomSettings(isPublic),
  };
}

function intersect(origin, dir, low, high) {
  let enter = 0, leave = 125;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < low[i] || origin[i] > high[i]) return Infinity;
      continue;
    }
    const a = (low[i] - origin[i]) / dir[i], b = (high[i] - origin[i]) / dir[i];
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return Infinity;
  }
  return enter;
}
function wallDistance(map, origin, dir) {
  let distance = Infinity;
  for (const b of map.boxes) {
    distance = Math.min(
      distance,
      intersect(origin, dir, [b.x - b.w / 2, b.y || 0, b.z - b.d / 2], [
        b.x + b.w / 2,
        (b.y || 0) + b.h,
        b.z + b.d / 2,
      ]),
    );
  }
  return distance;
}
function spawn(r, p, now) {
  const map = arenaFor(r),
    others = livePlayers(r).filter((q) => q.id !== p.id && q.alive);
  const blasts = [];
  for(const grenade of r.grenades || []) {
    const owner=r.players.find(q=>q.id===grenade.owner),deadline=grenade.createdAt+FUSE_MS;
    const team=owner?.team??grenade.team;
    if(deadline<now+1000 || r.endsAt&&deadline>r.endsAt || p.team&&team===p.team&&grenade.owner!==p.id)continue;
    blasts.push(stepGrenade({...grenade},map,FUSE_MS/1000-grenade.age));
  }
  let bestScore = -Infinity, best;
  for (const base of map.spawns) {
    for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
      const x = base.x + dx, z = base.z + dz;
      if (
        !clearPosition(map, x, z) ||
        others.some((q) => Math.hypot(q.x - x, q.z - z) < 1.1)
      ) continue;
      let visible = 0, nearest = 80;
      for (const q of others) {
        if (p.team && q.team === p.team) continue;
        const len = Math.hypot(q.x - x, q.y + q.eyeHeight - 1.6, q.z - z) || 1;
        nearest = Math.min(nearest, len);
        if (
          wallDistance(map, [x, 1.6, z], [
            (q.x - x) / len,
            (q.y + q.eyeHeight - 1.6) / len,
            (q.z - z) / len,
          ]) >= len
        ) visible++;
      }
      const recentDeaths = r.events.filter((e) =>
        e.type === "kill" && now - e.at < 8000 &&
        Math.hypot(e.x - x, e.z - z) < 5
      ).length;
      const nearbyShots = r.events.filter((e) => e.type === "shot" && now - e.at < 2500 &&
        Number.isFinite(e.x) && Math.hypot(e.x - x, e.z - z) < 7).length;
      const side = p.team === "blue" ? z : p.team === "orange" ? -z : 0;
      let blastRisk=0;
      for(const blast of blasts) {
        const dir=[x-blast.x,1.62*.6-blast.y,z-blast.z],distance=Math.hypot(...dir),amount=blastDamage(distance);
        if(amount&&wallDistance(map,[blast.x,blast.y,blast.z],dir.map(v=>v/(distance||1)))>=distance-.1)blastRisk+=amount;
      }
      const score = nearest - visible * 40 - recentDeaths * 8 - nearbyShots * 4 + side * .8 -
        Math.hypot(dx, dz) - Math.min(MAX_HEALTH,blastRisk)*2;
      if (score > bestScore) {
        bestScore = score;
        best = { x, z, yaw: base.yaw };
      }
    }
  }
  if (!best) {
    p.alive = false;
    p.respawnAt = now + 250;
    return;
  }
  resetPlayerMotion(p,best);
  Object.assign(p, {
    spawnX: best.x,
    spawnZ: best.z,
    history: [],
    alive: true,
    life: (p.life || 0) + 1,
    spawnedAt: now,
    respawnAt: 0,
    shieldUntil: now + 1000,
    ammo: 1,
    reloadUntil: 0,
    lastShot: 0,
    moveTime: now,
    credit: .1,
    scoped: false,
    scopeSince: 0,
    equipment: "rifle", grenades: 1, health: MAX_HEALTH, knifeHits: 0, grenadePrimedAt: null, meleeReadyAt: 0,
  });
  if (r.settings.mode === 'arms') applyArmsWeapon(p);
  record(p, now);
}
function applyArmsWeapon(p) {
  const stage = armsStage(p.armsKills);
  if (p.weapon !== stage.weapon) p.finish = 'field';
  p.weapon = stage.weapon;
  p.equipment = stage.final ? 'knife' : 'rifle';
  p.scoped = false; p.scopeSince = 0; p.grenadePrimedAt = null;
}
function record(p, at) {
  p.history = p.history.filter((s) => at - s.at <= 330);
  if (p.history.length && at - p.history.at(-1).at < 12) p.history.pop();
  p.history.push({
    at,
    x: p.x,
    y: p.y,
    z: p.z,
    lean: p.lean,
    yaw: p.yaw,
    eyeHeight: p.eyeHeight,
  });
}
function resetStats(r, at) {
  r.events = [];
  r.eventResetId = r.eventId;
  r.grenades = [];
  r.scores = { blue: 0, orange: 0 };
  r.flags = r.settings.mode === 'ctf' ? createFlags(getMap(r.map)) : null;
  for (const p of livePlayers(r)) {
    Object.assign(p, {
      kills: 0,
      deaths: 0,
      streak: 0,
      bestStreak: 0,
      scoreAt: at,
      shots: 0,
      hits: 0,
      headshots: 0, quickscopes: 0, airborneKills: 0, longestKill: 0,
      weaponStats: {}, scoped: false, scopeSince: 0,
      armsKills: 0,
      liveSince: at,
    });
    p.alive = false;
  }
  for (const p of livePlayers(r)) spawn(r, p, at);
}
function remove(r, id, now) {
  const leaving = r.players.find(p => p.id === id);
  if (leaving && r.flags && r.phase === "live") dropFlags(r.flags, leaving, now);
  r.players = r.players.filter((p) => p.id !== id);
  delete r.votes[id];
  if (r.host === id) r.host = livePlayers(r)[0]?.id ?? null;
}
function setPhase(r, phase, at) {
  r.phase = phase;
  r.endsAt = phase === "live"
    ? r.settings.mode === 'duel' && r.settings.duelRule === 'points' ? 0 : at + r.settings.duration * 60000
    : timeouts[phase]
    ? at + timeouts[phase]
    : 0;
  if (phase === "vote") {
    r.votes = {};
    r.round++;
  }
  if (phase === "live") {
    r.startedAt = at;
    r.finishedAt = 0;
  }
  if (phase === "results") {
    r.finishedAt = at;
    if(r.public){
      const ranked=[...livePlayers(r)].sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||a.scoreAt-b.scoreAt||a.id.localeCompare(b.id));
      r.completedRewards ||= [];
      for(const p of ranked)if(p.guestProfileId)r.completedRewards.push({profileId:p.guestProfileId,result:{
        roundId:r.id+':'+r.round,completed:true,practice:false,finishedAt:at,
        kills:p.kills,deaths:p.deaths,streak:p.bestStreak,shots:p.shots,hits:p.hits,
        headshots:p.headshots,quickscopes:p.quickscopes,airborneKills:p.airborneKills,longestKill:p.longestKill,
        weaponStats:structuredClone(p.weaponStats||{}),win:p.kills>0&&ranked[0]?.id===p.id,
      }});
    }
  }
  if (phase === "live" || phase === "warmup") resetStats(r, at);
  if (phase === "waiting") { for (const p of r.players) p.ready = false; }
}
function votedMap(r) {
  const mapIds = MAPS.map((m) => m.id), votes = Object.values(r.votes);
  const priority = mapIds.slice(r.round % mapIds.length).concat(
    mapIds.slice(0, r.round % mapIds.length),
  );
  // Every displayed map remains eligible: a clear majority must always win.
  // Rotating priority breaks equal-vote ties without favoring the first card.
  return priority.sort((a, b) =>
    votes.filter((v) => v === b).length - votes.filter((v) => v === a).length
  )[0];
}
export function advance(r, now) {
  r.events = r.events.filter(e => now - e.at <= 8000);
  if (r.public) {
    r.settings.mode = "ffa";
    r.settings.capacity = 15;
    r.settings.duration = 10;
    for (const p of r.players) p.team = null;
  }
  const rosterAt=r.phase==='live'&&r.endsAt?Math.min(now,r.endsAt):now;
  for (const p of [...r.players]) if (rosterAt - p.seen > 45000) remove(r, p.id, now);
  if (
    r.public && ["vote", "warmup"].includes(r.phase) &&
    livePlayers(r).length < r.settings.capacity
  ) setPhase(r, "waiting", now);
  if (r.public && r.phase === "waiting" && livePlayers(r).length >= r.settings.capacity) {
    setPhase(r, "vote", now);
  }
  if (["warmup", "live"].includes(r.phase)) advanceGrenades(r, r.endsAt ? Math.min(now, r.endsAt) : now);
  while (r.endsAt && now >= r.endsAt) {
    const at = r.endsAt;
    if (r.phase === "vote") {
      r.map = votedMap(r);
      r.history = [...r.history.slice(-1), r.map];
      setPhase(r, "warmup", at);
    } else if (r.phase === "warmup") setPhase(r, "live", at);
    else if (r.phase === "live") setPhase(r, "results", at);
    else {setPhase(
        r,
        "waiting",
        at,
      );}
  }
  if (["warmup", "live"].includes(r.phase)) {
    for (const p of livePlayers(r)) {
      if (!p.alive && now >= p.respawnAt) spawn(r, p, now);
      if (p.reloadUntil && now >= p.reloadUntil) {
        p.ammo = 1;
        p.reloadUntil = 0;
      }
    }
  }
  updateObjectives(r, now);
}
export function addPlayer(r, body, now) {
  const weapon = body.weapon ?? WEAPONS[0].id;
  requireRule(WEAPONS.some((w) => w.id === weapon), "Select a valid rifle.", 400);
  requireRule(!r.settings.locked, "This room is locked.");
  requireRule(
    !r.banned.includes(body.device),
    "You were removed from this room.",
    403,
  );
  const spectator = body.spectator === true;
  requireRule(
    !spectator || (!r.public && r.settings.spectators),
    "Spectators are disabled.",
  );
  requireRule(
    spectator
      ? r.players.length < r.settings.capacity + 8
      : livePlayers(r).length < r.settings.capacity,
    "This room is full.",
  );
  const name = playerAlias(body.name) || "Guest";
  const p = {
    id: uuid(),
    token: uuid(),
    guestProfileId:body.guestProfileId || null,
    guestSessionHash:body.guestSessionHash || null,
    device: String(body.device || uuid()).slice(0, 64),
    name,
    weapon,
    finish:'field',
    gear: cosmeticLoadout(body.gear),
    ready: false,
    team: null,
    spectator,
    seen: now,
    joined: now,
    liveSince: now,
    alive: false,
    history: [],
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    streak: 0,
    bestStreak: 0,
    headshots: 0, quickscopes: 0, airborneKills: 0, longestKill: 0, weaponStats: {},
    badge: ["weapon-master", "deadeye", "untouchable", "veteran"].includes(body.badge) ? body.badge : null,
    ping: 0,
    scoreAt: now,
    inputSeq: 0,
    shotSeq: 0,
    equipmentSeq: 0,
    armsKills: 0,
  };
  if (!spectator && teamGame(r.settings.mode) && (r.settings.autoAssign || ["warmup","live"].includes(r.phase))) {
    p.team = countTeam(r, "blue") <= countTeam(r, "orange") ? "blue" : "orange";
  }
  r.players.push(p);
  if (!r.public && !r.host && !spectator) r.host = p.id;
  if (!spectator) spawn(r, p, now);
  advance(r, now);
  return { id: p.id, token: p.token, code: r.code };
}
function settings(r, patch) {
  const cfg = { ...r.settings };
  requireRule(patch && typeof patch === "object", "Invalid settings.", 400);
  if (patch.mode !== undefined) {
    requireRule(["ffa", "duel", "tdm", "arms", "ctf"].includes(patch.mode), "Unknown mode.");
    if (cfg.mode !== patch.mode) {
      cfg.mode = patch.mode;
      cfg.capacity = cfg.mode === "duel" ? 2 : teamGame(cfg.mode) ? 10 : 4;
      cfg.duration = 10;
    }
  }
  const capacities = cfg.mode === "duel"
    ? [2]
    : teamGame(cfg.mode)
    ? [4, 6, 8, 10]
    : Array.from({ length: 14 }, (_, i) => i + 2);
  for (
    const [key, values] of [["capacity", capacities], [
      "duration",
      teamGame(cfg.mode) ? [5, 10, 15] : [3, 5, 10, 15, 20],
    ], ["map", MAPS.map((m) => m.id)]]
  ) {
    if (patch[key] !== undefined) {
      requireRule(values.includes(patch[key]), "Invalid " + key + ".");
      cfg[key] = patch[key];
    }
  }
  for (const key of ["firstToTen", "autoAssign", "spectators", "locked"]) {
    if (typeof patch[key] === "boolean") cfg[key] = patch[key];
  }
  if (patch.duelRule !== undefined) {
    requireRule(['time','points'].includes(patch.duelRule), 'Choose time or target points.');
    cfg.duelRule = patch.duelRule;
  } else if (patch.firstToTen !== undefined) cfg.duelRule = patch.firstToTen ? 'points' : 'time';
  if (patch.targetPoints !== undefined) {
    requireRule([5,10,15,20,30,50].includes(patch.targetPoints), 'Choose a valid target.');
    cfg.targetPoints = patch.targetPoints;
  }
  requireRule(
    livePlayers(r).length <= cfg.capacity,
    "Room already has more players than this capacity.",
  );
  const teamModeChanged = r.settings.mode !== cfg.mode;
  if (teamGame(cfg.mode) && !teamModeChanged) {
    requireRule(
      Math.max(countTeam(r, "blue"), countTeam(r, "orange")) <=
        cfg.capacity / 2,
      "Reassign teams before lowering capacity.",
    );
  }
  r.settings = cfg;
  r.map = cfg.map;
  livePlayers(r).forEach((p, i) => {
    if (teamModeChanged) {
      p.team = teamGame(cfg.mode) && cfg.autoAssign
        ? ["blue", "orange"][i % 2]
        : null;
    } else if (teamGame(cfg.mode) && cfg.autoAssign && !p.team) {
      p.team = countTeam(r, "blue") <= countTeam(r, "orange")
        ? "blue"
        : "orange";
    }
    p.ready = false;
    if (teamModeChanged) p.armsKills = 0;
  });
}
function emit(r, event) {
  r.events.push({ id: ++r.eventId, ...event });
  r.events = r.events.slice(-256);
}
function updateObjectives(r, now) {
  if (r.phase !== 'live' || r.settings.mode !== 'ctf' || !r.flags) return;
  const canReach = (player, flag) => {
    const origin=[player.x,player.y+.8,player.z],delta=[flag.x-player.x,(flag.y||0)+.6-origin[1],flag.z-player.z];
    const distance=Math.hypot(...delta);
    return distance<.001 || wallDistance(arenaFor(r),origin,delta.map(v=>v/distance))>=distance-.02;
  };
  for (const event of updateFlags(r.flags, livePlayers(r), r.scores, now, canReach)) {
    if (event.type === 'flag-pickup') {
      const carrier = r.players.find(p => p.id === event.player);
      if (carrier) carrier.shieldUntil = 0;
    }
    emit(r, {...event, at:now});
    if (event.type === 'flag-capture' && r.scores[event.team] >= 3) {
      setPhase(r, 'results', now);
      break;
    }
  }
}
function poseAt(q, at) {
  const samples = q.history;
  const i = samples.findIndex((s) => s.at >= at);
  if (i < 0) return q;
  if (i === 0) return samples[0];
  const a = samples[i - 1],
    b = samples[i],
    t = (at - a.at) / (b.at - a.at || 1);
  return Object.fromEntries(
    ["x", "y", "z", "lean", "yaw", "eyeHeight"].map(
      (k) => [k, a[k] + (k === "yaw" ? Math.atan2(Math.sin(b[k]-a[k]),Math.cos(b[k]-a[k])) : b[k]-a[k]) * t],
    ),
  );
}
function shoot(r, p, data, now) {
  if (!Number.isSafeInteger(data.seq) || data.seq <= p.shotSeq) return;
  p.shotSeq = data.seq;
  if (
    (p.equipment || "rifle") !== "rifle" || !p.alive || p.ammo < 1 || p.reloadUntil || now - p.lastShot < CHAMBER_MS ||
    !Number.isFinite(data.yaw) || !Number.isFinite(data.pitch) ||
    Math.abs(data.pitch) > 1.49
  ) return;
  const yaw = data.yaw % (Math.PI * 2), pitch = data.pitch;
  const eye = eyeOrigin(p, yaw);
  const dir = [
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
  const at = Math.max(
    now - 180,
    Math.min(now, Number.isFinite(data.at) ? data.at : now),
  );
  p.shieldUntil = 0;
  p.lastShot = now;
  p.ammo = 0;
  p.reloadUntil = now + CHAMBER_MS;
  p.shots++;
  const rifleStats = (p.weaponStats ||= {})[p.weapon] ||= { shots: 0, hits: 0, kills: 0, headshots: 0 };
  rifleStats.shots++;
  emit(r, { type: "shot", attacker: p.id, life:p.life, weapon: p.weapon || WEAPONS[0].id, x: p.x, z: p.z, origin:eye, yaw, pitch, at: now });
  let distance = wallDistance(arenaFor(r), eye, dir),
    target,
    headshot = false;
  for (const q of livePlayers(r)) {
    if (q.id === p.id || !q.alive || q.shieldUntil > at || at < (q.spawnedAt || 0)) continue;
    const pose = poseAt(q, at), boxes = rifleHitboxes(pose);
    const head = intersect(eye, dir, ...boxes.head);
    const body = intersect(eye, dir, ...boxes.body);
    if (Math.min(head, body) < distance) {
      distance = Math.min(head, body);
      target = q;
      headshot = head <= body;
    }
  }
  if (!target && r.public && r.phase === 'warmup') {
    for (const board of TRAINING_MAP.targets) {
      const hit=intersect(eye,dir,[board.x-.65,board.y-.65,board.z+.105],[board.x+.65,board.y+.65,board.z+.135]);
      if(hit <= distance + .03) { emit(r,{type:'practice-hit',attacker:p.id,at:now}); break; }
    }
  }
  if (!target || (p.team && p.team === target.team)) return;
  eliminate(r, p, target, p.weapon || WEAPONS[0].id, dir, distance, headshot, now);
}
function eliminate(r, p, target, weapon, dir, distance, headshot, now) {
  if (r.flags && r.phase === 'live') dropFlags(r.flags, target, now);
  target.alive = false;
  target.health = 0;
  target.deaths++;
  target.streak = 0;
  target.respawnAt = now + 2000;
  target.reloadUntil = 0;
  target.grenadePrimedAt = null;
  const suicide = p.id === target.id;
  if (!suicide) p.kills++;
  if (!suicide) p.streak++;
  p.bestStreak = Math.max(p.bestStreak, p.streak);
  const isRifle = WEAPONS.some((w) => w.id === weapon);
  if (isRifle) {
    p.hits++;
    const rifleStats = p.weaponStats[weapon];
    rifleStats.hits++; rifleStats.kills++; rifleStats.headshots += Number(headshot);
  }
  const quickscope = Boolean(isRifle && p.scoped && now - p.scopeSince <= 350);
  const airborne = isRifle && !p.grounded && p.y > .2;
  p.headshots = (p.headshots || 0) + Number(headshot);
  p.quickscopes = (p.quickscopes || 0) + Number(quickscope);
  p.airborneKills = (p.airborneKills || 0) + Number(airborne);
  p.longestKill = Math.max(p.longestKill || 0, distance);
  p.scoreAt = now;
  if (p.team && !suicide && r.settings.mode === 'tdm') r.scores[p.team]++;
  emit(r, {
    type: "kill",
    attacker: p.id,
    attackerName: p.name,
    victim: target.id,
    weapon,
    headshot,
    quickscope, airborne, distance,
    longShot: distance >= 30,
    streak: p.streak,
    x: target.x,
    z: target.z,
    victimPose: {
      x: target.x, y: target.y, z: target.z, yaw: target.yaw,
      eyeHeight: target.eyeHeight, weapon: target.weapon,finish:target.finish||'field',
      impactX: dir[0] || 0, impactZ: dir[2] || 0,
    },
    at: now,
  });
  if (r.phase === 'live' && r.settings.mode === 'arms' && !suicide) {
    const before = armsStage(p.armsKills);
    if (before.final ? weapon === 'knife' : weapon === before.weapon) {
      p.armsKills = (p.armsKills || 0) + 1;
      const after = armsStage(p.armsKills);
      if (after.index !== before.index) applyArmsWeapon(p);
      if (after.complete) setPhase(r, 'results', now);
    }
  }
  if (
    r.phase === "live" && r.settings.mode === "duel" && (r.settings.duelRule ? r.settings.duelRule === 'points' : r.settings.firstToTen) &&
    p.kills >= (r.settings.targetPoints || 10)
  ) setPhase(r, "results", now);
}
function melee(r, p, data, now) {
  if (!p.alive || p.equipment !== "knife" || now < (p.meleeReadyAt || 0) ||
      !Number.isFinite(data.yaw) || !Number.isFinite(data.pitch) || Math.abs(data.pitch) > 1.49) return;
  p.meleeReadyAt = now + KNIFE_MS; p.shieldUntil = 0;
  const dir = [-Math.sin(data.yaw) * Math.cos(data.pitch), Math.sin(data.pitch), -Math.cos(data.yaw) * Math.cos(data.pitch)];
  const origin = eyeOrigin(p, data.yaw);
  let distance = Math.min(KNIFE_RANGE, wallDistance(arenaFor(r), origin, dir)), target;
  for (const q of livePlayers(r)) {
    if (q.id === p.id || !q.alive || q.shieldUntil > now) continue;
    const d = intersect(origin, dir, [q.x - .4, q.y, q.z - .4], [q.x + .4, q.y + q.eyeHeight + .24, q.z + .4]);
    if (d < distance) { distance = d; target = q; }
  }
  emit(r, { type: "melee", attacker: p.id, life:p.life, at: now });
  if (target && !(p.team && p.team === target.team)) {
    target.knifeHits = (target.knifeHits || 0) + 1;
    const damage = damagePlayer(target, KNIFE_DAMAGE);
    emit(r, { type: "knifehit", attacker: p.id, victim: target.id, damage, health: target.health, at: now });
    if (target.health === 0) eliminate(r, p, target, "knife", dir, distance, false, now);
  }
}
function advanceGrenades(r, now) {
  r.grenades ||= [];
  for (const grenade of r.grenades) {
    stepGrenade(grenade, arenaFor(r), Math.max(0, now - grenade.updatedAt) / 1000);
    grenade.updatedAt = now;
    if (grenade.age < FUSE_MS / 1000 - .00001) continue;
    const at = grenade.createdAt + FUSE_MS;
    emit(r, { type: "explosion", grenadeId: grenade.id, x: grenade.x, y: grenade.y, z: grenade.z, at });
    // A thrown explosive remains live when its owner leaves; no credentials are retained.
    const attacker = r.players.find((q) => q.id === grenade.owner) || {
      id:grenade.owner, name:grenade.ownerName || "Operator", team:grenade.team || null,
      kills:0, streak:0, bestStreak:0,
    };
    for (const q of livePlayers(r)) {
      if (!q.alive || q.shieldUntil > at || attacker.team && attacker.team === q.team && q.id !== attacker.id) continue;
      const dir = [q.x - grenade.x, q.y + q.eyeHeight * .6 - grenade.y, q.z - grenade.z];
      const distance = Math.hypot(...dir);
      const amount = blastDamage(distance);
      if (!amount) continue;
      const unit = dir.map((v) => v / (distance || 1));
      if (wallDistance(arenaFor(r), [grenade.x, grenade.y, grenade.z], unit) < distance - .1) continue;
      const damage = damagePlayer(q, amount);
      emit(r, { type: "grenadehit", grenadeId: grenade.id, attacker: attacker.id, victim: q.id, damage, health: q.health, distance, at });
      if (q.health === 0) eliminate(r, attacker, q, "grenade", unit, distance, false, at);
    }
  }
  r.grenades = r.grenades.filter((g) => g.age < FUSE_MS / 1000 - .00001);
}

export function command(r, token, data, now) {
  const p = r.players.find((q) => q.token === token);
  requireRule(p, "Room session expired or you were removed.", 403);
  p.seen = now;
  if (Number.isFinite(data.ping) && data.ping >= 0) {
    p.ping = Math.min(9999, Math.round(data.ping));
  }
  const type = data.type;
  if (["input","shoot","melee","prime","throw","equip","cancelprime","reload"].includes(type) &&
      data.life !== undefined && data.life !== p.life) return;
  if (type === "leave") {
    remove(r, p.id, now);
    advance(r, now);
    return;
  }
  if (type === "refresh") return;
  if (type === "rename") {
    const name = playerAlias(data.name); requireRule(name.length >= 2, "Use 2–22 letters, numbers, spaces, _ or -.", 400);
    p.name = name; return;
  }
  if (type === "equip") {
    requireRule(EQUIPMENT.includes(data.equipment), "Select valid equipment.", 400);
    if (!p.alive || p.spectator) return;
    requireRule(r.settings.mode !== 'arms' || !armsStage(p.armsKills).final || data.equipment === 'knife', 'Final stage: finish with the knife.');
    requireRule(data.equipment !== "grenade" || p.grenades > 0, "No grenade left this life.");
    if (p.equipment === data.equipment) return;
    p.equipment = data.equipment; p.scoped = false; p.grenadePrimedAt = null; return;
  }
  if (type === "cancelprime") { p.grenadePrimedAt = null; return; }
  if (type === "vote") {
    requireRule(
      r.phase === "vote" && !p.spectator && getMap(data.map),
      "Voting is closed.",
    );
    r.votes[p.id] = data.map;
    return;
  }
  if (type === "loadout") {
    requireRule(canChangeWeapon(r.phase, p.alive, p.spectator, r.settings.mode), r.settings.mode === 'arms' ? 'Arms Race chooses your rifle. Earn kills to advance.' : "Change rifles during warmup or while eliminated.");
    requireRule(WEAPONS.some((w) => w.id === data.weapon), "Select a valid rifle.", 400);
    p.weapon = data.weapon;
    return;
  }
  if (["ready", "settings", "kick", "team", "start", "queueparty"].includes(type)) {
    requireRule(
      !r.public && r.phase === "waiting" && !p.spectator,
      "Room configuration is closed.",
    );
    if (type === "ready") {
      p.ready = !!data.ready;
      return;
    }
    if (type === "team") {
      requireRule(
        teamGame(r.settings.mode) && ["orange", "blue"].includes(data.team),
        "Select a valid team.",
      );
      requireRule(
        p.team === data.team ||
          countTeam(r, data.team) < r.settings.capacity / 2,
        "This team is full.",
      );
      p.team = data.team;
      p.ready = false;
      return;
    }
    requireRule(p.id === r.host, "Only the room host can do that.", 403);
    if (type === "settings") {
      settings(r, data.settings);
      return;
    }
    if (type === "kick") {
      const q = r.players.find((q) => q.id === data.id && q.id !== p.id);
      requireRule(q, "Player not found.");
      r.banned.push(q.device);
      remove(r, q.id, now);
      return;
    }
    requireRule(
      livePlayers(r).length >= 2 && livePlayers(r).every((q) => q.ready),
      "At least two players must join and everyone must be ready.",
    );
    if (type === "queueparty") {
      requireRule(r.players.every(q => !q.spectator), "Spectators must leave before public matchmaking.");
      r.public = true;
      r.partyQueueAt = now;
      r.settings = defaultRoomSettings(true);
      r.votes = {};
      for (const member of r.players) member.ready = false;
      advance(r, now);
      return;
    }
    if (teamGame(r.settings.mode)) {
      requireRule(
        countTeam(r, "blue") === countTeam(r, "orange") &&
          countTeam(r, "blue") * 2 === livePlayers(r).length &&
          livePlayers(r).length >= 4,
        "Team matches require equal teams of at least two.",
      );
    }
    setPhase(r, "warmup", now);
    return;
  }
  requireRule(
    ["input", "shoot", "reload", "prime", "throw", "melee"].includes(type),
    "Unknown room action.",
    400,
  );
  if (!["live", "warmup"].includes(r.phase) || p.spectator) return;
  if(["shoot","melee","prime","throw"].includes(type)&&data.input&&typeof data.input==="object"){
    command(r,token,{type:"input",seq:data.input.seq,frames:data.input.frames,life:data.life},now);
  }
  if (type === "prime") {
    if (p.alive && p.equipment === "grenade" && p.grenades > 0 && p.grenadePrimedAt == null) p.grenadePrimedAt = now;
    return;
  }
  if (type === "throw" || type === "melee") {
    if (!Number.isSafeInteger(data.seq) || data.seq <= (p.equipmentSeq || 0)) return;
    p.equipmentSeq = data.seq;
    if (type === "melee") { melee(r, p, data, now); return; }
    if (!p.alive || p.equipment !== "grenade" || p.grenadePrimedAt == null || !(p.grenades > 0) ||
        !Number.isFinite(data.yaw) || !Number.isFinite(data.pitch) || Math.abs(data.pitch) > 1.49) return;
    const held = Number.isFinite(data.holdMs) ? Math.max(0, Math.min(CHARGE_MS, data.holdMs)) : now - p.grenadePrimedAt;
    const charge = Math.max(0, Math.min(1, Math.min(held, now - p.grenadePrimedAt) / CHARGE_MS));
    const g = grenadeLaunch({ ...p, yaw: data.yaw, pitch: data.pitch }, charge, arenaFor(r));
    r.grenades ||= [];
    if (r.grenades.length >= 30) return;
    r.grenades.push({ ...g, id: p.id + ":" + data.seq, owner: p.id, ownerName:p.name, team:p.team, createdAt: now, updatedAt: now });
    emit(r,{type:"throw",attacker:p.id,life:p.life,at:now});
    p.grenadePrimedAt = null; p.grenades = 0; p.equipment = "rifle"; p.scoped = false; p.shieldUntil = 0;
    return;
  }
  if (type === "shoot") {
    shoot(r, p, data, now);
    return;
  }
  if (type === "reload") {
    if (p.alive && p.ammo < 1 && !p.reloadUntil) {
      p.reloadUntil = now + CHAMBER_MS;
    }
    return;
  }
  if (!Number.isSafeInteger(data.seq) || data.seq <= p.inputSeq) return;
  p.inputSeq = data.seq;
  if (!p.alive) return;
  const frames = Array.isArray(data.frames) ? data.frames.slice(0, 32)
    .filter(frame => Number.isFinite(frame?.dt) && frame.dt > 0)
    .map(frame => frame.dt > .05 ? { ...frame, dt: .05 } : frame) : [];
  p.credit = Math.min(.32, p.credit + Math.max(0, now - p.moveTime) / 1000);
  p.moveTime = now;
  for (const frame of takeRecentMovementFrames(frames, p.credit)) {
    if (typeof frame.scoped === "boolean") {
      if (frame.scoped && !p.scoped) p.scopeSince = now;
      p.scoped = frame.scoped && (p.equipment || "rifle") === "rifle";
    }
    movePlayer(p, frame, frame.dt, arenaFor(r));
    p.credit = Math.max(0, p.credit - frame.dt);
    updateObjectives(r, now);
    if (r.phase === 'results') break;
  }
  if (Math.hypot(p.x - p.spawnX, p.z - p.spawnZ) > 1.5) p.shieldUntil = 0;
  record(p, now);
}

export function snapshot(r, now, eventAfter) {
  const cursor=Number.isSafeInteger(eventAfter)&&eventAfter>=0&&eventAfter<=r.eventId?eventAfter:null;
  const firstEvent=r.events[0]?.id??r.eventId+1;
  const players = r.players.map((
    { token, guestProfileId, guestSessionHash, appearanceLife, device, history, credit, moveTime, spawnX, spawnZ, seen, ...p },
  ) => p)
    .sort((a, b) =>
      Number(a.spectator) - Number(b.spectator) || (r.settings.mode === 'arms' ? compareArmsPlayers(a,b) : 0) || b.kills - a.kills ||
      a.deaths - b.deaths || a.scoreAt - b.scoreAt || a.id.localeCompare(b.id)
    );
  return {
    code: r.code,
    roundId: (r.id || r.code) + ":" + r.round,
    startedAt: r.startedAt || 0,
    finishedAt: r.finishedAt || 0,
    public: r.public,
    host: r.host,
    phase: r.phase,
    map: r.map,
    arena: arenaFor(r)?.id || r.map,
    endsAt: r.endsAt,
    round: r.round,
    serverTime: now,
    settings: r.settings,
    players,
    votes: r.votes,
    eventId:r.eventId,
    eventGap:cursor!==null&&Math.max(cursor,r.eventResetId||0)<firstEvent-1,
    events: cursor===null?r.events:r.events.filter(e=>e.id>cursor),
    grenades: r.grenades || [],
    flags: r.flags || null,
    scores: r.scores,
  };
}
