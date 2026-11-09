import test from "node:test";
import assert from "node:assert/strict";
import { gameAudioOutput, setPlatformMuted } from "../dist/platform-audio.js";
import { platformLifecycle } from "../dist/platform-lifecycle.js";
import { createShotAudio } from "../dist/shot-audio.js";

test("SDK loading and gameplay events report transitions once and tolerate optional SDK failures", async () => {
  const calls = [];
  const sdk = { game: Object.fromEntries(["loadingStart", "loadingStop", "gameplayStart", "gameplayStop"]
    .map((name) => [name, () => calls.push(name)])) };
  const lifecycle = platformLifecycle(sdk);
  lifecycle.loading(true);
  lifecycle.loading(true);
  lifecycle.loading(false);
  lifecycle.gameplay(true);
  lifecycle.gameplay(true);
  lifecycle.gameplay(false);
  lifecycle.gameplay(false);
  lifecycle.gameplay(true);
  lifecycle.gameplay(false);
  assert.deepEqual(calls, ["loadingStart", "loadingStop", "gameplayStart", "gameplayStop", "gameplayStart", "gameplayStop"]);
  assert.doesNotThrow(() => platformLifecycle(null).gameplay(true));
  assert.doesNotThrow(() => platformLifecycle({ game: { gameplayStart: () => { throw Error("SDK offline"); } } }).gameplay(true));
  platformLifecycle({ game: { gameplayStart: () => Promise.reject(Error("SDK offline")) } }).gameplay(true);
  await Promise.resolve();
});

test("platform mute silences existing audio outputs and new ones without rewriting user volume", () => {
  const events = [];
  const context = { destination: {}, currentTime: 5, createGain() {
    return { context: this, gain: { value: 1, setValueAtTime: (value, at) => events.push([value, at]) }, connect() {}, disconnect() {} };
  } };
  setPlatformMuted(true);
  const first = gameAudioOutput(context);
  assert.equal(first.input.gain.value, 0);
  setPlatformMuted(false);
  assert.deepEqual(events.at(-1), [1, 5]);
  const second = gameAudioOutput(context);
  assert.equal(second.input.gain.value, 1);
  setPlatformMuted(true);
  assert.equal(events.filter(([value]) => value === 0).length, 2);
  first.dispose();
  second.dispose();
  const count = events.length;
  setPlatformMuted(false);
  assert.equal(events.length, count, "disposed contexts are no longer updated");
});

test("predecoded sniper sample starts without another fetch/decode and routes through the mute output", () => {
  const sample = {}, master = {}, outputs = [];
  const context = {
    destination: {},
    createGain() { return { gain: {}, connect: (target) => outputs.push(target), disconnect() {} }; },
    createBufferSource() { return { connect() {}, start() { assert.equal(this.buffer, sample); }, stop() { this.onended(); }, disconnect() {} }; },
    decodeAudioData() { assert.fail("already decoded at boot"); },
  };
  const shot = createShotAudio(context, "/not-fetched.mp3", .5, undefined, sample, master);
  shot.play();
  assert.equal(outputs[0], master);
  shot.dispose();
});
