export const CONTROL_BINDINGS = {
  forward: ["Forward", "KeyW"], backward: ["Back", "KeyS"],
  left: ["Strafe left", "KeyA"], right: ["Strafe right", "KeyD"],
  jump: ["Jump", "Space"], sprint: ["Sprint", "ShiftLeft"],
  crouch: ["Crouch / slide", "ControlLeft"],
  leanLeft: ["Peek left", "KeyQ"], leanRight: ["Peek right", "KeyE"],
  reload: ["Reload", "KeyR"], inspect: ["Inspect rifle", "KeyV"],
};
export const DEFAULT_BINDINGS = Object.fromEntries(
  Object.entries(CONTROL_BINDINGS).map(([action, [, code]]) => [action, code]),
);
const fixed = { Digit1: "sniper", Digit2: "knife", Digit3: "grenade", KeyB: "loadout", KeyC: "alternate crouch", Tab: "scoreboard",
  Escape: "pause", MetaLeft: "system shortcuts", MetaRight: "system shortcuts" };
const valid = (code) => typeof code === "string" && /^[A-Za-z][A-Za-z0-9]{0,30}$/.test(code) && code !== "Unidentified";

export function keyLabel(code) {
  const labels = { ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
    ShiftLeft: "L Shift", ShiftRight: "R Shift", AltLeft: "L Alt", AltRight: "R Alt",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc" };
  return labels[code] || String(code).replace(/^(Key|Digit)/, "");
}

export function bindingError(bindings, action, code) {
  if (!Object.hasOwn(DEFAULT_BINDINGS, action) || !valid(code)) return "Choose a keyboard key";
  if (Object.hasOwn(fixed, code)) return keyLabel(code) + " is reserved for " + fixed[code];
  if (Object.entries(bindings).some(([other, assigned]) => other !== action && assigned === code)) return "Key already assigned";
  return "";
}

export function resolveBindings(saved = {}) {
  const result = { ...DEFAULT_BINDINGS };
  for (const action of Object.keys(result)) {
    const code = saved?.[action];
    if (valid(code) && !Object.hasOwn(fixed, code)) result[action] = code;
  }
  // A repaired default can expose a second conflict in an old saved mapping.
  // Each pass only restores overrides, so this always converges to unique keys.
  let changed;
  do {
    changed = false;
    for (const action of Object.keys(result)) {
      if (result[action] !== DEFAULT_BINDINGS[action] &&
        Object.entries(result).some(([other, code]) => other !== action && code === result[action])) {
        result[action] = DEFAULT_BINDINGS[action];
        changed = true;
      }
    }
  } while (changed);
  return result;
}
