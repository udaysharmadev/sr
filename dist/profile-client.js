export function createProfileClient(onChange, {storage=localStorage,fetcher=fetch,read=()=>performance.now()}={}){
  let current=null,version=0,queue=Promise.resolve(),serverAt=0,receivedAt=0;
  const legacyRaw=storage.getItem('sr.profile.v1');
  const commit=value=>{
    current=value.profile;version=value.version;serverAt=value.serverTime;receivedAt=read();
    onChange(current);return value;
  };
  async function request(type,data={}){
    const response=await fetcher('/api/profile',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,type,version,profileId:current?.id}),signal:AbortSignal.timeout(8000)});
    let value;try{value=await response.json();}catch{throw new Error('Save service unavailable. Try again shortly.');}
    if(!response.ok)throw Object.assign(new Error(value.error||'Could not save. Try again.'),{status:response.status,recoveryRequired:value.recoveryRequired});
    return commit(value);
  }
  function enqueue(run){const next=queue.then(run);queue=next.catch(()=>{});return next;}
  async function change(type,data){
    if(!current)throw new Error('Your save is not connected. Reload to reconnect.');
    try{return await request(type,data);}
    catch(error){
      // Resolve uncertain commits, but never resend a purchase/spin automatically.
      if(error.status!==401)await request('refresh').catch(()=>{});
      throw error;
    }
  }
  return {
    now:()=>current?serverAt+Math.max(0,read()-receivedAt):Date.now(),
    open(legacy){return enqueue(async()=>{
      if(!storage.getItem('sr.profile.server.v1')&&!storage.getItem('sr.profile.legacy.v1')){
        const previous=legacyRaw;
        if(previous)storage.setItem('sr.profile.legacy.v1',previous);
      }
      const first=!storage.getItem('sr.profile.server.v1');
      const result=await request('open',{name:legacy?.name,weapon:legacy?.equipped?.skins,expectedProfileId:storage.getItem('sr.profile.server.v1')});
      storage.setItem('sr.profile.server.v1',result.profile.id);
      return {...result,migrated:first&&!!storage.getItem('sr.profile.legacy.v1')};
    });},
    refresh:()=>enqueue(()=>request('refresh')),
    recover:code=>enqueue(async()=>{const value=await request('recover',{code});storage.setItem('sr.profile.server.v1',value.profile.id);return value;}),
    mutate:(type,data={})=>enqueue(()=>change(type,data)),
    claimRewards:()=>enqueue(async()=>{
      const total={rounds:0,xp:0,coins:0};
      for(let batch=0;batch<20;batch++){
        const {result}=await change('claimrewards',{});
        for(const key of Object.keys(total))total[key]+=result[key]||0;
        if(result.rounds<50)break;
      }
      return total;
    }),
  };
}
