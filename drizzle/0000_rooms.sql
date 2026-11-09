CREATE TABLE rush_rooms (code TEXT PRIMARY KEY NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL, touched INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX rush_rooms_touched ON rush_rooms (touched);
