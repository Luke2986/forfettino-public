
-- Step 1: Recreate trigger function
CREATE OR REPLACE FUNCTION public.set_user_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_code IS NULL OR NEW.user_code !~ '^[A-Z0-9]{9}$' THEN
    NEW.user_code := public.generate_user_code(NEW.first_name, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS trg_set_user_code ON public.profiles;
CREATE TRIGGER trg_set_user_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_user_code_on_insert();

-- Step 3: Backfill malformed codes
UPDATE public.profiles
SET user_code = public.generate_user_code(first_name, created_at)
WHERE user_code !~ '^[A-Z0-9]{9}$';
