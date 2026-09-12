-- ============================================================
-- Activation & Adoption v1 – Migration
-- ============================================================

-- 1) event_logs: analytics event tracking
CREATE TABLE IF NOT EXISTS public.event_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name  TEXT NOT NULL,
  props       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own events
CREATE POLICY "Users can insert own events"
  ON public.event_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admins / service role can read events
CREATE POLICY "Service role can read events"
  ON public.event_logs FOR SELECT
  TO service_role
  USING (true);

-- No update or delete
CREATE POLICY "No update on event_logs"
  ON public.event_logs FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No delete on event_logs"
  ON public.event_logs FOR DELETE
  TO authenticated
  USING (false);

-- Index for querying by user
CREATE INDEX idx_event_logs_user_id ON public.event_logs(user_id);
CREATE INDEX idx_event_logs_event_name ON public.event_logs(event_name);


-- 2) survey_responses: micro survey storage
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_key      TEXT NOT NULL,
  selected_reason TEXT NOT NULL,
  free_text       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Users can insert their own survey responses
CREATE POLICY "Users can insert own survey responses"
  ON public.survey_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own survey responses (needed for cooldown check)
CREATE POLICY "Users can read own survey responses"
  ON public.survey_responses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No update or delete (immutable)
CREATE POLICY "No update on survey_responses"
  ON public.survey_responses FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No delete on survey_responses"
  ON public.survey_responses FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX idx_survey_responses_user_key ON public.survey_responses(user_id, survey_key);


-- 3) Add prudenza_preset to fiscal_year_settings
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS prudenza_preset TEXT DEFAULT 'bilanciato';


-- 4) RPC: get_income_stats
-- Returns count_total, count_year, last_income_at, first_income_at, total_year_amount
CREATE OR REPLACE FUNCTION public.get_income_stats(p_year INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count_total BIGINT;
  v_count_year BIGINT;
  v_last_income_at TIMESTAMPTZ;
  v_first_income_at TIMESTAMPTZ;
  v_total_year_amount NUMERIC(12,2);
BEGIN
  -- Total count across all years
  SELECT COUNT(*), MIN(created_at), MAX(created_at)
  INTO v_count_total, v_first_income_at, v_last_income_at
  FROM public.receipts
  WHERE user_id = v_user_id;

  -- Count and sum for the specific year
  SELECT COUNT(*), COALESCE(SUM(gross_amount), 0)
  INTO v_count_year, v_total_year_amount
  FROM public.receipts
  WHERE user_id = v_user_id
    AND fiscal_year = p_year;

  RETURN json_build_object(
    'count_total', COALESCE(v_count_total, 0),
    'count_year', COALESCE(v_count_year, 0),
    'last_income_at', v_last_income_at,
    'first_income_at', v_first_income_at,
    'total_year_amount', COALESCE(v_total_year_amount, 0)
  );
END;
$$;
