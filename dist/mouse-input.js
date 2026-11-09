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
    held.delete(event.button);
    onUp(event);
  }, { signal });
  const cancel = () => {
    if (!held.size) return;
    held.clear();
    onCancel();
  };
  // Some browsers miss mouseup when released outside the window. Cancel the
  // abandoned gesture; synthesizing mouseup could accidentally throw a grenade.
  releaseTarget.addEventListener("mousemove", (event) => {
    if (Number.isInteger(event.buttons) && [...held].some(button => masks[button] && !(event.buttons & masks[button]))) cancel();
  }, { signal });
  releaseTarget.addEventListener("blur", cancel, { signal });
}
