// Decode once per match. AudioContext is unlocked by the player's first gesture.
export function createShotAudio(context, url, volume, signal, decoded = null, output = context.destination) {
  let buffer = decoded, loading = null, disposed = false;
  const active = new Set();
  function load() {
    if (disposed) return Promise.resolve(null);
    if (buffer) return Promise.resolve(buffer);
    if (!loading) {
      loading = fetch(url, { signal }).then((response) => {
        if (!response.ok) throw Error("Gunshot audio unavailable");
        return response.arrayBuffer();
      }).then((bytes) => context.decodeAudioData(bytes)).then((decoded) => {
        if (!disposed) buffer = decoded;
        return buffer;
      }).catch(() => null).finally(() => loading = null);
    }
    return loading;
  }
  function playBuffer(sample, level = 1, pan = 0, delay = 0) {
    if (disposed || !sample || volume <= 0) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = sample;
    gain.gain.value = volume * .85 * Math.max(0, Math.min(1, level));
    source.connect(gain);
    const panner = pan && context.createStereoPanner ? context.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(output);
    } else gain.connect(output);
    active.add(source);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      active.delete(source);
    };
    source.start((context.currentTime || 0) + Math.max(0, delay));
  }
  const stop = () => {
    for (const source of active) source.stop();
    active.clear();
  };
  return {
    load,
    play(level = 1, pan = 0, delay = 0) {
      if (level <= 0) return;
      if (buffer) playBuffer(buffer, level, pan, delay);
      else void load().then((sample) => playBuffer(sample, level, pan, delay));
    },
    stop,
    dispose() {
      disposed = true;
      stop();
      buffer = null;
    },
  };
}

export function remoteShotMix(listener, shooter, yaw) {
  const dx = shooter.x - listener.x, dz = shooter.z - listener.z;
  const distance = Math.hypot(dx, shooter.y - listener.y, dz);
  return {
    level: distance > 80 ? 0 : .7 / (1 + distance * .10),
    pan: distance < .001 ? 0 : Math.max(-1, Math.min(1,
      (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance,
    )),
  };
}
