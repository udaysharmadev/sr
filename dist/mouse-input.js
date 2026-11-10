// Mouse events report every button transition, including LMB pressed while RMB
// is already held. Pointerdown only reports the first button of that chord.
export function listenMouseButtons(
  canvas,
  releaseTarget,
  onDown,
  onUp,
  signal,
  onCancel = () => {},
) {
  const held = new Set(), masks = { 0: 1, 1: 4, 2: 2 };
  canvas.addEventListener("mousedown", (event) => {
    held.add(event.button);
    onDown(event);
  }, { signal });
  releaseTarget.addEventListener("mouseup", (event) => {
    if (held.delete(event.button)) onUp(event);
  }, { signal });
  const cancel = () => {
    if (!held.size) return;
    const buttons = [...held];
    held.clear();
    onCancel(buttons);
  };
  // Some browsers miss mouseup when released outside the window. Cancel the
  // abandoned gesture; synthesizing mouseup could accidentally throw a grenade.
  releaseTarget.addEventListener("mousemove", (event) => {
    if (!Number.isInteger(event.buttons)) return;
    const missing = [...held].filter(button => masks[button] && !(event.buttons & masks[button]));
    if (!missing.length) return;
    for (const button of missing) held.delete(button);
    onCancel(missing);
  }, { signal });
  releaseTarget.addEventListener("blur", cancel, { signal });
}
