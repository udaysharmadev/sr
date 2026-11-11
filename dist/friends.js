const socialEscape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Search responses include the authoritative relationship at lookup time.
export function friendSearchAction(player) {
  return ({self:'YOU',friend:'FRIEND',outgoing:'SENT',incoming:'ACCEPT',none:'ADD'})[player?.relationship] || 'ADD';
}
export function relationshipFromList(playerId,state) {
  if(playerId===state.playerId)return 'self';
  if(state.friends?.some(p=>p.playerId===playerId))return 'friend';
  if(state.incoming?.some(p=>p.playerId===playerId))return 'incoming';
  if(state.outgoing?.some(p=>p.playerId===playerId))return 'outgoing';
  return 'none';
}
export async function requestFriends(type,data={}) {
  const response=await fetch('/api/social',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,...data}),signal:AbortSignal.timeout(8000)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Friends unavailable');return value;
}
export function mountFriends(panel,onIdentity=()=>{},joinRoom=async()=>false) {
  let state=null,busy=false,refreshing=false,searching=false,found=null,error='',disposed=false,generation=0;
  const esc=socialEscape;
  const request=requestFriends;
  const action=(label,type,id)=>'<button data-friend-action="'+type+'" data-player-id="'+esc(id)+'">'+label+'</button>';
  const row=(player,buttons='')=>'<li><span class="friend-presence '+(player.online?'online':'')+'"></span><div><b>'+esc(player.name)+'</b><small>ID '+esc(player.playerId)+'</small></div>'+buttons+'</li>';
  function render(){
    if(disposed)return;
    const input=panel.querySelector('input'),query=input?.value||'',focused=input===document.activeElement;
    const oldScroll=panel.querySelector('.friends-scroll')?.scrollTop||0;
    const online=(state?.friends||[]).filter(p=>p.online);
    panel.innerHTML='<button class="find-players" data-find-players><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>Find players</button>'+
      '<div class="own-player-id">YOUR PLAYER ID <b>'+esc(state?.playerId||'…')+'</b></div>'+
      (searching?'<form class="friend-search"><input aria-label="Player ID" name="playerId" inputmode="numeric" pattern="[0-9]{9}" maxlength="9" placeholder="9-digit Player ID" required><button>SEARCH</button></form>':'')+
      '<p class="friend-status" role="status">'+esc(error)+'</p>'+
      (found?'<ul class="friend-list">'+row(found,friendSearchAction(found)==='ACCEPT'?action('ACCEPT','accept',found.playerId):friendSearchAction(found)==='ADD'?action('ADD','request',found.playerId):'<small>'+friendSearchAction(found)+'</small>')+'</ul>':'')+
      '<div class="friends-scroll">'+
      (state?.roomInvites?.length?'<h3>ROOM INVITES</h3><ul class="friend-list">'+state.roomInvites.map(p=>row(p,action('JOIN','roominviteopen',p.playerId)+action('DISMISS','roominvitedismiss',p.playerId))).join('')+'</ul>':'')+
      (state?.incoming?.length?'<h3>REQUESTS · '+state.incoming.length+'</h3><ul class="friend-list">'+state.incoming.map(p=>row(p,action('ACCEPT','accept',p.playerId)+action('×','decline',p.playerId))).join('')+'</ul>':'')+
      '<h3>ONLINE · '+online.length+'</h3><ul class="friend-list">'+(online.length?online.map(p=>row(p)).join(''):'<li class="friend-empty">No friends online</li>')+'</ul>'+
      '<h3>ALL FRIENDS · '+(state?.friends.length||0)+'</h3><ul class="friend-list">'+(state?.friends.length?state.friends.map(p=>row(p,action('REMOVE','remove',p.playerId))).join(''):'<li class="friend-empty">Find a player to add your first friend</li>')+'</ul>'+
      (state?.outgoing?.length?'<h3>SENT REQUESTS</h3><ul class="friend-list">'+state.outgoing.map(p=>row(p,action('CANCEL','cancel',p.playerId))).join('')+'</ul>':'')+'</div>';
    const next=panel.querySelector('input');if(next){next.value=query;if(focused)next.focus();}
    const scroll=panel.querySelector('.friends-scroll');if(scroll)scroll.scrollTop=oldScroll;
    for(const b of panel.querySelectorAll('button'))b.disabled=busy;
  }
  async function refresh(){if(busy||refreshing||disposed||document.hidden)return;refreshing=true;const epoch=generation;try{const value=await request('list');if(epoch!==generation||disposed)return;state=value;if(found)found={...found,relationship:relationshipFromList(found.playerId,state)};onIdentity(state.playerId);error='';render();}catch(e){if(epoch===generation){error=e.message;render();}}finally{refreshing=false;}}
  panel.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button||busy)return;
    if(button.hasAttribute('data-find-players')){searching=!searching;render();panel.querySelector('input')?.focus();return;}
    if(!button.dataset.friendAction)return;
    generation++;busy=true;error='';render();
    try{
      const type=button.dataset.friendAction,data={playerId:button.dataset.playerId};
      if(type==='roominviteopen'){
        const {invite}=await request(type,data);
        if(await joinRoom(invite.roomCode))state=await request('roominvitedismiss',data);
      }else state=await request(type,data);
      found=null;
    }catch(e){error=e.message;}finally{busy=false;render();}
  });
  panel.addEventListener('submit',async event=>{
    if(!event.target.matches('.friend-search'))return;event.preventDefault();if(busy)return;
    const playerId=new FormData(event.target).get('playerId');generation++;busy=true;error='';render();
    try{const result=await request('find',{playerId});found=result.player;if(!found)error='Player not found';}catch(e){found=null;error=e.message;}finally{busy=false;render();}
  });
  render();void refresh();const timer=setInterval(()=>void refresh(),30000);
  return {refresh,dispose(){disposed=true;clearInterval(timer);}};
}
