-- Migration: Normalize old engine_type values to new 2-engine system
-- Run this ONCE before removing old engine code.

-- 1. Pending assignments: normalize XP-based types → 'levelup'
UPDATE test_assignments SET engine_type = 'levelup'
WHERE engine_type IN ('xp_word', 'xp_stage', 'xp_listen') AND status = 'pending';

-- 2. Pending assignments: normalize legacy-based types → 'legacy'
UPDATE test_assignments SET engine_type = 'legacy'
WHERE engine_type IN ('legacy_stage', 'legacy_listen', 'legacy_word') AND status = 'pending';

-- 3. NULL engine_type on pending assignments: infer from test_config
UPDATE test_assignments ta
SET engine_type = CASE
    WHEN tc.test_type = 'placement' THEN 'levelup'
    ELSE 'legacy'
END
FROM test_configs tc
WHERE ta.test_config_id = tc.id AND ta.engine_type IS NULL AND ta.status = 'pending';

-- Verify
SELECT engine_type, status, COUNT(*) FROM test_assignments GROUP BY engine_type, status ORDER BY engine_type, status;
