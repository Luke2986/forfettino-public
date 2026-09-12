-- Flag admin account LC26VLW38 as internal so it's excluded from stats
UPDATE profiles SET is_internal = true WHERE user_code = 'LC26VLW38';
