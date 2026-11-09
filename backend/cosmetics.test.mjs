import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../dist/vendor/three.module.js";
import { rifle, setRifleFinish, disposeRifle } from "../dist/rifle-models.js";
import { operator } from "../dist/arena.js";
import { animateVictory } from "../dist/results-stage.js";

test("earned gold finish changes only rifle surfaces and restores the original field materials", () => {
  const model = rifle(new T.Scene(), "sunbolt", false), other = rifle(new T.Scene(), "sunbolt", false);
  const stock = [], otherStock = [];
  model.traverse((node) => { if (node.material?.name === "rifle-stock") stock.push(node.material); });
  other.traverse((node) => { if (node.material?.name === "rifle-stock") otherStock.push(node.material); });
  assert.ok(stock.length);
  const initial = stock[0].color.getHex();
  setRifleFinish(model, "gold"); assert.notEqual(stock[0].color.getHex(), initial);
  assert.equal(otherStock[0].color.getHex(), initial);
  setRifleFinish(model, "field"); assert.equal(stock[0].color.getHex(), initial);
  assert.doesNotThrow(() => model.clone()); disposeRifle(model); disposeRifle(other);
});

test("podium placements have distinct stable poses, respect reduced motion and retain clone-safe rigs", () => {
  const scene = new T.Scene(), poses = [];
  for (let place = 0; place < 3; place++) {
    const actor = operator(scene);
    animateVictory(actor, place, 1, true);
    const before = actor.userData.victoryRig.map(({ node }) => [node.position.y, node.rotation.z]);
    animateVictory(actor, place, 4, true);
    assert.deepEqual(actor.userData.victoryRig.map(({ node }) => [node.position.y, node.rotation.z]), before);
    poses.push(JSON.stringify(before)); assert.doesNotThrow(() => actor.clone());
    assert.equal(actor.userData.gun.userData.flash.visible, false);
  }
  assert.equal(new Set(poses).size, 3);
});

test("multiplayer gear is canonical, replicates on actors and stays clone-safe", async () => {
  const { cosmeticLoadout } = await import("../dist/weapons.js");
  const { addPlayer, newRoom } = await import("./rooms.mjs");
  const gear = { clothing: "ember", accessories: "cap", shoes: "crimson", arbitrary: "ignored" };
  const room = newRoom("GEARAA", true);
  addPlayer(room, { name: "Outfit", gear });
  assert.deepEqual(room.players[0].gear, { clothing: "ember", accessories: "cap", shoes: "crimson" });
  assert.deepEqual(cosmeticLoadout({ clothing: "fake", accessories: {}, shoes: null }), cosmeticLoadout(null));
  const actor = operator(new T.Scene(), 0xffffff, "sunbolt", room.players[0].gear);
  const colors = [];
  actor.traverse((node) => { if (node.material?.color) colors.push(node.material.color.getHex()); });
  assert.ok(colors.includes(0xcf5e3d), "equipped outfit should reach actor materials");
  assert.doesNotThrow(() => actor.clone());
});

test('costumes, headgear and shoes change remote model geometry rather than only material colours',()=>{
 const signature=(gear)=>{const model=operator(new T.Scene(),0xffffff,'sunbolt',gear),parts=[];model.traverse(node=>{if(node.isMesh&&node.visible&&node!==model.userData.gun)parts.push([node.position.toArray(),node.scale.toArray(),node.geometry.attributes.position.count]);});assert.doesNotThrow(()=>model.clone());return JSON.stringify(parts);};
 for(const [category,ids] of Object.entries({clothing:['cobalt','ember','lime','arctic','desert','shadow'],accessories:['sky','blaze','violet','headset','cap','mask'],shoes:['runner','tactical','alpine','crimson']})) {
   assert.equal(new Set(ids.map(id=>signature({clothing:'cobalt',accessories:'sky',shoes:'runner',[category]:id}))).size,ids.length,category+' needs distinct structure');
 }
});
