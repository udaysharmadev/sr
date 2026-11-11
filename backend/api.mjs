import {rifleSkinById} from '../dist/rifle-skins.js';
import {CATALOG} from '../dist/catalog.js';
import {
  addPlayer,
  advance,
  codeForRoom,
  command,
  newRoom,
  snapshot,
} from "./rooms.mjs";
import {packSnapshot} from '../dist/snapshot-wire.js';
import {rifleMastery,earnedBadges,hasGoldFinish} from '../dist/progression.js';
import {cosmeticLoadout} from '../dist/weapons.js';

const ttl = 10 * 60 * 1000;
const partySearchLimit = 16;
const isPartyQueue = (room) => room.public && room.partyQueueAt != null && room.phase === "waiting";
const failure = (message, status) =>
  Object.assign(new Error(message), { status });
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export class MemoryStore {
  rows = new Map();
  async read(code) {
    return structuredClone(this.rows.get(code));
  }
  async write(code, prev, room, now) {
    if (this.rows.get(code)?.version !== prev?.version) return false;
    this.rows.set(code, {
      room: structuredClone(room),
      version: (prev?.version ?? 0) + 1,
      touched: now,
    });
    return true;
  }
  async sweep(now) {
    for (const [code, row] of this.rows) {
      if (row.touched < now - ttl) this.rows.delete(code);
    }
  }
  async partyQueues(now) {
    return [...this.rows.entries()]
      .filter(([, row]) => row.touched >= now - ttl && isPartyQueue(row.room) && row.room.players.length < 15
        && row.room.players.some(player => now - player.seen <= 45000))
      .sort(([, a], [, b]) => a.room.partyQueueAt - b.room.partyQueueAt)
      .slice(0, partySearchLimit).map(([code]) => code);
  }
}
export class D1Store {
  constructor(db) {
    this.db = db;
  }
  async read(code) {
    const row = await this.db.prepare(
      "SELECT state, version, touched FROM rush_rooms WHERE code=?",
    ).bind(code).first();
    return row
      ? {
        room: JSON.parse(row.state),
        version: row.version,
        touched: row.touched,
      }
      : undefined;
  }
  async write(code, prev, room, now) {
    const state = JSON.stringify(room);
    const query = prev
      ? this.db.prepare(
        "UPDATE rush_rooms SET state=?,version=version+1,touched=? WHERE code=? AND version=?",
      ).bind(state, now, code, prev.version)
      : this.db.prepare(
        "INSERT OR IGNORE INTO rush_rooms(code,version,state,touched) VALUES (?,1,?,?)",
      ).bind(code, state, now);
    return (await query.run()).meta.changes === 1;
  }
  async sweep(now) {
    await this.settleFinished(now);
    // Leave any unprocessed overdue public round for the next bounded batch.
    await this.db.prepare("DELETE FROM rush_rooms WHERE touched<? AND NOT (json_extract(state,'$.public')=1 AND json_extract(state,'$.phase')='live' AND json_extract(state,'$.endsAt')<=?)").bind(now-ttl,now).run();
  }
  async partyQueues(now) {
    const { results } = await this.db.prepare(`
      SELECT code FROM rush_rooms
      WHERE touched>=? AND json_extract(state,'$.partyQueueAt') IS NOT NULL
        AND json_extract(state,'$.public')=1 AND json_extract(state,'$.phase')='waiting'
        AND json_array_length(state,'$.players')<15
        AND EXISTS (SELECT 1 FROM json_each(state,'$.players') WHERE json_extract(value,'$.seen')>=?)
      ORDER BY json_extract(state,'$.partyQueueAt'),code LIMIT ?
    `).bind(now - ttl, now - 45000, partySearchLimit).all();
    return results.map(row => row.code);
  }
  async settleRoom(code,now){
    for(let attempt=0;attempt<3;attempt++){
      const previous=await this.read(code),room=previous?.room;
      if(!room?.public||room.phase!=='live'||room.endsAt>now)return;
      room.completedRewards=[];advance(room,now);
      if(await this.write(code,previous,room,previous.touched))return;
    }
    throw failure('Match settlement busy. Please try again.',503);
  }
  async settleFinished(now,profileId=null){
    const rows=await this.db.prepare("SELECT code FROM rush_rooms WHERE json_extract(state,'$.public')=1 AND json_extract(state,'$.phase')='live' AND json_extract(state,'$.endsAt')<=? AND (? IS NULL OR EXISTS (SELECT 1 FROM json_each(state,'$.players') WHERE json_extract(value,'$.guestProfileId')=?)) ORDER BY touched LIMIT 50").bind(now,profileId,profileId).all();
    for(const row of rows.results)await this.settleRoom(row.code,now);
  }
}
export function roomApi(store, clock = Date.now, identity = null) {
  return async (request) => {
    try {
      if (request.method !== "POST") {
        return json({ error: "Use POST for room actions." }, 405);
      }
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) {
        return json({ error: "Invalid request origin." }, 403);
      }
      if (
        !request.headers.get("content-type")?.startsWith("application/json")
      ) return json({ error: "JSON required." }, 415);
      if (Number(request.headers.get("content-length")) > 24576) {
        return json({ error: "Request too large." }, 413);
      }
      const raw = await request.text();
      if (raw.length > 24576) return json({ error: "Request too large." }, 413);
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid request." }, 400);
      }
      if (!data || typeof data !== "object") {
        return json({ error: "Invalid request." }, 400);
      }
      const opening = ["public", "create", "join"].includes(data.type);
      const guest=identity?await identity(request):null;
      if(identity&&!guest)return json({error:'Reconnect your guest save before joining a match.'},401);
      const publicQueue = data.type === "public";
      const partyCodes = publicQueue ? await store.partyQueues(clock()) : [];
      let partyIndex = 0;
      let slot = 0,
        code = publicQueue
          ? partyCodes[0] ?? "P00000"
          : data.type === "create"
          ? codeForRoom()
          : String(data.code || "").toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        return json({ error: "Enter a six-character room code." }, 400);
      }
      const token = request.headers.get("authorization")?.replace(
        /^Bearer /,
        "",
      );
      if (!opening && !token) {
        return json({ error: "Room session required." }, 403);
      }
      if (opening && Math.random() < .025) await store.sweep(clock());
      let collision = 0;
      while (collision < 32 && slot < 200) {
        const prev = await store.read(code), now = clock();
        const expired = !prev || prev.touched < now - ttl;
        const lookingAtParty = publicQueue && partyIndex < partyCodes.length;
        if (lookingAtParty && (expired || !isPartyQueue(prev.room))) {
          code = partyCodes[++partyIndex] ?? "P00000";
          continue;
        }
        if(expired&&prev?.room.public&&prev.room.phase==='live'&&prev.room.endsAt<=now&&store.settleRoom){
          await store.settleRoom(code,now);collision++;continue;
        }
        if (!expired && data.type === "create") {
          code = codeForRoom();
          collision++;
          continue;
        }
        let room = expired ? newRoom(code, publicQueue) : prev.room;
        // The previous successful room write archived these atomically.
        room.completedRewards=[];
        advance(room, now);
        const vacant = room.players.length === 0;
        if (lookingAtParty && (vacant || room.phase !== "waiting" || room.players.length >= room.settings.capacity ||
            room.banned.includes(data.device))) {
          code = partyCodes[++partyIndex] ?? "P00000";
          continue;
        }
        if ((expired || vacant) && !["create", "public"].includes(data.type)) {
          return json({
            error: "Room expired. Create a new room or request a fresh invite.",
          }, 404);
        }
        if (publicQueue && vacant && room.public) room = newRoom(code, true);
        if (
          publicQueue &&
          (!room.public || room.players.length >= room.settings.capacity ||
            room.phase !== "waiting")
        ) {
          code = "P" + String(++slot).padStart(5, "0");
          continue;
        }
        if (data.type === "join" && room.public) {
          return json({ error: "Enter a private room code." }, 400);
        }
        let credentials;
        if(opening && guest && room.players.some(member=>member.guestProfileId===guest.profile.id)) {
          return json({error:'You are already in this room. Reconnect to your existing session.'},409);
        }
        if(!opening&&identity){
          const member=room.players.find(p=>p.token===token);
          if(!member||member.guestProfileId!==guest.profile.id||member.guestSessionHash!==guest.key)return json({error:'Room session retired. Join the match again.'},403);
          if(data.type==='loadout'&&!guest.profile.owned?.includes(data.weapon))return json({error:'Unlock this rifle in the shop first.'},409);
        }
        if (opening) credentials = addPlayer(room, {...data,...(guest?{
          name:guest.profile.name,weapon:guest.profile.owned?.includes(guest.profile.equipped.skins)?guest.profile.equipped.skins:'sunbolt',
          gear:guest.profile.equipped,badge:guest.profile.badge,
        }:{}),guestProfileId:guest?.profile.id,guestSessionHash:guest?.key}, now);
        else command(room, token, guest&&data.type==='rename'?{...data,name:guest.profile.name}:data, now);
        if(guest){
          const member=room.players.find(p=>p.id===(credentials?.id)||p.token===token);
          if(member){
            member.name=guest.profile.name;
            member.badge=earnedBadges(guest.profile).some(b=>b.id===guest.profile.badge)?guest.profile.badge:null;
            const finish=guest.profile.equipped.finishes?.[member.weapon];
            member.finish=finish==='gold'&&hasGoldFinish(guest.profile,member.weapon)?'gold':CATALOG.wraps.some(item=>item[0]==='wrap-'+finish)&&(!rifleSkinById(finish)||rifleSkinById(finish).weapon===member.weapon)&&guest.profile.owned.includes('wrap-'+finish)?finish:'field';
            if(member.alive&&member.appearanceLife!==member.life){
              member.gear=cosmeticLoadout(guest.profile.equipped);member.appearanceLife=member.life;
            }
          }
        }
        if (await store.write(code, prev, room, now)) {
          if (data.type === "leave") return json({ left: true });
          const state=snapshot(room, now, data.eventAfter);
          const ownId=credentials?.id || room.players.find(p=>p.token===token)?.id;
          return json({ ...credentials, state: data.wire===1?packSnapshot(state,ownId):state });
        }
        collision++;
      }
      throw failure("Arena is busy. Please try again.", 503);
    } catch (e) {
      if (!e.status) console.error("Room API failure", e.message);
      return json({
        error: e.status ? e.message : "Arena service temporarily unavailable.",
      }, e.status || 503);
    }
  };
}
