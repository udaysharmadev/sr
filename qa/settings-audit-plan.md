## Plan — effective settings and match presentation

| File | Change | Risk |
| --- | --- | --- |
| dist/presentation.js | Tested mouse aim, point-duel clock, owned rifle selection, bounded per-rifle presentation recoil helpers | Preserve exact centered aim and fixed chamber |
| dist/game.js | Use helpers; expose live invert/shake; load recreated audio; owned loadout and point goal display | Avoid stale UI/audio and default weapon persistence |
| backend/settings-effects.test.mjs | Verify numeric settings effects, clock modes, owned choices and recoil bounds | Browser rendering still separate |

Decision: existing menu controls already feed runtime; fix concrete live-volume load bug and missing live controls, rather than replace the settings system. Keep hit registration perfect centered, give rifle upgrades a smaller/faster visual recoil recovery only. No dependency/schema changes.
