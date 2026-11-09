## Plan — numeric player IDs and persistent friends

| File | Change | Risk / verification |
| --- | --- | --- |
| drizzle/0004_social.sql | Add stable numeric identity, presence and normalized friend relation tables | Additive; uniqueness and immutable profile binding |
| backend/social.mjs | Authenticated bounded lookup/list/request/accept/decline/cancel/remove and presence | SQL predicates enforce participant permissions; current guest cookie required; no secrets returned |
| backend/local-profile-store.mjs, server.mjs, build-worker.mjs | Same API/storage in SQLite and Worker D1 | Existing profile routes preserved; generated Worker syntax/build |
| backend/social.test.mjs | Real SQLite identity/recovery continuity, social permissions, state transitions, duplicates, privacy and presence | Deterministic clocks and isolated temporary saves |

Decision: use one normalized relation row per numeric pair rather than copying friend arrays between profiles. Every acceptance/removal is one conditional SQL write, so recovery and profile CAS cannot overwrite friendships. Presence means recent authenticated social heartbeat, not invented room state. Existing guest authentication reused. No profile/economy/catalog/menu changes. Failure: reject malformed IDs/actions; conflicting pending relation never auto-accepts; transient server errors return503 without exposing SQL/errors.
