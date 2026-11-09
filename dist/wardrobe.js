// Original blocky gear collections; each item has its own constructed silhouette.
export const WARDROBE = [
 {id:'inferno',category:'clothing',name:'Inferno Warden',price:6500,color:0x6d2b22,effect:'flame',shape:'fire',description:'Forged shoulder plates, furnace backpack and ember seams'},
 {id:'cryonaut',category:'clothing',name:'Cryonaut',price:7000,color:0x6b9fae,effect:'frost',shape:'frost',description:'Polar pressure suit, ice fins and insulated panels'},
 {id:'voltage',category:'clothing',name:'Voltage Runner',price:6200,color:0x294e62,effect:'arc',shape:'arc',description:'Split power harness, coil pack and current rails'},
 {id:'wraith',category:'clothing',name:'Wraith Ronin',price:7800,color:0x463957,effect:'void',shape:'void',description:'Layered cuirass, suspended skirt plates and dark mist'},
 {id:'sovereign',category:'clothing',name:'Sun Sovereign',price:8000,color:0x9c793e,effect:'embers',shape:'relic',description:'Ceremonial mantle, relief armor and golden motes'},
 {id:'orbit',category:'clothing',name:'Orbital Explorer',price:7400,color:0xc2c6b6,effect:'frost',shape:'space',description:'Pressure shell, twin oxygen tanks and flight pack'},
 {id:'corsair',category:'clothing',name:'Abyss Corsair',price:5800,color:0x346e68,effect:'void',shape:'diver',description:'Brass diving harness, ballast cylinders and layered belts'},
 {id:'shinobi',category:'clothing',name:'Crimson Shinobi',price:6000,color:0x762f42,effect:'flame',shape:'samurai',description:'Laced lamellar coat, asymmetric shoulder guard and sash'},
 {id:'drake-helm',category:'accessories',name:'Drake Helm',price:3800,color:0xb9693c,effect:'flame',shape:'fire',description:'Swept horns, cheek guards and glowing crest'},
 {id:'crystal-crown',category:'accessories',name:'Crystal Crown',price:4200,color:0xb4e7ed,effect:'frost',shape:'frost',description:'Five faceted ice spires around an open face'},
 {id:'tesla-halo',category:'accessories',name:'Tesla Halo',price:4000,color:0x55c3cf,effect:'arc',shape:'arc',description:'Induction halo, side coils and current terminals'},
 {id:'oni-mask',category:'accessories',name:'Oni Mask',price:4500,color:0x6f4d8e,effect:'void',shape:'void',description:'Angular demon faceplate and split crown horns'},
 {id:'solar-diadem',category:'accessories',name:'Solar Diadem',price:5000,color:0xe0b95a,effect:'embers',shape:'relic',description:'Radiating ceremonial crown and floating sun emblem'},
 {id:'orbit-visor',category:'accessories',name:'Orbital Visor',price:4400,color:0xd9e0d5,effect:'frost',shape:'space',description:'Open-window pressure helmet with twin side seals'},
 {id:'brass-diver',category:'accessories',name:'Brass Diver',price:3600,color:0x9d8a50,effect:'void',shape:'diver',description:'Porthole frame, riveted cap and breathing canister'},
 {id:'ronin-kabuto',category:'accessories',name:'Ronin Kabuto',price:4600,color:0x963d4d,effect:'flame',shape:'samurai',description:'Flared lamellar helmet with crescent crest'},
 {id:'cinder-steps',category:'shoes',name:'Cinder Steps',price:2600,color:0xa64b2e,effect:'flame',shape:'fire',description:'Armored toe caps and ember exhaust heels'},
 {id:'glacier-boots',category:'shoes',name:'Glacier Boots',price:2800,color:0xa5d7e2,effect:'frost',shape:'frost',description:'Faceted ice grips and layered snow gaiters'},
 {id:'pulse-kicks',category:'shoes',name:'Pulse Kicks',price:3000,color:0x407e9b,effect:'arc',shape:'arc',description:'Floating heel rails and luminous power soles'},
 {id:'phantom-treads',category:'shoes',name:'Phantom Treads',price:3400,color:0x5b4775,effect:'void',shape:'void',description:'Segmented shin guards and hovering dark ankle shards'},
 {id:'gilded-greaves',category:'shoes',name:'Gilded Greaves',price:4000,color:0xc59b4d,effect:'embers',shape:'relic',description:'Sculpted gilded toes, sun buckles and armored cuffs'},
 {id:'orbit-walkers',category:'shoes',name:'Orbit Walkers',price:3600,color:0xc7d0c7,effect:'frost',shape:'space',description:'Pressure boots with thick bellows and heel thrusters'},
 {id:'abyss-anchors',category:'shoes',name:'Abyss Anchors',price:2400,color:0x658c78,effect:'void',shape:'diver',description:'Weighted diving soles and brass ankle locks'},
 {id:'ronin-tabi',category:'shoes',name:'Ronin Tabi',price:2700,color:0x934754,effect:'flame',shape:'samurai',description:'Split toe guards, lacquer heel blocks and tied cuffs'},
];
export const wardrobeById = id => WARDROBE.find(item=>item.id===id);
export const wardrobeItems = category => WARDROBE.filter(item=>item.category===category);
export const WARDROBE_IDS = Object.fromEntries(['clothing','accessories','shoes'].map(category=>[category,wardrobeItems(category).map(item=>item.id)]));
