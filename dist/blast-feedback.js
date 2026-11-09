// Presentation can anticipate a known fuse, but never applies online damage.
export function createBlastFeedback(play, clock = () => performance.now()) {
  const seen = new Map();
  return (id, position, age = 0) => {
    const t = clock();
    for (const [key, expiry] of seen) if (expiry <= t) seen.delete(key);
    if (!id || !Number.isFinite(age) || age >= 4000 || seen.has(id)) return false;
    seen.set(id, t + 10000);
    if (seen.size > 128) seen.delete(seen.keys().next().value);
    age = Math.max(0, age);
    play(position, age, age <= 250);
    return true;
  };
}
