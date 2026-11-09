import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStore, roomApi } from "./api.mjs";
import { createPrivate, joinPublic, resumeSession, isRetryable, isSessionExpired, recoveryDelay, estimatedServerTime } from "../dist/net.js";

async function withNetwork(run) {
  const original = { fetch: globalThis.fetch, sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage, performance:globalThis.performance };
  const storage = new Map(), device = new Map();
  const facade = (map) => ({ getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) });
  globalThis.sessionStorage = facade(storage);
  globalThis.localStorage = facade(device);
  const store = new MemoryStore();
  let now = 1000000, elapsed = 0, latency = 0, failure = null;
  globalThis.performance = {now:()=>elapsed};
  const api = roomApi(store, () => now), calls = [], requests = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.type);
    requests.push(body);
    const fail = failure;
    failure = null;
    if (fail === "before") throw new TypeError("Network offline");
    elapsed+=latency/2;now+=latency/2;
    const response = await api(new Request("http://arena.test" + url, init));
    elapsed+=latency/2;now+=latency/2;
    if (fail === "after") throw new TypeError("Response lost");
    return response;
  };
  try {
    await run({ store, storage, calls, requests, fail: (mode) => failure = mode, step: (ms) => now += ms,
      tick:ms=>elapsed+=ms, latency:ms=>latency=ms });
  } finally {
    Object.assign(globalThis, original);
  }
}

test("transient refresh failure preserves credentials and reload restores the same player", () => withNetwork(async ({ storage, fail, calls }) => {
  const first = await createPrivate("Reconnect", "prism");
  fail("before");
  await assert.rejects(first.refresh(), (error) => isRetryable(error));
  assert.equal(first.failures, 1);
  assert.ok(storage.has("sr.room.v1"));
  const restored = await resumeSession(first.code);
  assert.equal(restored.id, first.id);
  assert.equal(restored.state.players.length, 1);
  assert.equal(restored.state.players[0].weapon, "prism");
  assert.equal(calls.filter((type) => type === "create").length, 1);
  assert.equal(calls.filter((type) => type === "join").length, 0);
  await restored.leave();
  assert.equal(storage.has("sr.room.v1"), false);
}));

test("an accepted mutation with a lost response is not replayed; refresh reveals its committed state", () => withNetwork(async ({ fail, calls }) => {
  const session = await createPrivate("No duplicate");
  fail("after");
  await assert.rejects(session.action("ready", { ready: true }), /Response lost/);
  const state = await session.refresh();
  assert.equal(state.players[0].ready, true);
  assert.equal(calls.filter((type) => type === "ready").length, 1);
  assert.equal(session.failures, 0);
  await session.leave();
}));

test("expired saved sessions are cleared instead of automatically creating another player", () => withNetwork(async ({ step, storage, calls }) => {
  await createPrivate("Expired");
  step(46000);
  assert.equal(await resumeSession(), null);
  assert.equal(storage.has("sr.room.v1"), false);
  assert.equal(calls.filter((type) => type === "create").length, 1);
}));

test("explicit fresh matchmaking leaves the saved room and a different invite is not silently restored", () => withNetwork(async ({ store, calls }) => {
  const old = await createPrivate("Old room");
  const count = calls.length;
  assert.equal(await resumeSession("OTHER1"), null);
  assert.equal(calls.length, count);
  const fresh = await joinPublic("New match");
  assert.equal((await store.read(old.code)).room.players.length, 0);
  assert.equal(fresh.state.players.length, 1);
  await fresh.leave();
}));

test("bad saved data is discarded and service errors have explicit retry semantics", () => withNetwork(async ({ storage }) => {
  storage.set("sr.room.v1", JSON.stringify({ code: "not a room", token: "x", id: "x" }));
  assert.equal(await resumeSession(), null);
  assert.equal(storage.has("sr.room.v1"), false);
  const session = await createPrivate("Errors");
  globalThis.fetch = async () => Response.json({ error: "Session removed" }, { status: 403 });
  await assert.rejects(session.refresh(), (error) => isSessionExpired(error) && !isRetryable(error));
  assert.equal(storage.has("sr.room.v1"), false);
  assert.equal(isRetryable({ status: 409 }), false);
  assert.equal(isRetryable({ status: 429 }), true);
  assert.equal(isRetryable({ status: 503 }), true);
  assert.deepEqual([1, 2, 3, 4, 5, 20].map(recoveryDelay), [250, 500, 1000, 2000, 3000, 3000]);
}));

function holdRefresh(){
  const send=globalThis.fetch;let release,entered;
  const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  globalThis.fetch=async(url,init)=>{if(JSON.parse(init.body).type==='refresh'){entered();await gate;}return send(url,init);};
  return {release,started};
}
test('stale queued combat and input expire locally without reaching authority or replaying after reconnect',()=>withNetwork(async({calls,tick})=>{
  const session=await createPrivate('Slow queue'),hold=holdRefresh(),first=session.refresh();await hold.started;
  const queued=['input','shoot','melee','prime','throw','equip'].map(type=>session.action(type,{seq:1,equipment:'knife'}));
  const outcome=Promise.allSettled(queued);tick(351);hold.release();await first;
  for(const result of await outcome){assert.equal(result.status,'rejected');assert.equal(result.reason.status,408);}
  assert.equal(calls.filter(type=>['input','shoot','melee','prime','throw','equip'].includes(type)).length,0);
  await session.refresh();assert.equal(session.failures,0);await session.leave();
}));
test('real-time queue has a hard bound while cancellation and refresh can still recover it',()=>withNetwork(async({calls})=>{
  const session=await createPrivate('Bounded queue'),hold=holdRefresh(),first=session.refresh();await hold.started;
  const queued=Array.from({length:7},(_,i)=>session.action('input',{seq:i+1,frames:[]}));
  const settled=Promise.allSettled(queued);
  await assert.rejects(session.action('shoot',{seq:1}),error=>error.status===408);
  const cancel=session.action('cancelprime');hold.release();await first;
  assert.ok((await settled).every(result=>result.status==='rejected'&&result.reason.status===408));await cancel;
  assert.equal(calls.includes('shoot'),false);assert.equal(calls.at(-1),'cancelprime');await session.refresh();await session.leave();
}));
test('leaving a session cancels pending attacks even when an earlier response arrives afterward',()=>withNetwork(async({calls,storage})=>{
  const session=await createPrivate('Leave race'),hold=holdRefresh(),first=session.refresh();await hold.started;
  const shot=session.action('shoot',{seq:1,yaw:0,pitch:0}),settled=Promise.allSettled([first,shot]);
  await session.leave();hold.release();assert.ok((await settled).every(v=>v.status==='rejected'));
  assert.equal(calls.includes('shoot'),false);assert.equal(storage.has('sr.room.v1'),false);
}));
test('a transient failure invalidates younger queued combat while refresh and cancellation still recover',()=>withNetwork(async({calls,fail})=>{
  const session=await createPrivate('Failure queue'),hold=holdRefresh(),first=session.refresh();await hold.started;
  const shot=session.action('shoot',{seq:1,yaw:0,pitch:0}),prime=session.action('prime');
  const outcome=Promise.allSettled([first,shot,prime]);fail('before');hold.release();
  const results=await outcome;assert.equal(results[0].status,'rejected');assert.ok(results.slice(1).every(v=>v.status==='rejected'&&v.reason.status===408));
  assert.equal(calls.includes('shoot'),false);assert.equal(calls.includes('prime'),false);
  await session.action('cancelprime');await session.refresh();assert.equal(session.failures,0);await session.leave();
}));
test('server clock estimates receipt time using RTT and advances independently of the device wall clock',()=>withNetwork(async({latency,tick})=>{
  latency(120);const session=await createPrivate('Clock');const state=session.state;
  assert.equal(state.serverTime,1000060);assert.equal(estimatedServerTime(state),1000120);
  tick(250);assert.equal(estimatedServerTime(state),1000370);assert.equal(estimatedServerTime(state,0),1000120,'clock cannot run backward before receipt');
  assert.equal(estimatedServerTime({serverTime:4000}),4000,'older embedded fixtures remain supported');await session.leave();
}));
test('lost shot acknowledgement retains the event cursor; recovery gets the committed event once',()=>withNetwork(async({store,fail,requests})=>{
  const session=await createPrivate('Lost shot'),row=await store.read(session.code);
  row.room.phase='live';row.room.endsAt=1600000;row.room.players[0].shieldUntil=0;
  assert.equal(await store.write(session.code,row,row.room,1000000),true);
  fail('after');await assert.rejects(session.action('shoot',{seq:1,life:session.state.players[0].life,yaw:0,pitch:1.4}),/Response lost/);
  const recovered=await session.refresh();assert.equal(recovered.events.filter(e=>e.type==='shot').length,1);assert.equal(recovered.eventId,1);
  const next=await session.refresh();assert.deepEqual(next.events,[]);assert.equal(requests.at(-1).eventAfter,1);
  assert.equal(requests.filter(r=>r.type==='shoot').length,1);await session.leave();
}));

test('fresh matchmaking retains the old room credential until an uncertain leave is reconciled', () => withNetwork(async ({store,storage,fail,calls}) => {
  const old = await createPrivate('Uncertain leave');
  fail('before');
  await assert.rejects(joinPublic('New match'), /Network offline/);
  assert.equal(JSON.parse(storage.get('sr.room.v1')).token, old.token);
  assert.equal((await store.read(old.code)).room.players.length, 1);
  assert.equal(calls.filter(type => type === 'public').length, 0);
  const fresh = await joinPublic('New match');
  assert.equal((await store.read(old.code)).room.players.length, 0);
  assert.equal(fresh.state.players.length, 1);
  await fresh.leave();
}));

test('fresh matchmaking can continue after a leave response is lost once the old room has expired', () => withNetwork(async ({store,storage,fail,calls}) => {
  const old = await createPrivate('Lost leave acknowledgement');
  fail('after');
  await assert.rejects(joinPublic('New match'), /Response lost/);
  assert.equal(JSON.parse(storage.get('sr.room.v1')).token, old.token);
  assert.equal((await store.read(old.code)).room.players.length, 0);
  const fresh = await joinPublic('New match');
  assert.equal(calls.filter(type => type === 'public').length, 1);
  await fresh.leave();
}));

test('failed cancellation keeps a recoverable credential and the next queue reconciles it', () => withNetwork(async ({store,storage,fail}) => {
  const old = await joinPublic('Cancel while offline');
  fail('before'); await old.leave();
  assert.equal(JSON.parse(storage.get('sr.room.v1')).token, old.token);
  assert.equal((await store.read(old.code)).room.players.length, 1);
  const fresh = await joinPublic('Return');
  const members = (await store.read(fresh.code)).room.players;
  assert.equal(members.length, 1); assert.equal(members[0].id, fresh.id);
  await fresh.leave();
}));

test('reload after an interrupted cancellation finishes leaving instead of rejoining the queue', () => withNetwork(async ({store,storage,fail,calls}) => {
  const old = await joinPublic('Cancelled before reload');
  fail('before'); await old.leave();
  assert.equal(JSON.parse(storage.get('sr.room.v1')).leaving, true);
  assert.equal(await resumeSession(), null);
  assert.equal((await store.read(old.code)).room.players.length, 0);
  assert.equal(storage.has('sr.room.v1'), false);
  assert.equal(calls.filter(type => type === 'refresh').length, 0);
}));

test('reload retains a cancelled room if leave reconciliation is still offline', () => withNetwork(async ({storage,fail}) => {
  const old = await createPrivate('Still offline');
  fail('before'); await old.leave();
  fail('before'); await assert.rejects(resumeSession(), /Network offline/);
  assert.equal(JSON.parse(storage.get('sr.room.v1')).leaving, true);
  assert.equal(await resumeSession(), null);
  assert.equal(storage.has('sr.room.v1'), false);
}));
