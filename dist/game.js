import {audioLevel} from './audio-levels.js';
import {armsStage,compareArmsPlayers} from './arms-race.js';
import { updateWardrobeEffects } from './wardrobe-effects.js';
import { updateRifleSkinEffects } from './rifle-skin-effects.js';
import { roundMusic } from "./round-music.js";
import { icon } from "./icons.js";
import { KNIFE_RANGE, KNIFE_MS, KNIFE_CONTACT_MS, FUSE_MS, CHARGE_MS, MAX_HEALTH, KNIFE_DAMAGE, blastDamage, damagePlayer, grenadeLaunch, stepGrenade, rifleHitboxes, knifeSwing, eyeOrigin } from "./equipment.js";
import { createBlastFeedback } from "./blast-feedback.js";
import { equipmentModel, equipmentThumbnails, createEquipmentEffects } from "./equipment-models.js";
import { createDeathEffects } from "./death-animation.js";
import { alignRifleToCenter, COLLAPSE_MS, shotRecoil, updateAimRotation, approachAngle, landingCompression, createPlayClock, mouseAim, matchDeadline, selectableRifles } from "./presentation.js";
import { createShotEffects, traceSurface, animateMuzzleFlash } from "./shot-effects.js";
import { remoteShotMix } from "./shot-audio.js";
import { createCombatAudio } from "./combat-audio.js";
import { studioEnvironment } from "./lighting.js";
import { canChangeWeapon, CHAMBER_MS, weaponById, WEAPONS } from "./weapons.js";
import { disposeRifle, setRifleFinish } from "./rifle-models.js";
import { createWeaponPreview, fillRifleThumbnails, rifleThumbnails } from "./weapon-preview.js";
import { isRetryable, isSessionExpired, recoveryDelay, watchSession, estimatedServerTime } from "./net.js";
import { frameTimings, QUALITY_CHOICES, renderQuality } from "./quality.js";
import { spectatorView } from "./spectator.js";
import { gameAudioOutput } from "./platform-audio.js";
import * as T from "./vendor/three.module.js";
import { MAPS, TRAINING_MAP } from "./maps.js";
import { listenMouseButtons } from "./mouse-input.js";
import { movePlayer, resetPlayerMotion, smoothCameraHeight, clampCameraEyeY } from "./movement.js";
import { keyLabel, resolveBindings } from "./input-bindings.js";
import { queueMovementFrame, takeRecentMovementFrames } from './input-queue.js';
import { nameplateWorldWidth } from './presentation.js';
import { BADGES } from "./progression.js";
import { animateOperator, animateOperatorCombat, buildArena, operator, rifle, setOperatorWeapon } from "./arena.js";

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
const text = (parent, tag, value) => {
  const node = document.createElement(tag);
  node.textContent = value;
  parent.append(node);
  return node;
};
const timing = { shot: CHAMBER_MS, reload: CHAMBER_MS };

export function startGame(
  { container, session = null, queueSession = null, practiceMap = null, settings = {}, onExit, onResults, onWeaponChange, onSettingsChange, onActivityChange, onRoomState, onPerformance },
) {
  const map = [...MAPS,TRAINING_MAP].find((m) => m.id === (session?.state.arena || session?.state.map || practiceMap)) || MAPS[0],
    practice = !session,
    spectating = Boolean(session?.state.players.find((q) => q.id === session.id)?.spectator);
  const playClock = createPlayClock(), now = playClock.now;
  const root = document.createElement("section");
  root.className = "sr-match" + (spectating ? " sr-spectating" : "");
  root.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  root.setAttribute("aria-label", "Sniper Rush arena");
  root.innerHTML =
    `<canvas class="sr-field" tabindex="0" aria-label="First-person arena"></canvas>
    <div class="sr-hud"><div class="sr-match-top"><button class="sr-pause" aria-label="Pause match" title="Pause · Esc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14"/></svg></button><button class="sr-settings" aria-label="Match settings" title="Settings">${icon("gear")}</button></div>
    <div class="sr-clock"><strong></strong><b></b><small class="sr-rank"></small></div><div class="sr-feed"></div><aside class="sr-live-board" aria-label="Live leaderboard"><div class="sr-leader-head"><strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8"/></svg>TOP PLAYERS</strong><span>K</span><span>D</span></div><div class="sr-leader-rows"></div></aside>
    <div class="sr-center"><i></i><i></i><i></i><i></i><em></em></div><div class="sr-scope"><span></span></div><div class="sr-damage-vignette" aria-hidden="true"></div>
    <div class="sr-toast" aria-live="polite"></div><div class="sr-control-hints"></div>
    <div class="sr-ammo" aria-label="Equipped weapon"><img class="sr-held-thumb" alt="" hidden><div class="sr-ammo-readout"><small></small><b>∞</b><span></span><progress class="sr-chamber" max="1" value="1"></progress></div></div><div class="sr-equipment-slots" aria-label="Equipment"><span data-slot="rifle">1 · SNIPER</span><span data-slot="knife">2 · KNIFE</span><span data-slot="grenade">3 · GRENADE</span></div>
    <div class="sr-respawn" hidden></div><div class="sr-status"></div><div class="sr-ping"></div></div>
    <section class="sr-break" hidden role="dialog" aria-modal="true" aria-labelledby="sr-pause-title"><div class="sr-dialog"><small>SNIPER RUSH</small><h2 id="sr-pause-title">Match paused</h2><p></p><div class="sr-pause-actions"><button class="sr-continue">Resume match</button><button class="sr-open-settings">Settings</button><button class="sr-finish" hidden>Finish practice</button><button class="sr-leave">Return to lobby</button></div><div class="sr-match-options" hidden></div></div></section>
    <section class="sr-board" hidden aria-label="Match rankings"><div><small>SNIPER RUSH <span>HOLD TAB</span></small><h2>Match rankings</h2><table><thead><tr><th>#</th><th>Player</th><th>Kills</th><th>Deaths</th><th>K/D</th><th>Streak</th><th>Ping</th></tr></thead><tbody></tbody></table></div></section>
    <section class="sr-armory" hidden role="dialog" aria-modal="true" aria-label="Match rifle loadout"><div class="sr-armory-panel"><header><h2>RIFLE LOADOUT</h2><button class="sr-armory-back">B · BACK</button></header><canvas class="sr-rifle-preview" aria-label="Rotatable rifle preview"></canvas><div class="sr-rifle-summary"><div><h3></h3><p>ONE SHOT · 1.5s CHAMBER · UNLIMITED</p></div><button class="sr-rifle-equip">EQUIP</button></div><div class="sr-rifle-list"></div><p class="sr-armory-status" role="status"></p></div></section>
    <div class="sr-enter" hidden><button>Click to resume aiming</button></div>`;
  const $ = (s) => root.querySelector(s), canvas = $("canvas");
  const hudText = (selector, value) => {
    const node = $(selector);
    const label = String(value);
    if (node.textContent !== label) node.textContent = label;
  };
  let quality = renderQuality(settings.quality, window.devicePixelRatio);
  let timings = frameTimings();
  let networkTimings = frameTimings();
  let skipFrameSample = true;
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    powerPreference: "high-performance",
  });
  container.replaceChildren(root);
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.autoClear = false;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(70, 1, .045, 180);
  const view = new T.Scene(), viewCam = new T.PerspectiveCamera(61, 1, .025, 5);
  const arenaSun = buildArena(scene, map, quality);
  const flagModels = {};
  if (!practice && session.state.settings.mode === 'ctf') {
    for (const [team,color] of [['blue',0x367dff],['orange',0xff8a35]]) {
      const flag = new T.Group();
      const pole = new T.Mesh(new T.CylinderGeometry(.045,.045,2.3,8),new T.MeshStandardMaterial({color:0xd6d2bf,metalness:.5,roughness:.4}));
      pole.position.y=1.15; flag.add(pole);
      const cloth = new T.Mesh(new T.BoxGeometry(.95,.62,.06),new T.MeshStandardMaterial({color,roughness:.65}));
      cloth.position.set(.47,1.86,0);flag.add(cloth);flag.visible=false;scene.add(flag);flagModels[team]=flag;
    }
  }
  const muzzleEffects = createShotEffects(scene);
  const equipmentEffects = createEquipmentEffects(scene, map);
  const muzzlePosition = new T.Vector3(), muzzleDirection = new T.Vector3();
  const environment = studioEnvironment(renderer);
  view.environment = environment.texture;
  view.add(new T.HemisphereLight(0xffffff, 0xa5b8e6, 2.4));
  const sun = new T.DirectionalLight(0xfff7ea, 2.1);
  sun.position.set(-3, 4, 2);
  view.add(sun);
  let weaponId = weaponById(session?.state.players.find((q) => q.id === session.id)?.weapon || settings.skin).id;
  let gun = rifle(view, weaponId);
  setRifleFinish(gun, session?.state.players.find(q=>q.id===session.id)?.finish||settings.finishes?.[weaponId]);
  const knifeModel = equipmentModel(view, "knife", true), grenadeModel = equipmentModel(view, "grenade", true);
  knifeModel.visible = grenadeModel.visible = false;
  knifeModel.scale.setScalar(.65); grenadeModel.scale.setScalar(.85);
  let selectedEquipment = "rifle", equipmentSeq = 0, meleeAt = -Infinity, grenadeStock = 1, primeAt = null, throwAt = -Infinity;
  let pendingKnifeAt = Infinity;
  let fireHeld = false, knifeSide = 1, equipmentAt = -1000, autoRifleAt = Infinity, handoffToResults = false, stepDistance = 0;
  let localGrenades = [], remoteGrenades = [], thumbImages = {}, lastThumb = "";
  let lastHintEquipment = "", hintUntil = 0;
  let hurtUntil = 0, blastAt = -Infinity, blastForce = 0;
  const presentBlast = createBlastFeedback((position, age, audible) => {
    equipmentEffects.blast(new T.Vector3(position.x, position.y, position.z), now() - age);
    if (!audible) return;
    const mix = remoteShotMix(camera.position, position, camera.rotation.y);
    combatAudio?.cue("blast", Math.min(1, mix.level * 2.5), mix.pan);
    blastAt = now() - age;
    blastForce = clamp(1 - camera.position.distanceTo(new T.Vector3(position.x, position.y, position.z)) / 16, 0, 1);
  });
  Promise.all([rifleThumbnails(), equipmentThumbnails()]).then(([rifles, extra]) => { if (!stopped) { thumbImages = { ...rifles, ...extra }; updateEquipmentHUD(); } }).catch(() => {});
  function updateEquipmentHUD() {
    if(lastHintEquipment!==selectedEquipment){
      const rows=root.querySelectorAll('.sr-control-hints > div');
      if(rows.length>=4){
        const hints=selectedEquipment==='rifle'?[['RMB','Scope'],[keyLabel(binds.inspect),'Inspect']]:selectedEquipment==='knife'?[['LMB','Swing'],['1','Sniper']]:[['LMB','Hold & release'],['1','Cancel / sniper']];
        for(const [index,values] of [[1,hints[0]],[3,hints[1]]]){rows[index].querySelector('kbd').textContent=values[0];rows[index].querySelector('span').textContent=values[1];}
        lastHintEquipment=selectedEquipment;hintUntil=now()+4500;
      }
    }
    const id = selectedEquipment === "rifle" ? weaponId : selectedEquipment;
    if (lastThumb !== id || !$(".sr-held-thumb").getAttribute("src")) {
      lastThumb = id; const image = $(".sr-held-thumb"); image.alt = equipmentName(id);
      if (thumbImages[id]) { image.src = thumbImages[id]; image.hidden = false; }
    }
    for (const slot of root.querySelectorAll("[data-slot]")) slot.classList.toggle("active", slot.dataset.slot === selectedEquipment);
    hudText("[data-slot=grenade]", "3 · GRENADE " + grenadeStock);
    $("[data-slot=grenade]").classList.toggle("empty", grenadeStock === 0);
  }
  function equipmentName(id) { return id === "knife" ? "Field knife" : id === "grenade" ? "Frag grenade" : weaponById(id).name; }
  const foes = new Map(),
    ray = new T.Raycaster();
  const binds = resolveBindings(settings.bindings),
    keys = new Set(),
    ctrl = new AbortController(),
    { signal } = ctrl;
  const handle = (node, type, fn, options = {}) =>
    node.addEventListener(type, fn, { ...options, signal });
  let viewportHeight = 1, lastDrawAt = -Infinity;
  const paint = () => {
    const w = root.clientWidth || 1, h = root.clientHeight || 1;
    viewportHeight = h;
    lastDrawAt = -Infinity;
    renderer.setSize(w, h, false);
    camera.aspect = viewCam.aspect = w / h;
    camera.updateProjectionMatrix();
    viewCam.updateProjectionMatrix();
  };
  const resize = new ResizeObserver(paint);
  resize.observe(root);
  paint();
  let stopped = false,
    paused = false,
    locked = document.pointerLockElement === container,
    wasLocked = document.pointerLockElement === container,
    denied = false,
    scoped = false,
    rightButtonHeld = false,
    last = now(),
    frame = 0,
    lastHUD = 0,
    inspectAt = -3000,
    kick = 0,
    shotAt = -Infinity,
    zoom = 0;
  function setPaused(value) {
    if(paused===value)return;
    paused=value;
    if(practice){
      playClock.setPaused(value);
      roundMusic.setPaused(value);
      if(audio&&audio.state!=="closed")void(value?audio.suspend():audio.resume()).catch(()=>{});
    }
  }
  let jump = false,
    slide = false,
    lean = 0,
    yaw = map.spawns[0].yaw || 0,
    pitch = 0,
    seq = 0,
    shotSeq = 0,
    waiting = false,
    frames = [],
    netAt = 0,
    pending = [],
    serverAnchor = Date.now(), serverAnchorAt = performance.now(),
    lastEvent = 0,
    hadState = false,
    lastSync = now();
  let cameraFeet = 0, lastMouseX = null, lastMouseY = null;
  let landedAt=-Infinity,landingSpeed=0,fallSpeed=0,stride=0,bobAmount=0;
  let needsResync = false, retryAt = 0;
  let stopQueue = null;
  let watchedId = null;
  // Mouse deltas rotate the camera; shots always use its centered forward ray.
  const centerAim = new T.Vector2(0, 0);
  let ammo = 1,
    reloadAt = 0,
    nextShot = 0,
    shots = 0,
    hits = 0,
    kills = 0,
    deaths = 0,
    streak = 0,
    best = 0,
    toastUntil = 0,
    infoUntil = 0,
    phase = "",
    elapsed = 0,
    animTime = 0,
    ping = 0,
    lastAlive = true;
  let audio = null, audioOutput = null, combatAudio = null, errorAt = 0, lastActivity = false;
  let loadoutOpen = false, loadoutPreview = null, selectedRifle = weaponId, equipping = false;
  const p = {
    ...map.spawns[0],
    y: 0,
    eyeHeight: 1.62,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    lean: 0,
    alive: true,
    health: MAX_HEALTH,
  };
  const mode = practice
    ? "Practice · " + map.name
    : session.state.settings?.mode === "ctf"
    ? "Capture the flag"
    : session.state.settings?.mode === "tdm"
    ? "Team deathmatch"
    : session.state.settings?.mode === 'duel'
    ? '1 vs 1'
    : session.state.settings?.mode === 'arms' ? 'Arms race'
    : "Free for all";
  const duration = queueSession ? Infinity : 180000,
    practiceId = "operator",
    meId = session?.id || practiceId;
  $(".sr-clock strong").textContent = mode;
  $(".sr-ammo small").textContent = weaponById(weaponId).name.toUpperCase();
  $(".sr-ammo").hidden = spectating;
  $(".sr-equipment-slots").hidden = spectating;
  $(".sr-center").hidden = spectating;
  if (spectating) $(".sr-enter button").textContent = "Click to watch";

  $(".sr-finish").hidden = !practice || Boolean(queueSession);
  root.style.setProperty(
    "--reticle",
    clamp(Number(settings.reticle) || 2, 1, 4) + "px",
  );
  const hint = $(".sr-control-hints");
  for (
    const [label, key] of (spectating ? [["Next player", "LMB / →"], ["Previous player", "RMB / ←"]] : [["Move", ["forward", "left", "backward", "right"].map((action) => keyLabel(binds[action])).join(" ")], ["Scope", "RMB"], [
      "Slide",
      keyLabel(binds.crouch),
    ], ["Inspect", keyLabel(binds.inspect)]])
  ) {
    const row = text(hint, "div", "");
    text(row, "kbd", key);
    text(row, "span", label);
  }
  // Patrols stay in verified spawn-side lanes, away from solid cover.
  const targets = map.spawns.slice(1).map(({ x, z }) => [x, z, .7]);
  const retiredActors=[];
  function retireActor(f){f.model.visible=false;f.model.removeFromParent();retiredActors.push({model:f.model,until:now()+COLLAPSE_MS});foes.delete(f.id);}
  function updateFoeLabel(f,name,badge){
    const c=f.label.material.map.image;
    c.width = 256;
    c.height = badge ? 70 : 48;
    const g = c.getContext("2d");
    g.font = "italic 800 27px Rush, sans-serif";
    g.textAlign = "center";
    g.lineWidth = 7;
    g.strokeStyle = "#1a223d";
    g.strokeText(name.slice(0, 18), 128, 34);
    g.fillStyle = f.friendly ? '#a8d8ff' : '#ffb2a4';
    g.fillText(name.slice(0, 18), 128, 34);
    const badgeTitle = BADGES.find((b) => b.id === badge)?.name;
    if (badgeTitle) {
      g.font = "italic 800 17px Rush, sans-serif"; g.fillStyle = "#f0d286"; g.lineWidth = 4;
      g.strokeText(badgeTitle.toUpperCase(), 128, 61); g.fillText(badgeTitle.toUpperCase(), 128, 61);
    }
    f.label.material.map.needsUpdate=true;f.label.scale.set(2,badge ? .55 : .375,1);f.name=name;f.badge=badge;
  }
  function addFoe(id, name, color, weapon, badge, gear, friendly = false) {
    const model = operator(scene, color, weapon, gear);
    const tex = new T.CanvasTexture(document.createElement('canvas'));
    tex.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(
      new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    label.position.y = 2.03;
    label.scale.set(2, badge ? .55 : .375, 1);
    model.add(label);
    const o = { id, name, model, label, friendly, gearKey:JSON.stringify(gear), dest: new T.Vector3(), previous: null, until: 0, health: MAX_HEALTH };
    updateFoeLabel(o,name,badge);
    foes.set(id, o);
    return o;
  }
  if (practice) {
    targets.forEach((v, i) =>
      addFoe(
        i,
        "Target " + String(i + 1).padStart(2, "0"),
        [0xff6353, 0x1668f1, 0xbe49eb][i % 3],
      )
    );
  }
  const deathEffects = createDeathEffects(scene, map, now);
  const feed = [];
  function log(a, b, weapon = weaponId, head = false, long = false) {
    feed.unshift([a, b, weapon, head, long]);
    feed.splice(4);
    const n = $(".sr-feed");
    n.replaceChildren();
    for (const [attacker, victim, rifleId, headshot, longShot] of feed) {
      const row = text(n, "div", "");
      text(row, "b", attacker);
      text(row, "i", equipmentName(rifleId));
      text(row, "span", victim);
      if (headshot || longShot) text(row, "small", headshot ? "HEAD" : "LONG");
    }
  }
  function sound(hz, len, type = "sine", volume = .11, glide = .5) {
    if (!audio || !audioLevel(settings,'effects')) return;
    const osc = audio.createOscillator(), amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(16, hz * glide),
      audio.currentTime + len,
    );
    amp.gain.setValueAtTime(
      Math.max(.0001, volume * audioLevel(settings,'effects')),
      audio.currentTime,
    );
    amp.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + len);
    osc.connect(amp);
    amp.connect(audioOutput.input);
    osc.start();
    osc.stop(audio.currentTime + len);
  }
  function message(v, ms = 1400) {
    $(".sr-status").textContent = v;
    infoUntil = now() + ms;
  }
  function confirmKill(name, head) {
    toastUntil = now() + 900;
    $(".sr-toast").textContent = (head ? "Headshot" : "Eliminated") + "  /  " +
      name;
    root.classList.add("sr-hit");
    combatAudio?.eliminate();
  }
  function safelyPublic(){return Boolean(session?.state.public);}
  function serverNow() {
    return serverAnchor + Math.max(0, performance.now() - serverAnchorAt);
  }
  let lastArmsStage = -1;
  function applyState(s) {
    if (stopped || !s) return;
    if (s.arena && s.arena !== map.id) { cleanup(true); onExit?.({preserveRoom:true, preserveAim:true}); return; }
    const me = s.players.find((q) => q.id === meId);
    if (!me) return;
    const newRound = phase === "warmup" && s.phase === "live";
    if (newRound) {
      shots = 0;
      hits = 0;
      best = 0;
    }
    phase = s.phase;
    serverAnchor = estimatedServerTime(s); serverAnchorAt = performance.now();
    lastSync = now();
    ping = me.ping || 0;
    if (hadState && !paused && !document.hidden) networkTimings.record(ping);
    const respawn = me.alive && (!lastAlive || hadState && me.life !== p.life);
    if (lastAlive && !me.alive) { resetInput(); combatAudio?.cancelChamber(); }
    lastAlive = me.alive;
    const recovering = needsResync && hadState && !respawn && !newRound;
    const fresh = !hadState || respawn || newRound || needsResync;
    needsResync = false;
    retryAt = 0;
    if (fresh) {
      resetInput(recovering); meleeAt = throwAt = -Infinity; inspectAt = -3000;
      hurtUntil = 0; blastAt = -Infinity;
      landedAt=-Infinity;landingSpeed=fallSpeed=bobAmount=0;
      seq = Math.max(seq, me.inputSeq || 0);
      shotSeq = Math.max(shotSeq, me.shotSeq || 0);
      equipmentSeq = Math.max(equipmentSeq, me.equipmentSeq || 0);
      selectedEquipment = me.equipment || "rifle"; primeAt = null;
      grenadeStock = me.grenades ?? 1; autoRifleAt = Infinity; fireHeld = false;
      equipmentAt=now();stepDistance=stride=0;
      updateEquipmentHUD();
      if (!recovering) {
        yaw = me.yaw || 0;
        pitch = me.pitch || 0;
      }
      pending = [];
      frames = [];
      lean = 0;
      scoped = recovering && rightButtonHeld && selectedEquipment === 'rifle' && me.alive && !paused;
      reloadAt = 0;
      nextShot = 0;
      shotAt = -Infinity;
      kick = zoom = 0;
    }
    if (!me.alive) { primeAt = null; fireHeld = false; pendingKnifeAt = Infinity; }
    if (me.grenades === 0) grenadeStock = 0;
    remoteGrenades = s.grenades || [];
    for (const team of ['blue','orange']) {
      const model=flagModels[team], flag=s.flags?.[team];
      if (!model) continue;
      model.visible=Boolean(flag && s.phase==='live');
      if (flag) model.position.set(flag.x, flag.y + (flag.carrier ? 1.4 : 0), flag.z);
    }
    Object.assign(p, me);
    if(s.settings.mode==='arms') {
      const stage=armsStage(me.armsKills), changed=stage.index!==lastArmsStage;
      if(changed){lastArmsStage=stage.index;selectedEquipment=me.equipment||'rifle';primeAt=null;scoped=false;fireHeld=false;pendingKnifeAt=Infinity;equipmentAt=now();updateEquipmentHUD();if(hadState)message(stage.final?'FINAL STAGE · KNIFE':stage.name.toUpperCase(),1200);}
    }
    if (me.weapon) setLocalWeapon(me.weapon);
    setRifleFinish(gun,me.finish||'field');
    if (loadoutOpen && !canChangeWeapon(phase, p.alive, p.spectator, session?.state.settings.mode)) {
      closeLoadout(false);
      setPaused(true);
      $(".sr-enter").hidden = false;
    }
    pending = pending.filter((batch) => batch.seq > (me.inputSeq || 0));
    for (const batch of pending) {
      for (const f of batch.frames) movePlayer(p, f, f.dt, map);
    }
    for (const f of frames) movePlayer(p, f, f.dt, map);
    if (fresh) cameraFeet = p.y;
    if (fresh || !me.alive || now() > nextShot - 650) ammo = me.ammo;
    if (me.reloadUntil > s.serverTime) {
      reloadAt = now() + Math.max(0,me.reloadUntil - serverNow());
    }
    kills = me.kills;
    deaths = me.deaths;
    streak = me.streak;
    best = Math.max(best, streak);
    for (const other of s.players.filter((o) => o.id !== meId && !o.spectator)) {
      const friend = ["tdm","ctf"].includes(s.settings.mode) && other.team === me.team;
      let f = foes.get(other.id);
      if(f&&f.gearKey!==JSON.stringify(other.gear)){retireActor(f);f=null;}
      if(!f){f=addFoe(other.id,other.name,friend?0x2779ff:0xf34b54,other.weapon,other.badge,other.gear,friend);f.model.visible=false;}
      if(f.name!==other.name||f.badge!==other.badge||f.friendly!==friend){f.friendly=friend;updateFoeLabel(f,other.name,other.badge);}
      setOperatorWeapon(f.model, other.weapon,other.finish);
      const equipment = other.equipment || "rifle";
      if (!f.extras) { f.extras = {}; for (const kind of ["knife", "grenade"]) { const item = equipmentModel(f.model, kind); item.position.set(.24, 1.02, -.22); item.scale.setScalar(.7); f.extras[kind] = item; } }
      f.model.userData.gun.visible = equipment === "rifle";
      for (const [kind, item] of Object.entries(f.extras)) item.visible = kind === equipment;
      f.grounded = other.grounded;
      f.pitchTarget=other.pitch||0;f.leanTarget=other.lean||0;f.primeTime=other.grenadePrimedAt;
      if(f.life!==other.life){f.swingAt=f.throwAt=-Infinity;f.hurtAt=-Infinity;f.stepDistance=0;f.poseSnap=true;f.life=other.life;Object.assign(f.model.userData.stride,{phase:0,weight:0});}
      f.dest.set(other.x, other.y, other.z);
      const snapRemote=!f.model.visible || !hadState || f.model.position.distanceTo(f.dest)>3;
      if(snapRemote)f.model.position.copy(f.dest);
      f.model.visible = other.alive;
      f.model.userData.shield.visible = other.shieldUntil > s.serverTime;
      f.yawTarget = other.yaw;
      f.stanceTarget = other.eyeHeight < 1.3 ? .77 : 1;
      if(snapRemote || fresh || !other.alive) { f.model.rotation.y=other.yaw;f.model.scale.y=f.stanceTarget; }
    }
    for (const [id, f] of foes) {
      if (!s.players.some((q) => q.id === id)) f.model.visible = false;
    }
    if (!hadState) lastEvent = s.eventId ?? Math.max(0, ...s.events.map((e) => e.id));
    for (const e of s.events) {
      if (e.id <= lastEvent) continue;
      lastEvent = e.id;
      if (e.type === "shot" && e.attacker !== meId) {
        const shooter = s.players.find((q) => q.id === e.attacker);
        if (shooter && serverNow() - e.at < 500) {
          const origin=e.origin?new T.Vector3().fromArray(e.origin):new T.Vector3(shooter.x,shooter.y+1.03,shooter.z);
          const mix = remoteShotMix(camera.position, origin, camera.rotation.y);
          combatAudio?.fire(e.weapon, mix.level, mix.pan, false);
          const foe = foes.get(e.attacker);
          const shotYaw=e.yaw??shooter.yaw??0,shotPitch=e.pitch??shooter.pitch??0;
          muzzleDirection.set(-Math.sin(shotYaw)*Math.cos(shotPitch),Math.sin(shotPitch),-Math.cos(shotYaw)*Math.cos(shotPitch));
          if (foe?.model.visible && (e.life===undefined||e.life===foe.life) && Math.hypot(foe.model.position.x-origin.x,foe.model.position.z-origin.z)<.75) {
            foe.flashUntil = now() + 45;
            foe.model.userData.gun.userData.flash.getWorldPosition(muzzlePosition);
            muzzleEffects.fire(muzzlePosition, muzzleDirection, now());
          } else muzzleEffects.fire(origin.addScaledVector(muzzleDirection,.65),muzzleDirection,now());
        }
      }
      if (e.type === "explosion" && serverNow() - e.at < 4000) {
        presentBlast(e.grenadeId || `event-${e.id}`, e, serverNow() - e.at);
      }
      if (e.type === "knifehit" && serverNow() - e.at < 1000) {
        const foe = foes.get(e.victim); if (foe) foe.hurtAt = now();
        if (e.attacker === meId || e.victim === meId) combatAudio?.cue("stab", .8);
        if (e.attacker === meId) message("Hit", 350);
        if (e.victim === meId && serverNow() - e.at < 1000) { hurtUntil = now() + 550; message("Knife hit", 500); }
      }
      if (e.type === "grenadehit" && serverNow() - e.at < 1000) {
        const foe = foes.get(e.victim); if (foe) foe.hurtAt = now();
        if (e.victim === meId) { hurtUntil = now() + 650; if (e.health > 0) message("Wounded", 700); }
        if (e.attacker === meId && e.victim !== meId && e.health > 0) message("Blast hit", 500);
      }
      if (e.type === "melee" && e.attacker !== meId && serverNow()-e.at<KNIFE_MS-KNIFE_CONTACT_MS) { const f = foes.get(e.attacker); if (f && (e.life===undefined||e.life===f.life)) f.swingAt = now()-KNIFE_CONTACT_MS-Math.max(0,serverNow()-e.at); }
      if (e.type === "throw" && e.attacker !== meId && serverNow()-e.at<380) { const f=foes.get(e.attacker);if(f && (e.life===undefined||e.life===f.life))f.throwAt=now()-Math.max(0,serverNow()-e.at); }
      if (e.type === 'flag-capture' && serverNow()-e.at<1500) message(e.team.toUpperCase()+' CAPTURED THE FLAG',1200);
      if (e.type === 'practice-hit' && e.attacker === meId && serverNow()-e.at<1000) message('TARGET HIT',700);
      if (e.type === "kill") {
        const name = (id) =>
          s.players.find((q) => q.id === id)?.name || (id===e.attacker?e.attackerName:null) || "Operator";
        deathEffects.add(
          foes.get(e.victim)?.model,
          Math.max(0, serverNow() - e.at),
          e.victimPose,
        );
        log(name(e.attacker), name(e.victim), e.weapon, e.headshot, e.longShot);
        if (e.attacker === meId && e.victim !== meId && serverNow()-e.at<1000) {
          hits++;
          confirmKill(name(e.victim), e.headshot);
        }
        if (e.victim === meId && serverNow()-e.at<1000 && !me.alive) {
          scoped = false;
          message("Eliminated by " + name(e.attacker), 1350);
          combatAudio?.eliminate(.85);
        }
      }
    }
    hadState = true;
    for(const [id,f] of foes)if(!s.players.some(q=>q.id===id&&!q.spectator))retireActor(f);
    onRoomState?.(s);
    if (phase === "results") {
      finish();
      return;
    }
    if (phase === "waiting" || phase === "vote") {
      cleanup();
      onExit?.({ preserveRoom: true });
      return;
    }
  }
  async function command(type, data) {
    try {
      if(["shoot","melee","prime","throw"].includes(type)&&frames.length&&!needsResync) data={...data,input:takeInputBatch()};
      const state = await session.action(type, { ...data, life: p.life });
      applyState(state || session.state);
    } catch (e) {
      connectionError(e);
    }
  }
  function takeInputBatch() {
    const batch={seq:++seq,frames:takeRecentMovementFrames(frames)};
    if(batch.frames.length){pending.push(batch);if(pending.length>12)pending.shift();}
    return batch;
  }
  function connectionError(error) {
    if (stopped) return;
    if (isSessionExpired(error)) {
      cleanup();
      onExit?.({ connectionError: error.message });
      return;
    }
    if (isRetryable(error)) {
      needsResync = true;
      retryAt = now() + recoveryDelay(session?.failures || 1);
      resetInput(true);
    }
    if (now() - errorAt > 1500) {
      errorAt = now();
      message(isRetryable(error) ? "Reconnecting…" : error.message, 2100);
    }
  }
  function network(t) {
    if (!session || waiting || t < retryAt || t - netAt < 80) return;
    netAt = t;
    waiting = true;
    if (frames.length && !needsResync) {
      void command("input", takeInputBatch()).finally(() => waiting = false);
    } else {void session.refresh().then((s) => applyState(s || session.state))
        .catch(connectionError).finally(() => waiting = false);}
  }
  function rowData() {
    return practice
      ? [{ id: meId, name: settings.playerName || "You", kills, deaths, streak, ping: 0 }]
      : session.state.players;
  }
  const leaderRows = new Map();
  let leaderSignature = "";
  function rankedPlayers() {
    return [...rowData()].filter((q) => !q.spectator).sort((a, b) =>
      (!practice && session.state.settings.mode==='arms' ? compareArmsPlayers(a,b) : 0) || b.kills - a.kills || a.deaths - b.deaths ||
      (a.scoreAt || 0) - (b.scoreAt || 0) ||
      String(a.id).localeCompare(String(b.id))
    );
  }
  function updateLiveBoard() {
    const ranked = rankedPlayers();
    const visible = ranked.slice(0, 5);
    const own = ranked.find((q) => q.id === meId);
    if (own && !visible.includes(own)) visible.push(own);
    const signature = JSON.stringify(
      visible.map((q) => [q.id, q.name, q.kills, q.deaths, ranked.indexOf(q)]),
    );
    if (signature === leaderSignature) return;
    leaderSignature = signature;
    const list = $(".sr-leader-rows");
    for (const [id, node] of leaderRows) {
      if (!visible.some((q) => q.id === id)) {
        node.remove();
        leaderRows.delete(id);
      }
    }
    visible.forEach((q, i) => {
      let node = leaderRows.get(q.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "sr-leader-row";
        node.append(
          document.createElement("b"),
          document.createElement("span"),
          document.createElement("span"),
          document.createElement("span"),
        );
        list.append(node);
        leaderRows.set(q.id, node);
      }
      node.classList.toggle("is-you", q.id === meId);
      node.classList.toggle("is-first", ranked.indexOf(q) === 0);
      node.classList.toggle("is-separated", i === 5);
      node.children[0].textContent = String(ranked.indexOf(q) + 1).padStart(
        2,
        "0",
      );
      node.children[1].textContent = q.name;
      node.children[2].textContent = q.kills;
      node.children[3].textContent = q.deaths;
      node.style.transform = "translateY(calc(" + i + " * var(--leader-step)))";
      list.append(node);
    });
    list.style.height = "calc(" + visible.length + " * var(--leader-step))";
  }
  function board() {
    const body = $(".sr-board tbody");
    body.replaceChildren();
    for (const [rank, q] of rankedPlayers().entries()) {
      const row = text(body, "tr", "");
      if (q.id === meId) row.className = "sr-own";
      for (
        const cell of [
          String(rank + 1).padStart(2, "0"),
          q.name,
          q.kills,
          q.deaths,
          (q.kills / Math.max(1, q.deaths)).toFixed(1),
          q.streak,
          practice ? "—" : (q.ping || 0) + "ms",
        ]
      ) text(row, "td", String(cell));
    }
  }
  function finish() {
    if (stopped) return;
    if (queueSession) { cleanup(); onExit?.({ preserveRoom: true }); return; }
    const final = session?.state.players.find((q) => q.id === meId);
    const data = {
      mode,
      map: map.name,
      mapId: map.id,
      practice,
      kills,
      deaths,
      streak: final?.bestStreak ?? best,
      shots: final?.shots ?? shots,
      hits: final?.hits ?? hits,
      headshots: final?.headshots || 0,
      quickscopes: final?.quickscopes || 0,
      airborneKills: final?.airborneKills || 0,
      longestKill: final?.longestKill || 0,
      weaponStats: final?.weaponStats || {},
      finishedAt: session?.state.finishedAt,
      win: !practice && !spectating && phase === "results" && (session.state.settings.mode === 'ctf' || final?.kills > 0) && (["tdm","ctf"].includes(session.state.settings.mode)
        ? session.state.scores[final?.team] > session.state.scores[final?.team === "blue" ? "orange" : "blue"]
        : rankedPlayers()[0]?.id === meId),
      players: practice ? [{ ...rowData()[0], name: settings.playerName || "You", weapon: weaponId,finish:settings.finishes?.[weaponId]||'field', gear: settings.gear, shots, hits, bestStreak: best }] : rankedPlayers(),
      playerId: meId,
      completed: phase === "results",
      roundId: session?.state.roundId,
      joinedLate: Boolean(final && final.liveSince > session.state.startedAt + 1000),
      team: final?.team,
      scores: session?.state.scores,
      spectator: spectating,
    };
    handoffToResults = true;
    cleanup();
    onResults?.(data);
  }
  function reload() {
    if (!p.alive || reloadAt || ammo >= 1) return;
    inspectAt = -3000;
    reloadAt = now() + timing.reload;
    combatAudio?.chamber(weaponId);
    if (session) void command("reload", {});
  }
  const tmp = new T.Vector3(), aabb = new T.Box3();
  function shoot() {
    const t = now();
    if (
      selectedEquipment !== "rifle" || paused || needsResync || !p.alive || t < nextShot || reloadAt ||
      (!practice && phase !== "live" && phase !== "warmup")
    ) return;
    if (ammo === 0) {
      sound(100, .05, "square");
      message("Reload  /  " + binds.reload.replace("Key", ""));
      return;
    }
    ammo = 0;
    reloadAt = t + CHAMBER_MS;
    shots++;
    nextShot = t + timing.shot;
    // Input may arrive between animation frames. Aim with the latest mouse
    // rotation, before applying this shot's visual recoil.
    updateAimRotation(camera, yaw, pitch, kick, settings.reducedMotion ? 0 : settings.shake ?? .5, p.lean || 0);
    camera.updateMatrixWorld();
    kick = 1;
    shotAt = t;
    inspectAt = -3000;
    combatAudio?.fire(weaponId);
    camera.updateMatrixWorld();
    ray.setFromCamera(centerAim, camera);
    if (zoom <= .75) {
      gun.userData.flash.getWorldPosition(muzzlePosition);
      const ratio = Math.tan(camera.fov * Math.PI / 360) / Math.tan(viewCam.fov * Math.PI / 360);
      muzzlePosition.x *= ratio; muzzlePosition.y *= ratio;
      muzzlePosition.applyMatrix4(camera.matrixWorld);
    }
    const surface = traceSurface(map, ray.ray);
    let dist = surface?.distance ?? Infinity, winner = null, headshot = false;
    for (const f of foes.values()) {
      if (!f.model.visible) continue;
      const pos = f.model.position;
      const boxes = rifleHitboxes({ x: pos.x, y: pos.y, z: pos.z, eyeHeight: f.model.scale.y < .9 ? 1.02 : 1.62 });
      for (const [part, bounds] of Object.entries(boxes)) {
        aabb.min.fromArray(bounds[0]); aabb.max.fromArray(bounds[1]);
        if (ray.ray.intersectBox(aabb, tmp)) {
          const d = tmp.distanceTo(camera.position);
          if (d < dist) { dist = d; winner = f; headshot = part === "head"; }
        }
      }
    }
    if (surface && !winner) muzzleEffects.impact(surface.position, surface.normal, t);
    if (zoom <= .75) muzzleEffects.fire(muzzlePosition, ray.ray.direction, t, true,
      ray.ray.at(Number.isFinite(dist) ? dist : 80, new T.Vector3()));
    if (session) {
      const point = ray.ray.at(
        Number.isFinite(dist) ? dist : 100,
        new T.Vector3(),
      );
      const origin = new T.Vector3().fromArray(eyeOrigin(p, yaw));
      const direction = point.sub(origin).normalize();
      void command("shoot", {
        seq: ++shotSeq,
        at: serverNow(),
        yaw: Math.atan2(-direction.x, -direction.z),
        pitch: Math.asin(clamp(direction.y, -1, 1)),
      });
      return;
    }
    if (winner) {
      deathEffects.add(winner.model, 0, { impactX: ray.ray.direction.x, impactZ: ray.ray.direction.z });
      winner.until = elapsed + COLLAPSE_MS;
      winner.health = 0;
      winner.model.visible = false;
      kills++;
      hits++;
      streak++;
      best = Math.max(best, streak);
      confirmKill(winner.name, headshot);
      log("You", winner.name, weaponId, headshot, dist >= 30);
    }
  }
  let equipmentNoise = null;
  function equipmentSound(kind) {
    if (!audio || !audioOutput || audioLevel(settings,'effects') <= 0) return;
    if (!equipmentNoise) { equipmentNoise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .8), audio.sampleRate); const data = equipmentNoise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; }
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
    source.buffer = equipmentNoise; filter.type = "lowpass"; filter.frequency.value = kind === "blast" ? 650 : 2600;
    const length = kind === "blast" ? .7 : .15, start = audio.currentTime;
    gain.gain.setValueAtTime(audioLevel(settings,'effects') * (kind === "blast" ? .65 : .10), start); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    source.connect(filter); filter.connect(gain); gain.connect(audioOutput.input); source.start(); source.stop(start + length);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  function secondaryKill(foe, weapon, direction) {
    deathEffects.add(foe.model, 0, { impactX: direction.x, impactZ: direction.z });
    foe.until = elapsed + COLLAPSE_MS; foe.knifeHits = 0; foe.health = 0; foe.model.visible = false;
    kills++; streak++; best = Math.max(best, streak); confirmKill(foe.name, false); log("You", foe.name, weapon);
  }
  function selectEquipment(kind) {
    if (paused || spectating || !p.alive || needsResync) return;
    if (!practice && session.state.settings.mode==='arms' && armsStage(p.armsKills).final && kind!=='knife') { message('FINAL STAGE · KNIFE',1000);return; }
    if (kind === selectedEquipment) return;
    if (kind === "grenade" && grenadeStock <= 0) { message("Grenade used · replenishes on respawn", 1000); return; }
    if (primeAt !== null) combatAudio?.cancelPrime();
    primeAt = null; scoped = false; fireHeld = false; pendingKnifeAt = Infinity; autoRifleAt = Infinity; inspectAt = -3000; selectedEquipment = kind; equipmentAt = now(); updateEquipmentHUD();
    if (session) void command("equip", { equipment: kind });
  }
  function knifeAttack() {
    const t = now(); if (paused || needsResync || !p.alive || t - meleeAt < KNIFE_MS) return;
    meleeAt = t; knifeSide *= -1; pendingKnifeAt = t + KNIFE_CONTACT_MS; equipmentSound("knife");
  }
  function landKnife() {
    pendingKnifeAt = Infinity; const t = now();
    updateAimRotation(camera, yaw, pitch, 0, 0, p.lean || 0); camera.updateMatrixWorld(); ray.setFromCamera(centerAim, camera);
    const contact = ray.ray.at(Math.min(KNIFE_RANGE,traceSurface(map,ray.ray)?.distance??Infinity),new T.Vector3());
    const origin = new T.Vector3().fromArray(eyeOrigin(p,yaw));
    ray.ray.set(origin,contact.sub(origin).normalize());
    if (session) { void command("melee", { seq: ++equipmentSeq, yaw:Math.atan2(-ray.ray.direction.x,-ray.ray.direction.z), pitch:Math.asin(clamp(ray.ray.direction.y,-1,1)) }); return; }
    let distance = Math.min(KNIFE_RANGE, traceSurface(map, ray.ray)?.distance ?? Infinity), target;
    for (const foe of foes.values()) {
      if (!foe.model.visible) continue;
      const pos = foe.model.position; aabb.min.set(pos.x - .4, pos.y, pos.z - .4); aabb.max.set(pos.x + .4, pos.y + 1.86, pos.z + .4);
      if (ray.ray.intersectBox(aabb, tmp) && tmp.distanceTo(ray.ray.origin) < distance) { distance = tmp.distanceTo(ray.ray.origin); target = foe; }
    }
    if (target) {
      target.knifeHits = (target.knifeHits || 0) + 1; target.hurtAt = t;
      damagePlayer(target, KNIFE_DAMAGE);
      combatAudio?.cue("stab", .8); message("Hit", 300);
      if (target.health === 0) secondaryKill(target, "knife", ray.ray.direction);
    }
  }
  function primeGrenade() {
    if (paused || needsResync || !p.alive || grenadeStock <= 0 || primeAt !== null) return;
    primeAt = now(); combatAudio?.cue("pin"); if (session) void command("prime", {});
  }
  function throwGrenade() {
    if (primeAt === null) return;
    const charge = clamp((now() - primeAt) / CHARGE_MS, 0, 1); primeAt = null;
    if (paused || needsResync || !p.alive || selectedEquipment !== "grenade") return;
    throwAt = now(); grenadeStock = 0; autoRifleAt = now() + 380; updateEquipmentHUD();
    if (session) { void command("throw", { seq: ++equipmentSeq, yaw, pitch, holdMs: charge * CHARGE_MS }); return; }
    localGrenades.push({ ...grenadeLaunch({ ...p, yaw, pitch }, charge, map), id: "practice:" + ++equipmentSeq });
  }
  function resetInput(preserveKeys = false) {
    if (primeAt !== null && session) void command("cancelprime", {});
    if (primeAt !== null) combatAudio?.cancelPrime();
    primeAt = null; fireHeld = false; pendingKnifeAt = Infinity;
    inspectAt = -3000; lastMouseX = lastMouseY = null;
    if (!preserveKeys) { keys.clear(); rightButtonHeld = false; }
    lean = 0;
    jump =
      slide =
      scoped =
        false;
    $(".sr-board").hidden = true;
  }
  function setLocalWeapon(id) {
    const next = weaponById(id).id;
    if (next === weaponId) return;
    const previous = gun;
    gun = rifle(view, next);
    setRifleFinish(gun, settings.finishes?.[next]);
    previous.removeFromParent();
    disposeRifle(previous);
    weaponId = next;
    updateEquipmentHUD();
    if(practice || session?.state.settings.mode!=='arms') onWeaponChange?.(next);
  }
  function renderLoadout() {
    const focusedChoice = document.activeElement?.dataset?.matchWeapon;
    loadoutPreview?.dispose();
    loadoutPreview = null;
    const oldCanvas = $(".sr-rifle-preview");
    oldCanvas.replaceWith(oldCanvas.cloneNode());
    $(".sr-rifle-summary h3").textContent = weaponById(selectedRifle).name;
    $(".sr-rifle-equip").textContent = selectedRifle === weaponId ? "EQUIPPED" : "EQUIP";
    $(".sr-rifle-equip").disabled = equipping || selectedRifle === weaponId;
    const list = $(".sr-rifle-list");
    list.replaceChildren();
    for (const spec of selectableRifles(WEAPONS, settings.ownedRifles)) {
      const choice = text(list, "button", "");
      const image = document.createElement("img"); image.alt = ""; image.dataset.rifleThumb = spec.id; choice.append(image);
      text(choice, "strong", spec.name);
      if (spec.id === weaponId) text(choice, "small", "Equipped");
      choice.dataset.matchWeapon = spec.id;
      choice.setAttribute("aria-pressed", String(spec.id === selectedRifle));
    }
    void fillRifleThumbnails(list);
    if (focusedChoice) [...list.children].find((choice) => choice.dataset.matchWeapon === selectedRifle)?.focus({ preventScroll: true });
    try {
      loadoutPreview = createWeaponPreview($(".sr-rifle-preview"), selectedRifle, settings);
    } catch {
      $(".sr-armory-status").textContent = "Preview unavailable. Rifle selection still works.";
    }
  }
  function openLoadout() {
    if (!practice && !canChangeWeapon(phase, p.alive, p.spectator, session?.state.settings.mode)) {
      message(session.state.settings.mode === 'arms' ? "Arms Race assigns your rifle" : "Loadout available in warmup or while eliminated");
      return;
    }
    setPaused(true);
    resetInput();
    loadoutOpen = true;
    selectedRifle = weaponId;
    $(".sr-break").hidden = true;
    $(".sr-enter").hidden = true;
    $(".sr-armory").hidden = false;
    $(".sr-armory-status").textContent = "";
    if (document.pointerLockElement === container) document.exitPointerLock();
    renderLoadout();
    $(".sr-armory-back").focus();
  }
  function closeLoadout(resume = true) {
    loadoutOpen = false;
    $(".sr-armory").hidden = true;
    loadoutPreview?.dispose();
    loadoutPreview = null;
    if (resume) focusAim();
  }
  async function equipRifle() {
    if (equipping || !loadoutOpen || selectedRifle === weaponId) return;
    if (!selectableRifles(WEAPONS, settings.ownedRifles).some(spec => spec.id === selectedRifle)) return;
    equipping = true;
    $(".sr-rifle-equip").disabled = true;
    try {
      if (session) {
        const state = await session.action("loadout", { weapon: selectedRifle });
        if (stopped) return;
        applyState(state || session.state);
      } else setLocalWeapon(selectedRifle);
      if (loadoutOpen) $(".sr-armory-status").textContent = weaponById(weaponId).name + " equipped";
    } catch (error) {
      if (!stopped && loadoutOpen) $(".sr-armory-status").textContent = error.message;
    } finally {
      equipping = false;
      if (!stopped && loadoutOpen) renderLoadout();
    }
  }
  function pause() {
    if (stopped) return;
    if (loadoutOpen) closeLoadout(false);
    const alreadyPaused = paused;
    setPaused(true);
    resetInput();
    if (practice) p.vx = p.vz = 0;
    $(".sr-enter").hidden = true;
    $(".sr-break").hidden = false;
    if (!alreadyPaused || $(".sr-match-options").hidden) showPauseActions();
    $(".sr-break p").textContent = practice
      ? "The range will wait for you."
      : "The match clock is running.";
    if (document.pointerLockElement === container) document.exitPointerLock();
    if ($(".sr-match-options").hidden) $(".sr-continue").focus({ preventScroll: true });
  }
  function showPauseActions() {
    $(".sr-match-options").hidden = true;
    $(".sr-pause-actions").hidden = false;
    $(".sr-break h2").textContent = practice ? "Practice paused" : "Match menu";
  }
  const matchRanges = [
    ["sensitivity", "Mouse sensitivity", .2, 3, .1, 1],
    ["adsSensitivity", "Scope sensitivity", .1, 1.5, .05, .55],
    ["volume", "Master volume", 0, 1, .05, .65],
    ["musicVolume", "Music", 0, 1, .05, 1],
    ["effectsVolume", "Sound effects", 0, 1, .05, 1],
    ["reticle", "Crosshair thickness", 1, 4, 1, 2],
    ["shake", "Camera shake", 0, 1, .05, .45],
  ];
  const optionValue = (key, value) => ["volume", "musicVolume", "effectsVolume", "shake"].includes(key) ? Math.round(value * 100) + "%" : key === "reticle" ? value + "px" : Number(value).toFixed(2);
  function changeMatchQuality(value) {
    if (value === quality.name || !QUALITY_CHOICES.some(([id]) => id === value)) return;
    const next = renderQuality(value, window.devicePixelRatio);
    if (quality.shadowSize !== next.shadowSize || !next.shadows) {
      arenaSun.shadow.map?.dispose();
      arenaSun.shadow.map = null;
      arenaSun.shadow.mapSize.set(next.shadowSize, next.shadowSize);
    }
    arenaSun.castShadow = renderer.shadowMap.enabled = next.shadows;
    renderer.setPixelRatio(next.pixelRatio);
    quality = next;
    settings.quality = next.name;
    timings = frameTimings();
    networkTimings = frameTimings();
    paint();
    onSettingsChange?.({ quality: next.name });
  }
  function openMatchSettings() {
    pause();
    $(".sr-pause-actions").hidden = true;
    $(".sr-break h2").textContent = "Settings";
    const panel = $(".sr-match-options");
    panel.innerHTML = '<div class="sr-match-option-list"><fieldset class="sr-match-quality"><legend>Graphics quality</legend>' +
      QUALITY_CHOICES.map(([id, label]) => '<button data-match-quality="' + id +
        '" aria-pressed="' + (quality.name === id) + '">' + label + '</button>').join('') +
      '</fieldset>' + matchRanges.map(([key, label, min, max, step, fallback]) => {
      const value = settings[key] ?? fallback;
      return '<label><span>' + label + '</span><output>' + optionValue(key, value) + '</output><input type="range" aria-label="' + label + '" data-match-setting="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></label>';
    }).join("") + [['invertY', 'Invert vertical aim'], ['reducedMotion', 'Reduced motion']].map(([key, label]) => '<label class="sr-option-toggle"><span>' + label + '</span><input type="checkbox" aria-label="' + label + '" data-match-setting="' + key + '" ' + (settings[key] ? 'checked' : '') + '></label>').join('') + '</div><button class="sr-options-done">Back to match menu</button>';
    panel.hidden = false;
    panel.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  }
  function cycleMenuFocus(panel, reverse) {
    const buttons = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled)")].filter(el => el.getClientRects().length);
    const index = buttons.indexOf(document.activeElement);
    buttons[index < 0 ? (reverse ? buttons.length - 1 : 0) :
      (index + (reverse ? -1 : 1) + buttons.length) % buttons.length]?.focus();
  }
  function focusAim() {
    skipFrameSample = true;
    roundMusic.configure(settings.audioBuffers?.finale, audioLevel(settings,'music'));
    roundMusic.unlock();
    setPaused(false);
    showPauseActions();
    $(".sr-break").hidden = true;
    lastMouseX = lastMouseY = null;
    canvas.focus({ preventScroll: true });
    try {
      if (!audio && settings.volume > 0) {
        audio = new AudioContext();
        audioOutput = gameAudioOutput(audio);
        combatAudio = createCombatAudio(audio, settings.audioBuffers, audioLevel(settings,'effects'), signal, audioOutput.input);
        void combatAudio.load();
      }
      if (audio?.state === "suspended") void audio.resume().catch(() => {});
    } catch {}
    if (spectating) {
      denied = true;
      $(".sr-enter").hidden = true;
      return;
    }
    const fallback = () => {
      if (stopped) return;
      denied = true;
      $(".sr-enter").hidden = true;
    };
    if (!container.requestPointerLock) {
      fallback();
      return;
    }
    try {
      const result = container.requestPointerLock();
      if (result?.catch) result.catch(fallback);
    } catch {
      fallback();
    }
  }
  handle(document, "pointerlockchange", () => {
    locked = document.pointerLockElement === container;
    if (locked) {
      // A lock request may finish after Pause or Loadout was opened.
      // Only an explicit resume action is allowed to close those menus.
      if (paused || loadoutOpen) {
        wasLocked = false;
        document.exitPointerLock();
        return;
      }
      wasLocked = true;
      denied = false;
      setPaused(false);
      $(".sr-enter").hidden = true;
      $(".sr-break").hidden = true;
      canvas.focus();
    } else if (wasLocked) {
      wasLocked = false;
      if (!loadoutOpen) pause();
    }
  });
  handle(document, "pointerlockerror", () => {
    denied = true;
    $(".sr-enter").hidden = true;
  });
  handle(window, "blur", pause);
  handle(document, "visibilitychange", () => {
    if (document.hidden) pause();
  });
  handle($(".sr-pause"), "click", pause);
  handle($(".sr-settings"), "click", openMatchSettings);
  handle($(".sr-open-settings"), "click", openMatchSettings);
  handle($(".sr-match-options"), "click", (event) => {
    const choice = event.target.closest("[data-match-quality]");
    if (choice) {
      changeMatchQuality(choice.dataset.matchQuality);
      for (const button of $(".sr-match-options").querySelectorAll("[data-match-quality]")) {
        button.setAttribute("aria-pressed", String(button.dataset.matchQuality === quality.name));
      }
    }
    if (event.target.closest(".sr-options-done")) { showPauseActions(); $(".sr-continue").focus(); }
  });
  handle($(".sr-match-options"), "input", (event) => {
    const input = event.target, key = input.dataset.matchSetting;
    const range = matchRanges.find(row => row[0] === key);
    if (!range && !['reducedMotion', 'invertY'].includes(key)) return;
    const value = input.type === 'checkbox' ? input.checked : clamp(Number(input.value), range[2], range[3]);
    if (typeof value === "number" && !Number.isFinite(value)) return;
    settings[key] = value;
    if (range) input.parentElement.querySelector("output").value = optionValue(key, value);
    if (key === "reticle") root.style.setProperty("--reticle", value + "px");
    if (key === "reducedMotion") root.classList.toggle("reduced-motion", value);
    if (["volume","effectsVolume"].includes(key)) {
      combatAudio?.dispose();
      if (audio) { combatAudio = createCombatAudio(audio, settings.audioBuffers, audioLevel(settings,'effects'), signal, audioOutput.input); void combatAudio.load(); }
    }
    if (["volume","musicVolume"].includes(key)) roundMusic.configure(settings.audioBuffers?.finale, audioLevel(settings,'music'));
    onSettingsChange?.({ [key]: value });
  });
  handle($(".sr-armory-back"), "click", () => closeLoadout());
  handle($(".sr-rifle-equip"), "click", () => void equipRifle());
  handle($(".sr-rifle-list"), "click", (event) => {
    const choice = event.target.closest("[data-match-weapon]");
    if (!choice || equipping) return;
    selectedRifle = choice.dataset.matchWeapon;
    renderLoadout();
  });

  handle($(".sr-continue"), "click", focusAim);
  handle($(".sr-enter button"), "click", focusAim);
  handle($(".sr-finish"), "click", finish);
  handle($(".sr-leave"), "click", () => {
    cleanup();
    onExit?.();
  });
  handle(container, "contextmenu", (e) => { if (locked || e.target === canvas) e.preventDefault(); });
  listenMouseButtons(container, window, (e) => {
    if (!locked && e.target !== canvas) return;
    e.preventDefault();
    if (stopped || paused) return;
    if (!locked && !denied) {
      focusAim();
      return;
    }
    if (spectating) {
      if (e.button === 0 || e.button === 2) watchedPlayer(e.button === 0 ? 1 : -1);
      return;
    }
    if (e.button === 0) {
      fireHeld = true;
      if (selectedEquipment === "rifle") shoot();
      else if (selectedEquipment === "knife") knifeAttack();
      else primeGrenade();
    }
    if (e.button === 2 && selectedEquipment === "rifle") {
      inspectAt = -3000;
      rightButtonHeld = true;
      scoped = true;
    }
  }, (e) => {
    if (e.button === 0) { fireHeld = false; throwGrenade(); }
    if (e.button === 2) { rightButtonHeld = false; scoped = false; }
  }, signal, (buttons) => {
    if (buttons.includes(0)) {
      if (primeAt !== null && session) void command('cancelprime', {});
      if (primeAt !== null) combatAudio?.cancelPrime();
      primeAt = null;
      fireHeld = false;
    }
    if (buttons.includes(2)) { rightButtonHeld = false; scoped = false; }
  });
  handle(canvas, "mouseenter", () => {
    lastMouseX = lastMouseY = null;
  });
  handle(canvas, "mouseleave", () => {
    lastMouseX = lastMouseY = null;
  });
  handle(document, "mousemove", (e) => {
    if (spectating) return;
    if (!(e.buttons & 2)) { rightButtonHeld = false; scoped = false; }
    if (paused || (!locked && !denied) || (!locked && e.target !== canvas)) {
      return;
    }
    const dx = locked
      ? e.movementX
      : lastMouseX === null
      ? 0
      : e.clientX - lastMouseX;
    const dy = locked
      ? e.movementY
      : lastMouseY === null
      ? 0
      : e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    ({yaw, pitch} = mouseAim(yaw, pitch, dx, dy, settings, scoped));
  });
  handle(window, "keydown", (e) => {
    if (stopped) return;
    if (e.metaKey || e.altKey) return;
    if (loadoutOpen) {
      if (["KeyB", "Escape", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyB") closeLoadout();
      if (e.code === "Escape") pause();
      if (e.code === "Enter") void equipRifle();
      if (!equipping && ["ArrowLeft", "ArrowRight"].includes(e.code)) {
        const choices = selectableRifles(WEAPONS, settings.ownedRifles);
        const index = choices.findIndex((w) => w.id === selectedRifle);
        if (choices.length) selectedRifle = choices[(index + (e.code === "ArrowRight" ? 1 : -1) + choices.length) % choices.length].id;
        renderLoadout();
      }
      if (e.code === "Tab") {
        cycleMenuFocus($(".sr-armory"), e.shiftKey);
      }
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      if (paused && !$(".sr-match-options").hidden) { showPauseActions(); $(".sr-continue").focus(); return; }
      if (!paused) pause();
      return;
    }
    if (paused) {
      if (e.code === "Tab") {
        e.preventDefault();
        cycleMenuFocus($(".sr-break"), e.shiftKey);
      }
      return;
    }
    if (spectating && ["ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) watchedPlayer(e.code === "ArrowRight" ? 1 : -1);
      return;
    }
    if (!p.alive && !["Tab", "KeyB"].includes(e.code)) return;
    if (["Digit1", "Digit2", "Digit3"].includes(e.code)) {
      e.preventDefault(); if (!e.repeat) selectEquipment({ Digit1: "rifle", Digit2: "knife", Digit3: "grenade" }[e.code]); return;
    }
    if (
      !Object.values(binds).includes(e.code) &&
      !["Tab", "KeyB", "KeyC"].includes(e.code)
    ) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === binds.jump) jump = true;
    if (e.code === binds.crouch || e.code === "KeyC") slide = true;
    if (e.code === binds.leanLeft) lean = lean === -1 ? 0 : -1;
    if (e.code === binds.leanRight) lean = lean === 1 ? 0 : 1;
    if (e.code === binds.reload && selectedEquipment === "rifle") reload();
    if (e.code === binds.inspect && selectedEquipment === "rifle" && !scoped && !reloadAt && primeAt === null) inspectAt = now();
    if (e.code === "Tab") {
      board();
      $(".sr-board").hidden = false;
    }
    if (e.code === "KeyB") openLoadout();
  });
  handle(window, "keyup", (e) => {
    keys.delete(e.code);
    if (e.code === "Tab") $(".sr-board").hidden = true;
  });
  function cleanup(preserveAim = false) {
    if (stopped) return;
    stopped = true;
    const frameReport = timings.summary();
    if (frameReport) onPerformance?.({ ...frameReport, quality: quality.name, network: networkTimings.summary() });
    stopQueue?.();
    cancelAnimationFrame(frame);
    ctrl.abort();
    loadoutPreview?.dispose();
    resize.disconnect();
    if (!preserveAim && document.pointerLockElement === container) document.exitPointerLock();
    combatAudio?.dispose();
    audioOutput?.dispose();
    if (lastActivity) onActivityChange?.(false);
    if (audio) void audio.close().catch(() => {});
    if (!handoffToResults) roundMusic.stop();
    equipmentEffects.dispose();
    deathEffects.dispose();
    muzzleEffects.dispose();
    for(const actor of retiredActors)disposeRifle(actor.model);
    retiredActors.length=0;
    const mats = new Set(), geo = new Set(), textures = new Set();
    for (const s of [scene, view]) {
      s.traverse((o) => {
        if (o.geometry) geo.add(o.geometry);
        if (o.material) { for (const m of [].concat(o.material)) mats.add(m); }
      });
    }
    for (const m of mats) {
      for(const key of ['map','bumpMap','normalMap','roughnessMap'])if(m[key])textures.add(m[key]);
      m.dispose();
    }
    for (const g of geo) g.dispose();
    for (const t of textures) t.dispose();
    arenaSun.shadow.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    root.remove();
  }
  if (session) applyState(session.state);
  function watchedPlayer(change = 0) {
    const participants = session.state.players.filter((q) => !q.spectator);
    const living = participants.filter((q) => q.alive);
    const choices = living.length ? living : participants;
    if (!choices.length) return null;
    let index = choices.findIndex((q) => q.id === watchedId);
    if (index < 0) index = 0;
    else index = (index + change + choices.length) % choices.length;
    watchedId = choices[index].id;
    return choices[index];
  }
  const nameplateDirection = new T.Vector3();
  function loop() {
    if (stopped) return;
    const t = now();
    if (!skipFrameSample && !paused && !document.hidden && (locked || denied)) timings.record(t - last);
    skipFrameSample = false;
    const dt = practice && paused ? 0 : clamp((t - last) / 1000, .001, .05);
    last = t;
    animTime += dt;
    deathEffects.update(t);
    for(let i=retiredActors.length-1;i>=0;i--)if(t>=retiredActors[i].until){disposeRifle(retiredActors[i].model);retiredActors.splice(i,1);}
    if (practice) {
      if (!paused) {
        elapsed += dt * 1000;
        if (elapsed >= duration) {
          finish();
          return;
        }
      }
      targets.forEach(([x, z, r], i) => {
        const f = foes.get(i);
        const returned = !f.model.visible && elapsed >= f.until;
        if (returned) { f.knifeHits = 0; f.health = MAX_HEALTH; }
        f.model.visible = elapsed >= f.until;
        const w = elapsed * .00072 + i * 1.71;
        f.model.position.set(x + Math.sin(w) * r, 0, z);
        f.model.rotation.y = Math.PI + Math.cos(w) * .5;
      });
    } else {for (const f of foes.values()) {
        f.model.position.lerp(f.dest, 1 - Math.exp(-dt * 15));
        f.model.rotation.y=approachAngle(f.model.rotation.y,f.yawTarget ?? f.model.rotation.y,dt);
        f.model.scale.y+=( (f.stanceTarget ?? 1)-f.model.scale.y)*(1-Math.exp(-dt*18));
      }}
    for (const f of foes.values()) {
      f.label.visible = !spectating || f.id !== watchedId;
      const position = f.model.position;
      const distance = f.previous ? Math.hypot(position.x - f.previous.x, position.z - f.previous.z) : 0;
      // A respawn/teleport should start idle rather than create a sprint stride.
      const speed = dt <= 0 || distance > 1 || !f.model.visible ? 0 : distance / dt;
      animateOperator(f.model, speed, dt);
      animateOperatorCombat(f.model,{pitch:f.pitchTarget,lean:f.leanTarget,swingAge:t-(f.swingAt??-Infinity),throwAge:t-(f.throwAt??-Infinity),
        charge:f.primeTime==null?0:(serverNow()-f.primeTime)/CHARGE_MS,items:f.extras,snap:f.poseSnap,reducedMotion:settings.reducedMotion},dt);
      f.poseSnap=false;
      f.model.rotation.z = !settings.reducedMotion && t - (f.hurtAt || -Infinity) < 180 ? Math.sin((t - f.hurtAt) / 180 * Math.PI) * .04 : 0;
      if (!practice && f.grounded && f.model.visible && speed > 1) {
        f.stepDistance = (f.stepDistance || 0) + distance;
        if (f.stepDistance > 2.4) { f.stepDistance = 0; const mix = remoteShotMix(camera.position, position, camera.rotation.y); combatAudio?.cue("footsteps", mix.level * .55, mix.pan); }
      }
      f.model.userData.gun.userData.flash.visible = t < (f.flashUntil || 0);
      updateWardrobeEffects(f.model,t,{quality:settings.quality,reducedMotion:settings.reducedMotion,hidden:!f.model.visible,speed});
      updateRifleSkinEffects(f.model.userData.gun,t,{quality:settings.quality,reducedMotion:settings.reducedMotion,hidden:!f.model.visible});
      if (!f.previous) f.previous = position.clone();
      else f.previous.copy(position);
    }
    if (practice && !paused) {
      for (const grenade of localGrenades) {
        stepGrenade(grenade, map, dt);
        if (grenade.age < FUSE_MS / 1000 - .00001) continue;
        const blast = new T.Vector3(grenade.x, grenade.y, grenade.z); presentBlast(grenade.id, blast);
        const self = new T.Vector3(p.x, p.y + p.eyeHeight * .6, p.z).sub(blast), selfDistance = self.length(); self.normalize();
        if (p.alive && blastDamage(selfDistance) && (traceSurface(map, new T.Ray(blast, self))?.distance ?? Infinity) >= selfDistance - .1) {
          damagePlayer(p, blastDamage(selfDistance)); hurtUntil = t + 650;
          if (p.health === 0) { p.alive = false; p.respawnAt = t + 2000; deaths++; streak = 0; resetInput(); combatAudio?.cancelChamber(); combatAudio?.eliminate(.8); }
          else message("Wounded", 700);
        }
        for (const foe of foes.values()) {
          if (!foe.model.visible) continue;
          const target = foe.model.position.clone().add(new T.Vector3(0, 1.62 * .6, 0)), direction = target.clone().sub(blast), distance = direction.length(); direction.normalize();
          if (blastDamage(distance) && (traceSurface(map, new T.Ray(blast, direction))?.distance ?? Infinity) >= distance - .1) {
            damagePlayer(foe, blastDamage(distance)); foe.hurtAt = t;
            if (foe.health === 0) secondaryKill(foe, "grenade", direction);
            else message("Blast hit", 500);
          }
        }
      }
      localGrenades = localGrenades.filter((g) => g.age < FUSE_MS / 1000 - .00001);
    }
    const visibleGrenades = practice ? localGrenades : remoteGrenades.map((state) => stepGrenade({ ...state }, map, Math.max(0, serverNow() - state.updatedAt) / 1000));
    if (!practice) for (const grenade of visibleGrenades) if (grenade.age >= FUSE_MS / 1000 - .00001) presentBlast(grenade.id, grenade, serverNow() - grenade.createdAt - FUSE_MS);
    equipmentEffects.sync(visibleGrenades.filter(g => g.age < FUSE_MS / 1000 - .00001)); equipmentEffects.update(t);
    if (practice && !paused && !p.alive && t >= p.respawnAt) {
      resetInput(); meleeAt = throwAt = -Infinity;
      resetPlayerMotion(p,map.spawns[0]);Object.assign(p,{alive:true,health:MAX_HEALTH});
      hurtUntil = 0; blastAt = -Infinity;
      equipmentAt=t;shotAt=-Infinity;kick=zoom=stepDistance=stride=bobAmount=fallSpeed=landingSpeed=0;landedAt=-Infinity;
      yaw = p.yaw; pitch = 0; cameraFeet = 0; grenadeStock = 1; selectedEquipment = "rifle"; ammo = 1; reloadAt = nextShot = 0; autoRifleAt = Infinity; updateEquipmentHUD();
    }
    if (t >= autoRifleAt) { selectedEquipment = "rifle"; equipmentAt = t; scoped = false; fireHeld = false; autoRifleAt = Infinity; updateEquipmentHUD(); }
    const active = !paused && !needsResync && p.alive && (locked || denied);
    equipmentEffects.guide({ ...p, yaw, pitch }, primeAt === null ? 0 : clamp((t - primeAt) / CHARGE_MS, 0, 1), t, active && selectedEquipment === "grenade" && primeAt !== null);
    const playing = !paused && !needsResync && (locked || denied);
    if (playing !== lastActivity) {
      lastActivity = playing;
      onActivityChange?.(playing);
    }
    if (active || session) {
      const down = (k) => active && keys.has(binds[k]),
        input = {
          forward: Number(down("forward")) - Number(down("backward")),
          strafe: Number(down("right")) - Number(down("left")),
          sprint: down("sprint") && !scoped,
          scoped,
          jump: active && jump,
          crouch: down("crouch") || (active && keys.has("KeyC")),
          slide: active && slide,
          lean: active ? lean : 0,
          yaw,
          pitch,
          dt,
        };
      if (p.alive) {
        const wasGrounded=p.grounded;
        fallSpeed=Math.max(fallSpeed,-(p.vy||0));
        movePlayer(p, input, dt, map);
        if(!wasGrounded&&p.grounded){landedAt=t;landingSpeed=fallSpeed;fallSpeed=0;}
        if(p.grounded)fallSpeed=0;
        if (session) queueMovementFrame(frames, input);
      }
      jump = slide = false;
    }
    if (active && t >= pendingKnifeAt && selectedEquipment === "knife") landKnife();
    if (active && fireHeld && selectedEquipment === "knife") knifeAttack();
    if (session) network(t);
    if (reloadAt && t >= reloadAt) {
      reloadAt = 0;
      if (practice) ammo = 1;
    }
    const speed = Math.hypot(p.vx || 0, p.vz || 0);
    const desiredBob=!settings.reducedMotion&&p.grounded&&active?Math.min(1,speed/7):0;
    bobAmount+=(desiredBob-bobAmount)*(1-Math.exp(-dt*14));
    stride+=speed*dt*1.65;
    const moving=bobAmount,landing=landingCompression(t-landedAt,landingSpeed,settings.reducedMotion);
    if (active && p.grounded && speed > 1) {
      stepDistance += speed * dt; if (stepDistance > 2.4) { stepDistance = 0; combatAudio?.cue("footsteps", speed < 4 ? .45 : .8); }
    } else stepDistance = 0;
    zoom += (Number(scoped && p.alive && !paused) - zoom) *
      (1 - Math.exp(-dt * 22));
    const recoil = shotRecoil(t - shotAt, weaponId);
    kick = recoil.kick;
    const newFov = 70 - zoom * 43;
    if (Math.abs(camera.fov - newFov) > .02) {
      camera.fov = newFov;
      camera.updateProjectionMatrix();
    }
    cameraFeet = smoothCameraHeight(
      cameraFeet,
      p.y,
      dt,
      p.grounded,
      settings.reducedMotion,
    );
    const eye = eyeOrigin(p,yaw),desiredEyeY=cameraFeet + p.eyeHeight - landing*(1-zoom*.8) + Math.sin(stride*2) * .022 * moving * (1 - zoom * .95);
    camera.position.set(eye[0],clampCameraEyeY(map,{x:eye[0],y:p.y,z:eye[2]},desiredEyeY),eye[2]);
    updateAimRotation(camera, yaw, pitch, kick, settings.reducedMotion ? 0 : settings.shake ?? .5, p.lean || 0);
    const inspect = clamp((t - inspectAt) / 1350, 0, 1),
      swing = Math.sin(inspect * Math.PI);
    const reloading = reloadAt
      ? Math.sin(clamp(1 - (reloadAt - t) / timing.reload, 0, 1) * Math.PI)
      : 0;
    gun.visible = selectedEquipment === "rifle" && zoom <= .75 && p.alive;
    knifeModel.visible = selectedEquipment === "knife" && p.alive && !spectating;
    grenadeModel.visible = selectedEquipment === "grenade" && p.alive && !spectating;
    const bladePose = knifeSwing(t - meleeAt, knifeSide, settings.reducedMotion);
    const draw = 1 - clamp((t - equipmentAt) / 220, 0, 1);
    knifeModel.position.set(bladePose.x, bladePose.y - draw * .28, bladePose.z);
    knifeModel.rotation.set(bladePose.rx, -.35, bladePose.rz);
    const charge = primeAt === null ? 0 : clamp((t - primeAt) / CHARGE_MS, 0, 1), toss = Math.sin(clamp((t - throwAt) / 380, 0, 1) * Math.PI);
    grenadeModel.position.set(.32 + charge * .05, -.23 - charge * .08 + toss * .14, -.65 + charge * .09 - toss * .2);
    grenadeModel.rotation.set(charge * -.4 + toss * 1.4, -.3, -.2);
    for (const node of grenadeModel.userData.itemNodes) node.visible = t - throwAt > 450;
    if (spectating) {
      gun.visible = false;
      const watched = watchedPlayer();
      if (watched) {
        const position = foes.get(watched.id)?.model.position || watched;
        const view = spectatorView(map, { ...watched, x: position.x, y: position.y, z: position.z });
        camera.position.set(view.position.x, view.position.y, view.position.z);
        camera.lookAt(view.focus.x, view.focus.y, view.focus.z);
      }
    }
    const blastAge = Math.max(0, (t - blastAt) / 1000);
    const pressure = !settings.reducedMotion && blastAge < .32 ? Math.sin(blastAge * 65) * Math.exp(-blastAge * 14) * blastForce * (settings.shake ?? .5) : 0;
    const viewKick = kick * (settings.reducedMotion ? .35 : 1);
    gun.position.set(
      .38 * (1 - zoom) + moving * Math.sin(stride) * .011,
      -.34 - draw * .28 + moving * Math.cos(stride*2) * .006 - landing*.5 + zoom * .08 + viewKick * .025 -
        reloading * .07,
      -.91 + viewKick * .14 + pressure * .12,
    );
    alignRifleToCenter(gun);
    gun.rotation.x += viewKick * .12 - reloading * .20;
    gun.rotation.y += swing * .92;
    gun.rotation.z += -swing * .30 - reloading * .18;
    animateMuzzleFlash(gun.userData.flash, recoil.flash, shots);
    gun.userData.bolt.position.z = -.06 +
      Math.sin(clamp(1 - (nextShot - t) / timing.shot, 0, 1) * Math.PI) * .12;
    root.classList.toggle("sr-scoped", zoom > .75);
    root.classList.toggle("sr-dead", !p.alive);
    root.classList.toggle("sr-wounded", p.alive && p.health <= KNIFE_DAMAGE && !spectating);
    root.classList.toggle("sr-damaged", p.alive && t < hurtUntil && !spectating);
    root.classList.toggle("sr-hit", t < toastUntil);
    if (t - lastHUD > 80) {
      lastHUD = t;
      const deadline = practice
        ? duration - elapsed
        : matchDeadline(session.state, serverNow());
      roundMusic.countdown(deadline, !queueSession && (practice || phase === "live"));
      root.classList.toggle("sr-final-seconds", !queueSession && deadline <= 5000 && deadline > 0 && (practice || phase === "live"));
      hudText(".sr-clock b", queueSession ? (queueSession.state.players.filter(player=>!player.spectator).length + " / 15 PLAYERS") : deadline === Infinity && !practice ? 'FIRST TO ' + session.state.settings.targetPoints : clock(deadline));
      hudText(".sr-clock strong", queueSession ? "Practice · matchmaking" : spectating ? "Spectating · " + (watchedPlayer()?.name || "Waiting for players") : phase === "warmup" ? (safelyPublic() ? "PRACTICE AREA · MATCH STARTS IN" : "Match starts in") : mode);
      hudText(".sr-ammo b", selectedEquipment === "knife" ? "" : selectedEquipment === "grenade" ? grenadeStock : "∞");
      updateEquipmentHUD();
      hudText(".sr-ammo small", selectedEquipment === "rifle"
        ? reloadAt ? "CHAMBERING · " + Math.max(0, (reloadAt - t) / 1000).toFixed(1) + "s" : weaponById(weaponId).name.toUpperCase()
        : selectedEquipment === "knife" ? "FIELD KNIFE" : primeAt !== null ? "RELEASE TO THROW" : "FRAG GRENADE");
      hudText(".sr-ammo-readout > span", selectedEquipment === "grenade" ? primeAt !== null ? Math.round(charge * 100) + "%" : "HOLD LMB" : "");
      $(".sr-chamber").value = selectedEquipment === "rifle" ? reloadAt ? clamp(1 - (reloadAt - t) / CHAMBER_MS, 0, 1) : 1
        : selectedEquipment === "grenade" ? primeAt !== null ? charge : grenadeStock : clamp((t-meleeAt)/KNIFE_MS,0,1);

      $(".sr-respawn").hidden = p.alive || spectating;
      if (!p.alive && !spectating) {
        $(".sr-respawn").textContent = "Eliminated · respawn in " +
          Math.max(0, (p.respawnAt - (practice ? t : serverNow())) / 1000).toFixed(1) + "s";
      }
      if (!practice && lastSync + 3000 < t) {
        message("Connection interrupted", 300);
      }
      updateLiveBoard();
      hudText(".sr-rank",
        !practice && session.state.settings.mode === 'ctf'
          ? 'BLUE ' + session.state.scores.blue + ' — ' + session.state.scores.orange + ' ORANGE · FIRST TO 3' + (Object.values(session.state.flags || {}).some(flag => flag.carrier === meId) ? ' · YOU HAVE THE FLAG' : '')
          : !practice && session.state.settings.mode === "tdm"
          ? "BLUE " + session.state.scores.blue + " — " +
            session.state.scores.orange + " ORANGE"
          : !practice && session.state.settings.mode === 'duel' ? session.state.players.filter(q => !q.spectator).map(q => q.name + ' ' + q.kills).join(' — ') : !practice && session.state.settings.mode === 'arms' ? (()=>{const a=armsStage(p.armsKills);return a.final?'FINAL · KNIFE':a.name.toUpperCase()+' · '+a.progress+' / '+a.target;})() : "");
      hudText(".sr-ping", practice ? "PRACTICE" : ping + " ms");
      if (infoUntil < t) {
        hudText(".sr-status", (!practice && p.shieldUntil > serverNow())
          ? "Spawn protection"
          : "");
      }
      if (toastUntil < t) hudText(".sr-toast", "");
      if (!$(".sr-board").hidden) board();
      hint.style.opacity = t > hintUntil && (elapsed > 22000 || (!practice && shots > 3))
        ? "0"
        : "1";
    }
    updateRifleSkinEffects(gun,t,{quality:settings.quality,reducedMotion:settings.reducedMotion,hidden:zoom>.6||!p.alive});
    muzzleEffects.update(t, zoom > .75);
    if (!paused || t - lastDrawAt >= 1000 / 15) {
      lastDrawAt = t;
      camera.getWorldDirection(nameplateDirection);
      for (const f of foes.values()) {
        const depth=(f.model.position.x-camera.position.x)*nameplateDirection.x+(f.model.position.y+2.03*f.model.scale.y-camera.position.y)*nameplateDirection.y+(f.model.position.z-camera.position.z)*nameplateDirection.z;
        const width=nameplateWorldWidth(depth,camera.fov,viewportHeight);
        f.label.scale.set(width,width*(f.badge?.length ? .275 : .1875),1);
      }
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(view, viewCam);
    }
    frame = requestAnimationFrame(loop);
  }
  $(".sr-enter").hidden = locked;
  if (!locked && navigator.userActivation?.isActive) focusAim();
  frame = requestAnimationFrame(loop);
  if(queueSession)stopQueue=watchSession(queueSession,(state)=>{
    if(state.phase==='waiting')return true;
    cleanup();onExit?.({preserveRoom:true});return false;
  },(error)=>{
    if(isSessionExpired(error)){cleanup();onExit?.({connectionError:error.message});return false;}
    message("Reconnecting to matchmaking…",2100);return recoveryDelay(queueSession.failures||1);
  });
  if(session){
    // Background tabs may suspend RAF; keep the room alive without driving physics from this timer.
    const heartbeat=setInterval(()=>{if(!stopped && document.hidden)network(now());},10000);
    signal.addEventListener('abort',()=>clearInterval(heartbeat),{once:true});
  }
  return cleanup;
}
