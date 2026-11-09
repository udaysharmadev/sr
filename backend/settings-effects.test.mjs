import test from 'node:test';
import assert from 'node:assert/strict';
import { mouseAim, shotRecoil, matchDeadline, selectableRifles, updateAimRotation } from '../dist/presentation.js';
import { WEAPONS, CHAMBER_MS } from '../dist/weapons.js';
import * as T from '../dist/vendor/three.module.js';

test('mouse sensitivity, scoped sensitivity and invert apply to real aim with bounded invalid inputs', () => {
  const baseline = mouseAim(0, 0, 100, 100, {sensitivity:1, adsSensitivity:.5});
  assert.equal(baseline.yaw, -.21); assert.equal(baseline.pitch, -.21);
  const faster = mouseAim(0, 0, 100, 100, {sensitivity:2, adsSensitivity:.5});
  assert.equal(faster.yaw, baseline.yaw * 2);
  const scoped = mouseAim(0, 0, 100, 100, {sensitivity:2, adsSensitivity:.5, invertY:true}, true);
  assert.equal(scoped.yaw, baseline.yaw); assert.equal(scoped.pitch, -baseline.pitch);
  assert.deepEqual(mouseAim(0,0,Infinity,NaN,{sensitivity:NaN}),{yaw:0,pitch:0});
  assert.equal(mouseAim(0,0,0,100000,{sensitivity:100}).pitch,-1.4835);
});
test('rifle upgrades lower visual kick and settle faster without changing flash, aim or chamber', () => {
  let lastStrength = Infinity, lastResidual = Infinity;
  for (const rifle of WEAPONS) {
    const initial = shotRecoil(0, rifle.id), residual = shotRecoil(100, rifle.id);
    assert.ok(initial.kick < lastStrength); assert.ok(residual.kick < lastResidual);
    assert.equal(initial.flash,1); assert.equal(shotRecoil(85,rifle.id).flash,0);
    const camera = new T.PerspectiveCamera(); updateAimRotation(camera,.4,.2,residual.kick,0);
    assert.equal(camera.rotation.x,.2); assert.equal(camera.rotation.y,.4);
    assert.ok(shotRecoil(CHAMBER_MS,rifle.id).kick<1e-9);
    lastStrength=initial.kick;lastResidual=residual.kick;
  }
  assert.equal(CHAMBER_MS,1500);
});
test('points duels use no false zero timer while warmup and time matches retain deadlines', () => {
  const state={phase:'live',endsAt:0,settings:{mode:'duel',duelRule:'points',targetPoints:20}};
  assert.equal(matchDeadline(state,5000),Infinity);
  assert.equal(matchDeadline({...state,phase:'warmup',endsAt:15000},5000),10000);
  assert.equal(matchDeadline({...state,endsAt:15000,settings:{mode:'duel',duelRule:'time'}},5000),10000);
});
test('match armory mouse and keyboard share only owned rifle choices', () => {
  assert.deepEqual(selectableRifles(WEAPONS,['sunbolt','ivory']).map(w=>w.id),['sunbolt','ivory']);
  assert.deepEqual(selectableRifles(WEAPONS,[]),[]);
  assert.equal(selectableRifles(WEAPONS,undefined),WEAPONS);
});
