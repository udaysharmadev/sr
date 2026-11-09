import {claimSeasonTier,claimSeasonMission} from '../dist/seasons.js';
import {rifleSkinById} from '../dist/rifle-skins.js';
import {claimDailyCoins,spinWheel,collectWheelPrize,exchangeCoins} from '../dist/economy.js';
import {playerAlias} from '../dist/equipment.js';
import {awardRound,earnedBadges,rifleMastery,hasGoldFinish} from '../dist/progression.js';
import {CATALOG} from '../dist/catalog.js';
const rifleIds = new Set(CATALOG.skins.map(item=>item[0]));
export function migrateRifleEconomy(profile) {
  if (profile.economyVersion >= 2) return false;
  const retained = new Set(['sunbolt',profile.equipped?.skins,...(profile.purchasedRifles||[])]);
  profile.owned = [...new Set([...(profile.owned||[]).filter(id=>!rifleIds.has(id)||retained.has(id)),'sunbolt'])];
  if (rifleIds.has(profile.equipped?.skins) && !profile.owned.includes(profile.equipped.skins)) profile.owned.push(profile.equipped.skins);
  profile.economyVersion = 2;
  return true;
}
const profileCookie='sr_guest';
const guestCookie=(secret,url)=>profileCookie+'='+secret+'; Path=/api; HttpOnly; SameSite=Strict; Max-Age=31536000'+(url.protocol==='https:'?'; Secure':'');
const profileHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
export async function resolveGuestProfile(store,request){
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(profileCookie+'='))?.slice(profileCookie.length+1);
  if(!token||!/^[a-f0-9-]{72}$/.test(token))return null;
  const key=await profileHash(token),row=await store.read(key);return row?{key,...row}:null;
}
export class ProfileStore {
  constructor(db){this.db=db;}
  async read(hash){const row=await this.db.prepare('SELECT version,state FROM rush_profiles WHERE session_hash=?').bind(hash).first();return row?{version:row.version,profile:JSON.parse(row.state)}:null;}
  async findRecovery(hash){const row=await this.db.prepare("SELECT session_hash,version,state FROM rush_profiles WHERE json_extract(state,'$.recoveryHash')=?").bind(hash).first();return row?{key:row.session_hash,version:row.version,profile:JSON.parse(row.state)}:null;}
  async restore(previous,newHash,profile){return (await this.db.prepare('UPDATE rush_profiles SET session_hash=?,state=?,version=version+1 WHERE session_hash=? AND version=?').bind(newHash,JSON.stringify(profile),previous.key,previous.version).run()).meta.changes===1;}
  async unclaimed(profile){
    const rows=await this.db.prepare('SELECT result FROM rush_match_results WHERE profile_id=? AND round_id NOT IN (SELECT value FROM json_each(?)) ORDER BY finished_at,round_id LIMIT 50').bind(profile.id,JSON.stringify(profile.awardedRounds||[])).all();
    return rows.results.map(row=>JSON.parse(row.result));
  }
  async write(hash,previous,profile){
    const statement=previous
      ?this.db.prepare('UPDATE rush_profiles SET version=version+1,state=? WHERE session_hash=? AND version=?').bind(JSON.stringify(profile),hash,previous.version)
      :this.db.prepare('INSERT OR IGNORE INTO rush_profiles(session_hash,version,state) VALUES (?,1,?)').bind(hash,JSON.stringify(profile));
    return (await statement.run()).meta.changes===1;
  }
}
export function profileApi(store,clock=Date.now,roomStore=null){
  return async request=>{
    const respond=(data,status=200,cookie)=>{
      if(data.profile){const {recoveryHash,...visible}=data.profile;data={...data,profile:{...visible,recoveryReady:!!recoveryHash}};}
      return Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
    };
    try{
      if(request.method!=='POST')return respond({error:'Use POST for profile actions.'},405);
      const url=new URL(request.url),origin=request.headers.get('origin');
      if(origin&&origin!==url.origin)return respond({error:'Invalid request origin.'},403);
      if(!request.headers.get('content-type')?.startsWith('application/json'))return respond({error:'JSON required.'},415);
      const raw=await request.text();if(raw.length>4096)return respond({error:'Request too large.'},413);
      let data;try{data=JSON.parse(raw);}catch{return respond({error:'Invalid request.'},400);}
      if(!data||Array.isArray(data)||typeof data!=='object')return respond({error:'Invalid request.'},400);
      if(data.type==='recover'){
        const input=typeof data.code==='string'?data.code.trim():'';
        if(!/^SR-[a-f0-9]{48}$/i.test(input))return respond({error:'Enter a valid recovery key.'},400);
        const code='SR-'+input.slice(3).toLowerCase(),saved=await store.findRecovery(await profileHash(code));
        if(!saved)return respond({error:'Recovery key unavailable or already used.'},403);
        const profile=saved.profile;delete profile.recoveryHash;
        const secret=crypto.randomUUID()+crypto.randomUUID();
        if(!await store.restore(saved,await profileHash(secret),profile))return respond({error:'Save changed. Try recovery again.'},409);
        return respond({profile,version:saved.version+1,serverTime:clock()},200,guestCookie(secret,url));
      }
      const row=await resolveGuestProfile(store,request),key=row?.key;
      if(data.type==='open'&&!row){
        if(data.expectedProfileId)return respond({error:'Your guest cookie is missing. Recover your save with its recovery key.',recoveryRequired:true},401);
        const secret=crypto.randomUUID()+crypto.randomUUID(),sessionHash=await profileHash(secret);
        const profile={id:crypto.randomUUID(),name:playerAlias(data.name)||'RushSniper',coins:0,gems:0,xp:0,kills:0,deaths:0,rounds:0,wins:0,best:0,economyVersion:2,purchasedRifles:[],owned:['sunbolt','cobalt','sky','runner'],equipped:{skins:'sunbolt',clothing:'cobalt',accessories:'sky',shoes:'runner',finishes:{}}};
        if(!await store.write(sessionHash,null,profile))return respond({error:'Could not create profile. Try again.'},503);
        const cookie=guestCookie(secret,url);
        return respond({profile,version:1,serverTime:clock()},200,cookie);
      }
      if(!row)return respond({error:'Open your guest profile first.'},401);
      if(['open','refresh'].includes(data.type)){
        if(migrateRifleEconomy(row.profile)) {
          if(!await store.write(key,row,row.profile))return respond({error:'Profile changed. Refresh and try again.'},409);
          row.version++;
        }
        return respond({profile:row.profile,version:row.version,serverTime:clock()});
      }
      if(data.profileId!==undefined&&data.profileId!==row.profile.id)return respond({error:'Your save changed in another tab. Refresh and try again.'},409);
      if(!Number.isSafeInteger(data.version)||data.version!==row.version)return respond({error:'Profile changed. Refresh and try again.'},409);
      const p=row.profile,now=clock();let result;
      if(data.type==='recoverykey'){
        const code='SR-'+Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
        p.recoveryHash=await profileHash(code);result={recoveryCode:code};
      }
      else if(data.type==='claimrewards'){
        await roomStore?.settleFinished?.(now,p.id);
        const rewards=await store.unclaimed(p);let xp=0,coins=0,rounds=0;
        for(const receipt of rewards){const reward=awardRound(p,receipt,true);if(reward.applied){xp+=reward.xp;coins+=reward.coins;rounds++;}}
        if(!rounds)return respond({profile:p,version:row.version,result:{rounds:0,xp:0,coins:0},serverTime:now});
        result={rounds,xp,coins};
      }
      else if(data.type==='reward'){
        const code=String(data.code||'').toUpperCase();
        if(!roomStore||!/^[A-Z0-9]{6}$/.test(code))return respond({error:'Completed match unavailable.'},409);
        const match=(await roomStore.read(code))?.room;
        const player=match?.players.find(q=>q.token===data.roomToken&&q.guestProfileId===p.id&&!q.spectator);
        if(!player||!match.public||match.phase!=='results')return respond({error:'No eligible completed public match.'},409);
        const ranking=[...match.players].filter(q=>!q.spectator).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||a.scoreAt-b.scoreAt||a.id.localeCompare(b.id));
        const reward=awardRound(p,{...player,roundId:match.id+':'+match.round,completed:true,practice:false,streak:player.bestStreak,finishedAt:match.finishedAt,win:player.kills>0&&ranking[0]?.id===player.id},true);
        result=reward.applied?reward:false;
      }
      else if(data.type==='seasonmission')result=claimSeasonMission(p,data.season,data.mission,now);
      else if(data.type==='seasonclaim')result=claimSeasonTier(p,data.season,data.tier,now);
      else if(data.type==='dailycoins')result=claimDailyCoins(p,now);
      else if(data.type==='spin')result=spinWheel(p,data.kind,now,undefined,data.paid===true);
      else if(data.type==='collect')result=collectWheelPrize(p);
      else if(data.type==='exchange')result=exchangeCoins(p,data.pack);
      else if(data.type==='buy'||data.type==='equip'){
        const item=Object.hasOwn(CATALOG,data.category)?CATALOG[data.category].find(item=>item[0]===data.item):null;
        if(!item)return respond({error:'Select valid equipment.'},400);
        if(data.type==='buy'){
          const skin=data.category==='wraps'?rifleSkinById(item[0].slice(5)):null;
          if(skin?.seasonOnly)return respond({error:'Earn this finish from its season reward track.'},409);
          const requiredRifle=skin?.weapon||(data.category==='goldFinishes'?item[0].slice(5):null);
          if(requiredRifle&&!p.owned.includes(requiredRifle))return respond({error:'Unlock this rifle before buying its skin.'},409);
          if(data.category==='goldFinishes'&&hasGoldFinish(p,requiredRifle))return respond({error:'Gold is already unlocked for this rifle.'},409);
          if(p.owned.includes(item[0])||p.coins<item[2])return respond({error:'Already owned or insufficient coins.'},409);
          p.coins-=item[2];p.owned.push(item[0]);
          if(data.category==='skins'){p.purchasedRifles ||= [];p.purchasedRifles.push(item[0]);}
        }else{
          if(['wraps','goldFinishes'].includes(data.category))return respond({error:'Choose the finish from your rifle.'},400);
          if(!p.owned.includes(item[0]))return respond({error:'Unlock this equipment first.'},409);
          p.equipped[data.category]=item[0];
        }
        result=true;
      }
      else if(data.type==='badge'){
        if(!earnedBadges(p).some(b=>b.id===data.badge))return respond({error:'Earn this badge first.'},409);
        p.badge=data.badge;result=true;
      }
      else if(data.type==='finish'){
        const skin=rifleSkinById(data.finish);
        if(skin&&skin.weapon!==data.weapon)return respond({error:'This skin belongs to another rifle.'},409);
        if(!CATALOG.skins.some(item=>item[0]===data.weapon)||!['field','gold',...CATALOG.wraps.map(item=>item[0].slice(5))].includes(data.finish))return respond({error:'Select a valid rifle finish.'},400);
        if(!p.owned.includes(data.weapon)||!['field','gold'].includes(data.finish)&&!p.owned.includes('wrap-'+data.finish))return respond({error:'Unlock this rifle and finish first.'},409);
        if(data.finish==='gold'&&!hasGoldFinish(p,data.weapon))return respond({error:'Buy Gold or earn its mastery first.'},409);
        p.equipped.finishes ||= {};p.equipped.finishes[data.weapon]=data.finish;result=true;
      }
      else if(data.type==='rename'){const name=playerAlias(data.name);if(name.length<2)return respond({error:'Use 2–22 letters, numbers, spaces, _ or -.'},400);p.name=name;result=true;}
      else return respond({error:'Unknown profile action.'},400);
      if(!result)return respond({error:'Reward unavailable or insufficient gems.'},409);
      if(!await store.write(key,row,p))return respond({error:'Profile changed. Refresh and try again.'},409);
      return respond({profile:p,version:row.version+1,result,serverTime:now});
    }catch(error){console.error('Profile service failure',error.message);return respond({error:'Profile service temporarily unavailable.'},503);}
  };
}
