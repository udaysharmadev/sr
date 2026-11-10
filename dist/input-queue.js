// Coalesce consecutive identical held inputs without repeating jump or slide edges.
export function queueMovementFrame(frames, input) {
  const last = frames.at(-1);
  const held = ['forward','strafe','sprint','scoped','crouch','lean','yaw','pitch'];
  if (last && !last.jump && !last.slide && !input.jump && !input.slide &&
      held.every(key => last[key] === input[key]) && last.dt + input.dt <= .05 + 1e-9) {
    last.dt += input.dt;
    return;
  }
  // Keep recent controls if a severely delayed connection exhausts the wire limit.
  if (frames.length >= 32) frames.shift();
  frames.push({...input});
}

// The server permits at most 320 ms of accumulated movement per request.
// Keep the newest controls within that window, so a delayed packet cannot
// consume its entire allowance on old movement and ignore a release.
export function takeRecentMovementFrames(frames, limit = .32) {
  const batch = frames.splice(0), selected = [];
  let remaining = limit;
  for (let i = batch.length - 1; i >= 0 && remaining > 1e-9; i--) {
    const frame = batch[i], dt = Math.min(frame.dt, remaining);
    selected.unshift(dt < frame.dt - 1e-9 ? {...frame, dt, jump:false, slide:false} : frame);
    remaining -= dt;
  }
  return selected;
}
