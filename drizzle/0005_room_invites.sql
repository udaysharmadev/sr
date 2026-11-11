CREATE TABLE IF NOT EXISTS rush_room_invites (
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  room_code TEXT NOT NULL,
  room_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (sender_id, recipient_id),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS rush_room_invites_recipient ON rush_room_invites(recipient_id, expires_at);
