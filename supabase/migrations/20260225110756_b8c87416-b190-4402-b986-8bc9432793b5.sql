
-- 1. Tabella user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  count         INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT user_sessions_user_date_unique UNIQUE (user_id, session_date)
);

-- 2. Indice ottimizzato per query admin
CREATE INDEX IF NOT EXISTS idx_user_sessions_date_user
  ON public.user_sessions (session_date, user_id);

-- 3. RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read user_sessions"
  ON public.user_sessions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. RPC per UPSERT atomico
CREATE OR REPLACE FUNCTION public.increment_user_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_sessions (user_id, session_date, count)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET count = user_sessions.count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_session() TO authenticated;
