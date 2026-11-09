import { gameAudioOutput } from './platform-audio.js';
// The same source spans the last five seconds and the result reveal.
export function createRoundMusic(makeContext = () => new AudioContext()) {
  let context, output, bus, source, buffer, volume = .65, startAt = 0, revealAt = null, revealBase = 0, stopped = true;
  function level(at) {
    if (stopped) return 0;
    if (revealAt !== null) return revealBase + (.75 - revealBase) * Math.min(1, Math.max(0, at - revealAt) / .8);
    return .28 * Math.min(1, Math.max(0, at - startAt) / 5);
  }
  function tail() {
    const end = startAt + buffer.duration;
    if (end > context.currentTime + 1.5) { bus.gain.setValueAtTime(volume * .75, end - 1.3); bus.gain.linearRampToValueAtTime(0, end - .02); }
  }
  function begin(reveal = false) {
    if (!context || !buffer || volume <= 0 || !stopped) return;
    source = context.createBufferSource(); bus = context.createGain(); source.buffer = buffer;
    source.connect(bus); bus.connect(output.input); stopped = false; startAt = context.currentTime; revealAt = reveal ? startAt : null; revealBase = 0;
    bus.gain.setValueAtTime(0, startAt); bus.gain.linearRampToValueAtTime(volume * (reveal ? .75 : .28), startAt + (reveal ? .8 : 5)); tail();
    const owned = source, gain = bus;
    source.onended = () => { owned.disconnect(); gain.disconnect(); if (source === owned) { source = null; stopped = true; } };
    source.start();
  }
  return {
    configure(decoded, gain) {
      buffer = decoded || buffer;
      const next = Math.max(0, Math.min(1, Number(gain) || 0));
      if (next === volume) return;
      volume = next;
      if (!stopped) {
        const now = context.currentTime, finish = revealAt === null ? startAt + 5 : revealAt + .8;
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(volume * level(now), now);
        bus.gain.linearRampToValueAtTime(volume * (revealAt === null ? .28 : .75), Math.max(now, finish));
        tail();
      }
    },
    unlock() { if (!context) { context = makeContext(); output = gameAudioOutput(context); } if (context.state === 'suspended') void context.resume().catch(() => {}); },
    countdown(remaining, eligible = true) { if (eligible && remaining > 0 && remaining <= 5000) begin(); },
    setPaused(value) {
      if(context && context.state!=='closed')void(value?context.suspend?.():context.resume())?.catch(()=>{});
    },
    reveal() {
      if(context?.state==='suspended')void context.resume().catch(()=>{});
      if (stopped) { begin(true); return; }
      const now = context.currentTime, current = level(now); revealAt = now; revealBase = current;
      bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(volume * current, now); bus.gain.linearRampToValueAtTime(volume * .75, now + .8); tail();
    },
    stop() {
      if (stopped) return; const now = context.currentTime; bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(context.state==='suspended'?0:volume * level(now), now);
      if(context.state==='suspended'){
        source.stop(now);source.disconnect();bus.disconnect();source=null;
      }
      else {bus.gain.linearRampToValueAtTime(0, now + .25);source.stop(now + .26);}
      stopped = true; revealAt = null;
    },
    dispose() { this.stop(); output?.dispose(); if (context) void context.close().catch(() => {}); context = null; },
  };
}
export const roundMusic = createRoundMusic();
