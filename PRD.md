# Sniper Rush — implementation PRD v1.3

6 November 2026 · Desktop browser game · Working title

## Purpose and source of truth

Continue the existing game toward a readable, responsive, multiplayer sniper arena with knife and grenade secondary equipment. This document extends the supplied production PRD v1.0, sections 01–15; it does not replace its multiplayer, fairness or platform requirements. Later direct user feedback takes precedence over conflicting reference-document targets. The current build is a playable prototype with automated checks, not a measured production release.

Keep the experience a game at every step: actual 3D lobby, armory, locker, match HUD and results. No website hero, dashboard, checkout flow, fake online players, invented ping or fake progress. Original meshes, layouts and branding; reference images set quality and feel rather than permission to copy assets.

## Locked decisions from user feedback

| Decision | Required behavior | Overrides v1.0 |
| --- | --- | --- |
| Avatar | Centered, full-body, blocky Roblox-inspired silhouette; original mesh; clothing, accessories and shoes visibly change | §02 sports-figure proportions |
| Lobby | Quiet geometric training bay; no busy generated background; logo above avatar, two dominant play buttons, compact utilities | §06 decorative density |
| Menu palette/type | Warm charcoal/olive scene, off-white Rush game font throughout, gold controls/reward accents; no blue profile/navigation chrome or operating-system selects | Latest direct user overhaul |
| Weapon roster | Eight distinct long realistic rifle forms; guns only in armory; cosmetic differences, identical damage and chamber timing | §13 one initial rifle |
| Ammunition | Unlimited reserve, one ready shot, automatic 1,500ms chamber after every accepted shot | §13 five-round magazine and timing targets |
| Damage | One unprotected sniper hit eliminates, with a 1cm graze shell; fresh player needs two 50-damage knife contacts; grenade wounds persist and one knife finishes any outer-blast survivor; internal vitality, no health bar | Latest direct user refinement |
| Aiming | Mouse turns camera; crosshair and bullet ray always screen center; rifle converges toward center; no cursor/reticle divergence | Earlier cursor-following experiment |
| Scope | Strict hold RMB only; release closes scope; LMB can fire while RMB stays held; no toggle setting; stable radius while moving/chambering | Latest user correction overrides §11 optional toggle |
| Death | Articulated collapse, floor contact, remain for 1.5s then disappear; independent from respawn | Refinement §14 |
| Materials | Subtle cloth, polymer, steel, wood and panel texture; keep readable color zones | Refinement §02/06 |
| Secondary equipment | 1 sniper / 2 knife / 3 grenade; held LMB chains knife swings; grenade hold/release, one per life, auto-return to sniper, replenish on respawn; server owns damage | Latest direct user refinement |
| Profile identity | Editable persistent alias and exact equipped-character portrait in profile/lobby | Latest direct user correction |
| Ammo HUD | Unboxed current-weapon image left of ammunition/chamber state | Latest direct user correction |
| Branding | CrazyGames mark bottom-right without a surrounding card | Refinement §06 |

No real-money economy is in scope. Base rifles and starter costume/headgear/shoes remain available. Other costumes/headgear/shoes have coin unlock prices for new guest profiles; existing owned items are retained. Gold rifle finish still requires mastery. Gems cannot be purchased and come only from completed daily challenges or a free golden wheel. All progression/currency is guest-local until an account-backed authority exists.

## Player journey

1. Load real essentials and build the lobby. Display accurate completed stages and retry on failure.
2. Enter interactive lobby immediately when ready. Show avatar head and boots with no CTA overlap at 907×510, 821×462 and 1920×1080.
3. Play Online joins a real public room. Underfilled rooms explain the wait and offer explicitly labeled practice. Joining a live match preserves its remaining time.
4. New public rounds vote for one of four maps, warm up for 10 server seconds, play 600 server seconds, show results, continue in the same room.
5. Play With Friends creates or joins by code/link; FFA, duel or balanced TDM; host settings only before play, readiness and host migration.
6. Scope, move, fire, automatically chamber, receive server-confirmed kills, respawn promptly. B opens an actual rifle-only loadout in warmup or while eliminated. A living player cannot change rifle in LIVE.
7. Results show placement, actual statistics, winner presentation and earned local rewards once per completed public round. Practice/private rounds do not inflate public statistics.

## Requirement and acceptance register

Status: **implemented** means code plus relevant automated evidence; **partial** means working pieces with missing behavior; **unverified** needs real browser/hardware/platform evidence; **planned** is not delivered. Passing unit checks never proves visual quality, real 15-person networking or hardware performance.

| ID | Priority | Requirement / acceptance | Current evidence and gap |
| --- | --- | --- | --- |
| BOOT-01 | P0 | Progress includes fonts/avatar, game modules, real shot decode and first rendered 3D lobby; errors retain retry, no fake timer | Implemented stage sequence, decode reuse and first render before overlay removal; failure/order checks pass; browser reached lobby after seven local clips decoded |
| INPUT-01 | P0 | Locked pointer supports continuous yaw; mouse has no acceleration; center aim and legal shot ray match; held RMB+LMB works | Implemented input chord/rifle math tests; fresh Safari/Chrome/Firefox QA pending |
| INPUT-02 | P0 | Esc/focus loss releases controls; resuming requires a gesture; Tab only captures in match; remaps persist | Shared validated bindings repair old reserved/duplicate keys; browser J remap survives reload and moves, hints match, Esc focuses Resume, Tab/Shift+Tab stay in pause/armory, Enter resumes and held Tab scoreboard clears on release; native pointer-lock/focus-loss device QA remains open |
| MOVE-01 | P0 | Stairs ascend/descend smoothly at 60/90/144Hz; crouch cannot expand into a roof; no wall tunnelling | Automated stairs, roof and elevated cover checks pass; live feel QA pending |
| GUN-01 | P0 | All rifles share one-shot damage and 1500ms automatic chamber; unlimited reserve | Implemented shared timing + 30-shot test |
| GUN-02 | P0 | Actual B loadout, rifle preview, selected state; server rejects alive LIVE changes; selection persists across spawn | Implemented eight-rifle armory, preview and keyboard navigation; server timing/permission/respawn checks pass; browser practice armory/equip and alive LIVE rejection observed |
| GUN-03 | P0 | Selected rifle replicated to opponents and shot/kill feed; server validates IDs and preserves equal stats | Implemented join/selection/event metadata and actual third-person models; fabricated-ID and resource-isolation checks pass |
| HIT-01 | P0 | Server validates alive/ammo/interval, cover and hitboxes; no client-awarded online kills | Implemented API tests plus shallow cover peek, elevated headshot and processed-after-death rejection; real latency QA pending |
| HIT-02 | P0 | Safe spawn, short visible protection; shooting or leaving safe radius cancels protection | Implemented spawn scoring/protection; safe-radius exit scenario checked; live spawn-camping playtest pending |
| HIT-03 | P1 | Readable cosmetic surface impacts from the centred shot ray, no marks through nearer characters/cover | Nearest box/floor trace, correct face normal, brief dust and 5s fading marks implemented; actual parapet impact observed; bounds/lifetime/resource checks pass; marks are local feedback and never award damage |
| DEATH-01 | P0 | Body collapses, retains crouch scale, does not intersect floor, removed at 1500ms; respawn cannot move corpse | Server-owned death position/stance/rifle survives delayed delivery and respawn; shot-directed collapse, independent dropped-rifle resources and exact 1500ms expiry checked. Actual practice kill shows fall, settled body and clean target return; real WAN late-event playtest remains open |
| NET-01 | P0 | Public capacity 15, authoritative 600s clock, replacement votes, late join, no >2 repeated maps, rematch population preserved | Automated 15-client lifecycle test; WAN device test pending |
| NET-02 | P0 | Private permissions, host migration, room lock/remove, duel, equal TDM teams, no friendly fire | Implemented rules; spectator UX and real 5v5 validation incomplete |
| NET-03 | P1 | Transient failures recover without duplicate commands; stale sessions explained; measured latency shown | Implemented typed errors, backoff, saved-tab restore, resync and no mutation replay; five recovery tests pass; browser reload preserved private identity/clock; real network loss QA remains open |
| HUD-01 | P0 | Small kill/death leaderboard below pause, own row visible, ranks reorder, Tab ranking matches | Implemented ranking checks; two-player live leaderboard observed below pause at 821×462; large real-match ranking still open |
| HUD-02 | P1 | Shot feed has rifle shorthand and concise headshot/long-shot tags; no permanent clutter or aim obstruction | Implemented rifle labels and HEAD/LONG tags; event metadata tested; crowded live feed QA pending |
| ART-01 | P0 | Quiet lobby, full-body centered avatar, unboxed CrazyGames mark, readable original logo | Browser screenshots at 821×462, 907×510 and 1920×1080 show head/boots, both play buttons and unboxed mark; framing tests pass |
| ART-02 | P1 | Actual movement animation, cloth/steel/wood/panel texture; no disappearing or sliding actors | Implemented stride/materials and corpse checks; visual review pending |
| MAP-01 | P1 | Original blocky arena identity with readable surfaces and connected routes | Slate-blue/sand panel palette, tower passages/windows, Crosswind upper route implemented and traversed; reported interior flicker fixed by removing coplanar caps and clipping duplicate structural faces; four-map surface checks and 60/144Hz traversal pass; blue-tower interior/opposite stair angles clean in browser; Safari/hardware and competitive balance playtest remain open |
| FEEL-01 | P1 | Sharp firing kick, quick recovery, small muzzle sparkle and brief smoke without obscuring aim | Real-time recoil recovery, shake/reduced-motion support, 85ms barrel-aligned flash, 70ms sparkle/trace and 800ms world-space smoke; bounded pool/disposal checks pass; actual browser firing/puff and centred recovery observed; extended device feel playtest remains open |
| GEAR-01 | P0 | Shop tabs always return between rifles/clothing/accessories/footwear; equip previews affect lobby | Game-style locker/shop, distinct gear glyphs, actual rendered equipment thumbnails and one Rush UI font implemented; compact Inventory→Rifles→Footwear→Clothing round-trip passed; Ember outfit equipped visibly, then original Cobalt restored; Titan rifle preview/equip observed |
| AUDIO-01 | P0 | Use the user's four shot and three reload recordings; fast cache reuse, volume respected, remote direction/distance; stop resources on exit | Eight local combat MP3s decoded at boot, including the requested elimination cue; rifle-specific voices and trimmed chamber scheduling; quiet filtered 45/90ms early reflections only on shots, no repeating feedback; source provenance retained; timing/cache/panner/master-mute/routing/disposal tests pass; requested elimination cue on confirmed local kill/received elimination, dry/master/mute/disposal checks pass; subjective listening balance remains open |
| RESULTS-01 | P1 | Separate game results composition with podium/placement, K/D, accuracy, streak and next round | Implemented podium/final stats/team result/continuation; fresh two-client private results rendered with podium, placement, K/D/accuracy, no public rewards and countdown; same room restored afterward; real public/TDM visual QA remains open |
| PROGRESS-01 | P1 | Completed public round rewards applied once; local guests labeled; no private/practice farming; no misleading prices | Implemented unique room/round identity and local idempotent award ledger; reload, exclusion and rematch checks pass; wallet copy corrected |
| PERF-01 | P1 | Quality selection persists, cap pixel ratio/shadows by tier, no hidden preview loops | Implemented Low/Balanced/High presets and bounded real frame samples; browser quality control verified; one local practice report: 600 frames, median 16.7ms, p95 17.6ms; hardware benchmark remains open |
| PLATFORM-01 | P1 | CrazyGames identity/invites/gameplay lifecycle/loading hooks follow current official SDK; no custom fullscreen or midgame ads | Official v3 docs checked; init/loading/gameplay/pause/invite/auth/friends/mute implemented; lifecycle/mute tests pass; hosted embed and account verification remain open |
| RELEASE-01 | P0 gate | Browser matrix + real concurrent match + deployment in original Site workspace | Blocked externally for publication; current switched account cannot access original Site; do not duplicate Site |

## Implementation order

### Milestone A — finish the existing core loop

1. BOOT-01: stage-tracked preload, first rendered lobby before ready, retry and cleanup.
2. GUN-02/03 and HUD-02: server-owned weapon selection, in-match armory, opponent rifle models, feed event metadata. No combat advantage or new currencies.
3. HIT-01/02: regression cases for cover/peek, airborne hitboxes, shield exit, rejected shots and loadout permission timing.

Exit: deterministic checks cover the complete new paths, Worker serves all modules/assets, no stale placeholder behavior; browser observations recorded honestly. Browser unavailability does not justify skipping code or service checks.

### Milestone B — results, progression and room continuity

4. RESULTS-01: original 3D winner/podium, score summary, late-join context, public next-round countdown and private ready flow.
5. PROGRESS-01: stable room/round identity, idempotent public reward application, clean wallet/task copy, persistence validation.
6. NET-03 and spectator flow: recover transient errors, avoid duplicate shots/results, join and return reliably.

### Milestone C — launch quality and integration

7. PERF-01: low/balanced/high quality settings; real frame-time capture and low-end check.
8. PLATFORM-01: verify SDK against official docs; real identity/friend/invite/loading behavior, no invented presence.
9. Release audit and publication after original workspace access returns. Do not describe a local build as deployed or real-device tested.

## 6 November feature and map continuation

| Requirement | Current implementation | Acceptance still open |
| --- | --- | --- |
| Public matchmaking | FFA only, 15-player capacity, 10-minute rounds, four-map voting, 10-second playable warmup | Real 15-player WAN match and balance |
| Queue practice | Real room membership retained while shooting range targets; second player triggers vote then warmup; no solo fake countdown | Two local clients observed; WAN interruption during this exact transition |
| Respawn / anti-camping | 2-second authoritative respawn; candidate scoring weighs enemy sightlines, distance, recent eliminations and nearby shots; one-second shield ends on moving >1.5m or firing | Real competitive spawn-camp playtest; no claim that camping is eliminated |
| Profile | Level/EXP, kills, wins, K/D, accuracy, longest elimination and best streak | Account-backed persistence; guests currently persist on this device |
| Rifle mastery | Individual rifle XP, Bronze at 100 kills, Silver at 250; Gold finish at 500 kills + 100 headshots + 50,000 XP | Cosmetic finish replication to remote rifles; visual review of an earned gold guest profile |
| Difficult permanent badges | Weapon Master: 250 kills/50 headshots on all eight rifles; Deadeye: 500 kills/300 headshots/2.0 K/D; Untouchable: 25 streak/20 wins; Arena Legend: 100 wins/200 rounds. Earned IDs persist even if K/D later falls | Badge IDs are canonical but local earning ledger is editable; authenticated server proof is not implemented |
| Daily challenges | UTC daily 10 quickscopes, 5 airborne kills and 2 public wins; one-time XP/coin rewards plus 10/10/20 gems; late prior-day results cannot replace a newer record | Full public-round device playtest; deterministic event/reward tests pass |
| Podium | Up to five actual top players in the current arena, full equipped lobby-quality operators, held rifles, individual poses, overhead kills/deaths/streak and weapon/accuracy cards; continuous final-five-second music | Actual three-client 1280×720 review passes; five-player/compact/device and distinct remote gear review remain open |
| Character gear | Six different costume structures, six headgear types, four shoe constructions; canonical gear reaches remote actors/results; full actual-mesh thumbnails and focus previews | Additional hair/glove content, remote gold finish and broader cosmetic roster |
| Friends | Private room codes, invite links and direct friend invites, with FFA, duel, TDM, CTF and Arms Race rules | Public parties and 8/16-player tournament brackets remain open |
| Sniper locker | Eight gun models, per-rifle voices, mastery and earned gold | Additional scope designs, reticle styles and selectable cosmetic trails/audio |

Four playable arenas share authoritative collision and the exposed-face renderer:

- **Crosswind:** familiar connected towers, relay deck and underpasses retained.
- **Switchyard:** existing freight cover mixed with Yardline's divided lanes and outer gantries; two approaches to each upper side.
- **Overlook:** Courtyard-inspired four-pavilion balcony loop with six stair approaches, central low cover and open lower passages.
- **Foundry:** original workshop cover combined with Skybridge/Switchback ideas: two-flight ascent, relay platform and tower skywalk; rail intrusion corrected after a route test stalled.

All four can be explored solo using the map gallery Practice action. Patrols use clear spawn-side lanes. Map gallery and public votes use actual browser screenshots, replacing schematic top-down thumbnails at the user's request. The user-supplied concept images remain design references, not gameplay evidence. Browser captures show actual gameplay at the available 805×890 viewport; the landscape override did not take effect, so no new landscape/compact sign-off is claimed.

Browser checks observed: all four arena entry flows, Overlook upper balcony, Foundry two-flight ascent/relay, public practice retaining membership and transitioning through a Foundry vote to 10-second warmup/live, profile/daily panels, loaded screenshot cards and no captured console errors. Local QA clients were removed and extra tabs closed. No 15-human test or production deployment is claimed.

[CrazyGames technical requirements](https://docs.crazygames.com/requirements/technical/) currently specify initial download limits of 50 MB and 20 MB for mobile homepage eligibility. The raw complete client bundle is below either size threshold, but mobile eligibility, memory, FPS, browser support and hosted SDK behavior still require actual validation. Multiplayer hosting/account-backed authority remains separate release work.

## Profile and secondary equipment addition

Editable alias uses the shared Unicode-aware 2–22 character normalizer, remains local for guests and is sent through the authenticated room session when present. It does not rename the external CrazyGames account. The portrait is generated from the actual equipped lobby mesh/gear in a cached render target; no generated or account profile photo is substituted.

Current weapon HUD uses a render of the actual selected model to the left of unboxed ammunition text. Sniper reserve remains unlimited, with 1500ms automatic chamber preserved across equipment changes. Key 2 knife performs LMB melee within 2.4m with a 580ms swing cycle, 180ms contact timing, alternating windup/thrust/recovery and hard-cover/team/shield checks. Holding LMB chains swings. Each clean contact deals 50 internal damage: two eliminate a fresh 100-vitality player, while one finishes an outer-blast survivor. Misses do not count; vitality and hit diagnostics reset on respawn. Key 3 grenade primes on LMB, charges up to 1200ms and throws on release. A tap drops it nearby; a full hold travels farther. The server bounds client hold duration by observed prime time, applies a 1800ms fuse, a 4.5m lethal core, and a 4.5–8m wound band falling from 99 to 50 damage. Hard cover, shields and team rules prevent damage; repeated blasts accumulate and there is no automatic healing before respawn. Each life gets one grenade, replenished only on respawn; throwing returns to sniper after the release animation. Self-elimination is possible without self-kill credit. A short additive white-hot flash, outward sparks, fragments, eight-metre dust ring and four-second expanding soot communicate the blast. A bounded gun impulse respects reduced motion; the centered aim and scope radius stay fixed. A red edge vignette communicates lasting wounds without a numeric health HUD. No health bar is introduced.

Shared bounded projectile physics run in practice and server rooms; client damage/target/origin fields are not trusted. Changing equipment, pausing/blur or death cancels pending prime; respawn restores sniper. Online thrown projectiles/blasts are replicated. Clients present known-fuse explosions on time and deduplicate the subsequent grenade-ID confirmation; only the server applies damage. Stale reconnect effects never replay delayed impact audio. The supplied grenade recording is trimmed at 398ms (measured audible onset moves from 405.67ms to 7.67ms) and stays dry. Rifle XP/accuracy counters stay separate from secondary eliminations. Knife and grenade have original base meshes with new skins explicitly deferred as requested future content. Real opposing-player melee/WAN/device feel testing remains a release gate.

## Technical constraints

- Shared movement and rifle timing run client/server. Online kills, loadout eligibility, score, respawn and clocks are server-owned. Client predicts presentation and movement with reconciliation.
- Current transport is serialized HTTP polling over the room API, with optimistic concurrency in D1. This is a prototype architecture; sustained 15-player WAN latency/cost is an open release risk, not a proven 60Hz game server. Measure before deciding on a room-per-authority realtime service.
- Existing `dist/` contains hand-authored runtime modules; `dist/server/index.js` is generated by `npm run build`. Change source modules, then regenerate the Worker.
- Reuse Three.js and browser APIs; avoid a second engine or UI framework. Dispose per-owner GPU and audio resources. Original asset/third-party license provenance remains in the repository.
- Do not report 60 FPS, first-click conversion, low-end support, complete anti-cheat or production scale without the corresponding measurements.

## Verification gates

Automated: `npm test`; `npm run build`; generated Worker syntax; changed module syntax; exact asset delivery through Worker; stateful scenarios covering whole match boundaries and newly added actions. Add tests for behavioral risk rather than duplicating implementation.

Manual when browser control is available: 907×510, 821×462, 1920×1080; lobby full body and buttons; shop tab round-trip; B armory restrictions; pointer lock loss/resume; hold scope+fire+chamber; stairs and roof; moving targets and corpse; results/rematch; prolonged play then leave/re-enter without resource growth.

Release-only: actual Chrome/Edge/Safari/Firefox sessions; 15 real clients through a full 10-minute public round and a real 5v5 private match; measured p50/p95 frame/shot/network timing; deployed storage and embed SDK. Any missing gate stays explicitly open.

## Current execution log

- 8 November appearance/public-results continuation: verified Gold now propagates through compact own/remote state and podium, with frozen corpse finish and new-life wardrobe changes; canonical labels refresh and departed/rebuilt actors release resources.175tests pass, packaged Worker verified. Native isolated public fixture accepted one real LMB headshot, then controlled end boundary produced actual podium+100XP/+25coins; next round retained both participants, reload preserved totals and all participants left. This is controlled UI pipeline evidence, not full600s/human/WAN or native earned-Gold sign-off. Requested advanced private modes, balance/device/performance/platform gates remain open.

- 8 November recovery/session continuation: single-use guest key restores the same persistent profile with cookie rotation; missing cookie for a known save requires recovery. Key/hash excluded from normal responses/cache. Production room commands require current authenticated profile/session binding.173tests pass;15 independently authenticated local SQLite clients completed45s/6,813requests/0busy/0gaps and all room participants left. Native restore-form error feedback checked without live secret generation. External account linking, remote Gold/gear parity, real public results/human/WAN checks, advanced modes and platform release remain open.

- 7 November profile menu rollout: boot, wallet/wheel/exchange/shop/equipment/name/badge/finish and public rewards now use server saves; exact legacy JSON backup preserves the old device save while online currency/career starts from verified state. Idle finished public rooms settle during claim/sweep before deletion.171 tests pass; isolated native localhost guest verified200coins/reload, Barrett equip/reload, rename, spin interruption recovery,300coin cap purchase/equip/reload, clean logs. Actual user127.0.0.1 save left untouched. Recovery, strict production room identity enforcement, remote earned finishes and remaining human/WAN/mode/platform phases still open.

- 7 November archive/wardrobe continuation: public completed rewards archive atomically with room CAS into separate persistent receipts; claimrewards survives processed result rollover, room deletion and restart and deduplicates concurrent claims. Local rooms now persist in SQLite. Shared catalog and server buy/equip/badge/mastery-finish checks implemented; authenticated joins take profile appearance.166tests pass and bundled Worker archived-claim path verified. Menu migration, anonymous compatibility removal, idle-room finish settlement, account recovery and remote Gold replication remain open; no phase-complete claim.

- 7 November persistent progression foundation: added private-cookie guest identity with hashed lookup, persistent local SQLite/D1 profile CAS, server daily/wheel/exchange/rename actions, authenticated room binding and public results rewards from room counters.161 tests pass and packaged Worker SQLite path verified. Legacy UI/save remains local until migration and all mutation paths are connected. Durable delayed-result archive, wardrobe validation, client/menu integration and recovery are required before this phase is complete; no server-saved profile UI claim.

- 7 November seven-point goal: negotiated compact player protocol reduces measured comparable15-client HTTP response bodies68.77% while retaining full-precision own prediction, required remote pose/ranking and full results.159tests pass;76-asset Worker built and SQLite integration checked. Actual two IAB tabs joined/readied/warmed/entered live FFA; host fired/rechambered, pause kept time running, host leave preserved peer play, both returned cleanly. Browser control now available. User requested local continuation while original Site remains inaccessible. Server progression, full real-human/WAN matches, balance, presentation/private modes and platform release remain required; no full-goal completion claim.

- 6 November multiplayer continuation: capped stale real-time queueing; RTT-aware monotonic server clock; bounded/cursor-based combat event delivery; grenade ownership survives disconnect; active manual-team joins receive a side; hidden tabs send a bounded heartbeat.155 automated tests pass. A repeatable15-client local45s soak completed6,803 requests with60 intentionally lost acknowledgements,0 busy replies,0 event gaps,0 cleanup leaks, p95 RTT8.28ms. Inference/limits: localhost memory-service latency is not a hosted network benchmark; native browser/background suspension and external D1 load remain pending. Report: [QA multiplayer soak](qa/multiplayer-soak.json).

- 6 November match-flow continuation: wall-clock/cancellable matchmaking survives practice pause, ignores late callbacks and hands off the existing session once. Public empty-lobby transitions reopen retained practice; practice replay keeps its map and releases the previous podium renderer. Async launch/connection intents respect cancellation. Practice/server share full respawn motion reset; presentation clears old zoom/recoil/stride/wound feedback. Paused finale reveal resumes its source, and canceled suspended voices disconnect without affecting the next round.143 tests pass;75-asset build and5/5 changed Worker/local asset delivery pass. Complete browser transition and physical-device/WAN checks remain open because local browser control is disabled. Production progression/economy authority and original Site access are still pending.

- Baseline before this PRD: 17 automated tests pass; build has 39 assets, 2.25 MiB gzip. These do not prove browser/platform release gates.
- Milestone A implemented: staged boot, authoritative in-match loadout, replicated rifle models/feed, clone-safe dropped weapons and targeted combat checks.
- Milestone B code implemented: original 3D podium, public next-round countdown, final server stats, reward deduplication, reconnect/session restore and spectator flow.
- Milestone C code implemented: persisted quality presets, actual frame sampling and documented CrazyGames SDK lifecycle/invite/mute integration. Real device and hosted platform gates remain open.
- Current automated evidence: `tests 95`, `pass 95`, `fail 0`; Worker build contains 74 assets, 3.34 MiB gzip. Exact delivery of 13 changed runtime/UI assets passes; changed/generated syntax passes. Complete raw client upper bound: 4,470,352 bytes (4.26 MiB), not a device benchmark or measured SDK initial download.
- Browser control enabled: fresh lobby framing at all three required sizes, shop round-trip, visible clothing equip, rifle-only preview, hold scope/release, exact centered reticle, private ready/start, session restore and spectator switching observed. Details and limits are in [QA_REPORT.md](QA_REPORT.md).
- Browser QA corrections: room setup grid/actions fit the compact embed; spectator camera stays in front of perimeter banners; watched name no longer fills the chase view; view rifle disappears at the same threshold as the ADS overlay.
- 6 November control pass: fixed B/C movement conflicts reproduced and rejected; valid J movement/persistence verified, then W restored. Pause and armory keyboard focus contained; controls use the full panel with all bindings and Reset visible at 821×462, without root overflow. Scope regression stayed centered at (640,360), fixed 50vmin, and closed on RMB release.
- 6 November death pass: reproduced late corpse cloning at the respawn location, then fixed using an authoritative victim-pose snapshot. Corpse stance/rifle remain independent after loadout and respawn; directional falls settle at the floor. Actual practice kill/settled-body/return screenshots captured. Removed the extra diagonal × over the reticle; all five reticle elements had identical rectangles/transforms before and after a confirmed kill, with rotation `none`.
- 6 November map/firing pass: new panel palette and tower passages, native walk across the Crosswind upper route, brief visible smoke and automatic chamber/recovery verified in an isolated range. Added quiet early reflections and sharper recoil; exact effect lifetime and audio routing verified automatically. Sound balance still needs subjective listening feedback.
- 6 November graphics correction: user screenshot identified tower/ledge flicker missed in the earlier pass. Removed exact coplanar caps and duplicate exposed faces; all-map geometry checks and actual blue-tower/stair views pass. Added local surface impact feedback; browser mark placement and pause→neutral lean observed. No Safari-specific or whole-device certification is claimed.
- 6 November menu/audio pass: tabbed settings and both armories fit compact game frames; computed title/button fonts match the landing page. Actual practice kill and final muzzle puff captured. Added the requested local elimination clip, clearer smoke and corrected flash orientation; effect/audio routing checks pass.
- Remaining gates: simultaneous native RMB+LMB device playtest (automated chord test passes), extended movement/corpse feel, real network loss, actual Chrome/Edge/Safari/Firefox hardware sessions, real 15-human/5v5 matches, hosted SDK and original Site access. Do not duplicate the inaccessible Site.

- 6 November combat/finale continuation: shared 1cm head/body graze allowance remains blocked by nearer cover; two-contact melee and one-grenade-per-life authority verified in tests. Added user-supplied dry pin/blast/stab/footsteps and five-second music handoff; actual browser decode measured a silent footstep lead-in and corrected its playback trim to 0.28–0.56s. Three real local clients completed private rounds; actual full-body gun-holding lineup, title separation and room-ready persistence observed. Alias RushSniper473 and Cobalt outfit restored, peers explicitly left. Compact override remained 1280×720, and subjective audio listening/competitive balance remain open.

- 6 November ranking HUD: individual charcoal ranking strips with warm placement/own-player accents replace the blue panel. Pause/settings move top-right, feed underneath. In-match settings persist sensitivity, scope sensitivity, volume, reticle thickness and reduced motion through the existing settings store; pointer/fire/prime resets and menu focus are preserved. Two real local players verified live rank reorder after a death; full Tab standings share the same visual palette.

## 6 November — game menus, currency and equipment overhaul

- Coins counter opens Coins: 200 free coins once per UTC day, gem packs of 1,000/10, 6,000/50 and 14,000/100. Insufficient balances cannot exchange. Gems counter is display-only and skipped by keyboard navigation.
- Daily free wheel awards one of eight equal-chance coin sectors: 50, 100, 75, 200, 150, 300, 100, 500. Golden wheel awards 5, 10, 15, 20, 30, 50, 10, 25 gems once per rolling seven days. Award/cooldown/pending result persist before animation; Collect acknowledges without granting twice. No paid spins or gem-purchase flow. This remains local guest state, not production tamper-proof account currency.
- Daily Challenges is directly below Inventory. Single Rush face applies to all visible UI, including nested lobby labels and in-match elements; redundant forced Bay preload removed. Warm profile/navigation chrome, unified close controls, image-led equipment choices, clearer titles and fewer paragraphs replace previous application-style panels. Private mode/map/time/capacity selection uses buttons/steppers; no native select remains. Play Online enters retained matchmaking practice immediately when alone.
- Six costume geometries: Rush runner varsity jacket, Pit crew racing harness/stripes, Bush scout leaf layers/hood, Polar ranger parka/fur/leg pads, Desert ranger sash/cape/pouches and Night operative plate carrier/armour. Headgear: goggles, combat helmet, recon visor, comms headset, field cap, respirator. Shoes: sneakers, treaded combat boots, strapped snow boots and high-tops. Head/shoe previews focus their category; thumbnails are generated from the actual meshes. Hood/helmet overlap and original gear restoration checked in local browser.
- Rifle IDs remain stable for saves/mastery/networking. Display names are M24, AWM, Barrett M82A1, Dragunov SVD, Sako TRG 42, Steyr Scout, Desert Tech SRS and CheyTac M200. Original stylized models retain equal combat rules; M200 now has its tubular handguard/carry handle/forward bipod/monopod details. Name references in WEAPON_REFERENCES.md.
- Actual local browser evidence and limits are in QA_REPORT.md. No deployment, real Safari/Firefox/Windows verification, new compact viewport sign-off, 15-player scale or server-backed reward authority is claimed.

## 6 November — core physics continuation

Shared movement substeps at 120Hz and vector-capped horizontal acceleration prevent diagonal speed-up while preserving stair stepping, buffered/coyote jump, crouch clearance and client/server prediction. Grenades use swept sphere-axis contact and a retained fixed-step remainder: test paths match across frame rates, thin ledges/ceilings stop the projectile, resting visual tumble stops. Knife animation blends windup into strike without the previous pose discontinuity; damage/contact rules unchanged. Landing compression and walk bob are cosmetic, bounded and reduced-motion aware. Remote turn/crouch interpolation uses shortest angles and snaps teleports. Blast visuals include a short ground dust ring and world-floor fragment settling with bounded resources. Current tests: 101 pass, 0 fail; build 74 assets / 3.34 MiB gzip, raw client 4.27 MiB. Actual Crosswind stairs, knife holding, grenade elimination and center reticle checked locally; fresh multi-client/physical-device/WAN/performance playtests remain open.


## 6 November — small combat interaction continuation

Same-slot equipment selection preserves ongoing ADS/prime; deliberate manual switches supersede grenade auto-return. Switching does not reset knife recovery or rifle chamber. Abandoned mouse gestures cancel rather than throwing, and pause/death/respawn clear pending contacts and held inputs. Inspect is rifle-only and blocked during chamber/ADS; interrupts cancel inspect and pin audio. Knife recovery uses the existing unboxed bar; hints reflect the actual equipment and briefly reappear when switching.

Held grenades show a small depth-tested dotted path from the shared launch/contact/fuse solver, refreshed at most every80ms. It predicts local geometry, never damage. Nearby/stacked points are suppressed and all guide resources are reused/released. Compact HUD separates clock, leaderboard and kill feed below600px. Evidence:113 automated tests,8 actual-client synthetic-input checks and native1280×720/425×664 observations; physical-key respawn/WAN/other-browser checks remain unverified.


## 6 November — character surface integrity

Physical clearance separates competing costume, accessory and footwear faces in lobby/profile/inventory/results and practice/remote actor pipelines. Red/Tactical boot collars wrap both trouser stances with attached exterior labels/laces; wide footwear has enough stance separation to avoid shoe intersection. No global depth-disable or camera workaround. A real-triangle/ray regression checks144 gear combinations per actor pipeline (288 total), plus cuff-wrap and shoe-clearance invariants.116 automated tests pass. Close-up browser render observed; moving-pose and cross-browser/driver artifact coverage remains incomplete.


## 6 November — cover movement and respawn continuation

Crouch/slide/jump eye height and rendered stair easing obey ceiling clearance. Lean tests use current capsule height; rifle, knife and grenade origins share physical lean placement. Melee converges from the legal eye onto the visible center aim while retaining2.4m reach. Practice initializes to authored spawn yaw. Respawn scoring predicts live grenade fuse endpoints and penalizes unblocked post-protection damage, with team/cover/round-end exceptions; existing shields and damage rules stay unchanged.123 automated tests pass, including actual Foundry low-roof recovery across30/60/144Hz. Underpass/jump/grenade fixture visually checked; final exit visual check interrupted when browser control was disabled.


## 6 November — core feel and multiplayer boundary continuation

Knife visual thrust peaks at its shared180ms contact while580ms cadence remains fixed. Remote lean/aim and knife/grenade arm/item actions ease and restore their authored poses; action events retain life/time to avoid replaying on a respawned actor. Accepted shot events retain origin/aim, preserving fast flick sound/particle placement. Practice menu/loadout freezes its action/effect clock and audio/finale contexts together; online menu clocks keep running.

Spawns stamp life generation and start time. Current clients tag combat/input commands, so stale queued packets cannot act in a new life. Rewound hits always reject targets not yet born at the shot timestamp, and historical yaw crosses±pi along the short arc. Combat commands piggyback pending validated movement/ADS frames atomically before deriving legal eye/hand origin, preserving time-credit/collision/sequence checks.134 tests pass, plus3 independent live localhost API clients. Fresh native visual/audio/animation sign-off is pending browser control; no production-ready claim.
