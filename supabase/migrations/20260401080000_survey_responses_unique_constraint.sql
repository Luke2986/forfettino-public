-- ============================================================
-- Add UNIQUE constraint on survey_responses for one-time surveys
-- ============================================================
-- Prevents duplicate responses for surveys without a campaign_id
-- (e.g. pricing_van_westendorp_v1). NPS surveys use campaign_id
-- and are excluded — the same user can respond to different campaigns.
--
-- Uses a partial unique index (WHERE campaign_id IS NULL) so that
-- campaign-based surveys are unaffected.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_unique_one_time
  ON public.survey_responses (user_id, survey_key)
  WHERE campaign_id IS NULL;
