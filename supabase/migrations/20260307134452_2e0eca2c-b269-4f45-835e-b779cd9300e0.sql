
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partita_iva VARCHAR(11) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_partita_iva_format_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_partita_iva_format_check
      CHECK (partita_iva ~ '^[0-9]{11}$' OR partita_iva IS NULL);
  END IF;
END$$;
