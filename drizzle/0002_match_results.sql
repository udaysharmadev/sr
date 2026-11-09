CREATE TABLE IF NOT EXISTS rush_match_results (
  profile_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  finished_at INTEGER NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (profile_id, round_id)
);
CREATE INDEX IF NOT EXISTS rush_results_profile_time ON rush_match_results(profile_id, finished_at);
-- These triggers share the room write transaction, including its CAS predicate.
CREATE TRIGGER IF NOT EXISTS rush_archive_results_insert AFTER INSERT ON rush_rooms BEGIN
  INSERT OR IGNORE INTO rush_match_results(profile_id,round_id,finished_at,result)
  SELECT json_extract(value,'$.profileId'),json_extract(value,'$.result.roundId'),
    json_extract(value,'$.result.finishedAt'),json_extract(value,'$.result')
  FROM json_each(NEW.state,'$.completedRewards');
END;
CREATE TRIGGER IF NOT EXISTS rush_archive_results_update AFTER UPDATE ON rush_rooms BEGIN
  INSERT OR IGNORE INTO rush_match_results(profile_id,round_id,finished_at,result)
  SELECT json_extract(value,'$.profileId'),json_extract(value,'$.result.roundId'),
    json_extract(value,'$.result.finishedAt'),json_extract(value,'$.result')
  FROM json_each(NEW.state,'$.completedRewards');
END;
