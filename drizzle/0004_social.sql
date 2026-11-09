CREATE TABLE IF NOT EXISTS rush_social_players (
  player_id INTEGER PRIMARY KEY NOT NULL,
  profile_id TEXT NOT NULL UNIQUE,
  last_seen INTEGER NOT NULL,
  next_request_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rush_friendships (
  low_id INTEGER NOT NULL,
  high_id INTEGER NOT NULL,
  requester INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (low_id,high_id),
  CHECK(low_id < high_id),
  CHECK(requester IN (low_id,high_id))
);
CREATE INDEX IF NOT EXISTS rush_social_profile ON rush_social_players(profile_id);
CREATE INDEX IF NOT EXISTS rush_profile_public_id ON rush_profiles(json_extract(state,'$.id'));
CREATE INDEX IF NOT EXISTS rush_friendships_high ON rush_friendships(high_id);
