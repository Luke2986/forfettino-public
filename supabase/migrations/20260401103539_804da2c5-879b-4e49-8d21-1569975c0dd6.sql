
-- 1) Add otp_threshold_days column if not exists (with CHECK constraint)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS otp_threshold_days INTEGER NOT NULL DEFAULT 14;

-- Add CHECK constraint (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_otp_threshold_range'
  ) THEN
    ALTER TABLE public.app_settings
      ADD CONSTRAINT app_settings_otp_threshold_range CHECK (otp_threshold_days >= 1 AND otp_threshold_days <= 90);
  END IF;
END $$;

-- 2) Replace get_otp_stats with corrected has_role(auth.uid(), 'admin') signature
CREATE OR REPLACE FUNCTION public.get_otp_stats(p_threshold_days INTEGER DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold INTEGER;
  v_result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_threshold_days IS NULL THEN
    SELECT otp_threshold_days INTO v_threshold FROM public.app_settings WHERE id = 1;
  ELSE
    v_threshold := p_threshold_days;
  END IF;
  v_threshold := COALESCE(v_threshold, 14);

  SELECT json_build_object(
    'total_users', COUNT(*),
    'users_with_otp', COUNT(last_otp_verified_at),
    'users_needing_otp', COUNT(*) FILTER (
      WHERE last_otp_verified_at IS NULL
      OR last_otp_verified_at < NOW() - (v_threshold || ' days')::INTERVAL
    ),
    'verified_last_30d', COUNT(*) FILTER (
      WHERE last_otp_verified_at >= NOW() - INTERVAL '30 days'
    ),
    'last_otp_verified', MAX(last_otp_verified_at)
  ) INTO v_result
  FROM public.profiles
  WHERE is_internal = false;

  RETURN v_result;
END;
$$;
