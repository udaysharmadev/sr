import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_CLIPS, createCombatAudio, trimCombatSample, weaponVoice } from "../dist/combat-audio.js";
import { CHAMBER_MS, WEAPONS } from "../dist/weapons.js";

test("every rifle uses a supplied shot and chamber voice that finishes inside 1.5 seconds", () => {
  const used = new Set();
  for (const weapon of WEAPONS) {
    const [shot, reload] = weaponVoice(weapon.id);
    assert.ok(COMBAT_CLIPS[shot]);
    assert.ok(COMBAT_CLIPS[reload]);
    const clip = COMBAT_CLIPS[reload];
    assert.ok(clip.delay + clip.end - clip.start < CHAMBER_MS / 1000);
    used.add(shot); used.add(reload);
  }
  assert.equal(used.size, 7, "all seven user-provided clips are used");
  assert.deepEqual(weaponVoice("unknown"), weaponVoice(WEAPONS[0].id));
});

test("reload trim excludes the following gunshot and fades clip boundaries", () => {
  const input = new Float32Array(2000).fill(.4);
  input.fill(10, 1300, 1500); // The later shot in the supplied reload-and-shot recording.
  const source = { length: 2000, sampleRate: 1000, numberOfChannels: 1, getChannelData: () => input };
  const decoder = { createBuffer(channels, length, sampleRate) {
    const wave = new Float32Array(length);
    return { length, sampleRate, numberOfChannels: channels, getChannelData: () => wave };
  } };
  const trimmed = trimCombatSample(decoder, source, COMBAT_CLIPS.reload);
  assert.equal(trimmed.length, 1050);
  assert.equal(trimmed.getChannelData(0)[0], 0);
  assert.equal(trimmed.getChannelData(0).at(-1), 0);
  assert.ok(Math.max(...trimmed.getChannelData(0)) < 1, "extra shot is outside the playback segment");
});

test("shot starts immediately, chamber is scheduled separately, and death cancels only chamber audio", () => {
  const sources = [];
  const context = { currentTime: 10, destination: {},
    createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
    createStereoPanner: () => ({ pan: {}, connect() {}, disconnect() {} }),
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start(at) { this.at = at; },
        stop() { this.stopped = true; this.onended(); } };
      sources.push(source);
      return source;
    },
  };
  const buffers = Object.fromEntries(Object.keys(COMBAT_CLIPS).map((id) => [id, { id }]));
  const sound = createCombatAudio(context, buffers, .65);
  sound.fire("prism");
  assert.equal(sources[0].buffer.id, "heavy");
  assert.equal(sources[0].at, 10);
  assert.equal(sources[1].buffer.id, "pump");
  assert.equal(sources[1].at, 10.62);
  sound.cancelChamber();
  assert.equal(sources[1].stopped, true);
  assert.equal(sources[0].stopped, undefined);
  sound.fire("cinder", .4, -.5, false);
  assert.equal(sources.length, 3, "remote gunshot has no local chamber cycle");
  assert.equal(sources[2].buffer.id, "rifle");
  sound.dispose();
  assert.equal(sources[0].stopped, true);
  assert.equal(sources[2].stopped, true);
  sound.fire("prism");
  assert.equal(sources.length, 3);
});

test("shots gain short quiet reflections while reloads stay dry and the audio graph has no echo feedback", () => {
  const nodes = [], sources = [], master = {};
  const node = (kind, fields = {}) => {
    const value = { kind, outputs: [], ...fields, connect(target) { this.outputs.push(target); }, disconnect() { this.disconnected = true; } };
    nodes.push(value); return value;
  };
  const context = { currentTime: 5, destination: {},
    createGain: () => node("gain", { gain: { value: 1 } }),
    createBiquadFilter: () => node("filter", { frequency: {}, Q: {} }),
    createDelay: () => node("delay", { delayTime: {} }),
    createStereoPanner: () => node("pan", { pan: {} }),
    createBufferSource() {
      const source = node("source", { start(at) { this.at = at; }, stop() { this.onended(); } });
      sources.push(source); return source;
    },
  };
  const buffers = Object.fromEntries(Object.keys(COMBAT_CLIPS).map((id) => [id, { id }]));
  const audio = createCombatAudio(context, buffers, .65, undefined, master);
  audio.fire("prism");
  assert.equal(sources[0].at, 5, "no delay added to the recording's attack");
  const dryBus = sources[0].outputs[0].outputs[0];
  assert.ok(dryBus.outputs.includes(master));
  assert.equal(sources[1].outputs[0].outputs[0], master, "chamber sample bypasses reflections");
  assert.deepEqual(nodes.filter((n) => n.kind === "delay").map((n) => n.delayTime.value), [.045, .09]);
  assert.equal(nodes.find((n) => n.kind === "filter").frequency.value, 2200);
  const visit = (value, path = new Set()) => {
    assert.ok(!path.has(value), "reflection graph must not feed back");
    if (!value.outputs) return;
    for (const next of value.outputs) visit(next, new Set([...path, value]));
  };
  visit(dryBus);
  assert.ok(!nodes.some((n) => n.outputs.includes(context.destination)), "all voices route through the supplied master mute output");
  audio.dispose();
  assert.ok(nodes.every((n) => n.disconnected));
});

test("requested elimination cue is immediate and dry, replaces a pending cue, respects mute and releases sources", () => {
  const sources = [], master = {}, gains = [];
  const context = { currentTime: 3, destination: {},
    createGain() { const node = { gain: {}, connect(target) { this.output = target; }, disconnect() {} }; gains.push(node); return node; },
    createBufferSource() { const source = { connect(target) { this.output = target; }, disconnect() {}, start(at) { this.at = at; },
      stop() { this.stopped = true; this.onended(); } }; sources.push(source); return source; },
  };
  const buffers = Object.fromEntries(Object.keys(COMBAT_CLIPS).map((id) => [id, { id }]));
  const audio = createCombatAudio(context, buffers, .65, undefined, master);
  audio.eliminate();
  assert.equal(sources.length, 1); assert.equal(sources[0].buffer.id, "elimination");
  assert.equal(sources[0].at, 3); assert.equal(sources[0].output.output, master);
  audio.eliminate(.85); assert.equal(sources[0].stopped, true); assert.equal(sources.length, 2);
  audio.dispose(); assert.equal(sources[1].stopped, true);
  audio.eliminate(); assert.equal(sources.length, 2);
  const muted = createCombatAudio(context, buffers, 0, undefined, master);
  muted.eliminate(); assert.equal(sources.length, 2); muted.dispose();
});

test('supplied pin, blast, stab and footsteps use dry master routing and stop at cleanup',()=>{
 const sources=[],master={};const context={currentTime:1,destination:{},createGain(){return {gain:{},connect(target){this.output=target;},disconnect(){}};},createBufferSource(){const source={connect(target){this.output=target;},disconnect(){},start(at){this.at=at;},stop(){this.stopped=true;this.onended();}};sources.push(source);return source;}};
 const buffers=Object.fromEntries(Object.keys(COMBAT_CLIPS).map(id=>[id,{id}]));const audio=createCombatAudio(context,buffers,.65,undefined,master);
 for(const id of ['pin','blast','stab','footsteps'])audio.cue(id);
 assert.deepEqual(sources.map(s=>s.buffer.id),['pin','blast','stab','footsteps']);assert.ok(sources.every(s=>s.output.output===master));audio.cancelPrime();assert.equal(sources[0].stopped,true);assert.equal(sources[1].stopped,undefined,'canceling a pin gesture leaves an already-thrown blast alone');audio.dispose();assert.ok(sources.every(s=>s.stopped));
});

test('footstep trim starts at the recorded step instead of its silent lead-in',()=>{
 const samples=new Float32Array(1000);samples.fill(.1,290,500);
 const source={length:1000,sampleRate:1000,numberOfChannels:1,getChannelData:()=>samples};
 const decoder={createBuffer(channels,length,sampleRate){const data=new Float32Array(length);return {length,sampleRate,numberOfChannels:channels,getChannelData:()=>data};}};
 const step=trimCombatSample(decoder,source,COMBAT_CLIPS.footsteps),wave=step.getChannelData(0);
 assert.ok(wave.slice(0,50).some(value=>value>.09),'first 50ms includes the measured onset');
 assert.ok(Math.sqrt(wave.reduce((sum,v)=>sum+v*v,0)/wave.length)>.07,'trim retains the complete step');
});

test('blast trim removes the measured 400ms silence without cutting its recorded attack',()=>{
 const samples=new Float32Array(5016);samples.fill(.8,400,700);
 const source={length:samples.length,sampleRate:1000,numberOfChannels:1,getChannelData:()=>samples};
 const decoder={createBuffer(channels,length,sampleRate){const data=new Float32Array(length);return {length,sampleRate,numberOfChannels:channels,getChannelData:()=>data};}};
 const wave=trimCombatSample(decoder,source,COMBAT_CLIPS.blast).getChannelData(0);
 assert.ok(wave.slice(0,10).some(v=>v>.7),'blast attack lands within 10ms');assert.ok(COMBAT_CLIPS.blast.gain<=1);
});
