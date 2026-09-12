-- Add IP tracking to referrals table for anti-abuse protection
-- Edge Function process-referral captures client IP and stores it here
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Partial index for IP-based anti-abuse lookups (only non-null IPs)
CREATE INDEX IF NOT EXISTS idx_referrals_ip
  ON public.referrals (ip_address)
  WHERE ip_address IS NOT NULL;
