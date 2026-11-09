// Original rifle collections. Each family has a different sculpted treatment;
// authored rifle variants change the trim, receiver layout and effect palette.
const collectionRows = [
  ['sunbolt',['Cinderfang','Glacier Spine','Stormrail','Night Bloom','Sunken Crown']],
  ['glacier',['Phoenix Talon','Permafrost','Thunder Monarch','Event Horizon','White Dynasty']],
  ['prism',['Furnace Titan','Cryo Bastion','Railbreaker','Dark Matter','Iron Pharaoh']],
  ['cinder',['Ash Serpent','Winter Thorn','Tesla Coil','Widow Veil','Tsar Reliquary']],
  ['spectre',['Blazewing','Polar Warden','Ion Sentinel','Phantom Wake','Desert Sovereign']],
  ['volt',['Wildfire Scout','Snow Lynx','Pulse Runner','Eclipse Fox','Jade Nomad']],
  ['rose',['Magma Wasp','Ice Mantis','Volt Hornet','Obsidian Hive','Amber Scarab']],
  ['ivory',['Dragon Ascendant','Aurora Lance','Celestial Surge','Starless King','Astral Emperor']],
];
const skinFamilies = [
  {family:'fire',effect:'flame',description:'Forged plates, swept flame fins and rising heat',colors:[0x252126,0x9f3c24,0xf59c3d,0xffd29a]},
  {family:'frost',effect:'frost',description:'Faceted crystal armor, frozen collars and cold mist',colors:[0x253e4b,0x75a8be,0xc8f3ff,0xeaf8ff]},
  {family:'arc',effect:'arc',description:'Split induction shrouds, exposed coils and charged sparks',colors:[0x1b2931,0x3f6f7c,0x56ecd8,0xb4f6ff]},
  {family:'void',effect:'void',description:'Floating segmented guards, angular blades and dark vapor',colors:[0x201e2e,0x493763,0xa87fe5,0xe4b9ff]},
  {family:'relic',effect:'embers',description:'Carved relief plates, ceremonial rings and golden motes',colors:[0x40362d,0xa78d50,0xf0d58e,0xfff0bf]},
];
export const RIFLE_SKINS = collectionRows.flatMap(([weapon,names],variant)=>names.map((name,index)=>({
  id:weapon+'-'+name.toLowerCase().replaceAll(' ','-'),weapon,name,
  price:10000+index*5500+variant*2000,...skinFamilies[index],variant,
})));
export const SEASON_RIFLE_SKINS = [{id:'sunbolt-frontier-vanguard',weapon:'sunbolt',name:'Frontier Vanguard',price:0,seasonOnly:true,family:'relic',effect:'embers',description:'Olive and gold ceremonial armor with golden motes',colors:[0x283c30,0x678059,0xe4c66c,0xffefad],variant:7}];
export const rifleSkinById = id => [...RIFLE_SKINS,...SEASON_RIFLE_SKINS].find(skin=>skin.id===id);
export const skinsForRifle = weapon => RIFLE_SKINS.filter(skin=>skin.weapon===weapon);
