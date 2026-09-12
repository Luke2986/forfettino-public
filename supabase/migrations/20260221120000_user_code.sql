-- ============================================
-- Migration: Codice Utente Univoco (user_code)
-- Formato: 1 iniziale + 2 timestamp (mese+anno) + 5 random = 8 char alfanumerici
-- Esempio: LB6K3M9X (L=Luca, B=Feb, 6=2026, K3M9X=random)
-- ============================================

-- Step A: Add nullable column
ALTER TABLE public.profiles
  ADD COLUMN user_code TEXT;

-- Step B: Create generation function
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
  year_char CHAR(1);
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

  -- 3. Year encoding: last digit (2026 -> 6)
  year_char := RIGHT(EXTRACT(YEAR FROM p_created_at)::TEXT, 1);

  LOOP
    -- 4. Generate 5 random alphanumeric chars
    random_part := '';
    FOR i IN 1..5 LOOP
      random_part := random_part || SUBSTRING(chars FROM (floor(random() * 36)::INT + 1) FOR 1);
    END LOOP;

    result := initial || month_char || year_char || random_part;

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

-- Step C: Backfill existing users
UPDATE public.profiles
SET user_code = public.generate_user_code(first_name, created_at)
WHERE user_code IS NULL;

-- Step D: Add constraints
ALTER TABLE public.profiles
  ALTER COLUMN user_code SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_code_unique UNIQUE (user_code);

-- Step E: Create trigger for new profiles
CREATE OR REPLACE FUNCTION public.set_user_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := public.generate_user_code(NEW.first_name, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_set_user_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_user_code_on_insert();

-- Note: UNIQUE constraint (Step D) already creates an implicit index on user_code.
-- No additional CREATE INDEX needed.
