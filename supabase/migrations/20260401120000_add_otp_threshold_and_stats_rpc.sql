-- Migration: Story 67-3 — OTP threshold configurabile + RPC stats admin
-- ROLLBACK: ALTER TABLE app_settings DROP COLUMN otp_threshold_days; DROP FUNCTION IF EXISTS get_otp_stats;

-- 1. Aggiungere colonna soglia OTP alla tabella singleton app_settings
ALTER TABLE public.app_settings
ADD COLUMN otp_threshold_days INTEGER NOT NULL DEFAULT 14
CHECK (otp_threshold_days BETWEEN 1 AND 90);

-- 2. RPC get_otp_stats — statistiche OTP per admin dashboard
CREATE OR REPLACE FUNCTION public.get_otp_stats(p_threshold_days INTEGER DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_threshold INTEGER;
  v_result JSON;
BEGIN
  -- Check admin
  IF NOT public.has_role('admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Leggi soglia da app_settings se non fornita
  IF p_threshold_days IS NULL THEN
    SELECT otp_threshold_days INTO v_threshold FROM public.app_settings WHERE id = 1;
  ELSE
    v_threshold := p_threshold_days;
  END IF;
  -- Safety net: fallback a 14 se la riga app_settings non esiste
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
