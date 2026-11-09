import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDailyCoins, exchangeCoins, spinWheel, collectWheelPrize, wheelStatus } from '../dist/economy.js';
import { awardRound } from '../dist/progression.js';

test('daily 200 coins can be claimed once per UTC day and cannot roll back',()=>{
 const at=Date.UTC(2026,10,6,23,59),p={coins:12};assert.equal(claimDailyCoins(p,at),true);assert.equal(p.coins,212);
 assert.equal(claimDailyCoins(p,at+1000),false);assert.equal(claimDailyCoins(p,at-86400000),false);
 assert.equal(claimDailyCoins(p,at+60000),true);assert.equal(p.coins,412);
});
test('gem exchange validates pack and balance before either mutation',()=>{
 const p={coins:3,gems:10};assert.equal(exchangeCoins(p,'missing'),false);assert.equal(exchangeCoins(p,'crate'),false);assert.deepEqual(p,{coins:3,gems:10});
 assert.equal(exchangeCoins(p,'pouch'),true);assert.deepEqual(p,{coins:1003,gems:0});assert.equal(exchangeCoins(p,'pouch'),false);
});
test('wheel awards commit once before animation, survive reload and obey daily/seven-day limits',()=>{
 const at=Date.UTC(2026,10,6,12),p={};const prize=spinWheel(p,'golden',at,()=>.999);assert.equal(prize.currency,'gems');assert.equal(p.gems,25);
 const loaded=JSON.parse(JSON.stringify(p));assert.deepEqual(loaded.wheels.pending,prize);assert.equal(spinWheel(loaded,'golden',at+1,()=>0),null);assert.equal(spinWheel(loaded,'daily',at+1,()=>0),null);
 assert.equal(collectWheelPrize(loaded),true);assert.equal(collectWheelPrize(loaded),false);assert.equal(loaded.gems,25);
 assert.equal(wheelStatus(loaded,'golden',at+7*86400000-1).ready,false);assert.equal(wheelStatus(loaded,'golden',at+7*86400000).ready,true);
 assert.equal(spinWheel(loaded,'daily',at,()=>0).amount,250);collectWheelPrize(loaded);assert.equal(spinWheel(loaded,'daily',at+1000,()=>0),null);
 assert.ok(spinWheel(loaded,'daily',at+86400000,()=>0));assert.equal(loaded.coins,500);
});
test('invalid wheel requests never mutate and daily challenge gems cannot be duplicated',()=>{
 const p={};assert.equal(spinWheel(p,'fake',1,()=>0),null);assert.equal(spinWheel(p,'daily',1,()=>1),null);assert.deepEqual(p,{});
 const r={roundId:'gem:1',completed:true,finishedAt:Date.UTC(2026,10,6),kills:10,quickscopes:10,airborneKills:5};awardRound(p,r,true);assert.equal(p.gems,20);awardRound(p,r,true);assert.equal(p.gems,20);
 awardRound(p,{...r,roundId:'gem:2'},true);assert.equal(p.gems,20);awardRound(p,{...r,roundId:'gem:3',finishedAt:r.finishedAt+86400000},true);assert.equal(p.gems,40);
});
