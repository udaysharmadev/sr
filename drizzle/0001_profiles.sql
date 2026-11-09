CREATE TABLE IF NOT EXISTS rush_profiles (
  session_hash TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL,
  state TEXT NOT NULL
);
