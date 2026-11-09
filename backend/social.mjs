import {resolveGuestProfile} from './profiles.mjs';

const socialLimit = 100;
const socialPresenceMs = 75000;
const socialId = value => typeof value === 'string' && /^[1-9][0-9]{8}$/.test(value) ? Number(value) : null;
const socialError = (message,status=409) => Object.assign(new Error(message),{status});
const socialColumns = "s.player_id,s.last_seen,json_extract(p.state,'$.name') AS name,json_extract(p.state,'$.equipped') AS gear";
const socialJoin = "rush_social_players s JOIN rush_profiles p ON json_extract(p.state,'$.id')=s.profile_id";
const publicSocialPlayer = (row,now,showPresence=false) => ({playerId:String(row.player_id),name:row.name,
  gear:JSON.parse(row.gear || '{}'),...(showPresence?{online:now-row.last_seen<socialPresenceMs}:{})});

export class SocialStore {
  constructor(db){this.db=db;}
  first(sql,...args){return this.db.prepare(sql).bind(...args).first();}
  async all(sql,...args){return (await this.db.prepare(sql).bind(...args).all()).results;}
  async run(sql,...args){return (await this.db.prepare(sql).bind(...args).run()).meta.changes;}
  async identity(profileId,now){
    let row=await this.first('SELECT player_id,last_seen FROM rush_social_players WHERE profile_id=?',profileId);
    for(let attempt=0;!row&&attempt<8;attempt++){
      const id=100000000+crypto.getRandomValues(new Uint32Array(1))[0]%900000000;
      await this.run('INSERT OR IGNORE INTO rush_social_players(player_id,profile_id,last_seen) VALUES (?,?,?)',id,profileId,now);
      row=await this.first('SELECT player_id,last_seen FROM rush_social_players WHERE profile_id=?',profileId);
    }
    if(!row)throw socialError('Player ID unavailable. Try again.',503);
    if(now-row.last_seen>=30000)await this.run('UPDATE rush_social_players SET last_seen=? WHERE player_id=? AND last_seen<?',now,row.player_id,now-29999);
    return row.player_id;
  }
  async list(own,now){
    const rows=await this.all(`SELECT ${socialColumns},f.status,f.requester FROM rush_friendships f
      JOIN rush_social_players s ON s.player_id=CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END
      JOIN rush_profiles p ON json_extract(p.state,'$.id')=s.profile_id
      WHERE f.low_id=? OR f.high_id=? ORDER BY f.created_at DESC LIMIT 300`,own,own,own);
    return {playerId:String(own),friends:rows.filter(r=>r.status==='accepted').map(r=>publicSocialPlayer(r,now,true)),
      incoming:rows.filter(r=>r.status==='pending'&&r.requester!==own).map(r=>publicSocialPlayer(r,now)),
      outgoing:rows.filter(r=>r.status==='pending'&&r.requester===own).map(r=>publicSocialPlayer(r,now)),serverTime:now};
  }
  async find(own,id,now){
    const row=await this.first(`SELECT ${socialColumns} FROM ${socialJoin} WHERE s.player_id=?`,id);
    if(!row)return null;
    const relation=await this.first('SELECT status,requester FROM rush_friendships WHERE low_id=? AND high_id=?',Math.min(own,id),Math.max(own,id));
    return {...publicSocialPlayer(row,now,relation?.status==='accepted'),relationship:own===id?'self':relation?.status==='accepted'?'friend':relation?relation.requester===own?'outgoing':'incoming':'none'};
  }
  async act(type,own,id,now){
    if(own===id)throw socialError('That is your own Player ID.');
    const low=Math.min(own,id),high=Math.max(own,id);
    if(type==='request'){
      if(!await this.first('SELECT player_id FROM rush_social_players WHERE player_id=?',id))throw socialError('Player not found.',404);
      const used=await this.run('UPDATE rush_social_players SET next_request_at=? WHERE player_id=? AND next_request_at<=?',now+2000,own,now);
      if(!used)throw socialError('Wait a moment before sending another request.',429);
      const inserted=await this.run(`INSERT OR IGNORE INTO rush_friendships(low_id,high_id,requester,status,created_at)
        SELECT ?,?,?,'pending',? WHERE
        (SELECT count(*) FROM rush_friendships WHERE low_id=? OR high_id=?)<? AND
        (SELECT count(*) FROM rush_friendships WHERE low_id=? OR high_id=?)<?`,low,high,own,now,own,own,socialLimit,id,id,socialLimit);
      if(!inserted)throw socialError('Request already exists, or the friends list is full.');
    }else if(type==='accept'){
      if(!await this.run("UPDATE rush_friendships SET status='accepted' WHERE low_id=? AND high_id=? AND status='pending' AND requester=?",low,high,id))throw socialError('Friend request is no longer available.');
    }else{
      const predicate=type==='remove'?"status='accepted'":type==='cancel'?"status='pending' AND requester=?":"status='pending' AND requester=?";
      const args=type==='remove'?[]:[type==='cancel'?own:id];
      if(!await this.run('DELETE FROM rush_friendships WHERE low_id=? AND high_id=? AND '+predicate,low,high,...args))throw socialError('Friend entry is no longer available.');
    }
  }
}

export function socialApi(store,profiles,clock=Date.now){
  return async request=>{
    const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
    try{
      if(request.method!=='POST')return reply({error:'Use POST for friends.'},405);
      const url=new URL(request.url),origin=request.headers.get('origin');
      if(origin&&origin!==url.origin)return reply({error:'Invalid request origin.'},403);
      if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
      const raw=await request.text();if(raw.length>2048)return reply({error:'Request too large.'},413);
      let data;try{data=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
      if(!data||Array.isArray(data)||typeof data!=='object')return reply({error:'Invalid request.'},400);
      if(!['list','find','request','accept','decline','cancel','remove'].includes(data.type))return reply({error:'Unknown friends action.'},400);
      const guest=await resolveGuestProfile(profiles,request);
      if(!guest)return reply({error:'Open your guest profile first.'},401);
      const now=clock(),own=await store.identity(guest.profile.id,now);
      if(data.type==='list')return reply(await store.list(own,now));
      const id=socialId(data.playerId);if(!id)return reply({error:'Enter a 9-digit Player ID.'},400);
      if(data.type==='find')return reply({player:await store.find(own,id,now),serverTime:now});
      await store.act(data.type,own,id,now);
      return reply(await store.list(own,now));
    }catch(error){return reply({error:error.status?error.message:'Friends unavailable. Try again.'},error.status||503);}
  };
}
