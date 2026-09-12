-- Story 67.1: Infrastruttura OTP Smart — campo per tracciare ultima verifica OTP
-- Se last_otp_verified_at e' NULL o > 14 giorni fa, il gate OTP client-side scatta.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_otp_verified_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.last_otp_verified_at IS
'Timestamp dell''ultima verifica OTP smart riuscita. NULL = mai verificato.';
