import test from 'node:test';
import assert from 'node:assert/strict';
import {finishOffer} from '../dist/armory-offer.js';
test('skin previews are read only and buying/equipping are separate ownership states',()=>{
 const p={owned:['sunbolt'],equipped:{skins:'sunbolt',finishes:{}},coins:9000},before=structuredClone(p);
 const offer=finishOffer(p,'sunbolt','digital');assert.equal(offer.action,'buy');assert.equal(offer.price,2500);assert.deepEqual(p,before);
 assert.equal(finishOffer(p,'glacier','digital').action,'rifle');
 p.owned.push('wrap-digital');assert.equal(finishOffer(p,'sunbolt','digital').action,'equip');p.equipped.finishes.sunbolt='digital';assert.equal(finishOffer(p,'sunbolt','digital').action,'equipped');assert.equal(finishOffer(p,'sunbolt','field').action,'equip');
 assert.equal(finishOffer(p,'sunbolt','gold').action,'buy');assert.equal(finishOffer(p,'sunbolt','gold').price,75000);assert.equal(finishOffer(p,'sunbolt','gold').category,'goldFinishes');assert.equal(finishOffer(p,'glacier','gold').action,'rifle');assert.equal(finishOffer(p,'sunbolt','forged').action,'invalid');
});
