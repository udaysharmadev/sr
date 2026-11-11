# Current game polish

**Latest checkpoint — 6 November, core physics/presentation pass:** `tests 101`, `pass 101`, `fail 0`; 74 assets, 3.34 MiB Worker gzip / 4,473,834 bytes (4.27 MiB) raw client. Shared 120Hz movement substeps with vector-limited acceleration remove diagonal acceleration advantage; swept grenade contacts and fixed integration remainder prevent thin-cover tunnelling and give matching 30/60/144Hz bounces. Knife windup transition made continuous. Added bounded landing compression, distance-driven walk bob, shortest-angle remote turning/crouch interpolation, displacement-driven grenade tumble and blast dust ring/debris floor correction. All-map route/roof/crouch and new physics/resource checks pass. Actual 1280×720 browser climbed/descended Crosswind stairs, held knife swings, grenade target elimination/auto rifle, exact reticle center (640,360); no captured errors. Worker changed delivery 5/5 PASS, runtime/generated syntax PASS. Remote presentation WAN/device review remains open; no perfection/production claim. Prior reward/UI work retained.

The current product roadmap and requirement status live in [PRD.md](PRD.md), with observed checks in [QA_REPORT.md](QA_REPORT.md). Milestone B/C implementation is present; continue the explicit manual/platform release gates. This file retains the earlier polish record.

## Active continuation — connection and rendering

### Plan — one consistent settings gear

| File | Change | Check |
| --- | --- | --- |
| dist/icons.js | Replace asymmetric cog with a centered, symmetric eight-tooth solid gear and clear circular hub | Inspect at actual lobby/menu/HUD sizes |
| dist/game.js | Reuse shared gear icon instead of the separate hand-drawn HUD path; explicit shared path attributes preserve solid fill | Lobby, settings Video tab and in-game icon match; buttons still work |

Decision: fix the existing shared vector icon and route the one duplicated in-game icon through it. No bitmap asset or icon dependency; preserve all settings behavior.

### Plan — match ranking HUD and right-side controls

| File | Change | Check |
| --- | --- | --- |
| dist/game.js, dist/game.css | Compact charcoal ranking strips, warm placement markers, animated rank changes and own-player highlight; move pause/settings icons to top-right, feed below | Real names/scores, own rank outside top five, consistent Rush/Bay fonts, no overlap with clock/feed |
| dist/game.js, dist/menu.js | In-match aim/audio options using the existing pause/input lifecycle, save changes back to current settings | Opening cancels fire/scope/prime; values apply and persist; keyboard focus stays inside menu |
| QA_REPORT.md | Actual browser screenshot and final automated/build evidence | No claim of compact viewport coverage unless dimensions really change |

Decision: reuse the existing ranked-player rows and pause layer. Remove the blue leaderboard panel and its large label; use legible individual ranking strips and warm rank accents. Settings must work in-match without exiting the room or constructing a separate app flow. If pointer-lock release re-enters pause, retain the selected options view.

### Plan — merge the supplied map references into playable arenas

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/menu.js, dist/game.js | Solo practice on each arena; replace diagram thumbnails with actual in-game captures after browser QA | Preserve queue identity and exclude practice rewards |
| dist/maps.js | Keep Crosswind; combine Yardline freight lanes with Switchyard gantries, Courtyard with Overlook balcony loop, Switchback/Skybridge with Foundry relay deck | Clear spawns, connected ground routes, at least two upper exits, no blocked stairs or enclosed spawn traps |
| backend/map-layout.test.mjs | Exercise new upper routes in both directions at 60/144 Hz and preserve all-map surface checks | Detect staircase headroom, railing/landing snags and unsupported joins |
| backend/cosmetics.test.mjs | Verify newly replicated character gear is canonical and clone-safe | No arbitrary values from client loadouts |
| PRD.md, QA_REPORT.md | Record actual feature/map status, current test/build evidence and remaining browser/hosting gates | Fresh browser capture only when CUA is available; reference render explicitly labelled |

Decision: implement the references through the existing shared box geometry, exposed-face batching and movement simulation. Reuse stairs, decks and open pavilion structures; no new physics or rendering dependency. Distinct lower flanks and multiple access points counter dominant balcony sightlines. If a route test stalls, correct geometry before visual QA.



### Plan — FFA launch loop, arenas and earned progression

| File | Work | Acceptance / risk |
| --- | --- | --- |
| dist/maps.js, dist/arena.js | Four distinct playable arena layouts, retain Crosswind; revise Switchyard/Overlook and add Foundry with individual material palettes | All spawns clear, ground paths connected, elevated routes climbable; preserve exposed-face rendering fix |
| backend/rooms.mjs, dist/game.js, dist/menu.js | Public FFA only, map votes retained, 10s playable warmup, queue practice stays in the same room and transitions to map vote/match; 2s respawn | No fake countdown without two real players, no public rewards in practice/warmup, no lost room identity |
| backend/rooms.mjs, dist/progression.js | Server-derived longest shot/headshot/airborne/quickscope/per-rifle statistics; cumulative profile, mastery, difficult badges and daily progress from completed public rounds only | Forged client counters ignored; results idempotent; badge/gold thresholds explicit and earned |
| dist/menu.js, dist/style.css | Profile stats, badge selection/progress, daily challenges and per-rifle mastery presentation using existing matte game menus | No invented stats, no progress awarded for private/practice, consistent typography |
| backend tests, PRD.md, QA_REPORT.md | Trace every new requirement, test lifecycle/queue/movement/progression, measure complete client bundle | Browser-dependent map screenshot pending browser access; private CTF/arms-race/tournament and public parties need their own implementation passes |

Decision: public map voting, authoritative hits, safe-spawn scoring and private FFA/duel/TDM already exist. The queue's current Practice button leaves matchmaking, warmup lasts 15s, and profile tracks only kills/deaths/rounds. Extend those shared paths instead of adding duplicate matchmaking or fake challenge counters. New private modes and bracket/party lifecycles remain explicit follow-on work rather than nonfunctional mode buttons.

### Plan — remove the blue menu treatment

| File | Change | Check |
| --- | --- | --- |
| dist/style.css | Warm charcoal menu canvas, flat neutral equipment/options, off-white text and restrained lime selected state; remove cyan glow and blue glass gradients | Actual settings/armory/locker at 1280×720 and compact settings; preserve Rush/Bay fonts, focus and spacing |
| dist/game.css | Match in-game armory and pause palette to the same materials | Rifle choices, pause readability and selection remain clear |
| PRD.md, QA_REPORT.md | Record visual evidence and new palette direction | Build/asset delivery, no claim of user approval or subjective finality |

Decision: the dominant blue/cyan comes from full-screen gradients, selected cards, borders and reflections applied across every menu. Use matte charcoal and warm grey with one lime accent instead of swapping blue for another saturated full-screen tint. This pass changes menu presentation; map geometry and equipped outfit colours stay intact.

### Plan — game menus, firing visibility and requested elimination cue

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/combat-audio.js, dist/assets/audio/USER_SOURCES.txt, backend/combat-audio.test.mjs | Cache the user-supplied elimination clip; play once on local confirmed kill or received elimination, through master mute, without shot reflections | Actual MP3 decode, correct event gating, cancellation/disposal; no cue on a miss or unrelated kill |
| dist/shot-effects.js, dist/rifle-models.js, dist/game.js, backend/shot-effects.test.mjs | More readable small muzzle flash and smoke, preserve the world-space origin and clear ADS view | Fix the flash's roll about its barrel axis, avoid rotating the cone sideways; verify lifetimes/reduced motion/clean scope and actual firing screenshots |
| dist/menu.js, dist/style.css, dist/weapon-preview.js | Rebuild settings with game tabs and full-width options; cohesive armory/locker navigation, actual rifle thumbnails, consistent lobby typography and clear equip actions | Preserve settings/gear; keyboard, category round-trips and compact 821×462 menus must fit and work |
| dist/game.css, dist/game.js | Bring pause and in-match loadout into the same menu language | Preserve loadout permissions, focus containment, held scope and automatic chamber |
| PRD.md, QA_REPORT.md | Record actual tests/build and visual checks | Keep subjective audio/device/hosting gaps explicit |

Decision: the current settings screen uses half the game canvas and clips its bottom actions; the modal button font overrides the lobby style, locker tiles repeat generic bag/gear icons, and rifle choices share the same silhouette. Replace those concrete patterns with consistent game controls and equipment presentation, retaining the existing 3D previews. Firing smoke currently uses small low-opacity puffs, and the cone's Euler Z spin changes its direction after the X alignment; fix orientation and improve readability rather than adding a large screen flash.

### Plan — surface feedback and input reset

| # | File | What changes | Risk / check |
| --- | --- | --- | --- |
| 1 | dist/shot-effects.js | Trace the nearest solid surface/floor and reuse bounded particles for brief dust plus a fading impact mark | Mark faces the actual hit face, never passes through nearer cover, expires and disposes |
| 2 | dist/game.js | Use that surface in the existing aim ray; show cosmetic impacts only when no nearer character is hit; clear toggled lean on input reset | Online damage remains server-owned; no mark on victims/sky; pause/reconnect/loadout cannot retain lean |
| 3 | backend/shot-effects.test.mjs | Cover surface normals, nearest obstruction, floor/miss and bounded impact lifetimes/resources | Regression must fail before implementation, existing muzzle checks remain valid |
| 4 | PRD.md, QA_REPORT.md | Record actual browser/automated evidence and limits | No claims of hardware or subjective sound validation |

Decision: the existing hit loop already computes the centre ray and box occlusion, but misses have no surface feedback. Share that same nearest-surface result with a small pooled cosmetic effect instead of adding a second ballistic simulation. `resetInput()` currently clears buttons but leaves the toggled `lean` value; clear it at the same source. If geometry or resource checks fail, fix the shared trace/pool before browser testing.

### Added user correction — flickering tower surfaces

| File | What changes | Verification |
| --- | --- | --- |
| dist/arena-geometry.js | Emit only exposed rectangles of axis-aligned structural boxes, subtracting overlapping and duplicate faces | Overlapping stairs, tower wall/floor joins, coplanar duplicates and hidden seams have one surface owner |
| dist/arena.js | Feed exposed structure into existing material batches; use face materials for caps instead of exact coplanar cap boxes | Keep original collision, panel UVs, geometry winding and draw-call batching; no change to map walkability |
| backend/arena-geometry.test.mjs | Exercise nested/touching/overlapping boxes and every actual map, plus exterior area/winding | No same-plane overlapping patches and no faces buried inside solid neighbours |

Decision: the screenshot corresponds to exact coplanar geometry in the renderer: cap boxes share their top and sides with the parent, and overlapping stair/tower boxes retain duplicate exterior faces. Remove these competing surfaces at mesh construction rather than masking flicker with global depth bias or reducing textures. The previous map visual pass missed this interior view.

### Map identity and connected routes — user-requested redesign

| File | Change | Risk / verification |
| --- | --- | --- |
| dist/maps.js | Ground-floor tower passages, slimmer roofs/back windows; Crosswind centre deck linked to east tower by a guarded L-shaped walkway; L-shaped ground cover | All structural geometry stays shared client/server; preserve centre occlusion and clear spawn exits |
| dist/arena.js | Slate-blue/sand/stone palette, subtle panel/grain surfaces instead of large checkerboards, quieter floor and perimeter; render walkways/rails consistently | Keep bright blocky game feel, low static draw-call count, no decorative invisible cover |
| dist/menu.js | Match map previews to actual material palette | New route structure appears in the existing arena picker |
| backend/map-layout.test.mjs | Spawn clearance, ground passage traversal, real staircase→bridge→centre route and shots beneath bridge | Exercise movement at 60/144Hz and authoritative hitscan; existing combat/corpse tests must pass |

Decision: keep the original blocky browser-game silhouette while replacing the dominant checker surfaces and disconnected solid towers. The new ground passages and upper connector must exist as actual collision boxes, not scenery that players cannot use. Rework is focused on the current Crosswind arena, with consistent building materials across all three maps.

### Added user steering — shot feel, sound and muzzle effects

| File | Change | Verification |
| --- | --- | --- |
| dist/combat-audio.js | Keep the supplied recordings; add a quiet, short filtered reflection only to firing, with no repeating feedback loop | Dry attack remains immediate, reload stays dry, all audio routes through master mute and is disposed |
| dist/presentation.js, dist/game.js | Sharper initial kick and short recovery, calmer bolt cycling | No reticle rotation or scope-radius change; aim ray computed before the new shot's visual kick |
| dist/shot-effects.js, dist/game.js, dist/rifle-models.js | Small muzzle sparkle and brief drifting smoke; bounded reusable particles | Real muzzle positions, clean ADS lens, no corpse flashes, bounded resources and exit cleanup |
| backend/combat-audio.test.mjs, backend/shot-effects.test.mjs | Exercise reflection routing/disposal and actual particle lifetime/reuse | Full tests/build plus browser shot capture; subjective sound balance remains user-listening dependent |

### 6 November — death pose and impact direction

| File | Change | Verification / risk |
| --- | --- | --- |
| backend/rooms.mjs | Record immutable victim position, stance, rifle and shot direction in accepted kill events | A later respawn/loadout change cannot rewrite the death pose; never accept pose data from the shooter |
| dist/death-animation.js | Use the event pose and impact direction; preserve independent weapon resources | Delayed kill at 1300ms must still appear at the death location, settle above the floor, expire at 1500ms |
| dist/game.js | Pass authoritative death pose into the existing corpse renderer | Older events without the new optional field keep the existing fallback |
| dist/game.js, dist/game.css | Remove the diagonal × overlaid on the crosshair after a kill; retain a color pulse, feed and elimination toast | Actual practice kill: center reticle shape/transform stays fixed before and after confirmation |
| backend/death-presentation.test.mjs | Actual server-kill → respawn → late corpse regression; directional falls and disposal | Existing hit/reload rules, all rifle resource tests and full build must pass |

Decision: kill events only retained x/z and the client cloned the latest actor state. Since respawn occurs at 1200ms and corpses remain for 1500ms, delayed events can clone a respawned actor at the wrong location/stance/rifle. Snapshot the accepted kill pose once and use it only for presentation; preserve authoritative scoring and timing.

### 6 November — control bindings and lifecycle

| File | Change | Verification |
| --- | --- | --- |
| dist/input-bindings.js | Share defaults, fixed-key validation, saved-binding repair and readable key labels | Reserved B/C/Tab/Esc cannot become movement; valid custom keys and swaps survive |
| dist/menu.js | Reject conflicting fixed shortcuts, explain fixed controls, associate binding buttons with actions | Browser reproduces old B conflict, then verifies rejection and valid J persistence |
| dist/game.js | Resolve the same binding map and derive movement/slide/inspect hints from it | Browser custom movement, pause/resume, B armory and scope checks |
| dist/game.js, dist/menu.js | Focus pause actions and contain keyboard navigation; expose the current key in each binding button's accessible name | Esc previously left focus on the arena canvas; Tab/Shift+Tab must stay in the open menu |
| dist/menu.js, dist/style.css | Use the full controls panel, fixed shortcuts on the right, visible Reset action | Browser at 1280×720 and 821×462; no clipped Reset or page-wide empty half |
| backend/input-bindings.test.mjs | Regression for reserved keys, duplicate repair and labels | Run affected checks, full suite and Worker build |

Decision: the browser accepted Forward=B while the game hardcodes B as armory and C as alternate crouch. Fix the shared control contract and repair legacy conflicts, rather than adding guards to individual gameplay actions. Keep mouse scope/fire and the 1500ms chamber rules intact.

### Browser QA correction plan

| File | Change | Risk / verification |
| --- | --- | --- |
| dist/spectator.js | Keep chase camera one metre inside the arena boundary, in front of decorative perimeter banners | Preserve wall sweep; check all four edges and real spectator render |
| backend/quality.test.mjs | Assert the camera stays before the perimeter decoration | Existing open-space and collision behavior must still pass |
| dist/game.js | Hide the watched player's redundant overhead label; hide view rifle at the exact scope-overlay threshold | Browser: no giant label in chase view or rifle flashing inside the lens during ADS |
| PRD.md, QA_REPORT.md | Replace stale browser-disabled status with observed QA and remaining release gates | Separate browser evidence from automated and hosted-only evidence |

Decision: fix the shared chase-camera boundary because the browser view is occluded by a banner at 25.75m while collision currently allows 25.88m. This is a local presentation change and does not change player collision.

Latest user correction: scope is strictly hold-RMB, with no toggle mode. Integrate the seven user-supplied Myinstants clips: four rifle voices and three chamber sounds, trim silence/extra shots, preserve 1500ms recovery and cancel pending chamber audio on death/exit. Verify timing and mute routing, then repeat browser scope/armory QA.

| Files | Change | Failure check |
| --- | --- | --- |
| dist/net.js, backend/net.test.mjs | Typed service errors, saved-tab session restore, no automatic mutation replay | Resume same identity; expired credentials cleared; transient failures retain room; accepted-but-lost mutation never duplicated |
| dist/menu.js, dist/game.js | Recover room heartbeat and resync prediction; explain terminal expiry | No leaving on a single failed poll; stop stale movement/fire during resync; no automatic fresh matchmaking |
| dist/quality.js and renderer owners | Low/balanced/high pixel/shadow presets and actual frame-time sampling | Defaults preserve existing high visuals; invalid settings safe; metrics retain visible stalls |
| dist/menu.js, PRD.md | Persist settings; report local measurements only; update evidence | Keep hardware/browser/platform gates open until observed |

## Next pass

| File | Change | Check |
| --- | --- | --- |
| dist/movement.js | Retain crouched capsule until there is headroom to stand | Walk out of a low tunnel at 60/144 Hz; feet stay on floor |
| dist/arena.js, dist/game.js | Distance-driven opponent stride, settling to idle; quieter ADS view bob | Animate actual operator meshes, preserve independent corpse lifetime |
| dist/shot-audio.js, dist/game.js | Attenuate and pan other players' recorded gunshots | Verify volume/pan, silence beyond range, decoded sample reuse |
| dist/game.js, dist/game.css | Correct equipped rifle text, consistent target font, sorted scoreboard; remove unused health styles | Syntax checks, gameplay tests and Worker build |

If a rig change breaks corpse cloning, keep the existing direct mesh hierarchy and animate around virtual hip pivots. Browser control was disabled on the last attempt; do not claim fresh visual QA without an observed render.

| File | Change | Risk / check |
| --- | --- | --- |
| dist/game.js, dist/game.css, dist/presentation.js | Always center hip/scope aim and ray; converge view rifle on center; retain independent recoil and inspection | Check pointer-lock fallback, held RMB + LMB, unchanged scope radius, rifle direction |
| dist/shot-audio.js, dist/assets/audio/ | Decode and cache local sampled sniper shot; remove synthetic firing tones | Check one decode, repeated shots, volume, cleanup and actual MP3 decode |
| server.mjs, build-worker.mjs | Serve and bundle MP3 with correct MIME type | Check local response and built Worker |
| backend/rooms.test.mjs | Verify rifle alignment and audio lifecycle | Run full suite and build; inspect final browser render |

Keep the completed stairs, textures, full-body lobby framing and 1.5-second corpse presentation. If an audio fetch/decode fails, allow retry and keep controls usable. Source and CC0 credit travel with the audio asset.

## Verification

Next pass completed: 17 tests pass, 0 failures. Shared client/server movement retains crouch beneath roofs; actual operator leg meshes stride and return to idle at 60/144 Hz. Remote shot attenuation and left/right pan, panner cleanup and mute behavior are checked. Corpse scale now preserves crouching and actual geometry stays above the floor. Built Worker serves all six changed gameplay files byte-for-byte. Build: 39 assets, 2.25 MiB gzip. Fresh browser visual QA remains pending from the disabled browser session.

- 14 tests passed: room rules, collision, stairs at 60/90/144 Hz, held RMB + LMB, corpse lifetime and isolation, responsive full-body fit, all eight rifles converging on the center ray, sampled-audio caching and cleanup.
- Real M2010 recording decoded by macOS AudioConverter: 48 kHz mono, 1.420 seconds, peak 0.660. Original synthetic shot/ready/reload tones removed.
- Worker build serves the exact 35,856-byte sample as audio/mpeg, its CC0 source credit, and changed game modules.
- Running local preview returns HTTP 200 and audio/mpeg; its game.js matches the updated source.
- Earlier browser checks confirmed full-body lobby framing and a constant 50vmin scope radius. Fresh visual verification of the latest centered gun pose is unavailable because browser use is disabled in Work settings. No fresh screenshot is claimed.
- Hosted publication remains unavailable in the switched account; the original Site was not recreated.

### Plan — editable identity, actual character portrait and secondary equipment

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/stage.js, dist/menu.js, dist/style.css | Capture the equipped lobby actor as portrait; name form with shared validation and persistence | Exact gear/head render, no account name overwriting custom alias; same guest stats retained |
| dist/game.js, dist/game.css | Unboxed equipped-weapon image beside ammunition; 1/2/3 equipment slots, melee animation and charge/release grenade | Keep centered aim, hold-RMB, 1500ms sniper chamber; cancel charge on pause/death/switch |
| dist/equipment.js, dist/equipment-models.js | Shared bounded grenade launch/bounce/fuse plus original knife/grenade meshes and blast visuals | Tap shorter than hold; collision prevents tunnelling; GPU resources disposed |
| backend/rooms.mjs, build-worker.mjs | Server equipment/cooldowns, prime duration, throw simulation, blast cover/team/shield checks and melee occlusion | Client cannot choose victims/damage/origin or fake charge; no duplicate attacks/rewards |
| backend tests, PRD.md, QA_REPORT.md | Test identity, trajectories and authoritative combat; browser profile/HUD/knife/grenade QA | Actual results and remaining limits recorded |

Decision: extend the current room authority and shared collision instead of adding client-owned damage. Knife is LMB melee; grenade charges while held and throws on release with an 1.8s fuse, at most once per 5s. Keys 1/2/3 select sniper/knife/grenade. Unlimited sniper ammunition and its current automatic chamber remain intact. New skin variants are future content; base equipment is playable now. If a collision/authority test fails, fix the shared path before browser presentation.

### Plan — combat feel, supplied Foley and match finale

| Files | Change | Evidence / failure checks |
| --- | --- | --- |
| dist/equipment.js, backend/rooms.mjs, dist/game.js | Two landed knife hits per life, tighter sweeping attack/recovery; one grenade per life and auto-return to sniper; 1cm rifle graze allowance | No cover penetration, head/body ordering, misses do not damage, shield/team rules; grenade resets only on respawn |
| dist/equipment-models.js, dist/game.js | Larger flash/dust burst, expanding lingering smoke, natural release and alternate knife swings/hit reaction | Bounded resources, reduced motion, clean aim; no geometry through walls from larger damage radius |
| dist/combat-audio.js, new round-music module, assets/audio | User pin/blast/stab/grass footsteps; distance-aware playback; Sigma fades in at five seconds remaining, swells at result poses | Decode supplied clips, no duplicated pin/footstep spam, master mute, one continuous music source across match→results, exit cleanup |
| dist/results-stage.js, dist/menu.js, dist/style.css | Full arena-backed top-player lineup with held rifles, individual poses and per-player stats aligned above actors | Match actual players/gear/stats; no fake winners or dashboard panel; 1280×720 and compact QA |
| tests, PRD.md, QA_REPORT.md | Verify authority, physics, audio lifecycle, animation/pose and actual browser evidence | Keep WAN/perfect-physics/device claims open; fix observed failures before completion |

Decision: reuse shared hit verification, progression, operator rigs and audio master output. Rifle graze forgiveness is a fixed 0.01m shell around existing hitboxes, bounded by the same nearer cover ray; it is not aim assistance or wide hit cones. Knife damage is two successful contacts, with no health bar. Grenade count is server-owned and returns on respawn; cosmetic blast size grows without increasing the existing lethal radius. Match-end music ownership transfers to results rather than restarting the clip. Reference image sets composition/feel, while actual game characters and original arena art are retained.

### Plan — game menus, earned currency, reward wheel and distinct equipment

| File | Change | Acceptance / risk |
| --- | --- | --- |
| dist/economy.js, dist/progression.js, backend economy/progression tests | 200 free coins per UTC day; gems-to-coins packs; daily free coin wheel and one golden wheel per seven days; gems only from challenges/golden wheel | No negative balance, duplicate claim/spin, reload reroll or spending before validation; guest-local persistence remains explicit |
| dist/index.html, dist/menu.js, dist/game-ui.css | Daily Challenges below Inventory, read-only gem counter, coin exchange/rewards, visual wheel; rebuild profile/shop/inventory/armory/maps/friends/settings presentation with one game typeface and restrained charcoal/gold palette | Clear purpose from title, image-led choices, little explanatory copy, no OS selects, no broken category/back paths; actual browser QA |
| dist/lobby.js, dist/arena.js, dist/stage.js | Six distinct outfit silhouettes, goggles/helmet/visor/accessories, different footwear structures; actual equipment thumbnails | Lobby/preview/results/remote silhouettes agree; clone/resource ownership, no new hitbox advantage |
| dist/weapons.js, dist/rifle-models.js | Real rifle names and recognisable stock/receiver/optic details, retain internal IDs and equal combat rules | Verify names from manufacturer sources; skins remain cosmetic, center aim/chamber unchanged |
| PRD.md, QA_REPORT.md | Trace implemented features and actual validation | No fake online users, rewards, new production authority or unverified device claims |

Decision: keep the existing renderer, room authority and progression ledger. Reward mutations are small pure functions, persisted before spin animation; a reload reveals the already committed prize instead of rerolling. Replace room native selects with in-game choice strips/steppers. Equipment silhouettes and real rendered thumbnails carry the collection UI, while each screen gets one clear primary action. If currency or resource checks fail, correct the shared mutation/ownership before browser polishing.

### Plan — core movement, projectile contact and physical presentation

| File | Change | Verification |
| --- | --- | --- |
| dist/movement.js, backend physics tests | Substep shared movement, vector-limited acceleration, prevent jump/slide retrigger during substeps | Equal cardinal/diagonal launch, 30/60/144 Hz travel, all-map stairs/roof/crouch, collision tests |
| dist/equipment.js, equipment tests | Swept sphere-axis grenade contacts, timestep-aware ground drag, continuous knife windup/strike | Thin geometry/high-speed/edge collisions, rest and timestep convergence, continuous pose at stage boundaries |
| dist/presentation.js, dist/game.js | Landing compression and grounded distance-driven bob, smooth remote yaw/crouch with teleport snap | Stable center aim/scope size, bounded reduced-motion presentation, shortest-angle interpolation; actual browser gameplay |
| dist/equipment-models.js | Physical-looking tumbling plus early blast light and expanding dust ring | Bounded effect resources and cleanup; avoid permanent lights/huge lens obstruction |
| PRD.md, QA_REPORT.md | Record concrete fixes, evidence and unverified device/balance limits | No blanket claim of perfect physics or production networking |

Reproduced: first 50ms speed forward 2.1m/s vs diagonal 2.97m/s; knife pose jumps at 104.4ms from winding offset to neutral; endpoint grenade checks can cross thin cover at high velocity. Keep all damage rules, chamber timing and fixed centered reticle. Presentation follows authoritative positions without changing hitbox size.

### Plan — connected grenade/knife damage and synchronized impact

| File | Change | Evidence |
| --- | --- | --- |
| dist/equipment.js, backend/rooms.mjs | Shared internal vitality/damage: rifle kills, fresh target needs two 50-damage knife contacts, grenade inner lethal 4.5m plus 4.5–8m wound band leaving at most 50 vitality | Outer wound + one knife, cover/team/shields, repeated blasts, reset on respawn; no numeric health HUD |
| dist/game.js | Same practice damage, confirmed wound feedback, predict presentation at known grenade deadline and deduplicate later explosion event by ID | Damage stays server owned online; late/stale events never replay audio, exact one presentation per grenade |
| dist/combat-audio.js, temporary audio QA | Find actual recording onset and trim lead-in; strengthen dry blast playback without long extra echo | Browser decode/sample timing; remove temporary page before build |
| dist/equipment-models.js, dist/game.css | Stronger brief flash/sparks, dense expanding smoke and pressure ring, short bounded camera/hurt response | Preserve reticle and scope radius, reduced motion, bounded GPU/audio lifetimes |
| tests/docs | Extend real connected-combat and sync checks, build and actual local browser QA | No claims of perfect WAN timing or hardware sound certification |

Decision: replace the disconnected knife-only hit counter as the kill condition with shared vitality, keeping the counter only for compatibility/stat diagnostics. Every unblocked survivor in the grenade wound band can be finished by one clean knife hit. No damage through cover and no auto-heal before respawn. Predict only sound/particles at the server grenade deadline; kills/vitality remain authoritative.

### Connected-combat completion evidence

Implemented all rows above. Shared damage now replaces knife-hit-count kills; close grenade100 / outer99–50 / knife50, health reset100. Browser measured MP3 audible onset405.67→7.67ms after trim. Presentation anticipates known fuse and deduplicates server confirmations by grenadeId; no client online damage. Stronger staged sparks/fire/soot/dust and bounded gun impulse, persistent wounded feedback without numeric health HUD.

Initial targeted fixture failure31/1 was a nearer co-located attacker correctly intercepting the knife; moved that actor out of the test ray. Final full suite109pass/0fail; build75assets/3.34MiBgzip; changed Worker delivery6/6 plus QA page404; syntax7/7. Actual browser survived outer blast with Wounded state, smoke/ring/sparks and unrotated center[640,360]. Saved actual screenshot, returned to lobby, no warning/error logs. Temporary measurement page removed. Physical sound/device/WAN and native opponent combo playtest remain unverified; no production-perfect claim.

VERDICT: PASS

### Plan — small combat interactions and throw readability

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/game.js, backend/rooms.mjs | Same equipment selection preserves held action/ADS; successful manual switch cancels pending grenade auto-return; interrupted/lost/dead input clears pending contacts and inspect; no combat key buffering while dead | Server same-slot prime/ADS tests, actual browser grenade→knife and scope/inspect; chamber remains 1500ms |
| dist/mouse-input.js | Recover a button release missed outside the window without turning an abandoned grenade into a throw | EventTarget chord/release/cancel/abort test; ordinary mouseup still throws |
| dist/equipment-models.js, dist/game.js | Small depth-tested dotted grenade trajectory only while primed, derived from shared launch/contact/fuse solver at bounded refresh | End point matches actual solver through cover, fixed reusable meshes, hide/dispose, actual browser held grenade |
| tests, PRD.md, QA_REPORT.md | Pin interruption/authority/resource regressions and record observed local QA | Full suite, syntax, build and built asset delivery; no performance/WAN certification |

Decision: preserve valid ongoing actions on same-slot keys, let deliberate player choice win over delayed automatic choice, and cancel abandoned gestures instead of replaying them on resume/respawn. Readback correction: accepted rifle fire already cancels inspect; actual gaps are inspect during chamber or with secondary equipment, and carrying inspect into ADS/switch. Add throw prediction as aiming feedback only, never client authority or a damage guarantee. Existing modules/state remain; no input framework or dependency.

Additional observed small-state issues: replaced irrelevant RMB/inspect hints when holding knife/grenade, show a brief contextual hint after switching and use existing unboxed bar for knife recovery. Compact425×664 browser view exposed leaderboard overlapping match title/time; added a600px HUD rule separating leaderboard/feed beneath the clock. Native overlapping input calls were serialized by automation, so held-grenade pause cancellation is verified by a temporary actual-client synthetic DOM harness (8/8), not falsely claimed as native chord evidence. Temporary harness must be removed before packaging.

### Micro-interaction completion evidence

All planned rows implemented and verified in scope.113 tests pass/0 fail;8/8 real-client synthetic DOM interaction checks; build75assets/3.34MiBgzip; Worker5/5 changed byte matches and temporary QA404; syntax7/7. Actual final throw guide/hints/knife recovery observed at1280×720. Actual425×664 HUD overlap fixed and rects report overlap:false, centered reticle[212.5,332]. Screenshot artifacts saved; temporary test page removed; local server26909 running updated authority; returned to lobby without guest-reward mutations. Native overlapping gesture automation was serialized, so cancellation evidence is explicitly synthetic-client rather than native hardware.

VERDICT: PASS

### Plan — character surface flicker audit

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/lobby.js | Separate genuinely coplanar footwear/trouser, hair/scarf, costume strips and overlapping costume layers by small physical clearances | Preserve silhouette and palette; inspect all144 outfit/accessory/shoe combinations, front/back/side visible surfaces |
| dist/arena.js if audit finds equivalent faults | Correct equivalent remote/practice character mesh joins | Same exhaustive combination audit; retain walk/death/clone rigs |
| backend/character-surfaces.test.mjs | Geometric regression: positive-area coplanar intersections visible from outward rays, not mere touching edges or buried faces | Real mesh triangles, visibility and material surfaces; no GPU/shadow certification inferred |
| QA_REPORT.md, WORK_PLAN.md | Record exact reproduced planes, completed fixes, build/test evidence and actual browser images | No promise of universal zero glitches on every GPU |

Reproduced on Cobalt/Sky/Crimson: right shoe white trim and trouser front both lie at worldz0.18; crimson shaft and trouser back both lie atz-0.25.144-combination triangle/ray audit found40 unique exposed coplanar mesh pairs, mostly common footwear, hair/scarf and overlapping ghillie strips. Fix placement at construction, not camera settings or a blanket depth-test disable. Rounded extrusion XY bevels exceed nominal dimensions; avoid a global shrink that would change the accepted character silhouette. Audit actual geometry instead.

### Character-surface completion evidence

Fixed reproduced coplanar planes and costume/hair/footwear counterparts in both actor pipelines.144 lobby +144 practice/remote configurations have zero detected visible coplanar conflicts. Added control geometry, cuff-wrap and shoe-gap regression checks. Browser close-up caught an additional right-cuff fit problem and Alpine shoe intersection; corrected before completion. Red/Tactical shafts now wrap both trouser stances; redundant generic cuff removed.

Final116tests pass/0fail, build75assets/3.34MiBgzip, Worker2/2 character assets match source and QA404, syntax3/3. Actual corrected model front/back/side captures checked; final425×360 JPEG saved. Temporary page removed, default viewport retained, user gear/economy unchanged, normal lobby left open. No blanket claim of zero artifacts in every pose/browser/GPU.

VERDICT: PASS

### Plan — movement/cover transitions and safer respawn

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/movement.js, dist/game.js | Clamp eye below roof during crouch/slide/jump and camera-height easing; use actual crouched clearance for lean | Reproduced eye1.574m and grenade origin1.324m inside1.3–1.5m roof; test entry/exit, crouch-jump, stairs smoothing and frame rates; preserve open-air easing |
| dist/equipment.js, backend/rooms.mjs, dist/game.js | Shared legal eye origin for rifle/knife/throw; knife direction converges from physical eye onto visible center aim | Lean parity/near-cover/range regression; server never accepts client damage or arbitrary origins |
| backend/rooms.mjs | Score future grenade blast positions during spawn selection, ignoring protected-before-detonation and harmless team blasts | Dangerous spawn avoidance, cover/team/protection exceptions, predict cloned projectiles without mutating live physics |
| tests + QA_REPORT.md/PRD.md | Pin transition regressions, build and browser QA | Full existing map/gear/combat suite, actual UI checks and explicit physical-device/WAN limits |

Decision: fix reproduced head/hand penetration in shared collision rather than camera-FOV hacks. Share eye placement but keep server authority and current shot/chamber/range/damage values. Penalize foreseeable post-protection blast exposure in existing spawn scoring rather than extending invulnerability or forbidding positioning.

Browser fixture caught practice look direction initializing to0 instead of the selected spawn yaw. Corrected initialization (normal current map spawn yaw is0; other spawns now face their authored direction). First outward-facing fixture screenshot was not accepted as under-roof evidence because its movement went the wrong way. Re-run after correcting the actual client initialization.

### Cover-transition completion evidence

Implemented shared ceiling-safe eye and rendered-eye clamp, crouched-height lean, physical lean origins across equipment, centered knife convergence and blast-aware spawn scoring. Practice respects authored spawn direction. Tests include actual Foundry entry/crouch-jump/exit at30/60/144Hz, grenade sphere clearance, camera easing, both lean sides/range, moving/stationary blast threats, exact shield expiry, teams/cover and nonmutating trajectory prediction.123tests pass/0fail; build75assets/3.34MiBgzip; changed Worker3/3 plus QA404; syntax5/5; raw4,483,564bytes.

Actual Foundry fixture render under roof/jump/held grenade observed; screenshot saved. Local browser control disabled in Work settings before final exit visual retest; user informed. Automated exit passes; browser may remain on temporary page, normal lobby could not be restored. QA page removed before packaging. Server69683 retains current authority. No production/hardware/WAN certification claimed.

VERDICT: PASS — implementation complete; interrupted browser exit check explicitly unverified.

### Plan — core feel, life boundaries and remote combat poses

| File | Change | Evidence / failure handling |
| --- | --- | --- |
| dist/equipment.js, dist/game.js | Shared180ms knife contact constant; align thrust peak with contact, leave580ms cadence intact | Pose/contact continuity and old held-input checks; no reach/damage change |
| backend/rooms.mjs, dist/game.js | Stamp spawn life/time; reject old-life queued input/combat and pre-spawn rewound hits; interpolate historical yaw through shortest arc | Reproduce old-shot killing a fresh life; explicit old/new command sequence, latency history and shield tests |
| dist/arena.js, dist/game.js | Bounded eased remote lean/aim and weapon/arm action pose, rewind received contact to its actual animation phase; reset on respawn | Model pose/rest/finite/clone tests; retained geometry and death/stride audits |
| dist/presentation.js, dist/game.js | Freeze practice-local action/effect deadlines while menu is paused, with online clock untouched | Small clock abstraction exercised by actual deadline math; resume/reload/respawn/FX stay in same time domain |
| tests/docs | Full checks, local browser if enabled; record actual limits/backlog | No all-roadmap or production-ready claim; hosting and hardware gates remain open |

Decision: repair concrete state/visual mismatches using existing modules. Life generation is a stale-command guard (optional for older local clients), not a replacement for server authority; target life-start timestamp is always checked for rewound shots. Remote pose uses retained references without changing geometry or clone metadata. Practice gets a monotonic active-time clock, so timers and effects stop together. Do not add modes or dependencies during core verification.

Additional core finding: shoot/melee/prime/throw can enqueue before the next80ms movement batch, leaving authoritative eye/hand at an older position than the client preview. Piggyback only pending validated movement frames/sequence inside the same combat command; server applies them with existing time-credit/collision rules before combat, so no arbitrary pose is trusted and no extra HTTP roundtrip is introduced. Pin server-side moved-cover, scope and retry/time-credit behavior. Remote shot events also carry accepted origin/aim/life so fast flick presentation does not read a later body pose.

### Core-feel pass completion evidence

Implemented planned timing/life/pose/clock rows and atomic combat movement. Reproduced old pre-birth shot killing a fresh player before fix.134 tests pass/0fail (11 new core checks), including3 independent API-client concurrent retry/respawn coherence, movement/ADS-before-shot, existing map/gear/death/audio suites. Build75assets/3.34MiBgzip; Worker5/5 exact changed assets; syntax7/7; raw4,488,085bytes. Updated local server85197, verified5/5 real localhost module delivery and3 temporary authenticated private API clients; explicitly left all clients.

Browser control remains disabled; user informed. No fresh visual screenshot or native pose/pause/audio sign-off this pass. No profile/currency mutations or duplicate hosting project. Core changes are implemented; broader roadmap (UI/gear polish, production reward authority, live WAN/device and release gates) remains tracked in PRD and QA_REPORT.

VERDICT: PASS — deterministic/API checks complete; visual/hardware checks remain pending.

### Plan — match transitions and empty-lobby continuity

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/net.js, dist/game.js | Matchmaking watcher uses cancellable wall-clock timers independent of practice pause/render frames | One in-flight refresh, retry backoff, stop ignores late response, vote/warmup exits once; no duplicate room join |
| dist/menu.js, dist/game.js | Replay keeps actual map; public waiting states reopen practice; async room/launch intents honor cancellation; hide finish-practice while queued | Existing map IDs and session reused; stale asynchronous connect must not reopen a closed screen; browser integration if enabled |
| dist/round-music.js | Reveal resumes paused finale context; stopping paused audio releases it rather than leaving stale source for next match | Same-source paused reveal, rapid stop/restart callbacks and cleanup tests |
| dist/movement.js, backend/rooms.mjs, dist/game.js | Shared complete motion reset for respawn, reset presentation/remote stride on new life | No inherited slide/coyote/jump/lean/crouch momentum; snapshot/collision checks retained |
| tests/docs | Full regression and built/live source checks; record remaining roadmap separately | No claim of all release work or native visual sign-off |

Evidence: queue polls currently use practice now(), now frozen in menus; Play again currently calls launch(null) without r.map; practice reset omits grounded/slide/jump-buffer/lean while server reset covers them; results reveal does not resume suspended context. Preserve coins/profile, core weapon rules and online clock behavior. No new framework or modes.

### Match-transition completion evidence

Implemented each planned row. Additional review found direct replay bypassed the normal menu transition disposal, retaining the old podium RAF/WebGL renderer; launch now stops it and invalidates pending stage creation. Generation-owned launch state prevents an older canceled import/error/finally path from clearing or interrupting a newer intent. Removed unreachable public waiting panel branches; retained practice is the waiting state.

Nine new tests cover paused-clock queue progress, slow nonoverlapping requests, late success/error cancellation, bounded backoff/recovery, terminal expiry, explicit delay, all actual map spawn motion, authoritative fresh stock/life, paused reveal and old-source end callbacks.143 tests pass/0fail,75assets/3.34MiBgzip, Worker5/5 and localhost5/5 exact delivery, syntax8/8. Server19203 updated; two temporary private API clients agreed on Foundry warmup/fresh-life defaults and explicitly left. No guest profile/economy changes.

Browser discovery remains disabled in Work settings, so same-map replay, room handoff and paused podium DOM/audio integration are implemented/reviewed but not fresh native browser observations. UI/gear polish, server progression/economy, hardware/WAN and original hosting access remain on the broader roadmap.

VERDICT: PASS for deterministic/API checks; browser/hardware integration remains pending.

## Plan — multiplayer latency, burst delivery and lifecycle hardening

Contract: strengthen the existing authoritative room transport, preserve public15-player FFA/private modes and weapon rules, test concurrent clients and fault recovery; no deployment, duplicate Site or production/WAN readiness claim. Scope: net/game, rooms/API, related tests and evidence docs.

| File | Change | Verification / risk |
| --- | --- | --- |
| dist/net.js, dist/game.js | Reject stale queued real-time actions before sending; bounded pending queue; monotonic RTT-aware server clock; incremental event cursor | Delayed/lost response, no late attacks or mutation replay, clock wall-time changes; retain sequential actions and server authority |
| backend/rooms.mjs, backend/api.mjs | Bounded256-event/8s replay window with cursor/gap metadata; preserve thrown grenade damage on owner departure; assign late active TDM joins; keep spectators out of actor meshes | Burst >32 events retained/deduped; cover/team/score semantics, no leaked credentials; existing clients receive fallback full window |
| backend/net.test.mjs, new multiplayer checks |15-client contention/lifecycle, SQLite/D1 parity, lost ack, jitter/slow queue, expiry/host transfer/late joins | Deterministic faults/time; assert authoritative state, clean up fixtures; native rendering and WAN remain separate gates |
| QA_REPORT.md, PRD.md | Record exact counts/build/live checks, transport ceiling and release gates | Browser availability once; no claims based only on simulation |

Decision: keep the existing transport and storage contract. Fix observed unbounded queue age, response-latency clock offset,32-event truncation, grenade disappearance after owner leave and unassigned late manual-team joins. Add bounded retained events plus per-client cursors rather than sending an ever-growing log. No framework or unverified transport rewrite.

Additional verification: add a repeatable localhost-only15-client HTTP soak command and machine-readable report outside dist. Exercise actual server scheduling with input/fire, injected receive jitter and deliberately discarded acknowledgements; measure local RTT/payloads and clean all private clients. This does not replace real browsers, WAN or hosted D1 load measurement.

Review follow-up: any transient transport failure invalidates already-queued real-time intents even if younger than350ms; cancellation/refresh still run. Online heartbeat must also run from a bounded10s wall timer when document.hidden, because browsers can stop requestAnimationFrame in background tabs. This timer uses the existing one-in-flight network guard and is released with the game AbortSignal. Native background-throttling behavior remains a browser gate.

Queue-overflow follow-up: the ninth realtime action invalidates the unsent queue immediately, using the same epoch as a transport failure. It cannot leave seven valid-age attacks to fire after the client has already entered resync.

## 7 November — seven-point goal execution

All seven requested phases remain required: transport/reconnect; traffic/storage efficiency; real2–4 then15-player matches; combat/map balance; server progression; presentation/gear; private modes/platform/release. API simulation cannot close native/WAN gates. No prior goal execution turn; this turn begins implementation.

Current step: implement versioned compact player payloads using a shared codec, preserving own prediction and full result stats while sending only consumed remote fields during active play. Keep legacy API responses working. Update API/client/Worker bundling, soak measurement and tests; fix outdated overflow assertion. Verify exact codec semantics, privacy, recovery, full suite and before/after actual HTTP payloads. No input precision reduction. Hosting/browser gates checked independently; goal stays active until all phases are actually verified.

Completed this slice: compact v1 codec/API/client/Worker integration;159tests/0fail;76assets/3.35MiBgzip; built Worker SQLite integration;7/7syntax and2/2 packaged byte matches. Comparable15-client45s HTTP body volume decreased68.77% (110,132,373→34,389,493bytes),0busy/0event gaps/60dropped acks/15cleanup. Actual two-tab IAB room ready/warmup/live/fire/chamber/pause/host leave/peer continuity observed; both left, no captured warn/errors, clean main lobby retained. See QA_REPORT for limits. Sites project still inaccessible; user explicitly selected local continuation.

Next: protocol request cadence/storage contention and stable snapshot lifecycle; design server guest identity/profile and transactional rewards with local-save migration that does not trust client career/currency. Continue combat/map/gear and private modes afterward; keep real2–4/15-human/WAN/platform gates open. No point is marked fully complete merely by this payload improvement.

### Plan — persistent server guest economy foundation

Previous goal turn: progress (compact transport, measured payload reduction and actual browser flow). This slice adds an authenticated same-origin HttpOnly guest cookie, hashed session lookup, versioned CAS profile mutations and persistent local SQLite/D1 adapters; shared existing economy rules drive server-time daily gifts, crypto wheel and gem exchange. Require expected profile version on writes so lost/retried requests cannot double spend. Keep local legacy profile untouched until menu integration and migration are complete. Add additive migration, Worker route, local private database outside dist and concurrency/privacy/clock/invalid-input tests. Completed-match receipts, wardrobe/profile client migration and account recovery remain subsequent required work; this foundation alone does not close progression.

Implemented: profile cookie/hash/store/API, additive migration, persistent local SQLite + Worker D1 route, authenticated private room/profile binding and public-result claim from server counters with persistent round deduplication.161tests/0fail, build76assets/3.35MiBgzip, syntax8/8, packaged Worker SQLite integration and live200/405 route check pass. Existing save untouched. Server30953. This is authoritative-state progress.

Required next progression steps: durable result archive/outbox so missed result screens can claim after room advances; server wardrobe/equip/badge/finish validation; client profile API and save migration preserving legacy backup without trusting old career/currency; connect all menu mutations and match reward flow; browser verification. Guest account recovery and cross-device sign-in still need product/platform implementation. Continue the entire seven-point objective; no completion update warranted.

### Plan — atomic archived public results

Previous turn: progress (persistent guest/CAS economy and membership proof). Archive completed bound-player rewards in a separate SQLite/D1 table using triggers on the same room CAS write, so failed/conflicting writes cannot mint receipts. Keep pending receipts independent of room reuse/expiry. Local server rooms move to the same persistent database to share those atomic guarantees. Profile claimrewards fetches only its own unclaimed receipts in bounded batches and commits the existing round ledger with profile CAS. Add tests for results missed across round/reset/restart, losing CAS, failed archive transaction, other profiles, concurrent claims and roster expiry boundary. Keep all seven phases active; menu migration follows this backend correctness step.

Continue this slice with a shared shop catalog (existing names/prices), server buy/equip/badge/finish actions and owned/earned validation. Authenticated room openings take verified outfit/name/badge from the server guest profile; anonymous legacy clients retain their current compatibility path until menu migration. Test concurrent purchase, client price forgery, category mismatch/unowned equip, locked mastery and server room appearance. No new UI style/content in this correctness pass.

Completed: migration0002 archive table and transactional SQLite/D1 room triggers, public results receipt generation, bounded authenticated claimrewards and local persistent rooms. Shared catalog and server buy/equip/badge/finish enforcement plus verified joined appearance.166tests/0fail;77assets/3.35MiBgzip; syntax11/11; built Worker delayed archive/claim after room removal, replay/unowned denial;2/2 packaged/live modules exact. Injected archive fault rolled back room CAS; restart and skipped screen preserved rewards. Local server88558. User save/currency untouched. This goal turn is progress, not a blocker wait.

Next implementation: client profile service and explicit legacy backup/migration; connect all wallet/shop/equip/name/badge/finish/reward paths with conflict/lost-ack refresh. Before rollout, settle entirely idle finished rooms before sweep and surface pending archived rewards. Then remote finish replication and native profile/match UI verification. Maintain full seven-phase scope, including human/WAN tests and requested modes; all release gates remain unfulfilled until observed.

### Plan — server profile menu integration

Prior goal turn is progress (durable results and verified catalog). Add a serialized cookie-based profile client with one-time legacy backup, server-time presentation and lost-ack/conflict refresh without automatic mutation replay. Boot loads server profile before lobby; every currency/equip/name/badge/finish flow and completed public rewards uses this client. Preserve ordinary settings locally, remove local career award path, guard stale menu callbacks and double taps. New guest migration retains name/free rifle preference, archives old editable progression rather than importing it, and informs the player. Guest-cookie loss must not silently create replacement identity from refresh. Tests cover service backup/reload/fault/concurrency and actual browser wallet/equip/reload. Keep goal active; idle-room settlement/account recovery still required.

Implemented profile-client and all enumerated menu actions, boot/result archived claims, exact one-time legacy backup, save conflict/ack refresh, stale view guards and server clock UI. Added bounded idle public-round settlement before reward discovery/sweep/expired reuse; unfinished batches cannot be swept away.171tests/0fail,78assets/3.35MiBgzip, syntax9/9, packaged2/2 exact and built Worker SQLite integration pass. Isolated localhost browser verified daily claim/reload, rifle equip/reload, rename, wheel pending prize after mid-spin reload, collect, cap purchase/equip/reload and clean logs. User127.0.0.1 save untouched; dedicated QA ServerSaveQA kept. Actual screenshot recorded. This turn is progress.

Next: complete account recovery and explicit missing-cookie guest handling; enforce authenticated production room openings/update verified member cosmetics and Gold replication; actual server-saved public result UI test. Broader phases still include transport cadence/storage load, real humans/WAN, competitive maps/feel and requested private modes/platform. Do not mark all seven achieved from171 automated checks.

### Plan — guest recovery and retired session enforcement

Completion8November: recovery hash/index,192-bit single-use key, CAS cookie rotation, backend/client/profile UI and boot recovery entry; production authenticated profile/session binding and private snapshot stripping; separate-cookie soak enrollment.173tests/0fail,78assets/3.36MiBgzip, syntax10/10, packaged/live modules2/2 exact. Actual Worker SQLite recovery/replay/missing-cookie/retired-room tests pass. Authenticated SQLite45s soak6,813requests/60lost acknowledgements/0busy/0gaps/p95local11.22ms;15room leaves. Native isolated QA form/error feedback checked without generating a live secret. This goal turn made implementation and verification progress.

Next: Gold finish propagation and verified in-room presentation; fresh public results→server rewards→next round UI test. Keep real humans/WAN/balance, private modes and platform release requirements open. All seven phases persist; no completion or blocked status warranted while local work remains possible.

Previous goal turn: progress (server menu migration and browser persistence). Add user-generated recovery keys, store only hash, single-use restore with atomic cookie/session rotation and same profile/rewards; expose recovery UI and boot missing-cookie handling without silently replacing an existing guest. Do not put recovery key/hash in caches/snapshots/logs. Production room API requires current guest cookie and matching profile/session binding, so restored identity invalidates old room commands. Legacy unit harness can omit identity adapter; actual Node/Worker always provides it. Update15-client soak to enroll separate guest cookies. Tests exercise wrong/replayed/concurrent recovery, cookie loss, secret privacy and retired room tokens; keep broader seven-point scope active.

### Plan — verified multiplayer appearance parity

Prior turn was progress (recovery and authenticated soak). Add server-derived finish to own/remote snapshots and frozen death pose; full actual podium already reads finish. Sync canonical name/badge/finish each current-member request; wardrobe changes apply on a new life so corpses cannot change clothes. Compact codec appends finish within existing mask width. Remote renderer updates name/badge labels and rebuilds changed wardrobe actors only at spawn, retaining old resources through corpse lifetime. Preserve rifle alive-change restriction and own exact centered shooting. Tests: forged join/rename/finish, mastery threshold, rifle changes, life-based clothes, Gold/field restoration, corpse freeze and bounded disposal; then actual browser/public flow where available. Seven-point goal remains active.

Completed this slice: authenticated canonical name/badge/finish, per-rifle Gold proof, new-life wardrobe sync, compact finish, remote label/material update and retired actor cleanup, frozen corpse finish, podium/practice finish.175tests/0fail;78assets/3.36MiBgzip; syntax9/9;4/4 Worker/live exact; built Worker SQLite Gold proof/decode/privacy/leave passes. Native earned-Gold and wardrobe-rebuild visual checks remain pending.

Actual isolated public UI pipeline checked: retained practice→vote→warmup→Switchyard live; controlled positions followed by native LMB actual headshot; only then a controlled3s end boundary. Real podium+server receipt +100XP/+25coins, next vote/warmup/live with both participants retained, lobby/reload totals persist. DB verified1kill/1headshot/1round. No stat fabrication, no claim of full600s/two-human/WAN validation. API peer and native participant explicitly left, no captured warn/errors. QA screenshot recorded; ServerSaveQA retains test rewards, original user save unchanged. This turn is progress.

Next: move onto requested private game modes and map-driven objectives while retaining transport/performance and real-device/WAN/balance gates. Need CTF, arms race and bracket tournament design/implementation, readable game HUD/result flows and team/private readiness. Current FFA/duel/TDM code is not proof of those modes. Final quality audit must still cover all seven phases before goal completion.

### Plan — private Arms Race

Continue authorized local work; all seven phases remain active. Add private-only Arms Race with eight existing rifles, two credited current-rifle eliminations per stage, then one knife elimination to win. Fresh opponents still take two knife contacts; grenade wounds remain valid. Warmup resets progression, deaths retain it, each spawn restores stage equipment, and manual rifle changes cannot bypass the ladder. Stage switches preserve chamber/cooldowns and cancel ADS/prime; grenade/early knife kills count score without advancing. Public remains15-player FFA. Shared stage/rank helpers drive server, compact additive field, live HUD and podium ordering. Forced stage weapons must not rewrite the player's saved rifle preference. Test full ladder through real command hit registration, invalid/replayed actions, respawn, late joins, timeout, spectators, reset, compact codec and existing modes; build and native UI QA where available. CTF, tournament, human/WAN playtests and release gates remain open.

## Plan — 9 November social, economy and private lobby request

User cleared the previous autonomous goal; this is an ordinary authorized implementation request, local only. Scope includes taller real-geometry map previews without first-person gun/HUD, explicit duel time OR target-points rules, actual settings effects, persistent numeric IDs/friend requests/presence, bounded home friends feed, rifle unlock economy and weekly challenges/paid coin spins. Parallel work per GRAVITAS conditional API/complexity review: backend social, backend economy, settings effects; parent owns menu/map-preview/duel/UI integration. Preserve existing equipped rifle and save balances; validate ownership server-side. No hosting changes or fabricated online friends. Verify migrations, authenticated action concurrency, game rules and build, then actual browser if available. Any unavailable browser or incomplete polish must be reported accurately.

| Files | Change | Risk |
|---|---|---|
| backend/rooms.mjs, menu.js | Explicit duel rule + target; map preview from buildArena | Points games must not expire at a hidden timer; no grenade/spawn regression |
| social.mjs, migration, server/Worker | Persistent numeric identity + friend lifecycle | Authentication, replay/races, privacy; SQLite/API tests |
| economy/catalog/progression/profiles | Starter rifle, costs, paid coin spin, weekly goals | Save migration, double spend; canonical server validation |
| game/settings/menu/CSS | Real settings, lock-aware menus, bounded social feed | Input/ADS regression; meaningful checks and native QA |

Additional scoped shop content: three original textured rifle wraps (digital woodland, tiger stripe, alpine fracture), bought once and usable on owned rifles. Shared catalog/finish validation, preview/live/remote/corpse restoration use the same finish ID; Gold remains mastery-only. Verify texture differences/resource disposal and unowned finish denial. Different rifle handling stays bounded visual recoil; actual centered hitscan remains exact.

Completed current verified slice: social API+UI, numeric identity, lobby actual-arena canvas/tallerview, duel target/time modes, functional settings fixes, server-owned unlock economy+weekly goals/extra spins,3textured rifle wraps, economy design evidence.191fulltests/0fail,8subsequentaffectedtests pass,81asset3.37MiB build; WorkerSQLite and localhost delivery checks pass. Browser inventory disabled, so fresh native layout/audio/mapframe verification is outstanding, along with requested broader character/sound content expansion. No deployment and no goal recreated after user cleared it. See QA_REPORT.md and ECONOMY_DESIGN.md.

## Plan — lobby feed scrolling and release notes

Replace stretched two-row Updates placeholder with six concise clickable entries covering actual delivered features, newest first. Keep fixed shared tab height and compact rows that overflow naturally. Hide scrollbars on Updates, Friends panel and inner friend list using Firefox + WebKit rules while preserving overflow, touch, wheel and keyboard scrolling. Add an explicit friends-feed shortcut without changing tab selection semantics. Maintain this release feed when shipping major player-visible features; don't announce unfinished modes. Verify build, syntax and delivered assets; fresh native QA depends on browser availability. No backend/economy change.

## Plan — rifle armory layout and try-before-buy

Fix root cause of clipped title: existing overflow panel vertically centers content taller than itself. Use top-aligned independently scrolling full-height info sidebar; bottom horizontal rifle rail with full wrapping names and hidden scrollbar. Skin clicks are local previews only (including locked skin/base rifle); separate server-backed Buy/Equip button and canonical ownership/mastery guards. Add three original premium sculpted skins alongside existing wraps, server allowlist derived from catalog, render on preview/live/remote/corpses through shared finish pipeline. Keep damage/accuracy/chamber unchanged. Follow project release-feed rule. Tests cover preview offer state, model switch/disposal and backend unowned denial; build/syntax and browser availability checked. No copied PUBG assets; researched official Hideout/Chroma design for inspiration only.

Completed armory implementation: top-aligned readable full details sidebar + horizontal lower rifle rail, local selected-skin try-on with explicit Buy/Equip, six purchasable patterns including three distinct sculpted premium finishes, canonical catalog/backend validation and update-feed entry.195tests/0fail,82assets/3.37MiBgzip. Native QA unavailable (browser control disabled); exact frame fitting/premium appearance remains unverified on real browser, no visual completion claim.

## Plan — forty rifle-specific animated skins and no-scroll armory

User requires5distinct designs for every rifle, effects beyond pattern, and entire right information/buy/skin-name area visible without vertical scrolling. Implement40curated rifle-bound catalog identities with five visual families and rifle-specific model trim; preserve purchased legacy wraps. Server enforces base rifle and finish-to-rifle ownership. Shared bounded effects run in preview/lobby/own+remote/podium, reduced-motion/low-quality aware. Parent owns menu/backend/no-scroll responsive layout, model agent owns collections/geometry, effects agent owns pooledVFX/integration. Remove scrollIntoView from lower rail because it can programmatically scroll an overflow-hidden ancestor and clip the information header. Constrain only horizontal rifle rail below fixed information region; all info grid rows fit available height. Tests cover40catalogentries/modelvariants/resourcecleanup/particles/ownership/wrongrifle, fullsuite/build and nativeQA availability. No real-money or copied assets.

### Skin effects implementation slice

Add bounded original cosmetic aura particles for fire/smoke, frost vapour, arc sparks, void mist and relic motes. One reusable geometry/material per visible rifle, at most12particles (6low), no lights/textures/network events or gameplay changes. Update existing preview/lobby/live+remote/results render loops; scope/reduced-motion suppress motion/reticle obstruction. Named clone-safe child groups attach to model decoration and are disposed by finish switches and existing object cleanup. Test finite trajectories, constant resource count, style differences, reduced motion, quality budget and field cleanup.

Completed40collection slice:5skins perrifle, authored names/mesh/texture variants and animatedfamilyeffects acrosspreview/lobby/game/remote/podium; new rifle-specific purchasevalidation, compact no-scrollsidebar +lowerhorizontalrail, ancestor-scroll clipping fix, delayed corpse trim cleanup.203tests/0fail,84assets3.38MiBgzip,10localhostassets exact +actualWorkerSQLite skinflow pass. Browsercontrol remainsdisabled; exactframefit/shaderlook/hardwareFPS notverified. Releasefeedupdated; previousgoalcleared and none recreated.

## Plan — simplify armory copy

Remove requested SNIPER RIFLE label, stock/barrel description, combat-spec row and Gold-mastery footer from actual markup. Remove redundant preview/helper copy and repeated rifle-equipped status, keeping gun name, selectable skins, chosen skin name and purchase/equip status/action. Preserve Gold unlock validation and existing preview/purchase logic. Reflow remaining sidebar children with breathing room and no vertical scrolling. Syntax/build and exact served assets verification; no new backend tests for this reversible presentation-only edit.

## Plan — purchasable per-rifle Mastery Gold and premium presentation

Gold currently has only an achievement unlock; user explicitly asks for Buy option. Add75,000coin per-rifle Gold purchase alongside existing free earned-mastery route; no real-money flow. Shared Gold entitlement helper checks purchased identity or earned mastery, used by offer/profile/room API. Base rifle ownership required for all skin purchases/equip; locked rifles preview skins without skinBuy. Explicit Buy/Equip remain separate. Gold sculpted reflective engraved trim and bounded gold-specific aura preserve aim/geometry cleanup. Model/effect agent owns visual files; parent catalog/progression/backend/menu/tests. Tests cover owned-base guards, gold wrong-rifle/replay/canonical price, free mastery unchanged, network canonical finish, clone/resource restoration. Releasefeed updated; no layout clutter additions.

Completed per-rifle75kGold purchase +preservedfree earned unlock, base-rifle skinpurchase/UI guard, Goldengraving/sculpture/star+vapouraura and canonicalnetworkentitlement.208tests/0fail,84asset3.38MiB build,10exactlocalhost assets +actualWorkerSQLite Goldflow passed. NativevisualQA remainsunavailable (browser setting disabled); no claim of rendered appearance signoff. Updatedreleasefeed/economydesign/collectionnotes.

## Plan — expanded distinct wardrobe and cosmetic effects

Add24original items:8costumes,8headgears,8footwear with different sculpted silhouettes/materials and animated cosmetic effects. Preserveblockystylized body, legacygear and performance/hitbox rules. Sharedmetadata drives canonicalcatalog/validation/thumbnails and both3Dpipelines(lobby/preview/podium andremote/practice). Modelagent ownsmetadata/builders/lobby/arena/catalog/choices; effectsagent ownspooledVFXandrenderhooks; parent owns shopUI/thumbnails/backendintegrationtests/docs. Preview-before-buy and verifiedcurrency/equip retained. Keep selecteditemname/action anchored while onlyitemgridscrollsinvisibly. Testeverynewitem plusrepresentativecombinations bothpipelines, purchase/equip/respawn snapshots, collision/feetresourcecleanup, bounded/reducedmotioneffects and existingtests. BrowserQA limitation mustremainexplicit;releasefeedupdated.

### Wardrobe model slice

Add24distinct catalog identities (8costume/8headgear/8footwear) with shared normalized mesh recipes adapted to lobby and arena rigs. Preserve legacy gear and surface-clearance tests. New clothing/headgear/boot geometry attaches to chest/head/arms/boots in lobby and tagged actor groups in arena so existing movement/combat/death clones follow it. Rebuild new wardrobe nodes only on changed IDs and dispose only their owned resources; expose plain effect metadata per selected item. Shared wardrobe metadata feeds catalog, validation and thumbnails. Verify real geometry signatures, finite bounds, clone safety, old288surface combinations and repeated gear changes.

### Wardrobe effects slice

Reuse one bounded depth-tested shader point pool per character for all equipped new wardrobe pieces. Up to6particles/item (18total),3/item low (9total), no dynamic lights/textures. Item-category anchors sit behind shoulders/head or low heels to avoid covering face and aim. Metadata changes rebuild pool; steady frames update existing buffers only. Reduced-motion freezes and lowers effects; hidden actors suppress rendering. Hook lobby/preview, actual practice/remote actors and podium, with generic root cleanup and clone-safe groups. Test finite trajectories, style distinctions, count bounds, metadata transitions and disposal; native GPU appearance remains a separate gate.

Completed expandedwardrobe:24newitems(8percategory), sharedsculptedmodels inbothrigs, boundedcosmeticeffects/renderhooks, canonicalcatalog/validation/thumbnails, anchoredshopname/action andscrollingitemlist. Found/fixedrealnewcoplanartrimconflicts andfootspacing;32new/mixedoutfits acrossbothrigs+288legacyconfigurations passsurfaceaudit.216tests/0fail,87asset3.39MiBbuild,13exactlocalhostassets+actualWorkerSQLite wardrobe buy/equip/compactappearance passes. Browsercontrolstilldisabled, nativevisual/shader/FPSnotverified. AddedWARDROBE_COLLECTIONS.md andupdatedreleasefeed; no newgoal/deploy.

## Audit and first reliability fix — 9 November

Requested overhaul covers the entire game. Existing Three.js browser runtime, Node/Worker HTTP polling rooms, SQLite/D1 profile and room storage, existing tests/assets were inspected. Public matchmaking currently starts voting at two real players, with a warmup on the selected map, not the specified 15-player fill followed by a distinct training compound. Seasons/events and real-world 15-human/WAN verification remain open. First P0: prevent a verified guest from consuming multiple participant slots in the same room. Preserve existing reconnect token flow and anonymous test harness; return explicit conflict rather than silently creating a second identity. Add authenticated API test and run affected/full checks. Broader audit and complete requested player journey remain outstanding.

## Plan — fifteen-player public admission

Public waiting rooms admit up to15 real participants, switch to a10-second vote only once full, and stop admitting new players after filling. If a player leaves or expires during vote/warmup, return to waiting for replacement; no invalid underfilled start. After results return to waiting and refill. Expose current real roster count in existing matchmaking practice HUD. Preserve private modes and verify race/late joins/disconnects and existing tests. Dedicated matchmaking interface and distinct training map remain subsequent work, not claimed complete.

Implemented public15-player fill/lock,10-second vote, pre-match departure return to waiting, overflow routing and actual roster HUD.219tests pass,87assets/3.39MiB build. The queue currently remains in existing practice experience: dedicated animated lobby, separately authored pre-match practice compound, full human/WAN tests, and all other overhaul phases remain pending. No completion claim.

## Plan — distinct public pre-match training arena

Keep vote selection in room.map, add a separate authored non-votable training map used only by public warmup. Server collision/shoot/spawn and snapshots must agree on active arena; selected combat map remains intact. Reset all live stats/positions and clear practice events/grenades at live start. Client renders active arena and hands off cleanly on arena change while retaining session. Provide visible training targets with server-verified practice-hit feedback, never awarding match stats. Preserve private warmup and existing practice queue, verify 15-player phase boundaries, map choice, collision, target events, score isolation and transition; report actual browser/render constraints.

Implemented distinct public warmup training compound with shared authoritative/client arena ID, seven target boards and verified hit feedback, ten-second countdown, and reset into the voted live map. The training map is not votable; private warmups stay on their chosen map. Two targeted tests cover 15 independent API sessions and practice-to-live state isolation; full suite: 221 passed. Worker build: 87 assets, 3.39 MiB gzip. Browser QA now available: verified online matchmaking practice screen, 1/15 roster, and return to lobby on localhost. Fifteen-human visual transition, rendering/performance and WAN tests remain outstanding; the wider overhaul is not complete.

## Public matchmaking lobby — 9 November

Replaced the public waiting-phase practice view with a 15-slot lobby driven by the authoritative room roster. It identifies the current player, updates on joins/departures, exposes a cancel action that leaves the room, and advances through the existing synchronized vote and separate practice phases. Added responsive/reduced-motion presentation and a clickable Updates entry. Browser checked the one-player view and cancellation; 221 automated tests passed and Worker build is 87 assets/3.39 MiB gzip. Multi-person browser presentation, avatars reflecting equipped characters, join audio, full transition and WAN playtests remain open.

## Map voting — 9 November

Public voting now uses four in-game map captures, map descriptions, selected-state cards, live counts and server countdown. Fixed an authoritative bug that previously excluded a map after two consecutive wins even when it had the majority; all displayed maps are eligible, with rotating priority for ties. Added a 15-player majority/repeated-map and vote-lock regression test. Full suite: 222 passed; build: 87 assets/3.39 MiB gzip. Voting screen has not yet been visually verified with a full room; actual 15-player/WAN QA remains pending.

## Room leave recovery — 9 November

Verified that room requests are serialized, so ordinary responses cannot reorder snapshots. Fixed fresh matchmaking and cancellation when a leave request fails or its response is lost: the saved credential is retained until the old slot is confirmed removed or expired, avoiding a new queue entry while the old slot may still exist. Added three transport/API regressions for pre-send failure, lost acknowledgement and cancellation failure. Full suite: 225 passed; build: 87 assets/3.39 MiB gzip. This does not replace 15-human or WAN network testing.

## Cancelled room reload recovery — 9 November

A cancelled room now records leave intent before sending the request. On reload the client retries removal rather than resuming the cancelled match; transient failures keep that intent for another retry and expired rooms clear it. Added cancellation/reload and repeated-offline tests. Full suite: 227 passed; build: 87 assets/3.39 MiB gzip. Human multi-client/WAN testing remains open.

## Isolated multiplayer browser check — 9 November

Started a temporary server with its own SQLite data and 14 synthetic API participants plus one real browser client. Observed real 14/15 roster updates, removal of inactive test participants, the 10-second training phase, automatic transition into live FFA, and the return-to-lobby control. The voting screen elapsed before it could be visually inspected. The live transition showed the existing “Click to resume aiming” prompt; seamless pointer capture across the arena remount is not verified and needs work/browser-policy investigation. Test server and clients stopped. This is one-browser local integration evidence, not 15-human or WAN testing.

## Pointer-lock handoff — 9 November

Moved gameplay pointer lock to the persistent game container and retain it during warmup-to-live arena remount; normal pause/exit still release it. Mouse listeners handle the persistent target and preserve the existing unlocked canvas fallback. Full suite: 227 passed; build: 87 assets/3.39 MiB gzip. The lock handoff and combat input have not yet been verified in a live browser match.

QA incident: the isolated 4181 server used the same 127.0.0.1 cookie domain as the 4173 server, overwriting the guest cookie in the Codex in-app browser profile; the 4173 page now reports that its guest cookie is missing. The servers use separate SQLite databases; no database deletion was performed. Other browser profiles have not been inspected. Future isolated browser testing must use a distinct hostname or isolated browser profile, not merely a different port.

## Aiming fallback browser check — 9 November

Retested on an isolated localhost hostname and database. In-app browser denied pointer lock, so the fallback path was exercised: a left click fired and showed 1.5-second chambering; pause and return to lobby worked. The actual pointer-locked warmup-to-live handoff remains unverified in a browser that grants pointer lock. The separate hostname avoided the 127.0.0.1 cookie used by the main local game.

## Isolated 15-client load check — 9 November

Ran a 20-second private-room soak using 15 independently authenticated localhost API clients against a temporary SQLite server: 3,044 requests, 25 deliberately discarded acknowledgements, 0 busy responses, 0 event gaps, 80 accepted live shots, all 15 test clients removed. Local RTT p95 10.87 ms. This verifies this local traffic scenario only; real browser rendering, WAN latency, packet loss and human playtesting remain open. Report: qa/multiplayer-isolated-soak.json.

## Map-vote browser check — 9 November

Used an isolated localhost server with the vote timer extended to 60 seconds only in its temporary backend copy. With one browser and 14 simulated API clients, visually inspected all four cards and selected Overlook; UI showed one vote and YOUR VOTE, then advanced to the practice compound and live match. Test clients and server were stopped. Existing vote-card screenshots visibly contain the first-person weapon/HUD; clean actual-arena captures remain a presentation issue. This is not a 15-human or WAN test.

## Clean voting previews — 9 November

Voting cards now capture the actual Three.js arena geometry without the first-person weapon, player, or HUD. Images are generated once per map and cached in memory for the vote countdown; temporary scene resources and renderers are disposed. Browser QA on the isolated server confirmed all four renders appeared; afterward the camera was lowered from y=7 to y=3.2 to avoid an overhead look, and that final camera angle still needs visual QA. Full suite: 227 passed; build: 87 assets/3.39 MiB gzip. Main 10-second vote timer unchanged.

The final y=3.2 voting-preview camera was subsequently checked in the isolated browser: all four playable arenas rendered from low angles with no gun or HUD, and their layouts remained distinguishable. The test-only server retained its 60-second visual-QA vote timer; production remains at 10 seconds. Browser left the room and the temporary server was stopped.

## Season progression foundation — 9 November

Added configurable UTC season data for Precision Frontier (1 Nov 2026–1 Feb 2027), public-match-only season XP derived from verified completed receipts, and three free coin/gem tiers with server-time eligibility and versioned one-time claims. The Challenges screen has a Season tab and the Updates feed links directly to it. Isolated browser QA checked the unearned/locked view; unit/API tests cover duplicate rounds, private/practice exclusion, boundary time, locked and concurrent/duplicate claims. Full suite: 229 passed; build: 88 assets/3.39 MiB gzip. This is a foundation, not the complete requested season system: unique seasonal cosmetics, themed content, seasonal missions, visual polish, future-season configuration/rollover and real player testing remain outstanding. No premium purchase is offered.

## Season missions — 9 November

Added three configurable season missions for public-match eliminations, headshots and wins. Verified result receipts update the original season once; one-time server-validated mission claims add season XP and survive tier claims. Browser visual QA for the new mission list remains pending. Existing season data from before this change has no retroactive mission counters. Two additional tests cover progress, tier interaction and concurrent claims; full suite: 231 passed, build: 88 assets/3.39 MiB gzip. Seasonal cosmetics, themed content and future-season rollover remain outstanding.

Season mission browser QA: the Updates entry opened Season, all three tier states and all three mission progress rows appeared, and the list scrolled to its end in the isolated browser. Hid the native scrollbar rail afterward while retaining scroll behavior; the exact final styling was not re-screenshot. Build remains 88 assets/3.39 MiB gzip.

## Season-exclusive badge — 9 November

Added the original Frontier Ace badge as a fourth free Season 1 tier at 5,000 season XP. Its unique icon appears on the track and profile badge picker; claiming records the server-owned badge and the existing authenticated equip/nameplate pipeline recognizes it. API tests cover locked equip, claim, equip, duplicate claim and retention through later matches. Full suite: 232 passed; build: 88 assets/3.39 MiB gzip. Browser visual verification of the new four-tier layout and real multiplayer nameplate remain pending. The full requested seasonal cosmetics/theming/event framework is not complete.

Frontier Ace follow-up QA: isolated browser showed the four tiers and badge icon; scrolling reached all three missions with the native rail hidden. A new integration test claimed and equipped the badge on one authenticated profile and verified it in another player's compact room snapshot. Full suite: 233 passed. This confirms transport and layout for the tested viewport, not a human multiplayer nameplate/render test or full seasonal polish.

## Season rollover claim window — 9 November

Earned tier and mission rewards remain claimable for seven days after a season ends, validated against server time. Matches finishing at or after the end cannot add progress to that season. The UI shows the claim deadline during grace and supports selecting multiple claimable seasons when future configured windows overlap. Added boundary and authoritative profile API checks; full suite: 235 passed, build: 88 assets/3.39 MiB gzip. Browser QA of the simulated post-season/overlap UI remains outstanding; no future season has yet been authored.

## Scheduled Precision Weekend — 9 November

Added a configurable server-time event window, 13 Nov 00:00 through 16 Nov 00:00 UTC 2026, doubling only public match elimination XP (not coins, challenge rewards or season XP). Verified archived delayed claims use the authoritative completion time and cannot be replayed. Challenges show an event banner only while active; Updates announces the scheduled window. Full suite: 237 passed; build: 89 assets/3.39 MiB gzip. Active-window browser presentation has not been simulated; wider themed events, assets and a complete live-ops system remain unfinished.

Simulated browser dates on an isolated localhost server confirmed the active Precision Weekend banner and the post-season 8 February claim deadline. The test exposed a stale NEW label after the event; the Updates tag now changes UPCOMING/LIVE/ENDED using the same server-time window as rewards, refreshed at profile updates and once per minute. Boundary test added; full suite: 238 passed; build: 89 assets/3.39 MiB gzip. The final status-label presentation has not been re-screenshot.

Season reward UI changed from separate cards to a connected milestone lane with currency/badge artwork and overall XP progress. Isolated browser QA verified the desktop track, locked labels, mission scrolling and active event LIVE tag using a simulated event clock. Build: 89 assets/3.39 MiB gzip. Narrow-screen layout and earned/claim visual states remain to be checked.

Isolated browser claim QA used a disposable profile preloaded with 600 season XP and a completed kills mission. Claiming tier 1 changed it to CLAIMED and awarded coins; claiming the mission changed it to CLAIMED and raised season XP to 1,100. A 600×700 viewport override showed a very small, letterboxed game area; narrow viewport usability remains unresolved and needs responsive-layout investigation. Viewport reset; isolated server stopped. No production save was changed.

Compact season-layout recheck: at a stable 600×700 viewport, measured viewport and modal both 600×700 and content 504×518; the previous apparent quarter-size/letterbox image was a transient viewport-resize capture, not reproduced. At 600×700, reward tiers and all mission rows are readable and scrollable; at 360×640, the two-column tier track and mission list render, with vertical scrolling required. This is a browser-layout check, not mobile control/gameplay certification. Viewport reset and isolated server stopped.

## Friends lookup consistency — 9 November

Player-ID search now uses the server's relationship result for self/friend/outgoing/incoming/none, and reconciles an open search result when a newer friends-list refresh arrives. Background rerenders preserve the friends list scroll position. Added relationship-transition tests; full suite: 240 passed, build: 89 assets/3.39 MiB gzip. Multi-user browser QA and party/public-match invitation flows remain open.

## Friends browser integration — 9 November

On an isolated server, a second disposable account sent a request to the browser account. Player-ID lookup showed ACCEPT for the incoming relationship; accepting moved the requester into ALL FRIENDS, a second lookup showed FRIEND, and remove left the list empty. One automated remove interaction unexpectedly opened the Shop while removal was also processed; the cause was not established and should be reproduced in further UI QA. Test account/data stayed isolated and the server was stopped. Public party and invite-to-match flows remain outstanding.

Retested the earlier friend-removal navigation anomaly on an isolated server: a new test account sent a request, the browser accepted it, then a direct click on the visible Remove control removed the friendship without opening Shop. The previous unexpected navigation did not reproduce; its cause remains unconfirmed. Temporary server stopped; no production friendship changed.

## Matchmaking roster portraits — 9 November

Reused the existing 3D lobby portrait renderer for authoritative roster gear, with a bounded 32-entry cache, restored local actor appearance after each capture, incremental frame scheduling, and a silhouette fallback. Room fingerprints include weapon/gear so appearance changes update. Isolated browser QA showed two different equipped appearances, prior to a small fallback-only markup change. Full suite: 240 passed; build: 89 assets/3.40 MiB gzip. Fifteen distinct portrait performance, final fallback visual, and real multiplayer QA remain open.

## Frontier Vanguard season rifle finish — 9 November

Added a Season 1 M24-only Frontier Vanguard finish at 7,500 season XP. It uses an olive/gold relic-family treatment and existing bounded golden particles. Server rejects direct purchase and unowned equip; claiming tier five records the per-rifle finish entitlement and normal armory equip/room validation applies. Isolated browser QA verified the five-tier track, rifle preview and Earn in Season navigation. An API/model test covered locked purchase/equip, claim, equip and decoration/effect descriptor; full suite: 241 passed, build: 89 assets/3.40 MiB gzip. The equipped skin has not been visually checked in a human multiplayer match, and broader season content remains unfinished.

Frontier Vanguard multiplayer transport QA: an authenticated owner claimed/equipped the finish and a second authenticated client observed it in the compact room snapshot; a forged finish from the unentitled observer resolved to field. Full suite: 242 passed. This is server/transport evidence; an actual two-human rendered match remains unverified.

## Private Arms Race — 9 November

Exposed existing server Arms Race in private-room mode selection. Connected client mode title, rifle-stage progress, server-ranked ordering, stage-driven equipment changes (including forced final knife), and prevented automatic ladder rifles from overwriting the saved loadout. Client blocks loadout and final-stage weapon changes consistently with server rules. Authoritative test covers two-kill rifle advance, final knife stage and match end; isolated browser with one temporary opponent verified mode selection, warmup/live entry and M24 0/2 HUD. Full suite: 243 passed; build: 89 assets/3.40 MiB gzip. The complete rifle ladder and final knife stage were server-tested but not played through by two human browser clients; CTF/tournament and WAN QA remain open.

## Isolated 15-player soak — 9 November

The multiplayer soak now accepts a localhost-only server URL and an optional report path, allowing a temporary database instead of the player's normal server. It separately counts event gaps observed across the intentional warmup-to-live event reset; gaps during a phase remain failures. A 45.1-second isolated run with 15 authenticated clients, jitter and 60 discarded acknowledgements completed 6,813 requests, 285 accepted live shots, zero within-phase event gaps and zero busy responses; all 15 clients left. Local RTT p50/p95/p99 was 5.01/10.76/14.84 ms. An earlier run observed three gaps without phase diagnostics, so their precise cause was not captured; the later run saw no phase-reset gaps either. The 22 multiplayer and networking tests passed. This is localhost API evidence only, not 15-human, browser-rendering or WAN validation. The test cannot distinguish additional post-reset loss if it happens in the same response as a warmup-to-live reset.

## Event reset boundary — 9 November

Server snapshots now remember the latest intentional event reset and report a gap only if events after that boundary are missing. This prevents discarded warmup effects from appearing as lost live events while preserving gap detection for a live overflow even when the client last acknowledged warmup. Existing rooms without a reset marker retain the conservative behavior. The soak no longer suppresses all gaps on a phase change. Regression covers both cases; the full suite passed 243 tests and the build produced 89 assets (3.40 MiB gzip). An isolated 20-second 15-client run completed 3,033 requests, 25 discarded acknowledgements, zero gaps and 81 accepted live shots; all clients left. The original uninstrumented three-gap run cannot be conclusively attributed to this reset. WAN and human browser validation remain open.

## CTF objective foundation — 9 November

Added a standalone server-side objective module covering opposing base selection, enemy pickup, contested-home capture, friendly return, death drop and 15-second dropped-flag return. Tests cover the capture sequence, no duplicate score, spectator/height checks and all four map base orientations. This is not a playable mode yet: authoritative room lifecycle, movement-triggered updates, deaths/disconnects, score limit, team setup, replicated presentation and UI still require integration and validation. No lobby announcement was added.

CTF server integration: private settings accept CTF and apply balanced team setup, warmup/live reset creates map-based flags, server movement updates objectives, carrier death/leave drops flags, dropped flags return after 15 seconds, captures alone score and three captures end the round. Pickup removes spawn protection. Snapshots include flag state; generated Worker includes the objective module. Room tests exercise teams, captures, victory and disconnect/return; standalone objective tests cover contested capture and drop. Full suite: 247 passed; build: 89 assets/3.40 MiB gzip and generated Worker syntax check passed. CTF remains unexposed and unplayable until lobby, in-world flag rendering, HUD/results and end-to-end combat/multiplayer QA are completed. Death-triggered drop and spawn-protection cancellation have not yet been exercised through a complete combat command in the room tests.

CTF presentation integration: private lobby now offers Capture Flag with team assignment, balanced capacity controls and team switching; the client renders team-colored flag meshes from authoritative snapshots, displays capture score, first-to-three and carrier status, and resolves team results by capture score. Lobby Updates links to private rooms. Isolated browser verified choosing CTF, team controls and arena preview; a visible room-config scrollbar observed there was subsequently hidden while retaining scrolling, but the final CSS was not re-screenshot. Full suite: 247 passed; build: 89 assets/3.40 MiB gzip; client and generated Worker syntax checks passed. No four-player browser match, live flag visuals, death-triggered drop through combat, scoring UX or CTF result screen was observed in this pass; these remain necessary QA before considering the mode finished.

## Movement input recovery — 10 November

Retained held keyboard state across transient resync, separated mouse cancellation from keyboard reset, coalesced identical movement frames and bounded batches to the server's 320 ms movement allowance while retaining the latest inputs. Focus/explicit pause/death still clear held keys. Focused input/network/room checks: 45 passed; build: 90 assets, 3.40 MiB gzip. Browser control was disabled in this session, so native held-key, mouse chord, UI response, frame rate and WAN play remain unverified. During stalls longer than the server allowance an authoritative position correction can still occur; no claim of fully smooth multiplayer without actual playtesting.

Browser input check: used an isolated IPv6 localhost session and temporary server data. In Crosswind practice, a 1.2-second W hold visibly moved the player; pause opened and Settings opened from the pause menu. This checks basic practice interactions only: pointer-lock behavior, simultaneous mouse/keyboard input, frame timing and online movement under latency are not verified. New profiles now default to Balanced graphics; existing saved quality choices are preserved. Focused quality/input checks passed and build completed.

Mouse chord follow-up: missing button releases now cancel only the missing buttons. A missed LMB release no longer clears held RMB scope; blur cancels the remaining chord, and duplicate/unmatched mouseup events do not execute release actions. The focused regression covers partial chord loss without an accidental grenade throw. Recovery retains camera aim and held RMB where appropriate. Full suite: 250 passed, zero failures. Browser evidence remains limited to basic practice W movement and pause/settings opening; online latency, simultaneous native input and hardware FPS require further gameplay QA.

## Network browser input — 10 November

An isolated private FFA room with one browser and one independently authenticated scripted peer reached live play. Browser W hold moved the player, 2/1 changed knife/rifle, and pause opened. The pause menu then disappeared before a Resume action could be verified, twice causing an AX action to target a no-longer-rendered menu. Exact event ordering was not captured. The pointerlockchange handler unconditionally resumed on lock acquisition, so it now rejects a late lock while paused or in loadout; explicit focusAim still resumes normally. Source syntax and build passed. This guard requires a fresh browser retest before claiming the observed menu instability fixed. Opponent left and temporary server stopped. This localhost check is not WAN, 15-human, pointer-lock chord or frame-rate certification.

Pause guard browser recheck: isolated Crosswind practice completed Pause → Settings → Back → Resume → Pause → Return to lobby. Practice clock remained at 2:55 through settings and advanced after explicit resume. DOM inspection showed pointerLockElement null while paused; this verifies the tested button flow but does not force or prove a late successful lock acquisition race. Guard remains a defensive correction supported by source inspection; network-menu instability needs further event-level reproduction if it recurs.

## Remote rifle render cost — 10 November

Measured base remote rifles at 89–154 meshes across the eight models, despite only nine materials. Static direct-child rifle geometry now batches by material; bolt and flash retain independent nodes. Each base remote rifle is 11 meshes. A comparison against HEAD confirmed identical per-material transformed vertex counts/positions/normals/UVs (maximum numeric difference zero). Existing full suite passed 250 tests; added render-budget/anchors/skin-transition/disposal regression passed; build completed with 90 assets, 3.40 MiB gzip. First-person rifles remain independently animated. Actual GPU draw-call/FPS change and remote-rifle visual QA are not measured yet; mesh reduction is evidence of reduced submissions, not a hardware FPS claim.

Optimized-rifle browser recheck: isolated Crosswind practice rendered, movement changed viewpoint, and the M24 loadout preview displayed the complete batched base rifle. Loadout opened/closed normally. This is visual evidence for the M24 preview and practice path; other seven models are covered by numerical geometry equivalence, not individual browser screenshots. Full 15-player GPU FPS and all skin visual combinations remain unmeasured.

## Wardrobe render cost — 10 November

Reused rifle static-material batching for each wardrobe body/head/arm/foot group; animated groups and gear ownership/disposal remain separate. Across all 24 catalog items, measured static meshes dropped from 366 to 126. Existing full suite: 251 passed. Added batching regression verifies transformed bounds, material reuse, animated-group preservation, original geometry disposal and vertex count; it passed. Build: 91 assets/3.40 MiB gzip. Wardrobe visual QA and device GPU frame-rate comparison remain outstanding; reduced mesh submission count is not an FPS measurement.

## CTF combat and reach validation — 10 November

Added an authoritative sniper-command regression: flag pickup clears protection, carrier elimination drops at the death position, kills do not grant capture points, duplicate shot packets cannot double-score, and the two-second respawn restores health without reattaching the flag. Hardened objective pickup/return/capture with a server collision ray, preventing interaction through intervening cover. An actual Crosswind balcony rail test rejects a 1.1 m pickup across the rail and accepts same-side reach. All six CTF tests pass; generated Worker syntax and 91-asset/3.40 MiB build pass. Four-player rendered CTF, capture HUD/results, WAN balance and tournament/party implementation remain open.

Rendered CTF check: one browser plus three authenticated scripted peers formed balanced 2v2 teams and reached live CTF. Capture score / first-to-three HUD and the blue home flag were visible. This was not a played capture or four-human match. A nearby teammate nameplate dominated the view and used the enemy label color; added a projected screen-size cap and blue friendly labels, with FOV/viewport/depth regression passing. New label rendering requires a browser recheck. Six CTF plus five quality tests passed; build 91 assets/3.40 MiB gzip. Temporary peers left and QA server stopped.

## Independent audio mix — 10 November

Audit found only master gain despite requested independent music/effects controls. Added persistent musicVolume/effectsVolume defaults, effective master×channel gain calculation, menu sliders and match sliders. Combat samples, synthetic cues, footsteps, menu feedback and elimination preview use effects gain; countdown/results music uses music gain, with immediate active-music updates. Legacy saves preserve their existing master volume and child channels default to full. Full suite 256 passed, build 92 assets/3.40 MiB gzip. Settings panel gains a bounded hidden-scrollbar overflow path for short windows. Browser slider layout/persistence and audible channel isolation still need verification before release.

## Hosted controls and proxy triage — 11 November

The cPanel URL was supplied, but automatic approval denied opening it because of its usage limit. Reproduced an independent hosting issue locally: an HTTPS Origin forwarded to the Node HTTP listener caused the profile API to return 403. The optional `SNIPER_PUBLIC_ORIGIN` deployment setting now supplies the canonical origin to all APIs. With HTTPS configured, isolated startup accepted guest creation and private room create/join, issued Secure cookies, and rejected a different Origin on profile, rooms and social despite forwarded headers. The effect of this issue on the actual hosted build remains unverified.

Paused match overlays now cap world/view rendering at 15 FPS while the match loop stays active. HUD labels only replace text when their value changes, and nameplate sizing reads cached viewport dimensions. Local browser tested practice knife/rifle switching, match Settings, pause, resume, practice results and the Inferno Warden costume preview. Earlier lobby volume values persisted after reload. Audible channel isolation, hardware frame timing and WAN movement remain unverified. A 20.11-second isolated localhost soak with 15 authenticated clients completed 3,048 requests, 80 accepted live shots, 25 discarded acknowledgements, zero busy responses and zero event gaps. RTT p95 was 13.74 ms. Hosted QA should capture frame timing and request latency together while repeating held movement, aim, pause/settings and reconnect with two real browsers.
