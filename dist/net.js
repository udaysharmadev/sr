import {unpackSnapshot} from './snapshot-wire.js';
const endpoint = "/api/rooms";
const savedKey = "sr.room.v1";
const receivedTimes = new WeakMap();
const realtimeActions = new Set(["input", "shoot", "melee", "prime", "throw", "equip"]);
export function estimatedServerTime(state, at = performance.now()) {
  const sample = receivedTimes.get(state);
  return sample ? sample.time + Math.max(0, at - sample.at) : state.serverTime;
}
export const isSessionExpired = (error) => [401, 403, 404].includes(error?.status);
export const isRetryable = (error) => !error?.status || [408, 429].includes(error.status) || error.status >= 500;
export const recoveryDelay = (attempt) => Math.min(3000, 250 * 2 ** Math.min(4, Math.max(0, attempt - 1)));

// Matchmaking must keep its heartbeat while the local practice clock is paused.
export function watchSession(session, onState, onError, timers = globalThis) {
  let timer, stopped = false;
  const stop = () => { stopped = true; timers.clearTimeout(timer); };
  const tick = async () => {
    let delay = 750;
    try {
      const state = await session.refresh();
      if(stopped)return;
      if(onState(state || session.state) === false){stop();return;}
    } catch(error) {
      if(stopped)return;
      const retry=onError(error);
      if(retry===false){stop();return;}
      delay=Number.isFinite(retry)?Math.max(0,retry):recoveryDelay(session.failures || 1);
    }
    if(!stopped)timer=timers.setTimeout(tick,delay);
  };
  timer=timers.setTimeout(tick,0);
  return stop;
}
function saveSession(session) {
  try {
    sessionStorage.setItem(savedKey, JSON.stringify({ code: session.code, token: session.token, id: session.id }));
  } catch {}
}
function clearSaved(session) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(savedKey) || "null");
    if (!session || saved?.token === session.token) sessionStorage.removeItem(savedKey);
  } catch {}
}
function markLeaving(session) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(savedKey) || "null");
    if (saved?.token === session.token) {
      sessionStorage.setItem(savedKey, JSON.stringify({ ...saved, leaving: true }));
    }
  } catch {}
}
async function reconcileLeave(saved) {
  try {
    await request({ type: "leave", code: saved.code }, saved.token, true);
  } catch (error) {
    if (!isSessionExpired(error)) throw error;
  }
  clearSaved(saved);
}
function guestDevice() {
  try {
    const key = "sniper-rush.device";
    let id = localStorage.getItem(key);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}
async function request(body, token, keepalive = false) {
  const started = performance.now();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({...body,wire:1}),
    keepalive,
    signal: AbortSignal.timeout(3500),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Object.assign(new Error("The arena service is unavailable. Try again shortly."), { status: response.status >= 400 ? response.status : 503 });
  }
  if (!response.ok) throw Object.assign(new Error(result.error || "Connection interrupted."), { status: response.status });
  if(result.state)result.state=unpackSnapshot(result.state);
  if (result.state && Number.isFinite(result.state.serverTime)) {
    const at = performance.now();
    receivedTimes.set(result.state, {at, time: result.state.serverTime + (at - started) / 2});
  }
  return result;
}
function attachSession(session) {
  let pending = Promise.resolve(), closed = false, queued = 0, epoch = 0;
  session.failures = 0;
  Object.defineProperty(session, "busy", { get: () => queued > 0 });
  saveSession(session);
  session.action = (type, data = {}) => {
    const enqueued = performance.now(), realtime = realtimeActions.has(type), enqueuedEpoch = epoch;
    if (realtime && queued >= 8) {
      epoch++;
      return Promise.reject(Object.assign(new Error("Connection backlog. Resyncing your player."), {status:408}));
    }
    queued++;
    const send = async () => {
      if (closed) throw new Error("Room session closed.");
      const start = performance.now();
      let result;
      try {
        if(realtime && (epoch!==enqueuedEpoch || start - enqueued > 350)) throw Object.assign(new Error("Action expired while reconnecting."), {status:408});
        // Mutations are never automatically replayed after an uncertain response.
        result = await request({
          ...data,
          type,
          ping: session.ping,
          code: session.code,
          eventAfter: session.state.eventId,
        }, session.token);
      } catch (error) {
        if (isRetryable(error)) {session.failures++;epoch++;}
        if (isSessionExpired(error)) clearSaved(session);
        throw error;
      }
      if (closed) throw new Error("Room session closed.");
      session.failures = 0;
      session.ping = Math.round(performance.now() - start);
      session.state = result.state;
      const me = session.state.players.find((p) => p.id === session.id);
      if (me) me.ping = session.ping;
      return session.state;
    };
    const response = pending.then(send);
    pending = response.then(() => {queued--;}, () => {queued--;});
    return response;
  };
  session.refresh = () => session.action("refresh");
  session.leave = async () => {
    if (closed) return;
    closed = true;
    markLeaving(session);
    try { await reconcileLeave(session); } catch { /* Retry on reload or next join. */ }
  };
  return session;
}
async function open(type, name, code, spectator = false, weapon, badge, gear) {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(savedKey) || "null"); } catch {}
  if (saved) {
    if (/^[A-Z0-9]{6}$/.test(saved.code) && typeof saved.token === "string") {
      markLeaving(saved);
      await reconcileLeave(saved);
    } else clearSaved(saved);
  }
  return attachSession(await request({ type, name, code, spectator, weapon, badge, gear, device: guestDevice() }));
}
export async function resumeSession(expectedCode = null) {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(savedKey) || "null"); } catch { return null; }
  if (!saved) return null;
  if (!/^[A-Z0-9]{6}$/.test(saved.code) || typeof saved.token !== "string" ||
      saved.token.length > 80 || typeof saved.id !== "string" || saved.id.length > 80) {
    clearSaved();
    return null;
  }
  if (saved.leaving) {
    await reconcileLeave(saved);
    return null;
  }
  if (expectedCode && saved.code !== expectedCode.toUpperCase()) return null;
  try {
    const result = await request({ type: "refresh", code: saved.code }, saved.token);
    if (!result.state.players.some((p) => p.id === saved.id)) {
      clearSaved();
      return null;
    }
    return attachSession({ ...saved, state: result.state });
  } catch (error) {
    if (isSessionExpired(error)) { clearSaved(); return null; }
    throw error;
  }
}
export const joinPublic = (name, weapon, badge, gear) => open("public", name, undefined, false, weapon, badge, gear);
export const createPrivate = (name, weapon, badge, gear) => open("create", name, undefined, false, weapon, badge, gear);
export const joinPrivate = (code, name, spectator = false, weapon, badge, gear) =>
  open("join", name, code, spectator, weapon, badge, gear);
