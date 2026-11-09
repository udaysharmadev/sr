let muted = false;
const outputs = new Set();

export function setPlatformMuted(value) {
  muted = Boolean(value);
  for (const output of outputs) output.gain.setValueAtTime(muted ? 0 : 1, output.context.currentTime);
}
export function gameAudioOutput(context) {
  const input = context.createGain();
  input.gain.value = muted ? 0 : 1;
  input.connect(context.destination);
  outputs.add(input);
  return { input, dispose() { outputs.delete(input); input.disconnect(); } };
}
