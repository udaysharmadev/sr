import test from "node:test";
import assert from "node:assert/strict";
import { bindingError, DEFAULT_BINDINGS, keyLabel, resolveBindings } from "../dist/input-bindings.js";

test("fixed game shortcuts cannot be remapped over movement or combat actions", () => {
  for (const code of ["KeyB", "KeyC", "Tab", "Escape", "MetaLeft", "MetaRight"]) {
    assert.match(bindingError(DEFAULT_BINDINGS, "forward", code), /reserved/);
    assert.equal(resolveBindings({ forward: code }).forward, "KeyW");
  }
  assert.equal(bindingError(DEFAULT_BINDINGS, "forward", "KeyJ"), "");
  assert.match(bindingError(DEFAULT_BINDINGS, "forward", "KeyS"), /already assigned/);
  assert.match(bindingError(DEFAULT_BINDINGS, "forward", "Unidentified"), /keyboard key/);
});

test("saved binding repair preserves custom keys and swaps while resolving cascading conflicts", () => {
  assert.deepEqual(resolveBindings(null), DEFAULT_BINDINGS);
  assert.equal(resolveBindings({ forward: "KeyJ" }).forward, "KeyJ");
  const swap = resolveBindings({ forward: "KeyS", backward: "KeyW" });
  assert.equal(swap.forward, "KeyS"); assert.equal(swap.backward, "KeyW");
  for (const saved of [{ forward: "KeyS", backward: "KeyA", left: "KeyB" },
    { forward: "KeyJ", backward: "KeyJ" }, { forward: 7, jump: "", unknown: "KeyP" }]) {
    const repaired = resolveBindings(saved);
    assert.equal(new Set(Object.values(repaired)).size, Object.keys(DEFAULT_BINDINGS).length);
    assert.deepEqual(resolveBindings(repaired), repaired);
  }
  assert.equal(keyLabel("KeyJ"), "J");
  assert.equal(keyLabel("ControlLeft"), "L Ctrl");
  assert.equal(keyLabel("ArrowUp"), "↑");
});
