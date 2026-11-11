const presets = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false },
  balanced: { pixelRatio: 1.25, shadows: true, shadowSize: 512, antialias: true },
  high: { pixelRatio: 1.65, shadows: true, shadowSize: 1024, antialias: true },
};
export const QUALITY_CHOICES = [['low', 'Low'], ['balanced', 'Balanced'], ['high', 'High']];
export function renderQuality(value = "high", deviceRatio = 1) {
  const name = Object.hasOwn(presets, value) ? value : "high";
  return { ...presets[name], name,
    pixelRatio: Math.min(presets[name].pixelRatio, Math.max(.5, Number(deviceRatio) || 1)) };
}

// A bounded window of actual animation-frame intervals, including visible stalls.
export function frameTimings(capacity = 600) {
  const samples = new Float64Array(capacity);
  let count = 0, cursor = 0;
  return {
    record(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
      samples[cursor] = milliseconds;
      cursor = (cursor + 1) % capacity;
      count = Math.min(count + 1, capacity);
    },
    summary() {
      if (!count) return null;
      const sorted = Array.from(samples.subarray(0, count)).sort((a, b) => a - b);
      return { samples: count, p50Ms: sorted[Math.ceil(count * .5) - 1],
        p95Ms: sorted[Math.ceil(count * .95) - 1] };
    },
  };
}
