-- Story 26-4: Admin-configurable action points
-- Single source of truth for point values — RPCs read from this table, not hardcoded.

----------------------------------------------------------------------
-- Table: contribution_action_config
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contribution_action_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type    TEXT NOT NULL UNIQUE,
  points         INTEGER NOT NULL CHECK (points > 0),
  label          TEXT NOT NULL,
  frequency_label TEXT NOT NULL DEFAULT '',
  color_bg       TEXT NOT NULL DEFAULT 'bg-slate-500',
  color_text     TEXT NOT NULL DEFAULT 'text-slate-700',
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contribution_action_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read (public info for "Come funziona?" section)
CREATE POLICY "Anyone can read action config"
  ON public.contribution_action_config FOR SELECT
  USING (true);

-- Admin can update
CREATE POLICY "Admin can update action config"
  ON public.contribution_action_config FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can insert (for future actions)
CREATE POLICY "Admin can insert action config"
  ON public.contribution_action_config FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

----------------------------------------------------------------------
-- Seed: 4 actions
----------------------------------------------------------------------
INSERT INTO public.contribution_action_config
  (action_type, points, label, frequency_label, color_bg, color_text, display_order)
VALUES
  ('call_completed',     50, 'Call mensile',     'max 1 ogni 30 giorni',       'bg-rose-500',    'text-rose-700',    1),
  ('feedback_submitted', 15, 'Feedback inviato', 'max 1 ogni 7 giorni',        'bg-amber-500',   'text-amber-700',   2),
  ('referral_signup',    30, 'Invita un amico',  'ogni amico, max 10/mese',    'bg-violet-500',  'text-violet-700',  3),
  ('first_import_xml',   15, 'Primo import XML', 'una tantum',                 'bg-blue-500',    'text-blue-700',    4)
ON CONFLICT (action_type) DO NOTHING;

----------------------------------------------------------------------
-- RPC: get_action_config — public read
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_action_config()
RETURNS TABLE (
  action_type    TEXT,
  points         INTEGER,
  label          TEXT,
  frequency_label TEXT,
  color_bg       TEXT,
  color_text     TEXT,
  display_order  INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT action_type, points, label, frequency_label, color_bg, color_text, display_order
  FROM public.contribution_action_config
  WHERE is_active = true
  ORDER BY display_order ASC;
$$;

-- SECURITY INVOKER: RLS "Anyone can read" already allows SELECT for all.
GRANT EXECUTE ON FUNCTION public.get_action_config() TO authenticated;

----------------------------------------------------------------------
-- RPC: admin_update_action_config — admin only
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_action_config(
  p_action_type    TEXT,
  p_points         INTEGER,
  p_label          TEXT,
  p_frequency_label TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points must be > 0';
  END IF;

  IF TRIM(p_label) = '' THEN
    RAISE EXCEPTION 'Label must not be empty';
  END IF;

  UPDATE public.contribution_action_config
  SET points = p_points,
      label = p_label,
      frequency_label = p_frequency_label,
      updated_at = now()
  WHERE action_type = p_action_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action type not found: %', p_action_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_action_config(TEXT, INTEGER, TEXT, TEXT) TO authenticated;
