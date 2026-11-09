import test from "node:test";
import assert from "node:assert/strict";
import { awardRound, dailyProgress, earnedBadges, rifleMastery } from "../dist/progression.js";
import { WEAPONS } from "../dist/weapons.js";
import { addPlayer, advance, command, newRoom, snapshot } from "./rooms.mjs";

test("career, rifle mastery and daily rewards use completed public rounds and cannot credit twice", () => {
  const p = {}, at = Date.UTC(2026, 10, 6, 12);
  const result = { roundId: "career:1", finishedAt: at, completed: true, kills: 12, deaths: 3, shots: 15, hits: 12,
    headshots: 7, longestKill: 42.5, quickscopes: 10, airborneKills: 5, streak: 9, win: true,
    weaponStats: { sunbolt: { shots: 15, hits: 12, kills: 12, headshots: 7 } } };
  assert.equal(awardRound(p, result, false).applied, false);
  assert.equal(awardRound(p, { ...result, practice: true }, true).applied, false);
  assert.equal(awardRound(p, result, true).applied, true);
  assert.equal(p.wins, 1); assert.equal(p.hits, 12); assert.equal(p.shots, 15); assert.equal(p.longestKill, 42.5);
  assert.equal(rifleMastery(p, "sunbolt").xp, 1375); assert.equal(rifleMastery(p, "sunbolt").gold, false);
  assert.equal(p.xp, 3200); assert.equal(p.coins, 800);
  assert.equal(awardRound(p, result, true).applied, false); assert.equal(p.xp, 3200);
  awardRound(p, { ...result, roundId: "career:2" }, true);
  assert.equal(p.xp, 5900, "second win grants its own daily reward once");
  assert.equal(dailyProgress(p, at).claimed.length, 3);
  assert.equal(dailyProgress(p, at + 86400000).wins, 0);
  for (let i = 3; i < 140; i++) awardRound(p, { completed: true, roundId: "career:" + i, finishedAt: at }, true);
  assert.equal(awardRound(p, result, true).applied, false, "old rounds stay deduplicated beyond 128 matches");
});

test("gold and persistent badges have demanding multi-condition thresholds", () => {
  const p = { kills: 499, deaths: 100, headshots: 299, wins: 19, rounds: 199, best: 24, mastery: {} };
  assert.equal(earnedBadges(p).length, 0);
  for (const w of WEAPONS) p.mastery[w.id] = { kills: 250, headshots: 50, xp: 26250 };
  assert.deepEqual(earnedBadges(p).map((b) => b.id), ["weapon-master"]);
  p.mastery.sunbolt = { kills: 500, headshots: 99, xp: 52475 };
  assert.equal(rifleMastery(p, "sunbolt").gold, false);
  p.mastery.sunbolt.headshots = 100; assert.equal(rifleMastery(p, "sunbolt").gold, true);
  Object.assign(p, { kills: 1000, headshots: 400, wins: 100, rounds: 200, best: 25 });
  assert.equal(earnedBadges(p).length, 4);
});

test("public queue is FFA, selected map gets ten seconds warmup and respawn waits exactly two seconds", () => {
  const t = 1000000, r = newRoom("P00000", true);
  const a = addPlayer(r, { name: "First" }, t);
  assert.equal(r.phase, "waiting"); assert.equal(r.endsAt, 0, "no fake solo countdown");
  const b = addPlayer(r, { name: "Second" }, t + 100);
  assert.equal(r.phase, "waiting");
  for(let i=0;i<13;i++)addPlayer(r,{name:"Pilot "+i},t+100);
  assert.equal(r.phase, "vote");
  command(r, a.token, { type: "vote", map: "foundry" }, t + 200);
  command(r, b.token, { type: "vote", map: "foundry" }, t + 200);
  assert.throws(() => command(r, a.token, { type: "settings", settings: { mode: "tdm" } }, t + 200), /configuration/);
  advance(r, t + 10100); assert.equal(r.phase, "warmup"); assert.equal(r.map, "foundry");
  assert.equal(r.endsAt, t + 20100);
  advance(r, t + 20099); assert.equal(r.phase, "warmup");
  advance(r, t + 20100); assert.equal(r.phase, "live"); assert.equal(r.endsAt, t + 620100);
  const victim = r.players[1]; victim.alive = false; victim.respawnAt = t + 22100;
  advance(r, t + 22099); assert.equal(victim.alive, false);
  advance(r, t + 22100); assert.equal(victim.alive, true); assert.ok(victim.shieldUntil > t + 22100);
  assert.equal(snapshot(r, t + 22100).settings.mode, "ffa");
});

test("accepted shots derive rifle, airborne, quickscope and distance statistics from the server pose", () => {
  const t = 1000000, r = newRoom("STATSA", false);
  const a = addPlayer(r, { weapon: "prism" }, t); addPlayer(r, {}, t);
  r.phase = "live"; r.endsAt = t + 600000;
  const [shooter, victim] = r.players;
  Object.assign(shooter, { x: 10, y: 1, z: 0, grounded: false, lean: 0, eyeHeight: 1.62, scopeSince: t - 200, scoped: true, shieldUntil: 0, history: [] });
  Object.assign(victim, { x: 10, y: 1, z: -6, lean: 0, eyeHeight: 1.62, shieldUntil: 0, history: [] });
  command(r, a.token, { type: "shoot", seq: 1, at: t, yaw: 0, pitch: 0, kills: 999, longestKill: 9999 }, t);
  assert.equal(shooter.kills, 1); assert.equal(shooter.quickscopes, 1); assert.equal(shooter.airborneKills, 1);
  assert.equal(shooter.headshots, 1); assert.ok(shooter.longestKill > 5 && shooter.longestKill < 7);
  assert.deepEqual(shooter.weaponStats.prism, { shots: 1, hits: 1, kills: 1, headshots: 1 });
  assert.equal(victim.respawnAt, t + 2000);
  command(r, a.token, { type: "shoot", seq: 1, at: t, yaw: 0, pitch: 0 }, t);
  assert.equal(shooter.weaponStats.prism.shots, 1);
});

test("earned badges remain unlocked and late results cannot reset a newer daily record", () => {
  const at = Date.UTC(2026, 10, 6, 12), p = { kills: 500, deaths: 200, headshots: 300 };
  awardRound(p, { completed: true, roundId: "badge:1", finishedAt: at }, true);
  assert.ok(p.badges.includes("deadeye"));
  awardRound(p, { completed: true, roundId: "badge:2", deaths: 1000, finishedAt: at + 86400000, quickscopes: 2, kills: 2 }, true);
  assert.ok(earnedBadges(p).some((b) => b.id === "deadeye"));
  const daily = structuredClone(p.daily);
  awardRound(p, { completed: true, roundId: "late:1", finishedAt: at, kills: 10, quickscopes: 10 }, true);
  assert.deepEqual(p.daily, daily);
});
