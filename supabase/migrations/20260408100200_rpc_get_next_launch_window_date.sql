-- RPC: get_next_launch_window_date — prossima finestra di lancio attiva e futura
-- Usata dal countdown timer sulla landing page /pro-presto

CREATE OR REPLACE FUNCTION public.get_next_launch_window_date()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT starts_at
  FROM launch_windows
  WHERE is_active = true
    AND starts_at > now()
  ORDER BY starts_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_launch_window_date() TO anon, authenticated;
