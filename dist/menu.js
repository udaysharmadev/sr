import {audioLevel} from './audio-levels.js';
import {QUALITY_CHOICES} from './quality.js';
import {activeEvents,EVENTS,eventStatus} from './events.js';
import {seasonAt,seasonProgress,claimableSeasons,SEASON_CLAIM_GRACE} from './seasons.js';
import {wardrobeById} from './wardrobe.js';
import {skinsForRifle,rifleSkinById,SEASON_RIFLE_SKINS} from './rifle-skins.js';
import {finishOffer} from './armory-offer.js';
import {mountFriends,requestFriends} from './friends.js';
import { roundMusic } from "./round-music.js";
import {CATALOG as goods} from './catalog.js';
import {createProfileClient} from './profile-client.js';
import { COIN_PACKS, WHEEL_PRIZES, EXTRA_SPIN_GEMS, canClaimCoins, wheelStatus } from './economy.js';
import { playerAlias } from "./equipment.js";
import { fillIcons, icon } from "./icons.js";
import { weaponById, WEAPONS } from "./weapons.js";
import { MAPS } from "./maps.js";
import { runPreload } from "./preload.js";
import { preloadCombatAudio, COMBAT_CLIPS } from "./combat-audio.js";
import { createShotAudio } from "./shot-audio.js";
import { BADGES, DAILY_CHALLENGES, dailyProgress, WEEKLY_CHALLENGES, weeklyProgress, rifleMastery, earnedBadges } from "./progression.js";
import { isRetryable, isSessionExpired, recoveryDelay } from "./net.js";
import { gameAudioOutput, setPlatformMuted } from "./platform-audio.js";
import { platformLifecycle } from "./platform-lifecycle.js";
import { CONTROL_BINDINGS as bindings, bindingError, keyLabel, resolveBindings } from "./input-bindings.js";

const $ = (q) => document.querySelector(q);
const modal = $("#modal"),
  content = $("#modal-content"),
  title = $("#dialog-title");
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]),
  );
const button = (label, action, style = "") =>
  '<button class="btn ' + style + '" data-action="' + action + '">' + label +
  "</button>";
const load = (key, defaults) => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return defaults;
  }
};
const profile = load("sr.profile.v1", {
  name: "RushSniper" + (100 + Math.floor(Math.random() * 900)),
  xp: 0,
  coins: 0,
  gems: 0,
  kills: 0,
  deaths: 0,
  rounds: 0,
  best: 0,
  owned: ["sunbolt", "cobalt", "sky"],
  equipped: { skins: "sunbolt", clothing: "cobalt", accessories: "sky" },
  claimed: false,
});
const settings = load("sr.settings.v1", {
  quality: "balanced",
  sensitivity: 1,
  adsSensitivity: .55,
  volume: .65,
  musicVolume: 1,
  effectsVolume: 1,
  shake: .45,
  reticle: 2,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  invertY: false,
  bindings: {},
});
delete settings.toggleADS;
settings.bindings = resolveBindings(settings.bindings);
let lastPerformance = load("sr.performance.v1", { samples: 0 });
const save = () => {
  try {
    localStorage.setItem("sr.profile.v1", JSON.stringify(profile));
    localStorage.setItem("sr.settings.v1", JSON.stringify(settings));
  } catch {}
};

profile.equipped = { shoes: "runner", ...profile.equipped };
profile.equipped.finishes ||= {};
settings.finishes = profile.equipped.finishes;
if (!profile.owned.includes('runner')) profile.owned.push('runner');
const categories = {
  skins: "Rifles",
  clothing: "Costumes",
  accessories: "Headgear",
  shoes: "Shoes",
};

function shopTabs(active) {
  return '<div class="seg shop-tabs">' +
    Object.entries(categories).map(([id, name]) =>
      '<button data-category="' + id + '" aria-pressed="' + (active === id) +
      '"><span>' + icon(id === "skins" ? "rifle" : id === "clothing" ? "shirt" : id === "shoes" ? "shoe" : "goggles") + '</span>' + name + "</button>"
    ).join("") + "</div>";
}

let roomMapPreview, roomMapEpoch=0;
let characterPreview, shopArmory = false, collectionInventory = false, settingsTab = "aim";
let profileBusy=false,menuEpoch=0;
let friendsPanel,playerNumber='';
const saves=createProfileClient(value=>{
  for(const key of Object.keys(profile))delete profile[key];
  Object.assign(profile,value);settings.finishes=profile.equipped.finishes||{};uiProfile();
});
async function profileAction(type,data={},after){
  if(profileBusy){notify('Saving…');return null;}
  profileBusy=true;const epoch=menuEpoch;
  content.setAttribute('aria-busy','true');
  try{const value=await saves.mutate(type,data);if(epoch===menuEpoch)after?.(value);return value;}
  catch(error){notify(error.message);if(epoch===menuEpoch)refreshProfileScreen();return null;}
  finally{profileBusy=false;content.removeAttribute('aria-busy');}
}
function refreshProfileScreen(){
  if(screen==='wallet')wallet();else if(screen==='tasks')tasks();else if(screen==='wheel')wheel();
  else if(screen==='profile')profileView();
  else if(['shop','inventory'].includes(screen))void collection(selectedCategory,selection,screen==='inventory');
}
function equipRifle(id){
  const shop=shopArmory;
  return profileAction('equip',{category:'skins',item:id},()=>{void inspect(id,shop);notify(weaponById(id).name+' equipped');});
}
let wheelTimer, wheelSpinning = false, wheelKind = 'daily';
let resultsStage = null, resultsVersion = 0;
let sdkLifecycle = null, bootReady = false, pendingPlatformInvite = null;
let gunPreview, previewWeapon = profile.equipped.skins;
let stage, initialAudioBuffers = null, roomPresence = "", roomFingerprint = "";
let screen = "",
  selectedCategory = "skins",
  selection = "",
  session = null,
  poll = null,
  requestGeneration = 0,
  gameCleanup = null,
  liveBay = null,
  remapping = null,
  toastTimer,
  sdk,
  inspectVersion = 0,
  gameRunning = false,
  sessionStarting = null;
function updatePortrait() {
  const picture = stage?.portrait();
  if (!picture) return;
  $("#avatar").src = picture;
  const photo = $("#profile-portrait"); if (photo) photo.src = picture;
}
function refreshEventStatus() {
  const now=saves.now();
  for(const tag of document.querySelectorAll('[data-event-status]')) {
    const event=EVENTS.find(e=>e.id===tag.dataset.eventStatus);
    if(event)tag.textContent=eventStatus(event,now);
  }
}
setInterval(refreshEventStatus,60000);
function uiProfile() {
  refreshEventStatus();
  $("#alias").textContent = profile.name;
  updatePortrait();
  $("#level").textContent = 1 + Math.floor(profile.xp / 1000);
  $("#xp-text").textContent = (profile.xp % 1000).toLocaleString() +
    " / 1,000 XP";
  $("#xp-fill").style.width = (profile.xp % 1000) / 10 + "%";
  $("#coins").textContent = profile.coins.toLocaleString();
  $("#gems").textContent = profile.gems.toLocaleString();
  $('#wheel-ready').textContent = profile.wheels?.pending ? 'REWARD READY' : wheelStatus(profile,'golden',saves.now()).ready ? 'GOLDEN SPIN READY' : wheelStatus(profile,'daily',saves.now()).ready ? 'FREE SPIN' : 'BACK TOMORROW';
  save();
}
function sdkCall(method, ...args) {
  try { sdk?.game?.[method]?.(...args)?.catch?.(() => {}); } catch {}
}
function notify(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}
function stopPolling() {
  clearTimeout(poll);
  poll = null;
}
function stopInspect() {
  updatePortrait();
  characterPreview?.dispose();
  characterPreview = null;
  gunPreview?.dispose();
  gunPreview = null;
  inspectVersion++;
  stage?.setActive(!gameRunning);
  liveBay?.setActive(false);
  $("#live-bay").hidden = true;
  document.body.classList.remove("inspect");
}
function stopResults(keepMusic = false) {
  if (!keepMusic) roundMusic.stop();
  resultsVersion++;
  resultsStage?.dispose();
  resultsStage = null;
}
function show(id, heading, html, nonmodal = false) {
  menuEpoch++;
  const active = document.activeElement;
  const hadMenuFocus = content.contains(active);
  const focusKey = ["weapon", "item", "category", "settingsTab", "quality", "vote", "roomStep", "configChoice", "previewFinish"].find((key) => active?.dataset?.[key]);
  const focusValue = focusKey && active.dataset[focusKey];
  if (screen === "results" && id !== "results") {
    stopResults();
    stage?.setActive(!gameRunning);
  }
  if (id !== screen && (gunPreview || characterPreview)) stopInspect();
  roomMapEpoch++; roomMapPreview?.dispose(); roomMapPreview=null;
  modal.classList.remove("shop-armory");
  modal.classList.remove("private-room", "public-queue", "public-vote");
  modal.classList.toggle("arsenal", id === "arsenal");
  modal.dataset.screen = id;
  $("#menu-prompt").innerHTML = id === "arsenal"
    ? "<kbd>←</kbd> <kbd>→</kbd> Select rifle <kbd>ENTER</kbd> Equip"
    : "<kbd>ESC</kbd> Return to lobby";
  screen = id;
  if (id !== 'wheel') { clearTimeout(wheelTimer); wheelSpinning = false; }
  title.textContent = heading;
  content.innerHTML = html;
  if (!modal.open) nonmodal ? modal.show() : modal.showModal();
  if (focusKey) [...content.querySelectorAll("button")].find((b) => b.dataset[focusKey] === focusValue)?.focus({ preventScroll: true });
  else if (hadMenuFocus) modal.querySelector(".modal-head button")?.focus({ preventScroll: true });
  fillIcons(content);
}
async function leaveRoom() {
  requestGeneration++;
  stopPolling();
  const old = session;
  session = null;
  if (old) {
    roomPresence = "";
    sdkCall("leftRoom");
    await old.leave().catch(() => {});
  }
}
function closeDialog() {
  menuEpoch++; roomMapEpoch++;roomMapPreview?.dispose();roomMapPreview=null;
  clearTimeout(wheelTimer);wheelSpinning=false;
  stopResults();
  remapping = null;
  stopInspect();
  menuCue?.dispose(); menuCue = null;
  if (["room", "connect", "results"].includes(screen) || sessionStarting !== null) void leaveRoom();
  modal.close();
  screen = "";
}
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top ||
      e.clientY > r.bottom
    ) closeDialog();
  }
});
function profileView() {
  const stats = [[profile.wins || 0, "Wins"], [profile.kills, "Kills"], [(profile.kills / Math.max(1, profile.deaths)).toFixed(2), "K/D"],
    [profile.shots ? Math.round((profile.hits || 0) / profile.shots * 100) + "%" : "—", "Accuracy"],
    [(profile.longestKill || 0).toFixed(1) + "m", "Longest kill"], [profile.best, "Best streak"]];
  const earned = earnedBadges(profile).map((badge) => badge.id);
  show(
    "profile",
    "Player profile",
    '<div class="profile-identity"><div class="profile-card"><img id="profile-portrait" src="' + escape(stage?.portrait() || '') + '" alt="Your equipped character"><div><div class="eyeline">Level ' +
      (1 + Math.floor(profile.xp / 1000)) + "</div><h2>" +
      escape(profile.name) + '</h2><small data-profile-player-id>PLAYER ID '+escape(playerNumber||'…')+'</small><button class="mini rename-trigger" data-action="rename">EDIT NAME</button><span>' + profile.xp.toLocaleString() + ' XP · ' + profile.rounds + ' matches</span></div></div><div class="stats career-stats">' +
      stats.map(([v, k]) => "<div><b>" + v + "</b>" + k + "</div>").join("") +
      '</div></div><div class="profile-medals"><h2>Sniper badges</h2><div class="badge-grid">' + BADGES.map((badge) =>
        '<button class="badge-choice ' + (earned.includes(badge.id) ? 'earned' : '') + '" data-badge="' + badge.id + '" ' +
        (earned.includes(badge.id) ? '' : 'disabled') + ' aria-pressed="' + (profile.badge === badge.id) + '"><span>' + icon('badge-'+badge.id) + '</span><strong>' + badge.name + '</strong><small>' + badge.description + '</small><b>' + (earned.includes(badge.id) ? profile.badge === badge.id ? 'Equipped' : 'Earned · equip' : 'Locked') + '</b></button>'
      ).join('') + '</div></div><div class="row">'+button(profile.recoveryReady?'Replace recovery key':'Save recovery key','recoverykey')+button('Recover a save','recover')+'</div>',
  );
}
function renameView() {
  show("rename", "Player name", '<form id="rename-form" class="rename-form"><label for="player-name">YOUR NAME</label><input id="player-name" name="name" aria-label="Player name" maxlength="22" minlength="2" required autocomplete="off" value="' + escape(profile.name) + '"><p>2–22 letters, numbers, spaces, _ or -.</p><p id="rename-error" role="alert"></p><button class="btn primary" type="submit">SAVE NAME</button></form>');
  $("#player-name").focus(); $("#player-name").select();
}
let recoveryBoot=false;
function recoveryView(fromBoot=false){
  recoveryBoot=fromBoot;
  show('recover','Recover your save','<form id="recover-form" class="rename-form"><label for="recovery-key">RECOVERY KEY</label><input id="recovery-key" name="code" aria-label="Recovery key" autocomplete="off" spellcheck="false" required placeholder="SR-…"><p>Restore your coins, unlocks and match history. Each key works once.</p><p id="recovery-error" role="alert"></p><button class="btn primary">RESTORE SAVE</button></form>');
}
function recoveryKeyView(code){
  show('recoverykey','Keep your save','<div class="rename-form"><p>Keep this key somewhere private. It restores your save if you lose this browser’s cookies. A new key replaces the old one.</p><label for="saved-recovery-key">YOUR RECOVERY KEY</label><input id="saved-recovery-key" aria-label="Your recovery key" readonly autocomplete="off" spellcheck="false" value="'+escape(code)+'"><p>Using it signs out previous sessions. Generate another key after restoring.</p>'+button('Done','close','primary')+'</div>');
  $('#saved-recovery-key').select();
}
let challengePeriod='daily';
function tasks(period=challengePeriod) {
  challengePeriod=['daily','weekly','season'].includes(period)?period:'daily';
  if (challengePeriod==='season') { seasonTrack(); return; }
  const weekly=challengePeriod==='weekly', progress=weekly?weeklyProgress(profile,saves.now()):dailyProgress(profile,saves.now()),challenges=weekly?WEEKLY_CHALLENGES:DAILY_CHALLENGES;
  const event=activeEvents(saves.now())[0],eventBanner=event?'<div class="active-event"><strong>'+escape(event.name)+' · '+event.eliminationXpMultiplier+'× ELIMINATION XP</strong><span>ENDS '+new Date(event.endsAt).toISOString().slice(0,10)+' UTC · PUBLIC MATCHES</span></div>':'';
  show('tasks','Challenges','<nav class="wheel-tabs"><button data-challenge-period="daily" aria-pressed="'+!weekly+'">DAILY</button><button data-challenge-period="weekly" aria-pressed="'+weekly+'">WEEKLY</button><button data-challenge-period="season" aria-pressed="false">SEASON</button></nav>'+eventBanner+'<div class="daily-gift"><span class="coin"></span><div><small>DAILY GIFT</small><h2>200 FREE COINS</h2></div><button class="btn primary" data-action="dailycoins" '+(canClaimCoins(profile,saves.now())?'':'disabled')+'>'+(canClaimCoins(profile,saves.now())?'CLAIM':'CLAIMED')+'</button></div><div class="challenge-list">'+challenges.map((challenge,i)=>{
    const n=Math.min(challenge.target,progress[challenge.id]||0),complete=progress.claimed.includes(challenge.id);
    return '<section class="challenge-card"><div class="challenge-emblem">'+icon(['target','arrow','medal'][i])+'</div><div class="challenge-objective"><h2>'+challenge.name+'</h2><small>'+challenge.description+'</small><progress value="'+n+'" max="'+challenge.target+'"></progress><b>'+n+' / '+challenge.target+'</b></div><span class="challenge-reward">'+(complete?'✓ EARNED':'<b>+'+challenge.gems+' '+icon('gem')+'</b><small>+'+challenge.coins.toLocaleString()+' COINS</small>')+'</span></section>';
  }).join('')+'</div><div class="daily-reset">PUBLIC MATCHES · REWARDS CREDITED AUTOMATICALLY · '+(weekly?'MONDAY':'DAILY')+' RESET 00:00 UTC</div>');
}
let selectedSeasonId=null;
function seasonTrack() {
  const now=saves.now(), choices=claimableSeasons(now);
  const season=choices.find(s=>s.id===selectedSeasonId)||seasonAt(now)||choices.at(-1);
  selectedSeasonId=season?.id||null;
  let body='<nav class="wheel-tabs"><button data-challenge-period="daily">DAILY</button><button data-challenge-period="weekly">WEEKLY</button><button data-challenge-period="season" aria-pressed="true">SEASON</button></nav>';
  if(!season) body+='<div class="daily-reset">NO ACTIVE SEASON</div>';
  else {
    const progress=seasonProgress(profile,season);
    if(choices.length>1)body+='<nav class="wheel-tabs" aria-label="Select season">'+choices.map(s=>'<button data-season-select="'+escape(s.id)+'" aria-pressed="'+(s.id===season.id)+'">SEASON '+s.number+'</button>').join('')+'</nav>';
    body+='<div class="season-title"><span>SEASON '+season.number+'</span><h2>'+escape(season.name)+'</h2><b>'+progress.xp.toLocaleString()+' / '+season.tiers.at(-1).xp.toLocaleString()+' SEASON XP</b><progress class="season-overall" value="'+Math.min(progress.xp,season.tiers.at(-1).xp)+'" max="'+season.tiers.at(-1).xp+'" aria-label="Season progression"></progress><small>'+(now<season.endsAt?'ENDS '+new Date(season.endsAt).toISOString().slice(0,10):'CLAIM REWARDS UNTIL '+new Date(season.endsAt+SEASON_CLAIM_GRACE).toISOString().slice(0,10))+' UTC</small></div><div class="season-tiers">'+season.tiers.map((tier,i)=>{
      const claimed=progress.claimed.includes(i),ready=progress.xp>=tier.xp;
      const reward=tier.finish?escape(tier.finishName):tier.badge?'FRONTIER ACE BADGE':(tier.coins?tier.coins.toLocaleString()+' COINS':'')+(tier.gems?' · '+tier.gems+' GEMS':'');
      return '<div class="season-tier '+(claimed?'is-claimed':ready?'is-ready':'is-locked')+'"><span>TIER '+(i+1)+'</span><div class="season-reward-art">'+(tier.finish?icon('rifle'):tier.badge?icon('badge-'+tier.badge):icon('coin')+(tier.gems?icon('gem'):''))+'</div><strong>'+reward+'</strong><small>'+tier.xp.toLocaleString()+' XP</small><button class="btn '+(ready&&!claimed?'primary':'')+'" data-season-tier="'+i+'" '+(!ready||claimed?'disabled':'')+'>'+(claimed?'CLAIMED':ready?'CLAIM':'LOCKED')+'</button></div>';
    }).join('')+'</div><h2 class="season-mission-heading">SEASON MISSIONS</h2><div class="season-missions">'+season.missions.map(m=>{
      const claimed=progress.missionClaims.includes(m.id),amount=Math.min(m.target,progress[m.id]),ready=amount>=m.target;
      return '<div class="season-mission"><div><strong>'+escape(m.name)+'</strong><small>'+amount+' / '+m.target+' · +'+m.xp+' SEASON XP</small><progress value="'+amount+'" max="'+m.target+'"></progress></div><button class="btn '+(ready&&!claimed?'primary':'')+'" data-season-mission="'+escape(m.id)+'" '+(!ready||claimed?'disabled':'')+'>'+(claimed?'CLAIMED':ready?'CLAIM':'IN PROGRESS')+'</button></div>';
    }).join('')+'</div><p class="daily-reset">'+(now<season.endsAt?'SEASON XP FROM COMPLETED PUBLIC MATCHES':'SEASON ENDED · CLAIM EARNED REWARDS BEFORE THE DEADLINE')+'</p>'; 
  }
  show('tasks','Season',body);
}
function wallet() {
  show(
    "wallet",
    "Coins",
    '<div class="currency-balance"><span class="coin"></span><b>'+profile.coins.toLocaleString()+'</b><span>YOUR COINS</span></div><div class="daily-gift"><span class="gift-coins" aria-hidden="true"><span class="coin"></span></span><div><small>DAILY GIFT</small><h2>200 FREE COINS</h2></div><button class="btn primary" data-action="dailycoins" '+(canClaimCoins(profile,saves.now())?'':'disabled')+'>'+(canClaimCoins(profile,saves.now())?'CLAIM':'CLAIMED')+'</button></div><div class="coin-packs">'+COIN_PACKS.map((pack,i)=>'<article class="coin-pack"><div class="coin-pile pile-'+i+'" aria-hidden="true">'+Array.from({length:3+i*2},()=>'<i></i>').join('')+'</div><h2>'+pack.coins.toLocaleString()+'</h2><span>COINS</span><button class="btn gem-price" data-exchange="'+pack.id+'" aria-label="Exchange '+pack.gems+' gems for '+pack.coins+' coins" '+(profile.gems<pack.gems?'disabled':'')+'>'+icon('gem')+pack.gems+'</button></article>').join('')+'</div><div class="gem-note">'+icon('gem')+profile.gems+' GEMS · EARN FROM DAILY CHALLENGES & THE GOLDEN WHEEL</div>',
  );
}
function wheel(kind=wheelKind, spinning=false) {
  clearTimeout(wheelTimer);
  const pending=profile.wheels?.pending;
  wheelKind=pending?.kind || kind;wheelSpinning=spinning;
  const golden=wheelKind==='golden',status=wheelStatus(profile,wheelKind,saves.now()),prizes=WHEEL_PRIZES[wheelKind];
  const turn=pending ? 360*5 + 360-(pending.index*45+22.5) : 0;
  show('wheel','Spin wheel','<nav class="wheel-tabs"><button data-wheel-kind="daily" aria-pressed="'+!golden+'" '+(pending?'disabled':'')+'>DAILY COINS</button><button data-wheel-kind="golden" aria-pressed="'+golden+'" '+(pending?'disabled':'')+'>WEEKLY GEMS</button></nav><div class="wheel-scene '+(golden?'golden':'')+'"><div class="wheel-pointer"></div><div class="prize-wheel '+(spinning?'is-spinning':'')+'" style="--turn:'+turn+'deg;'+(!spinning&&pending?'transform:rotate('+turn+'deg)':'')+'">'+prizes.map((amount,i)=>'<div class="wheel-wedge" style="--angle:'+(i*45+22.5)+'deg"><b>'+amount+'</b><span>'+icon(golden?'gem':'coin')+'</span></div>').join('')+'</div><div class="wheel-hub">'+icon(golden?'gem':'target')+'</div></div><div class="wheel-info"><span class="eyeline">'+(golden?'GOLDEN WHEEL':'DAILY WHEEL')+'</span><h2>'+(pending&&!spinning?'+'+pending.amount+' '+pending.currency.toUpperCase():golden?'GEMS AWAIT':'TAKE A SPIN')+'</h2><p>'+(spinning?'':pending?'LUCKY SHOT!':status.ready?golden?'ONE FREE SPIN EVERY 7 DAYS':'ONE FREE SPIN EVERY DAY':'NEXT SPIN IN '+(status.remaining>86400000?Math.ceil(status.remaining/86400000)+' DAYS':Math.max(1,Math.ceil(status.remaining/3600000))+' HOURS'))+'</p>'+(pending&&!spinning?button('COLLECT','collectwheel','primary'):'<button class="btn primary" data-action="spin" '+(!status.ready||spinning?'disabled':'')+'>'+(spinning?'SPINNING…':status.ready?'FREE SPIN':'COME BACK LATER')+'</button>')+'<small>Each segment: 12.5% chance</small>'+(!golden&&!pending?'<div class="extra-spins"><button class="btn gem-price" data-action="paidspin" '+(spinning||profile.gems<EXTRA_SPIN_GEMS?'disabled':'')+'>EXTRA SPIN · '+icon('gem')+EXTRA_SPIN_GEMS+'</button><small>Spend gems for another coin spin</small></div>':'')+'</div>');
  if(spinning)wheelTimer=setTimeout(()=>{if(screen==='wheel'){wheel(wheelKind);uiProfile();}},settings.reducedMotion?220:4100);
}
function storefront() {
  collectionInventory=false;
  show('store','Shop','<div class="shop-showcase">'+[['skins','SNIPER RIFLES','sunbolt'],['clothing','COSTUMES','inferno'],['accessories','HEADGEAR','tesla-halo'],['shoes','SHOES','glacier-boots']].map(([cat,label,id])=>'<button class="shop-department '+cat+'" data-category="'+cat+'"><img '+(cat==='skins'?'data-rifle-thumb="'+id+'"':'data-character-thumb="'+cat+':'+id+'"')+' alt=""><strong>'+label+'</strong><span>EXPLORE →</span></button>').join('')+'</div>');
  void import('./weapon-preview.js').then(m=>m.fillRifleThumbnails(content));
  void import('./stage.js').then(m=>m.fillCharacterThumbnails(content));
}
async function collection(cat = selectedCategory, id, inventory = false) {
  const oldGridScroll=selectedCategory===cat?content.querySelector('.gear-grid')?.scrollTop||0:0;
  collectionInventory = inventory;
  selectedCategory = cat;
  if (cat === "skins") {
    void inspect(id || profile.equipped.skins, true);
    return;
  }
  stopInspect();
  const version = inspectVersion;
  selectedCategory = cat;
  const items = inventory ? goods[cat].filter(item=>profile.owned.includes(item[0])) : goods[cat];
  const item = items.find((x) => x[0] === id) ||
    items.find((x) => x[0] === profile.equipped[cat]) || items[0];
  selection = item[0];
  const itemMeta=wardrobeById(item[0]);
  const effectNames={flame:'EMBER EFFECT',frost:'FROST VAPOUR',arc:'ELECTRIC SPARKS',void:'SHADOW MIST',embers:'GOLDEN MOTES'};
  show(
    inventory ? "inventory" : "shop",
    inventory ? "Inventory" : (cat==='clothing'?'Costume':cat==='shoes'?'Shoe':categories[cat]) + " shop",
    shopTabs(cat) +
      '<div class="wardrobe-stage"><canvas id="character-preview" aria-label="Character equipment preview"></canvas></div>' +
      '<div class="wardrobe-pick"><header class="wardrobe-summary"><h2>' + item[1] + '</h2>'+(itemMeta?'<small>'+effectNames[itemMeta.effect]+'</small>':'')+
      (profile.equipped[cat] === item[0]
        ? '<span class="equipped-label">Equipped</span>'
        : profile.owned.includes(item[0]) ? button("Equip", "equip", "primary") : button(item[2].toLocaleString()+" COINS · UNLOCK", "buy", "primary")) +
      '</header><div class="gear-grid" role="group" aria-label="Choose '+escape(categories[cat])+'">' +
      items.map((x) =>
        '<button class="gear-choice ' + (x === item ? "active" : "") +
        '" data-item="' + x[0] + '" aria-pressed="' + (x === item) + '" style="--gear-color:' + gearColor(x[0]) + '"><span><img data-character-thumb="'+cat+':'+x[0]+'" alt="">' +
        "</span><b>" + x[1] + "</b>" +
        (profile.equipped[cat] === x[0] ? "<small>✓</small>" : !profile.owned.includes(x[0]) ? '<small>'+x[2]+' COINS</small>' : "") +
        "</button>"
      ).join("") + "</div></div>",
  );
  content.querySelector('.gear-grid').scrollTop=oldGridScroll;
  try {
    const { createCharacterPreview, fillCharacterThumbnails } = await import("./stage.js");
    if (version !== inspectVersion) return;
    const preview = await createCharacterPreview(
      $("#character-preview"),
      () => ({ ...profile.equipped, [cat]: item[0] }),
      { ...settings, previewFocus: cat },
    );
    if (version !== inspectVersion) {
      preview.dispose();
      return;
    }
    characterPreview = preview;
    void fillCharacterThumbnails(content);
  } catch (e) {
    if (version === inspectVersion) notify("Character preview unavailable");
  }
}

function gearColor(id) {
  const item=wardrobeById(id);if(item)return '#'+item.color.toString(16).padStart(6,'0');
  return ({ cobalt: "#459dff", ember: "#f18051", lime: "#9fce53", arctic: "#dcebf1", desert: "#d4b589", shadow: "#82949f",
    sky: "#53d5f4", blaze: "#f0b15b", violet: "#b092ef", headset: "#8aaca6", cap: "#b0b9a2", mask: "#8d9ba7",
    runner: "#77b9e6", tactical: "#7e9678", alpine: "#d3dce3", crimson: "#ed6e80" })[id] || "#9ac9de";
}

async function inspect(id = profile.equipped.skins, fromShop = false, trialFinish = null) {
  const railPosition=screen==='arsenal'?content.querySelector('.weapon-grid')?.scrollLeft||0:0;
  shopArmory = fromShop;
  stopInspect();
  const version = inspectVersion;
  const selected = weaponById(
    typeof id === "string" ? id : profile.equipped.skins,
  );
  previewWeapon = selected.id;
  const finish=trialFinish||settings.finishes[selected.id]||'field';
  const offer=finishOffer(profile,selected.id,finish);
  const finishChoices=[['field','Field',0],...[...skinsForRifle(selected.id),...SEASON_RIFLE_SKINS.filter(s=>s.weapon===selected.id)].map(skin=>[skin.id,skin.name,skin.price]),['gold','Mastery Gold',0]];
  const legacy=goods.wraps.find(item=>item[0]==='wrap-'+finish);
  if(legacy&&!rifleSkinById(finish))finishChoices.push([finish,legacy[1],legacy[2]]);
  const riflePrice=goods.skins.find(item=>item[0]===selected.id)?.[2]||0;
  show(
    "arsenal",
    fromShop ? collectionInventory ? "Your rifles" : "Rifle shop" : "Sniper rifles",
    (fromShop ? shopTabs("skins") : "") +
      '<div class="weapon-stage"><canvas id="weapon-preview" aria-label="' +
      selected.name +
      ' rotatable rifle preview"></canvas><span>Drag to rotate</span></div>' +
      '<aside class="rifle-details" aria-label="Rifle information"><div class="rifle-identity"><h2>' + selected.name + '</h2></div>'+
      (profile.equipped.skins===selected.id?'':!profile.owned.includes(selected.id)?'<button class="btn primary" data-buy-rifle="'+selected.id+'">UNLOCK RIFLE · '+riflePrice.toLocaleString()+' COINS</button>':'<button class="btn primary" data-equip-weapon="'+selected.id+'">EQUIP RIFLE</button>')+
      '<section class="finish-selection"><header><h3>SKINS</h3></header><div class="finish-choices">'+finishChoices.map(([id,name,cost])=>'<button data-preview-finish="'+id+'" data-preview-rifle="'+selected.id+'" aria-pressed="'+(finish===id)+'"><i class="wrap-swatch wrap-'+(rifleSkinById(id)?.family||id)+'"></i><span>'+name+'</span></button>').join('')+'</div><div class="finish-offer '+(finish==='gold'?'gold-offer':'')+'"><h3>'+escape(offer.name)+'</h3>'+
      (offer.action==='rifle'?'':offer.action==='season'?'<button class="btn primary" data-action="season">EARN IN SEASON</button>':offer.action==='buy'?'<button class="btn primary" data-buy-wrap="'+offer.item+'" data-buy-category="'+offer.category+'" data-wrap-weapon="'+selected.id+'">' +(finish==='gold'?'BUY GOLD':'BUY SKIN')+' · '+offer.price.toLocaleString()+' COINS</button>':offer.action==='equipped'?'<span class="skin-equipped-status">Equipped</span>':'<button class="btn primary" data-equip-finish="'+finish+'" data-wrap-weapon="'+selected.id+'">EQUIP SKIN</button>')+'</div></section>'+
      '</aside>'+
      '<div class="weapon-grid">' +
      WEAPONS.map((w) =>
        '<button class="weapon-choice ' +
        (w.id === selected.id ? "selected" : "") + '" data-weapon="' + w.id +
        '" aria-pressed="' + (w.id === selected.id) + '"><span class="weapon-silhouette"><img data-rifle-thumb="' + w.id + '" alt=""></span><strong>' + w.name + "</strong>" +
        (w.id === profile.equipped.skins ? "<small>Equipped</small>" : !profile.owned.includes(w.id)?"<small>🔒 "+(goods.skins.find(item=>item[0]===w.id)?.[2]||0).toLocaleString()+" COINS</small>":"<small>Owned</small>") +
        "</button>"
      ).join("") + "</div>",
  );
  modal.classList.toggle("shop-armory", fromShop);
  const rail=content.querySelector('.weapon-grid');
  content.scrollTop=0;modal.scrollTop=0;
  rail.scrollLeft=railPosition;
  const chosen=rail.querySelector('[aria-pressed="true"]');
  if(chosen){const left=chosen.offsetLeft-rail.offsetLeft;if(left<rail.scrollLeft)rail.scrollLeft=left;else if(left+chosen.offsetWidth>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=left+chosen.offsetWidth-rail.clientWidth;}
  rail.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;const before=rail.scrollLeft;rail.scrollLeft+=event.deltaY*(event.deltaMode===1?20:event.deltaMode===2?rail.clientWidth:1);if(rail.scrollLeft!==before)event.preventDefault();},{passive:false});

  try {
    const { createWeaponPreview, fillRifleThumbnails } = await import("./weapon-preview.js");
    if (version !== inspectVersion) return;
    gunPreview = createWeaponPreview($("#weapon-preview"), selected.id, {...settings,finishes:{...settings.finishes,[selected.id]:finish}});
    void fillRifleThumbnails(content);
  } catch {
    if (version === inspectVersion) {
      $("#weapon-preview").outerHTML = '<img src="assets/rifle.png" alt="' +
        selected.name + ' rifle">';
    }
  }
}

function settingValue(key) {
  return ["volume", "musicVolume", "effectsVolume", "shake"].includes(key) ? Math.round(settings[key] * 100) + "%"
    : key === "reticle" ? settings[key] + "px" : Number(settings[key]).toFixed(2);
}
function settingRange(key, name, min, max, step) {
  return '<label class="setting-row"><span>' + name + '</span><input aria-label="' + name + '" type="range" data-setting="' + key +
    '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + settings[key] +
    '" style="--fill:' + (settings[key] - min) / (max - min) * 100 + '%"><output>' + settingValue(key) + '</output></label>';
}
function settingToggle(key, name) {
  return '<label class="setting-row toggle-row"><span>' + name + '</span><input aria-label="' + name + '" type="checkbox" data-setting="' + key + '" ' +
    (settings[key] ? 'checked' : '') + '><span class="toggle-state" aria-hidden="true"></span></label>';
}
function settingsView(tab = settingsTab) {
  settingsTab = ["aim", "audio", "video"].includes(tab) ? tab : "aim";
  const panes = {
    aim: '<div class="settings-options"><h2>Aim & controls</h2>' +
      settingRange("sensitivity", "Mouse sensitivity", .2, 3, .1) + settingRange("adsSensitivity", "Scope sensitivity", .1, 1.5, .05) +
      settingRange("reticle", "Reticle thickness", 1, 4, 1) + settingToggle("invertY", "Invert vertical aim") +
      '</div><aside class="settings-preview"><div class="aim-preview" style="--aim-size:' + settings.reticle + 'px"><div class="sr-center"><i></i><i></i><i></i><i></i><em></em></div></div><span>CROSSHAIR</span></aside>',
    audio: '<div class="settings-options"><h2>Sound</h2>' + settingRange("volume", "Master volume", 0, 1, .05) + settingRange("musicVolume", "Music", 0, 1, .05) + settingRange("effectsVolume", "Sound effects", 0, 1, .05) +
      '<div class="sound-check"><span>' + icon("sound") + '</span>' + button('Play elimination sound', 'testcue') + '</div></div>' +
      '<aside class="settings-preview audio-preview">' + icon("sound") + '<span>GAME AUDIO</span></aside>',
    video: '<div class="settings-options"><h2>Graphics & motion</h2><div class="quality-choices" aria-label="Graphics quality">' +
      QUALITY_CHOICES.map(([id, name]) =>
        '<button data-quality="' + id + '" aria-pressed="' + (settings.quality === id) + '"><i></i><b>' + name + '</b></button>'
      ).join('') + '</div>' + settingRange("shake", "Camera shake", 0, 1, .05) + settingToggle("reducedMotion", "Reduced motion") +
      (lastPerformance.samples ? '<p class="last-performance">Last session · ' + escape(lastPerformance.quality) +
        '<br>Frame time ' + Number(lastPerformance.p50Ms).toFixed(1) + ' ms median · ' + Number(lastPerformance.p95Ms).toFixed(1) + ' ms p95' +
        (lastPerformance.network ? '<br>Server RTT ' + Number(lastPerformance.network.p50Ms).toFixed(0) + ' ms median · ' + Number(lastPerformance.network.p95Ms).toFixed(0) + ' ms p95' : '') + '</p>' : '') +
      '</div><aside class="settings-preview quality-preview">' + icon("target") + '<span>' + String(settings.quality).toUpperCase() + '</span></aside>',
  };
  show("settings", "Settings", '<nav class="settings-nav" aria-label="Settings categories">' +
    [["aim", "Aim", "target"], ["audio", "Audio", "sound"], ["video", "Video", "gear"]].map(([id, label, glyph]) =>
      '<button data-settings-tab="' + id + '" aria-pressed="' + (settingsTab === id) + '"><span>' + icon(glyph) + '</span>' + label + '</button>'
    ).join('') + '</nav><section class="settings-pane">' + panes[settingsTab] + '</section><div class="settings-actions">' +
    button("Key bindings", "controls") + button("Done", "close", "primary") + '</div>');
}
function controls() {
  show(
    "controls",
    "Controls",
    '<p class="controls-note">Click a binding, then press a key to change it.</p><div class="controls-bindings">' +
      Object.entries(bindings).map(([k, [n, def]]) =>
        '<div class="key-row">' + n + '<button aria-label="' + n + ' key binding: ' + escape(keyLabel(settings.bindings[k] || def)) + '" data-bind="' + k + '">' +
        escape(keyLabel(settings.bindings[k] || def)) +
        "</button></div>"
      ).join("") +
      '</div><aside class="controls-fixed"><h2>Combat controls</h2><div class="detail-list"><div class="detail">Fire<strong>LMB</strong></div><div class="detail">Hold scope<strong>RMB</strong></div><div class="detail">Sniper / knife / grenade<strong>1 / 2 / 3</strong></div><div class="detail">Charge / throw grenade<strong>Hold / release LMB</strong></div><div class="detail">Scoreboard<strong>Tab</strong></div><div class="detail">Pause<strong>Esc</strong></div><div class="detail">Loadout<strong>B</strong></div><div class="detail">Alternate crouch<strong>C</strong></div></div>' +
      button("Reset bindings", "reset") + '</aside>',
  );
}
function mapShot(map) {
  return '<img class="map-shot" src="/assets/maps/' + map.id + '.jpg" alt="' +
    escape(map.name) + ' in-game arena" loading="lazy" width="320" height="180">';
}
function maps() {
  show(
    "maps",
    "Practice arenas",
    '<div class="tiles">' +
      MAPS.map((m) =>
        '<div class="map-card">' + mapShot(m) + '<b class="map-title">' +
        escape(m.name) + '</b><button class="btn primary" data-practice-map="' + m.id + '" aria-label="Practice on ' + escape(m.name) + '">PLAY</button></div>'
      ).join("") + "</div>" + button("Play online", "online", "primary"),
  );
}
function social() {
  show(
    "social",
    "Play with friends",
    '<div class="squad-choices"><button class="squad-card host" data-action="create"><div class="squad-art">'+icon('friends')+'</div><strong>CREATE ROOM</strong><small>HOST YOUR MATCH</small></button><button class="squad-card join" data-action="joincode"><div class="squad-art">'+icon('target')+'</div><strong>JOIN ROOM</strong><small>ENTER A CODE</small></button></div>',
  );
}
function joinCode() {
  show(
    "join",
    "Join squad",
    '<form class="join-game-code" id="join-form"><label for="room-code">Enter your six-character room code</label><input id="room-code" type="text" name="code" aria-label="Room code" placeholder="— — — — — —" required minlength="6" maxlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" spellcheck="false"><label class="formrow">Spectate<input type="checkbox" name="spectator"></label><button class="btn primary">Join room →</button></form>',
  );
}

function statusError(message, practice = false) {
  show(
    "error",
    "Connection issue",
    '<p class="error">' + escape(message) + '</p><div class="row">' +
      button("Try again", practice ? "online" : "social") +
      (practice ? button("Play practice", "practice", "primary") : "") +
      "</div>",
  );
}
async function connect(type, code, spectator = false) {
  const leaving = leaveRoom();
  const generation = requestGeneration;
  await leaving;
  if(generation!==requestGeneration)return;
  show(
    "connect",
    type === "online" ? "Play online" : "Private room",
    '<p><i class="pending"></i>Connecting to the arena…</p>',
  );
  try {
    await saves.refresh();
    if(generation!==requestGeneration)return;
    const net = await import("./net.js");
    const joined = await (type === "online"
      ? net.joinPublic(profile.name, profile.equipped.skins, profile.badge, profile.equipped)
      : type === "create"
      ? net.createPrivate(profile.name, profile.equipped.skins, profile.badge, profile.equipped)
      : net.joinPrivate(code, profile.name, spectator, profile.equipped.skins, profile.badge, profile.equipped));
    if (generation !== requestGeneration) {
      await joined.leave();
      return;
    }
    session = joined;
    room();
    scheduleRoom();
    return true;
  } catch (error) {
    if (generation === requestGeneration) {
      statusError(error.message, type === "online");
    }
  }
}
function scheduleRoom(delay = 750) {
  stopPolling();
  const active = session;
  if (!active || gameRunning || sessionStarting !== null) return;
  poll = setTimeout(async () => {
    if (session !== active) return;
    try {
      await active.refresh();
      if (session !== active || gameRunning || sessionStarting !== null) return;
      $(".room-link-state")?.remove();
      if (screen === "results") {
        if (active.state.phase !== "results" && active.state.public) room();
        else if (active.state.phase !== "results") { const countdown = $(".results-countdown"); if (countdown) countdown.textContent = "ROOM READY · PLAY AGAIN WHEN READY"; }
        else {
          const countdown = $(".results-countdown");
          if (countdown) countdown.textContent = "NEXT ROUND IN " + Math.max(0, Math.ceil((active.state.endsAt - active.state.serverTime) / 1000)) + "s";
        }
      }
      if (
        screen === "room" && ["warmup", "live"].includes(active.state.phase)
      ) {
        await launch(active);
        return;
      }
      if (
        screen === "room" && roomFingerprint !== fingerprint(active.state) &&
        (!content.contains(document.activeElement) ||
          !["SELECT", "INPUT"].includes(document.activeElement.tagName))
      ) room();
      scheduleRoom();
    } catch (e) {
      if (session === active) {
        if (isRetryable(e) && !isSessionExpired(e)) {
          let status = $(".room-link-state");
          if (!status && modal.open) {
            status = document.createElement("p");
            status.className = "room-link-state";
            status.setAttribute("role", "status");
            content.prepend(status);
          }
          if (status) status.textContent = "Reconnecting to your room…";
          scheduleRoom(recoveryDelay(active.failures));
        } else {
          void leaveRoom();
          statusError(e.message, active.state.public);
        }
      }
    }
  }, delay);
}
async function restoreRoom(preferredCode = null, instant = false) {
  const generation = requestGeneration;
  try {
    const net = await import("./net.js");
    const restored = await net.resumeSession(preferredCode);
    if (!restored) {
      if (preferredCode && generation === requestGeneration) void connect("join", preferredCode);
      else if (instant && generation === requestGeneration) void connect("create");
      return;
    }
    if (generation !== requestGeneration || gameRunning || session) return;
    session = restored;
    room();
    scheduleRoom();
  } catch (error) {
    if (generation !== requestGeneration) return;
    show("error", "Reconnect to match", '<p>' + escape(error.message) + '</p><div class="row">' +
      button("Reconnect", "reconnect", "primary") + button("Lobby", "close") + '</div>');
  }
}
function roomChoices(key, conf) {
  return key==='duelRule' ? [['time','TIME LIMIT'],['points','TARGET POINTS']]
    : key==='targetPoints' ? [5,10,15,20,30,50].map(n=>[n,n+' POINTS'])
    : key==='mode' ? [['ffa','FREE FOR ALL'],['duel','1 VS 1'],['tdm','TEAMS'],['arms','ARMS RACE'],['ctf','CAPTURE FLAG']]
    : key==='map' ? MAPS.map(map=>[map.id,map.name])
    : key==='duration' ? (['tdm','ctf'].includes(conf.mode)?[5,10,15]:[3,5,10,15,20]).map(n=>[n,n+' MIN'])
    : (conf.mode==='duel'?[2]:['tdm','ctf'].includes(conf.mode)?[4,6,8,10]:Array.from({length:14},(_,i)=>i+2)).map(n=>[n,String(n)]);
}
function fingerprint(s) {
  return JSON.stringify([
    s.public,
    s.phase,
    s.settings,
    s.host,
    s.players.map((p) => [p.id, p.name, p.ready, p.team, p.weapon, p.gear]),
    s.votes,
    s.endsAt ? Math.ceil((s.endsAt - s.serverTime) / 1000) : 0,
  ]);
}
function room(arenaTransition = null) {
  if (!session) return;
  const s = session.state;
  roomFingerprint = fingerprint(s);
  const me = s.players.find((p) => p.id === session.id),
    host = s.host === session.id,
    conf = s.settings;
  const participantCount = s.players.filter((p) => !p.spectator).length;
  const seconds = Math.max(0, Math.ceil((s.endsAt - s.serverTime) / 1000));
  publishRoom(s);
  if (s.public && s.phase === 'waiting') {
    const players = s.players.filter(p => !p.spectator);
    const slots = Array.from({length: conf.capacity}, (_, i) => {
      const player = players[i];
      return '<li class="queue-slot '+(player ? 'occupied' : 'empty')+(player?.id === session.id ? ' is-you' : '')+'">' +
        '<span class="queue-avatar" aria-hidden="true">'+(player?'<img data-queue-player="'+escape(player.id)+'" alt="" hidden>'+icon('friends'):icon('friends'))+'</span><span class="queue-name">'+
        (player ? escape(player.name)+(player.id === session.id ? ' <small>YOU</small>' : '') : 'OPEN SLOT')+'</span></li>';
    }).join('');
    show('room', 'Matchmaking', '<section class="queue-lobby" aria-label="Matchmaking lobby">'+
      '<div class="queue-header"><div><span class="eyeline">FREE FOR ALL</span><h2>SEARCHING FOR PLAYERS</h2></div>'+
      '<div class="queue-count" role="status" aria-live="polite"><strong>'+players.length+'</strong><span> / '+conf.capacity+' PLAYERS</span></div></div>'+
      '<div class="queue-track" aria-hidden="true"><span style="width:'+(100*players.length/conf.capacity)+'%"></span></div>'+
      '<ul class="queue-slots" aria-label="Players joined">'+slots+'</ul>'+
      '<div class="queue-footer"><span>MAP VOTING STARTS WHEN THE LOBBY IS FULL</span>'+button('CANCEL SEARCH','close')+'</div></section>');
    modal.classList.add('public-queue');
    // Spread small renders across frames and discard work for replaced lobby views.
    const portraits=[...content.querySelectorAll('[data-queue-player]')];
    const drawNext=()=>{
      const image=portraits.shift();if(!image||!image.isConnected||!stage)return;
      const player=players.find(p=>p.id===image.dataset.queuePlayer);
      if(player?.gear) { try { const src=stage.portrait({...player.gear,skins:player.weapon});if(src){image.src=src;image.hidden=false;if(image.nextElementSibling)image.nextElementSibling.style.display='none';} } catch {} }
      if(portraits.length)requestAnimationFrame(drawNext);
    };
    if(portraits.length)requestAnimationFrame(drawNext);
    return;
  }
  if (s.phase === "warmup" || s.phase === "live") {
    void launch(session, null, null, arenaTransition);
    return;
  }
  if (s.public && s.phase === 'vote') {
    const cards = MAPS.map(m => {
      const selected = s.votes[session.id] === m.id;
      const count = Object.values(s.votes).filter(v => v === m.id).length;
      return '<button class="vote-card'+(selected?' selected':'')+'" data-vote="'+escape(m.id)+'" aria-pressed="'+selected+'">'+
        '<img class="map-shot vote-preview" data-arena="'+escape(m.id)+'" alt="'+escape(m.name)+' arena">'+'<span class="vote-card-info"><strong>'+escape(m.name)+'</strong><small>'+escape(m.description)+'</small>'+
        '<span class="vote-total">'+count+' '+(count === 1 ? 'VOTE' : 'VOTES')+(selected?' · YOUR VOTE':'')+'</span></span></button>';
    }).join('');
    show('room','Map voting','<section class="vote-screen" aria-label="Choose your battleground">'+
      '<div class="vote-header"><div><span class="eyeline">FREE FOR ALL · '+participantCount+' PLAYERS</span><h2>CHOOSE YOUR BATTLEGROUND</h2></div>'+
      '<div class="vote-clock" role="timer" aria-label="Voting time remaining">'+seconds+'<small> SEC</small></div></div>'+
      '<div class="vote-cards">'+cards+'</div><div class="vote-footer">SELECT A MAP · CHANGE YOUR VOTE BEFORE TIME RUNS OUT</div></section>');
    modal.classList.add('public-vote');
    const previews = [...content.querySelectorAll('.vote-preview')];
    void import('./map-preview.js').then(({mapThumbnail}) => {
      for (const preview of previews) void mapThumbnail(preview.dataset.arena).then(src => {
        if (preview.isConnected) preview.src = src;
      }).catch(() => { if (preview.isConnected) preview.alt = 'Arena preview unavailable'; });
    }).catch(() => { for (const preview of previews) if (preview.isConnected) preview.alt = 'Arena preview unavailable'; });
    return;
  }
  let html = s.public
    ? '<div class="split"><h2>' + (s.phase === "vote"
      ? "Vote for a map"
      : s.phase === "results"
      ? "Round complete"
      : "Waiting for players") +
      "</h2><b>" + s.players.length + " / " + conf.capacity + "</b></div>"
    : '<div class="split room-top"><div><span class="eyeline">Room code</span><div class="room-code">' +
      escape(s.code) + "</div></div>" + button("Copy invite link", "copy") +
      "</div>";
  if (s.phase === "vote") {
    html += "<p>Voting closes in " + seconds + 's.</p><div class="tiles">' +
      MAPS.map((m) =>
        '<button class="tile ' +
        (s.votes[session.id] === m.id ? "active" : "") + '" data-vote="' +
        m.id + '" aria-pressed="' + (s.votes[session.id] === m.id) + '">' + mapShot(m) + m.name + "<small>" +
        Object.values(s.votes).filter((v) => v === m.id).length +
        " votes</small></button>"
      ).join("") + "</div>";
  }
  if (s.phase === "results") {
    html += "<p>The next round opens in " + seconds + "s.</p>";
  }
  if (!s.public && host && s.phase === "waiting") {
    const choices = (key,label) => {
      const opts=roomChoices(key,conf),selected=opts.find(([value])=>String(value)===String(conf[key]))||opts[0];
      return '<div class="room-choice '+(key==='map'?'room-map-choice':'')+'">'+(key==='map'?'<canvas class="room-map-render" aria-label="'+escape(selected[1])+' arena preview"></canvas>':'')+'<span>'+label+'</span><div class="choice-control"><button data-room-step="'+key+':-1" aria-label="Previous '+label+'" '+(opts.length<2?'disabled':'')+'>‹</button><strong>'+escape(selected[1])+'</strong><button data-room-step="'+key+':1" aria-label="Next '+label+'" '+(opts.length<2?'disabled':'')+'>›</button></div></div>';
    };
    html += '<div class="detail-list room-config"><div class="mode-picks" aria-label="Game mode">'+roomChoices('mode',conf).map(([value,label])=>'<button data-config-choice="mode:'+value+'" aria-pressed="'+(value===conf.mode)+'">'+label+'</button>').join('')+'</div>'+choices('map','Map')+'<div class="room-numbers">'+(conf.mode==='duel'?choices('duelRule','Win condition'):'')+(conf.mode==='duel'&&conf.duelRule==='points'?choices('targetPoints','Target points'):choices('duration','Match time'))+choices('capacity','Players')+'</div><div class="room-toggles">'+
      [
        ["locked", "Lock room"],
        ["spectators", "Allow spectators"],
        ...(["tdm","ctf"].includes(conf.mode) ? [["autoAssign", "Auto-assign teams"]] : []),

      ].map(([key, label]) =>
        '<label class="formrow">' + label +
        '<input type="checkbox" data-config="' + key + '" ' +
        (conf[key] ? "checked" : "") + "></label>"
      ).join("") + "</div></div>";
  }
  if (!s.public && !host) {
    html += '<p class="room-summary">' + escape(conf.mode.toUpperCase()) + " · " + escape(conf.map) +
      " · " + conf.duration + " min · " + participantCount + " / " +
      conf.capacity + " players</p>";
  }
  html += '<ul class="roster room-roster" aria-label="Room players">' +
    s.players.map((p) =>
      "<li><b>" + escape(p.name) + (p.id === session.id ? " (you)" : "") +
      "</b><span>" + (p.team ? escape(p.team) + " · " : "") +
      (p.spectator ? "Spectating" : p.ready ? "<em>Ready</em>" : p.id === s.host ? "Host" : "In room") +
      "</span>" + (!s.public && host && p.id !== session.id
        ? '<button class="btn danger" data-kick="' + escape(p.id) +
          '">Remove</button>'
        : "") +
      "</li>"
    ).join("") + (!s.public && s.phase==='waiting' && !me?.spectator && !conf.locked && participantCount<conf.capacity
      ? '<li class="room-friends"><button class="btn" data-action="roomfriends">Invite a friend</button><div class="room-friend-list" hidden></div></li>' : '') + "</ul>";
  if (!s.public && s.phase === "waiting" && !me?.spectator) {
    const canQueueParty = participantCount >= 2 && s.players.every(p => p.ready && !p.spectator);
    html += '<div class="row room-actions">' +
      button(me?.ready ? "Unready" : "Ready up", "ready", "primary") +
      (host ? '<button class="btn" data-action="queueparty" '+(canQueueParty?'':'disabled')+'>Queue public FFA</button>' : '') +
      (host ? button("Start match", "start") : "") +
      (["tdm","ctf"].includes(conf.mode) ? button("Switch team", "team") : "") + "</div>";
  }
  if (me?.spectator && s.phase === "waiting") html += '<p class="room-note">You will watch when the host starts the match.</p>';
  show("room", s.public ? "Play online" : "Private lobby", html);
  modal.classList.toggle("private-room", !s.public);
  const mapCanvas=content.querySelector('.room-map-render'),previewEpoch=roomMapEpoch;
  if(mapCanvas)void import('./map-preview.js').then(({createMapPreview})=>{
    if(previewEpoch!==roomMapEpoch||!mapCanvas.isConnected)return;
    roomMapPreview=createMapPreview(mapCanvas,conf.map);
  }).catch(()=>{if(previewEpoch===roomMapEpoch)mapCanvas.setAttribute('aria-label','Arena preview unavailable');});
}
function publishRoom(state) {
  if (!sdk) return;
  if (state.public) {
    if (roomPresence) sdkCall("leftRoom");
    roomPresence = "";
    return;
  }
  const joinable = !state.settings.locked && state.players.filter((p) => !p.spectator).length < state.settings.capacity;
  const presence = state.code + joinable;
  if (presence === roomPresence) return;
  roomPresence = presence;
  sdkCall("updateRoom", { roomId: state.code, isJoinable: joinable, inviteParams: { room: state.code } });
}
async function act(type, data = {}) {
  const active = session;
  if (!active) return;
  try {
    await active.action(type, data);
    if (session === active && !gameRunning) room();
  } catch (e) {
    notify(e.message);
    if (session === active) room();
  }
}
async function invite() {
  if (!session) return;
  const url = new URL(location.href);
  url.searchParams.set("room", session.code);
  let link = url.href;
  try {
    if (sdk) link = await sdk.game.inviteLink({ room: session.code }) || link;
    await navigator.clipboard.writeText(link);
    notify("Invite link copied");
  } catch {
    const input = document.createElement("input");
    input.type = "text";
    input.value = link;
    input.setAttribute("aria-label", "Invite link");
    content.append(input);
    input.select();
  }
}
async function showRoomFriends() {
  const list=content.querySelector('.room-friend-list');
  if(!list||!session)return;
  if(!list.hidden){list.hidden=true;return;}
  list.hidden=false;
  list.textContent='Loading friends…';
  try {
    const {friends}=await requestFriends('list');
    if(!list.isConnected)return;
    list.innerHTML=friends.length?friends.slice().sort((a,b)=>Number(b.online)-Number(a.online))
      .map(friend=>'<div><span>'+escape(friend.name)+(friend.online?' · Online':'')+'</span><button class="btn" data-room-invite-player="'+escape(friend.playerId)+'" aria-label="Invite '+escape(friend.name)+'">Invite</button></div>').join('')
      :'Add a player from your Friends tab first.';
  }catch(error){if(list.isConnected)list.textContent=error.message;}
}
async function inviteRoomFriend(button) {
  if(!session||button.disabled)return;
  button.disabled=true;
  try{
    await requestFriends('roominvite',{roomCode:session.code,playerId:button.dataset.roomInvitePlayer});
    button.textContent='Sent';
  }catch(error){
    button.disabled=false;
    notify(error.message);
  }
}
async function practiceArena(id = null) {
  const leaving=leaveRoom(),generation=requestGeneration;
  await leaving;
  if(generation===requestGeneration)await launch(null,null,id);
}
async function launch(active, queue = null, practiceMap = null, arenaTransition = null) {
  if (gameRunning || sessionStarting === requestGeneration) return;
  const generation=requestGeneration;
  sessionStarting = generation;
  stopPolling();
  if(screen==='results')stopResults();
  roomMapEpoch++;roomMapPreview?.dispose();roomMapPreview=null;
  modal.close();
  stopInspect();
  try {
    const { startGame } = await import("./game.js");
    if (generation!==requestGeneration || active && active !== session || queue && queue !== session) return;
    gameRunning = true;
    stage?.setActive(false);
    screen = "game";
    $("#lobby").hidden = true;
    $("#game").hidden = false;
    gameCleanup = startGame({
      container: $("#game"),
      session: active,
      queueSession: queue,
      practiceMap,
      arenaTransition,
      settings: {
        ...settings,
        audioBuffers: initialAudioBuffers,
        skin: profile.equipped.skins,
        ownedRifles: profile.owned.filter(id=>WEAPONS.some(w=>w.id===id)),
        outfit: profile.equipped.clothing,
        gear: profile.equipped, playerName: profile.name,
        accessory: profile.equipped.accessories,
      },
      onExit: (reason) => {
        endGame(Boolean(reason?.preserveAim));
        if (reason?.preserveRoom && session) {
          room(reason.arenaTransition);
          scheduleRoom();
        } else {
          void leaveRoom();
          if (reason?.connectionError) statusError(reason.connectionError, Boolean(active?.state.public));
        }
      },
      onResults: (r) => {
        endGame();
        results(r, active);
      },
      onWeaponChange: (id) => {if(id!==profile.equipped.skins)void saves.mutate('equip',{category:'skins',item:id}).catch(error=>notify(error.message));},
      onSettingsChange: (changes) => {
        Object.assign(settings, changes);
        if (changes.quality) stage?.setQuality(changes.quality);
        save();
      },
      onPerformance: (report) => {
        lastPerformance = report;
        try { localStorage.setItem("sr.performance.v1", JSON.stringify(report)); } catch {}
      },
      onActivityChange: (value) => sdkLifecycle?.gameplay(value),
      onRoomState: publishRoom,
    });
  } catch (e) {
    if(generation!==requestGeneration)return;
    endGame();
    void leaveRoom();
    show(
      "error",
      "Arena unavailable",
      "<p>" + escape(e.message) + "</p>" + button("Return to lobby", "close"),
    );
  } finally {
    if(sessionStarting===generation)sessionStarting = null;
  }
}
function endGame(preserveAim = false) {
  gameRunning = false;
  stage?.setActive(true);
  gameCleanup?.();
  gameCleanup = null;
  $("#game").replaceChildren();
  if (!preserveAim) {
    if (document.pointerLockElement === $("#game")) document.exitPointerLock();
    $("#game").hidden = true;
    $("#lobby").hidden = false;
  }
  screen = "";
  sdkLifecycle?.gameplay(false);
}
function results(r, active) {
  const publicRound = active?.state.public && !r.practice;
  const rank = r.players.findIndex((p) => p.id === r.playerId) + 1;
  const teamMode = ["Team deathmatch", "Capture the flag"].includes(r.mode);
  const winner = teamMode && r.scores.blue !== r.scores.orange ? (r.scores.blue > r.scores.orange ? "blue" : "orange") : null;
  const podiumPlayers = winner ? r.players.filter((p) => p.team === winner) : r.players;
  const headline = r.practice ? "RANGE COMPLETE" : teamMode ? (winner ? winner.toUpperCase() + " TEAM WINS" : "DRAW") : rank === 1 ? "VICTORY" : rank ? "PLACED #" + rank : "ROUND COMPLETE";
  const replayMap=MAPS.find(m=>m.id===r.mapId||m.name===r.map)?.id||MAPS[0].id;
  const replay=active?button("Next round","rematch","primary"):'<button class="btn primary" data-practice-map="'+escape(replayMap)+'">Play again</button>';
  stopResults(true);
  roundMusic.configure(initialAudioBuffers?.finale, audioLevel(settings,'music')); roundMusic.reveal();
  show(
    "results", r.practice ? "Range results" : "Match results",
    '<div class="victory-scene"><canvas id="results-stage" aria-label="Match winner lineup"></canvas><div class="victory-title"><span>' + escape(r.map) + ' · ' + escape(r.practice ? 'Practice' : r.mode) + '</span><h2>' + headline + '</h2></div>' +
    podiumPlayers.slice(0, 5).map((player, i) => '<article class="victor-card place-' + (i + 1) + '" data-victor="' + i + '"><b class="victor-rank">' + (i + 1) + '</b><h3>' + escape(player.name) + '</h3><dl><dt>Eliminations</dt><dd>' + player.kills + '</dd><dt>Deaths</dt><dd>' + player.deaths + '</dd><dt>Best streak</dt><dd>' + (player.bestStreak ?? player.streak ?? 0) + '</dd></dl></article><div class="victor-weapon" data-victor-weapon="' + i + '"><img data-rifle-thumb="' + escape(player.weapon || profile.equipped.skins) + '" alt=""><strong>' + escape(weaponById(player.weapon).name) + '</strong><small>K/D ' + (player.kills / Math.max(1, player.deaths)).toFixed(1) + ' · ACC ' + (player.shots ? Math.round(player.hits * 100 / player.shots) + '%' : '—') + '</small></div>').join('') +
    '<div class="victory-footer"><div><strong class="results-countdown"></strong><span class="results-rewards">' + (r.practice ? 'PRACTICE' : publicRound ? 'SAVING REWARDS…' : 'PRIVATE MATCH') + '</span></div><div class="row">' + replay + button("Lobby", "close") + '</div></div></div>',
  );
  void import("./weapon-preview.js").then(({ fillRifleThumbnails }) => fillRifleThumbnails(content));
  stage?.setActive(false);
  const version = resultsVersion;
  if(publicRound)void saves.claimRewards().then(reward=>{
    if(version===resultsVersion&&screen==='results')$('.results-rewards').textContent=reward.rounds?'+'+reward.xp+' XP · +'+reward.coins+' COINS':'NO NEW REWARDS';
  }).catch(()=>{if(version===resultsVersion&&screen==='results')$('.results-rewards').textContent='REWARDS PENDING · RECONNECT TO CLAIM';});
  void import("./results-stage.js").then(({ createResultsStage }) => {
    if (version !== resultsVersion || screen !== "results") return;
    resultsStage = createResultsStage($("#results-stage"), podiumPlayers, settings, r.map, (positions) => {
      for (const point of positions) {
        const card = content.querySelector('[data-victor="' + point.place + '"]'), weapon = content.querySelector('[data-victor-weapon="' + point.place + '"]');
        if (card) { card.style.left = point.x + "%"; card.style.top = point.top + "%"; card.style.width = Math.min(23, 83 / Math.min(5, podiumPlayers.length)) + "%"; }
        if (weapon) { weapon.style.left = point.x + "%"; weapon.style.bottom = point.bottom + "%"; weapon.style.width = Math.min(23, 83 / Math.min(5, podiumPlayers.length)) + "%"; }
      }
    });
  }).catch(() => {
    if (version === resultsVersion) $("#results-stage")?.setAttribute("hidden", "");
  });
  if (active) scheduleRoom();
}
const actions = {
  roomfriends: showRoomFriends,
  friends: () => document.querySelector('.tabs [data-tab="friends"]')?.click(),
  profile: profileView,
  recover:()=>recoveryView(),
  recoverykey:()=>profileAction('recoverykey',{},value=>recoveryKeyView(value.result.recoveryCode)),
  rename: renameView,
  wallet,
  shop: storefront,
  skins: inspect,
  clothing: () => collection("clothing"),
  accessories: () => collection("accessories"),
  inventory: () => collection("clothing", null, true),
  loadout: inspect,
  tasks,
  season: () => tasks('season'),
  settings: settingsView,
  controls,
  maps,
  social,
  joincode: joinCode,
  close: closeDialog,
  online: () => connect("online"),
  create: () => connect("create"),
  practice: async () => {
    if (session?.state.public && session.state.phase === "waiting") {
      await launch(null, session, session.state.map); return;
    }
    await practiceArena();
  },
  rematch: async () => {
    if (!session) return connect("online");
    try {
      await session.refresh();
      room();
      scheduleRoom();
    } catch (e) {
      statusError(e.message, true);
    }
  },
  reconnect: () => restoreRoom(new URLSearchParams(location.search).get("room")),
  copy: invite,
  ready: () =>
    act("ready", {
      ready: !session.state.players.find((p) => p.id === session.id)?.ready,
    }),
  start: () => act("start"),
  queueparty: () => act("queueparty"),
  team: () =>
    act("team", {
      team: session.state.players.find((p) =>
          p.id === session.id
        )?.team === "blue"
        ? "orange"
        : "blue",
    }),
  reset: () => {
    settings.bindings = {};
    save();
    controls();
  },
  wheel: () => wheel(),
  paidspin: () => {if(!wheelSpinning)void profileAction('spin',{kind:'daily',paid:true},()=>wheel('daily',true));},
  spin: () => {if(!wheelSpinning)void profileAction('spin',{kind:wheelKind},()=>wheel(wheelKind,true));},
  collectwheel: () => profileAction('collect',{},()=>wheel(wheelKind)),
  dailycoins: () => {const wasTasks=screen==='tasks';return profileAction('dailycoins',{},()=>{notify('+200 COINS');wasTasks?tasks():wallet();});},
  equip: () => {
    if (profile.owned.includes(selection)) {
      const category=selectedCategory,item=selection,inventory=screen==='inventory';
      return profileAction('equip',{category,item},()=>collection(category,item,inventory));
    }
  },
  buy: () => {
    const item = goods[selectedCategory].find((x) => x[0] === selection);
    if (!item || profile.owned.includes(selection)) return;
    if (profile.coins < item[2]) {
      notify(
        "Earn " + (item[2] - profile.coins) + " more coins in public matches",
      );
      return;
    }
    const category=selectedCategory,id=selection;
    return profileAction('buy',{category,item:id},()=>{void collection(category,id);notify('Added to inventory');});
  },
};
let menuAudio, menuOutput, menuCue;
function menuSound(confirm = false) {
  roundMusic.configure(initialAudioBuffers?.finale, audioLevel(settings,'music'));
  if (settings.volume > 0) roundMusic.unlock();
  if (!audioLevel(settings,'effects')) return;
  try {
    if (!menuAudio) {
      menuAudio = new AudioContext();
      menuOutput = gameAudioOutput(menuAudio);
    }
    void menuAudio.resume();
    const oscillator = menuAudio.createOscillator(),
      gain = menuAudio.createGain(),
      t = menuAudio.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(confirm ? 650 : 430, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      confirm ? 980 : 560,
      t + .055,
    );
    gain.gain.setValueAtTime(audioLevel(settings,'effects') * .035, t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .075);
    oscillator.connect(gain);
    gain.connect(menuOutput.input);
    oscillator.start();
    oscillator.stop(t + .08);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch {}
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if(b.dataset.challengePeriod){tasks(b.dataset.challengePeriod);return;}
  if(b.dataset.seasonSelect){selectedSeasonId=b.dataset.seasonSelect;seasonTrack();return;}
  if(b.dataset.seasonMission){const season=claimableSeasons(saves.now()).find(s=>s.id===selectedSeasonId);if(season)void profileAction('seasonmission',{season:season.id,mission:b.dataset.seasonMission},()=>{notify('MISSION REWARD CLAIMED');seasonTrack();});return;}
  if(b.dataset.seasonTier!==undefined){const season=claimableSeasons(saves.now()).find(s=>s.id===selectedSeasonId);if(season)void profileAction('seasonclaim',{season:season.id,tier:Number(b.dataset.seasonTier)},()=>{notify('SEASON REWARD CLAIMED');seasonTrack();});return;}
  if(b.dataset.wheelKind) { if(!wheelSpinning&&!profile.wheels?.pending)wheel(b.dataset.wheelKind);return; }
  if(b.dataset.exchange) {void profileAction('exchange',{pack:b.dataset.exchange},()=>{wallet();notify('COINS ADDED');});return;}
  if(b.dataset.roomStep && session) {
    const [key,direction]=b.dataset.roomStep.split(':'),delta=Number(direction);
    if(!['mode','map','duration','capacity','duelRule','targetPoints'].includes(key)||![-1,1].includes(delta))return;
    const opts=roomChoices(key,session.state.settings),index=opts.findIndex(([value])=>String(value)===String(session.state.settings[key]));
    void act('settings',{settings:{[key]:opts[(index+delta+opts.length)%opts.length][0]}});return;
  }
  if(b.dataset.configChoice && session) {
    const [key,value]=b.dataset.configChoice.split(':');
    if(key==='mode'&&roomChoices(key,session.state.settings).some(([id])=>id===value))void act('settings',{settings:{[key]:value}});return;
  }
  menuSound(
    Boolean(
      b.dataset.equipWeapon ||
        ["online", "create", "start"].includes(b.dataset.action),
    ),
  );
  if (b.dataset.settingsTab) { settingsView(b.dataset.settingsTab); return; }
  if(b.dataset.previewFinish){void inspect(b.dataset.previewRifle,shopArmory,b.dataset.previewFinish);return;}
  if(b.dataset.buyWrap){const item=b.dataset.buyWrap,weapon=b.dataset.wrapWeapon,category=b.dataset.buyCategory||'wraps';void profileAction('buy',{category,item},()=>{void inspect(weapon,shopArmory,category==='goldFinishes'?'gold':item.slice(5));notify('SKIN UNLOCKED');});return;}
  if(b.dataset.equipFinish){const finish=b.dataset.equipFinish,weapon=b.dataset.wrapWeapon;void profileAction('finish',{weapon,finish},()=>void inspect(weapon,shopArmory,finish));return;}
  if (b.dataset.finish) {
    if (rifleMastery(profile, b.dataset.finish).gold) {
      const weapon=b.dataset.finish,shop=shopArmory;
      void profileAction('finish',{weapon,finish:settings.finishes[weapon]==='gold'?'field':'gold'},()=>{void inspect(weapon,shop);});
    }
    return;
  }
  if (b.dataset.badge) {
    if (earnedBadges(profile).some((badge) => badge.id === b.dataset.badge))void profileAction('badge',{badge:b.dataset.badge},profileView);
    return;
  }
  if (b.dataset.quality) {
    settings.quality = b.dataset.quality; stage?.setQuality(settings.quality); save(); settingsView("video"); return;
  }
  if (b.dataset.action === "testcue") {
    if (menuAudio && initialAudioBuffers?.elimination) {
      menuCue?.dispose();
      menuCue = createShotAudio(menuAudio, "", audioLevel(settings,'effects'), undefined, initialAudioBuffers.elimination, menuOutput.input);
      menuCue.play(COMBAT_CLIPS.elimination.gain);
    }
    return;
  }
  if(b.dataset.roomInvitePlayer){void inviteRoomFriend(b);return;}
  if (b.dataset.weapon) {
    void inspect(b.dataset.weapon, shopArmory);
    return;
  }
  if(b.dataset.buyRifle){const id=b.dataset.buyRifle;void profileAction('buy',{category:'skins',item:id},()=>{void inspect(id,shopArmory);notify('RIFLE UNLOCKED');});return;}
  if (b.dataset.equipWeapon) {
    void equipRifle(b.dataset.equipWeapon);
    return;
  }

  if (b.dataset.practiceMap) {
    const id = b.dataset.practiceMap;
    if (MAPS.some((map) => map.id === id)) void practiceArena(id);
    return;
  }
  if (b.dataset.action) {
    if (screen === "inspect" && b.dataset.action !== "close") {
      stopInspect();
      modal.close();
    }
    actions[b.dataset.action]?.();
    return;
  }
  if (b.dataset.tab) {
    document.querySelectorAll("[data-tab]").forEach((t) =>
      t.setAttribute("aria-selected", String(t === b))
    );
    $("#updates").hidden = b.dataset.tab !== "updates";
    $("#friends").hidden = b.dataset.tab !== "friends";
    if(b.dataset.tab==='friends')void friendsPanel?.refresh();
  }
  if (b.dataset.category === "skins") {
    selectedCategory = "skins";
    void inspect(profile.equipped.skins, true);
    return;
  }
  if (b.dataset.category) {
    collection(b.dataset.category, null, screen === "inventory" || screen === "arsenal" && collectionInventory);
  }
  if (b.dataset.item) {
    collection(selectedCategory, b.dataset.item, screen === "inventory");
  }
  if (b.dataset.bind) {
    remapping = b.dataset.bind;
    b.textContent = "Press a key…";
  }
  if (b.dataset.vote) void act("vote", { map: b.dataset.vote });
  if (b.dataset.kick) void act("kick", { id: b.dataset.kick });
});
document.addEventListener("keydown", (e) => {
  if (
    screen === "arsenal" &&
    ["ArrowLeft", "ArrowRight", "Enter"].includes(e.code)
  ) {
    e.preventDefault();
    if (e.code === "Enter") {
      if(!profile.owned.includes(previewWeapon)){notify("Unlock this rifle in the shop first");return;}
      void equipRifle(previewWeapon);
      return;
    }
    const index = WEAPONS.findIndex((w) => w.id === previewWeapon);
    void inspect(
      WEAPONS[
        (index + (e.code === "ArrowRight" ? 1 : -1) + WEAPONS.length) %
        WEAPONS.length
      ].id,
      shopArmory,
    );
    return;
  }
  if (remapping) {
    e.preventDefault();
    if (e.code !== "Escape") {
      const error = bindingError(resolveBindings(settings.bindings), remapping, e.code);
      if (error) notify(error);
      else settings.bindings[remapping] = e.code;
    }
    remapping = null;
    save();
    controls();
  } else if (screen === "inspect" && e.key === "Escape") closeDialog();
}, true);
content.addEventListener("input", (e) => {
  const el = e.target, key = el.dataset.setting;
  if (!key) return;
  settings[key] = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : Number(el.value);
  if(["volume","effectsVolume"].includes(key)){menuCue?.dispose();menuCue=null;}
  if(["volume","musicVolume"].includes(key))roundMusic.configure(initialAudioBuffers?.finale,audioLevel(settings,'music'));
  if (key === "quality") stage?.setQuality(settings.quality);
  if (el.nextElementSibling?.tagName === "OUTPUT") {
    el.nextElementSibling.value = settingValue(key);
  }
  if (el.type === "range") el.style.setProperty("--fill", (Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min)) * 100 + "%");
  if (key === "reticle") $(".aim-preview")?.style.setProperty("--aim-size", el.value + "px");
  save();
});
content.addEventListener("change", (e) => {
  const el = e.target, k = el.dataset.config;
  if (k) {
    void act("settings", {
      settings: {
        [k]: el.type === "checkbox"
          ? el.checked
          : ["duration", "capacity"].includes(k)
          ? Number(el.value)
          : el.value,
      },
    });
  }
});
content.addEventListener("submit", (e) => {
  if(e.target.id==='recover-form'){
    e.preventDefault();const code=new FormData(e.target).get('code');
    const submit=e.target.querySelector('button');submit.disabled=true;
    void saves.recover(code).then(()=>{if(recoveryBoot)location.reload();else{void leaveRoom();profileView();notify('Save restored. Create a new recovery key.');}})
      .catch(error=>{const field=$('#recovery-error');if(field)field.textContent=error.message;})
      .finally(()=>{submit.disabled=false;});return;
  }
  if (e.target.id === "rename-form") {
    e.preventDefault();
    const name = playerAlias(new FormData(e.target).get("name"));
    if (name.length < 2) { $("#rename-error").textContent = "Enter at least two letters or numbers."; return; }
    void (async () => {
      try {
        const value=await profileAction('rename',{name},()=>{profileView();notify('Name saved');});
        if(value&&session)await session.action('rename',{name:profile.name});
      } catch (error) { const field = $("#rename-error"); if (field) field.textContent = error.message; else notify(error.message); }
    })();
    return;
  }
  if (e.target.id === "join-form") {
    e.preventDefault();
    const data = new FormData(e.target);
    const code = data.get("code").trim().toUpperCase();
    if (code) void connect("join", code, data.has("spectator"));
  }
});
// Explicit exits leave immediately. A reload retains this tab's token; abandoned
// tabs expire through the server heartbeat timeout rather than breaking resume.
window.addEventListener("pagehide", () => {
  roundMusic.dispose();
  menuOutput?.dispose();
  if (menuAudio) void menuAudio.close().catch(() => {});
  menuAudio = menuOutput = null;
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||!bootReady||gameRunning)return;
  const epoch=menuEpoch;
  void saves.refresh().then(()=>saves.claimRewards()).then(()=>{if(epoch===menuEpoch)refreshProfileScreen();}).catch(()=>notify('Save connection interrupted. Your rewards stay pending.'));
});
async function platform() {
  let referrer = "";
  try { referrer = new URL(document.referrer).hostname; } catch {}
  const isPlatform = /(^|\.)crazygames\.com$/.test(location.hostname) ||
    /(^|\.)crazygames\.[a-z]{2,3}$/.test(referrer) ||
    new URLSearchParams(location.search).get("isCrazyGames") === "true";
  if (!isPlatform && !window.CrazyGames?.SDK) return;
  let timer;
  try {
    sdk = await Promise.race([(async () => {
      if (!window.CrazyGames?.SDK) await new Promise((res, rej) => {
        const script = document.createElement("script");
        script.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
        script.onload = res;
        script.onerror = rej;
        document.head.append(script);
      });
      const available = window.CrazyGames.SDK;
      await available.init();
      return available;
    })(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Platform unavailable")), 8000); })]);
    sdkLifecycle = platformLifecycle(sdk);
    sdkLifecycle.loading(true);
    const audioSettings = (value) => setPlatformMuted(value?.muteAudio);
    audioSettings(sdk.game.settings);
    sdk.game.addSettingsChangeListener(audioSettings);
    sdk.game.addJoinRoomListener((invite) => {
      if (!invite?.room) return;
      if (!bootReady) { pendingPlatformInvite = invite.room; return; }
      if (gameRunning) endGame();
      void connect("join", invite.room);
    });
    pendingPlatformInvite ||= sdk.game.inviteParams?.room || sdk.game.getInviteParam("room");
  } catch {} finally { clearTimeout(timer); }
}
function moveLobby(e) {
  if (settings.reducedMotion || screen || gameRunning) return;
  const x = (e.clientX / innerWidth - .5) * 3,
    y = (e.clientY / innerHeight - .5) * 2;
  $(".bay").style.transform = "scale(1.006) translate(" + x + "px," + y + "px)";
}
$("#lobby").addEventListener("pointermove", moveLobby);
async function boot() {
  fillIcons();
  uiProfile();
  let stageModule;
  let migrated=false;
  const stages = [
    {label:'Connecting your save',run:async()=>{
      const legacy=structuredClone(profile);const opened=await saves.open(legacy);migrated=opened.migrated;
      await saves.claimRewards().catch(()=>notify('Match rewards pending. Reconnect to claim.'));
    }},
    { label: "Preparing game", run: platform },
    { label: "Loading game font", run: () => document.fonts.load("italic 800 22px Rush") },
    { label: "Preparing arena and rifles", run: async () => {
      const loaded = await Promise.all([import("./stage.js"), import("./game.js"), import("./weapon-preview.js")]);
      stageModule = loaded[0];
    } },
    { label: "Decoding rifle audio", run: async () => {
      initialAudioBuffers = await preloadCombatAudio();
    } },
    { label: "Rendering training bay", run: async () => {
      stage = await stageModule.createStage($("#stage"), settings, () => profile.equipped);
      updatePortrait();
    } },
  ];
  try {
    await runPreload(stages, (n, label) => {
      $("#progress").textContent = n + "% · " + label;
      $("#boot progress").value = n;
    });
    $("#boot").hidden = true;
    bootReady = true;
    friendsPanel=mountFriends($('#friends'),id=>{playerNumber=id;const label=content.querySelector('[data-profile-player-id]');if(label)label.textContent='PLAYER ID '+id;},code=>connect('join',code));
    if(migrated)notify('Online progression starts fresh. Previous device save backed up.');
    const warmEquipment = () => void stageModule.characterThumbnails()
      .then(() => import('./weapon-preview.js')).then(module=>module.rifleThumbnails()).catch(()=>{});
    if(window.requestIdleCallback)requestIdleCallback(warmEquipment,{timeout:1500});
    else setTimeout(warmEquipment,50);
    sdkLifecycle?.loading(false);
    const code = pendingPlatformInvite || new URLSearchParams(location.search).get("room");
    void restoreRoom(code, Boolean(sdk?.game.isInstantMultiplayer));
  } catch (error) {
    stage?.dispose();
    stage = null;
    $("#progress").textContent = error.message || "Could not load the training bay";
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "Retry";
    b.onclick = () => location.reload();
    $("#boot").append(b);
    if(error.recoveryRequired){const recover=document.createElement('button');recover.className='btn';recover.textContent='Recover save';recover.onclick=()=>recoveryView(true);$('#boot').append(recover);}
  }
}
boot();
