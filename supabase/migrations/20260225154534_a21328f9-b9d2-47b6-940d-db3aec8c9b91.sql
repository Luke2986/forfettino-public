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
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    initial := 'X';
  ELSE
    initial := UPPER(LEFT(TRIM(p_first_name), 1));
    IF initial !~ '^[A-Z]$' THEN
      initial := 'X';
    END IF;
  END IF;

  month_char := SUBSTRING(month_letters FROM EXTRACT(MONTH FROM p_created_at)::INT FOR 1);
  year_part := RIGHT(EXTRACT(YEAR FROM p_created_at)::TEXT, 2);

  LOOP
    random_part := '';
    FOR i IN 1..5 LOOP
      random_part := random_part || SUBSTRING(chars FROM (floor(random() * 36)::INT + 1) FOR 1);
    END LOOP;

    result := initial || month_char || year_part || random_part;

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

-- Backfill: rigenera tutti i codici esistenti con il nuovo formato a 9 caratteri
UPDATE public.profiles SET user_code = public.generate_user_code(first_name, created_at);