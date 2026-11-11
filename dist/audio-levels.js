const level = (value, fallback) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
export function audioLevel(settings, channel) {
  return level(settings.volume, .65) * level(settings[channel === 'music' ? 'musicVolume' : 'effectsVolume'], 1);
}
