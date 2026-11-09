import {rifleSkinById} from './rifle-skins.js';
import { CATALOG } from './catalog.js';
import { hasGoldFinish } from './progression.js';
export function finishOffer(profile,weapon,finish='field') {
  const item=finish==='gold'?CATALOG.goldFinishes.find(item=>item[0]==='gold-'+weapon):CATALOG.wraps.find(item=>item[0]==='wrap-'+finish);
  const skin=rifleSkinById(finish);
  const valid=(!skin||skin.weapon===weapon)&&(finish==='field'||finish==='gold'||!!item);
  const baseOwned=profile.owned.includes(weapon);
  const owned=finish==='field'||finish==='gold'&&hasGoldFinish(profile,weapon)||!!item&&profile.owned.includes(item[0]);
  return {valid,baseOwned,owned:!!owned,price:item?.[2]||0,item:item?.[0],category:finish==='gold'?'goldFinishes':'wraps',
    name:finish==='field'?'Field finish':finish==='gold'?'Mastery Gold':item?.[1]||'Field finish',
    action:!valid?'invalid':!baseOwned?'rifle':!owned&&skin?.seasonOnly?'season':!owned?'buy':profile.equipped.finishes?.[weapon]===finish||finish==='field'&&!profile.equipped.finishes?.[weapon]?'equipped':'equip'};
}
