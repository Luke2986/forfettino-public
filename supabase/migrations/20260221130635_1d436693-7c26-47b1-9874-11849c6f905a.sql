
-- 1. Aggiunge colonna
ALTER TABLE public.profiles ADD COLUMN user_code TEXT;

-- 2. Funzione generatore
CREATE OR REPLACE FUNCTION public.generate_user_code(p_first_name TEXT, p_created_at TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_letters TEXT[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L'];
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  initial CHAR(1);
  month_letter CHAR(1);
  year_digit CHAR(1);
  random_part TEXT;
  result TEXT;
  i INT;
  attempt INT := 0;
BEGIN
  IF p_first_name IS NOT NULL AND length(trim(p_first_name)) > 0 THEN
    initial := upper(left(trim(p_first_name), 1));
  ELSE
    initial := 'X';
  END IF;

  month_letter := month_letters[EXTRACT(MONTH FROM p_created_at)::INT];
  year_digit := right(EXTRACT(YEAR FROM p_created_at)::TEXT, 1);

  LOOP
    attempt := attempt + 1;
    IF attempt > 10 THEN
      RAISE EXCEPTION 'Unable to generate unique user_code after 10 attempts';
    END IF;

    random_part := '';
    FOR i IN 1..5 LOOP
      random_part := random_part || substr(chars, floor(random() * 36 + 1)::INT, 1);
    END LOOP;

    result := initial || month_letter || year_digit || random_part;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = result) THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.set_user_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_code IS NULL THEN
    NEW.user_code := generate_user_code(NEW.first_name, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger
CREATE TRIGGER trg_set_user_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_code_on_insert();

-- 5. Backfill
UPDATE public.profiles
SET user_code = generate_user_code(first_name, created_at)
WHERE user_code IS NULL;

-- 6. NOT NULL + UNIQUE
ALTER TABLE public.profiles
  ALTER COLUMN user_code SET NOT NULL,
  ADD CONSTRAINT profiles_user_code_unique UNIQUE (user_code);
