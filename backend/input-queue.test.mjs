import test from 'node:test';
import assert from 'node:assert/strict';
import {queueMovementFrame,takeRecentMovementFrames} from '../dist/input-queue.js';

test('held movement at high frame rates retains duration without repeating jump edges',()=>{
  const frames=[], base={forward:1,strafe:0,sprint:false,scoped:false,crouch:false,lean:0,yaw:0,pitch:0,jump:false,slide:false,dt:1/144};
  queueMovementFrame(frames,{...base,jump:true});
  for(let i=0;i<42;i++)queueMovementFrame(frames,base);
  assert.ok(frames.length<18);
  assert.ok(Math.abs(frames.reduce((n,f)=>n+f.dt,0)-43/144)<1e-9);
  assert.equal(frames.filter(f=>f.jump).length,1);
  assert.ok(frames.every(f=>f.dt<=.05000001));
});
test('delayed batch prioritizes the most recent release within the server time allowance',()=>{
  const frames=Array.from({length:10},()=>({forward:1,dt:.05}));
  frames.push({forward:0,dt:.05});
  const batch=takeRecentMovementFrames(frames);
  assert.equal(frames.length,0);assert.equal(batch.at(-1).forward,0);
  assert.ok(Math.abs(batch.reduce((n,f)=>n+f.dt,0)-.32)<1e-9);
});
test('bounded queue keeps the latest release and direction during long delays',()=>{
  const frames=[];
  for(let i=0;i<40;i++)queueMovementFrame(frames,{forward:i%2,dt:.05});
  queueMovementFrame(frames,{forward:0,dt:.01});
  assert.equal(frames.length,32);assert.equal(frames.at(-1).forward,0);
});
