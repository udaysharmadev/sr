import {wardrobeItems} from './wardrobe.js';
import {RIFLE_SKINS,SEASON_RIFLE_SKINS} from './rifle-skins.js';
import {WEAPONS} from './weapons.js';
export const CATALOG={
  skins:WEAPONS.map((w,i)=>[w.id,w.name,[0,10000,18000,28000,40000,55000,75000,100000][i],0]),
  goldFinishes:WEAPONS.map(w=>['gold-'+w.id,'Mastery Gold · '+w.name,75000,0]),
  wraps:[['wrap-digital','Digital woodland',2500,0],['wrap-tiger','Tiger stripe',4500,0],['wrap-alpine','Alpine fracture',7000,0],['wrap-ember-drake','Ember Drake',14000,0],['wrap-ivory-relic','Ivory Relic',19000,0],['wrap-carbon-circuit','Carbon Circuit',24000,0],...[...RIFLE_SKINS,...SEASON_RIFLE_SKINS].map(skin=>['wrap-'+skin.id,skin.name,skin.price,0])],
  clothing:[['cobalt','Rush runner',0,0],['ember','Pit crew',1200,151],['lime','Bush scout',1600,244],['arctic','Polar ranger',1800,0],['desert','Desert ranger',1500,0],['shadow','Night operative',2400,0],...wardrobeItems('clothing').map(item=>[item.id,item.name,item.price,0])],
  accessories:[['sky','Sky goggles',0,0],['blaze','Combat helmet',650,160],['violet','Recon visor',900,76],['headset','Comms headset',450,0],['cap','Field cap',300,0],['mask','Respirator',750,0],...wardrobeItems('accessories').map(item=>[item.id,item.name,item.price,0])],
  shoes:[['runner','Sprint sneakers',0,0],['tactical','Combat boots',600,0],['alpine','Snow boots',750,0],['crimson','High-tops',500,0],...wardrobeItems('shoes').map(item=>[item.id,item.name,item.price,0])],
};
