-- Epic 73, Story 73-1: Modello Dati Launch Window e Hook
-- Tabella launch_windows, RLS, RPC reincrement_launch_cap

----------------------------------------------------------------------
-- 1. CREATE TABLE launch_windows
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.launch_windows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  lifetime_ends_at TIMESTAMPTZ NOT NULL,
  cap_total        INTEGER NOT NULL CHECK (cap_total > 0),
  cap_remaining    INTEGER NOT NULL CHECK (cap_remaining >= 0),
  prices           JSONB NOT NULL DEFAULT '{"six_month": 4900, "annual": 6900, "lifetime": 16900}'::jsonb,
  is_active        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT launch_windows_dates_order CHECK (starts_at < ends_at),
  CONSTRAINT launch_windows_lifetime_before_end CHECK (lifetime_ends_at <= ends_at),
  CONSTRAINT launch_windows_cap_remaining_lte_total CHECK (cap_remaining <= cap_total)
);

----------------------------------------------------------------------
-- 2. RLS
----------------------------------------------------------------------
ALTER TABLE public.launch_windows ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active launch windows
CREATE POLICY "Authenticated can read active launch_windows"
  ON public.launch_windows
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Admin can manage launch windows (CRUD)
CREATE POLICY "Admin can manage launch_windows"
  ON public.launch_windows
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

----------------------------------------------------------------------
-- 3. Index on is_active (partial)
----------------------------------------------------------------------
CREATE INDEX idx_launch_windows_is_active
  ON public.launch_windows (is_active) WHERE is_active = true;

----------------------------------------------------------------------
-- 4. RPC: reincrement_launch_cap — simmetrica a decrement_launch_cap
--    Usata dal refund flow (story 73-9) per restituire un posto
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reincrement_launch_cap(p_window_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap_remaining INTEGER;
  v_cap_total INTEGER;
BEGIN
  -- Lock timeout to prevent indefinite hangs (same as decrement)
  SET LOCAL lock_timeout = '5s';

  -- Advisory lock per-window — same key as decrement_launch_cap for serialization
  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_window_id::text));
  EXCEPTION
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'lock_timeout';
  END;

  -- Fetch current caps
  SELECT cap_remaining, cap_total
  INTO v_cap_remaining, v_cap_total
  FROM public.launch_windows
  WHERE id = p_window_id
  FOR UPDATE;

  -- Window not found
  IF v_cap_remaining IS NULL THEN
    RAISE EXCEPTION 'launch_window_not_found';
  END IF;

  -- Cannot exceed cap_total
  IF v_cap_remaining >= v_cap_total THEN
    RAISE EXCEPTION 'cap_already_full';
  END IF;

  -- Increment
  UPDATE public.launch_windows
  SET cap_remaining = cap_remaining + 1
  WHERE id = p_window_id;

  -- Audit trail (symmetric to launch_cap_decremented)
  INSERT INTO public.event_logs (user_id, event_name, props)
  VALUES (
    auth.uid(),
    'launch_cap_reincremented',
    jsonb_build_object(
      'window_id', p_window_id,
      'remaining_after', v_cap_remaining + 1
    )
  );

  RETURN true;
END;
$$;

-- Security: only service_role can execute (symmetric to decrement_launch_cap)
REVOKE ALL ON FUNCTION public.reincrement_launch_cap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reincrement_launch_cap(UUID) TO service_role;
