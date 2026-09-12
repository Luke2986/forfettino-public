-- ============================================
-- Migration: Codice Utente 9 char (anno 2 digit)
-- Cambiamento: anno da 1 digit (6=2026) a 2 digit (26=2026)
-- Formato: 1 iniziale + 1 mese + 2 anno + 5 random = 9 char
-- Esempio: LB26K3M9X (L=Luca, B=Feb, 26=2026, K3M9X=random)
-- ============================================

-- Step A: Replace generation function with 2-digit year
CREATE OR REPLACE FUNCTION public.generate_user_code(
  p_first_name TEXT,
  p_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  month_letters TEXT := 'ABCDEFGHIJKL';
  initial CHAR(1);
  month_char CHAR(1);
  year_part TEXT;
  random_part TEXT;
  result TEXT;
  i INT;
  attempt INT := 0;
  max_attempts INT := 10;
BEGIN
  -- 1. Initial letter from first_name (fallback 'X')
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    initial := 'X';
  ELSE
    initial := UPPER(LEFT(TRIM(p_first_name), 1));
    IF initial !~ '^[A-Z]$' THEN
      initial := 'X';
    END IF;
  END IF;

  -- 2. Month encoding: A=Jan, B=Feb, ..., L=Dec
  month_char := SUBSTRING(month_letters FROM EXTRACT(MONTH FROM p_created_at)::INT FOR 1);

  -- 3. Year encoding: last 2 digits (2026 -> 26)
  year_part := RIGHT(EXTRACT(YEAR FROM p_created_at)::TEXT, 2);

  LOOP
    -- 4. Generate 5 random alphanumeric chars
    random_part := '';
    FOR i IN 1..5 LOOP
      random_part := random_part || SUBSTRING(chars FROM (floor(random() * 36)::INT + 1) FOR 1);
    END LOOP;

    result := initial || month_char || year_part || random_part;

    -- 5. Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = result) THEN
      RETURN result;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique user_code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step B: Backfill all existing codes with new 9-char format
UPDATE public.profiles
SET user_code = public.generate_user_code(first_name, created_at);

-- Note: trigger trg_set_user_code and UNIQUE constraint remain unchanged.
-- New inserts will automatically get 9-char codes via the updated function.
