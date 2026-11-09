import { createShotAudio } from "./shot-audio.js";
import { weaponById } from "./weapons.js";

export const COMBAT_CLIPS = {
  heavy: { file: "user-heavy.mp3", start: .085, end: 1.89, gain: .82 },
  awp: { file: "user-awp.mp3", start: 0, end: 2.35, gain: .70 },
  rifle: { file: "user-rifle.mp3", start: 0, end: 2.3, gain: .88 },
  sniper: { file: "user-sniper.mp3", start: 0, end: .58, gain: .82 },
  reload: { file: "user-reload-shot.mp3", start: .18, end: 1.23, gain: .52, delay: .30 },
  pump: { file: "user-pump-reload.mp3", start: 0, end: .57, gain: .46, delay: .62 },
  pumping: { file: "user-pumping.mp3", start: 0, end: .55, gain: .50, delay: .58 },
  pin: { file: "user-grenade-pin.mp3", start: 0, end: .576, gain: .65 },
  // Browser-decoded recording is silent until ~400ms. Preserve the attack.
  blast: { file: "user-grenade-blast.mp3", start: .398, end: 5.04, gain: .96 },
  stab: { file: "user-knife-stab.mp3", start: .02, end: .55, gain: .72 },
  footsteps: { file: "user-footsteps.mp3", start: .28, end: .56, gain: 1.2 },
  finale: { file: "user-finale.mp3", start: 0, end: 18.54, gain: .8 },
  elimination: { file: "user-elimination.mp3", start: 0, end: 1.17, gain: .62 },
};
const voices = {
  sunbolt: ["awp", "reload"], glacier: ["awp", "pumping"],
  prism: ["heavy", "pump"], cinder: ["rifle", "reload"],
  spectre: ["sniper", "pumping"], volt: ["rifle", "pumping"],
  rose: ["heavy", "pump"], ivory: ["sniper", "reload"],
};
export const weaponVoice = (id) => voices[weaponById(id).id];
const clipUrl = (id) => new URL("./assets/audio/" + COMBAT_CLIPS[id].file, import.meta.url);

function shotSpace(context, output) {
  if (!context.createDelay || !context.createBiquadFilter) return { input: output, dispose() {} };
  const input = context.createGain(), filter = context.createBiquadFilter();
  const nodes = [input, filter];
  input.connect(output); // Keep the recording's attack dry and immediate.
  filter.type = "lowpass"; filter.frequency.value = 2200; filter.Q.value = .35;
  input.connect(filter);
  // Two quiet early reflections, without a feedback loop or a long echo wash.
  for (const [seconds, level, pan] of [[.045, .095, -.22], [.09, .035, .22]]) {
    const delay = context.createDelay(.15), gain = context.createGain();
    delay.delayTime.value = seconds; gain.gain.value = level;
    filter.connect(delay); delay.connect(gain);
    nodes.push(delay, gain);
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner(); panner.pan.value = pan;
      gain.connect(panner); panner.connect(output); nodes.push(panner);
    } else gain.connect(output);
  }
  return { input, dispose() { nodes.forEach((node) => node.disconnect()); } };
}

export function trimCombatSample(decoder, source, clip) {
  const start = Math.min(source.length - 1, Math.floor(clip.start * source.sampleRate));
  const end = Math.min(source.length, Math.floor(clip.end * source.sampleRate));
  const length = Math.max(1, end - start);
  const trimmed = decoder.createBuffer(source.numberOfChannels, length, source.sampleRate);
  const fadeIn = Math.min(Math.floor(source.sampleRate * .002), length / 2);
  const fadeOut = Math.min(Math.floor(source.sampleRate * .025), length / 2);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const output = trimmed.getChannelData(channel);
    output.set(source.getChannelData(channel).subarray(start, start + length));
    for (let i = 0; i < fadeIn; i++) output[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i++) output[length - 1 - i] *= i / fadeOut;
  }
  return trimmed;
}
export async function preloadCombatAudio(signal) {
  const decoder = new OfflineAudioContext(2, 1, 48000);
  return Object.fromEntries(await Promise.all(Object.entries(COMBAT_CLIPS).map(async ([id, clip]) => {
    const response = await fetch(clipUrl(id), { signal });
    if (!response.ok) throw Error("Could not load rifle sound");
    const source = await decoder.decodeAudioData(await response.arrayBuffer());
    return [id, trimCombatSample(decoder, source, clip)];
  })));
}
export function createCombatAudio(context, buffers, volume, signal, output) {
  output ||= context.destination;
  const space = shotSpace(context, output);
  let disposed = false, loading = null;
  const players = new Map();
  const prepare = (decoded) => {
    if (disposed) return;
    for (const id of Object.keys(COMBAT_CLIPS)) {
      players.set(id, createShotAudio(context, clipUrl(id), volume, signal, decoded[id],
        ["heavy", "awp", "rifle", "sniper"].includes(id) ? space.input : output));
    }
  };
  if (buffers) prepare(buffers);
  const load = () => {
    if (disposed || players.size) return Promise.resolve();
    return loading ||= preloadCombatAudio(signal).then(prepare).catch(() => {}).finally(() => loading = null);
  };
  const cancelChamber = () => {
    for (const id of ["reload", "pump", "pumping"]) players.get(id)?.stop();
  };
  const cycle = (weapon) => {
    cancelChamber();
    const id = weaponVoice(weapon)[1], clip = COMBAT_CLIPS[id];
    players.get(id)?.play(clip.gain, 0, clip.delay);
  };
  return {
    load,
    fire(weapon, level = 1, pan = 0, chamber = true) {
      const play = () => {
        if (disposed) return;
        const id = weaponVoice(weapon)[0];
        players.get(id)?.play(level * COMBAT_CLIPS[id].gain, pan);
        if (chamber) cycle(weapon);
      };
      if (players.size) play();
      else void load().then(play);
    },
    chamber: cycle,
    cue(id, level = 1, pan = 0) {
      if (disposed || !players.size || !COMBAT_CLIPS[id]) return;
      players.get(id)?.play(COMBAT_CLIPS[id].gain * level, pan);
    },
    eliminate(level = 1) {
      if (disposed || !players.size) return;
      const cue = players.get("elimination");
      cue?.stop();
      cue?.play(COMBAT_CLIPS.elimination.gain * level);
    },
    cancelChamber,
    cancelPrime() { players.get("pin")?.stop(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const player of players.values()) player.dispose();
      players.clear();
      space.dispose();
    },
  };
}
