CREATE INDEX IF NOT EXISTS rush_profile_recovery ON rush_profiles(json_extract(state,'$.recoveryHash'));
