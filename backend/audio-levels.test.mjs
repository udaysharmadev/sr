import test from 'node:test';
import assert from 'node:assert/strict';
import {audioLevel} from '../dist/audio-levels.js';

test('master volume multiplies independent music and effects channels with legacy defaults',()=>{
  const settings={volume:.5,musicVolume:.2,effectsVolume:.8};
  assert.equal(audioLevel(settings,'music'),.1);assert.equal(audioLevel(settings,'effects'),.4);
  assert.equal(audioLevel({volume:.65},'music'),.65);
  assert.equal(audioLevel({...settings,volume:0},'effects'),0);
  assert.equal(audioLevel({...settings,musicVolume:0},'music'),0);
  assert.equal(audioLevel({...settings,musicVolume:0},'effects'),.4);
  assert.equal(audioLevel({...settings,effectsVolume:0},'music'),.1);
  assert.equal(audioLevel({volume:2,effectsVolume:-1},'effects'),0);
});
