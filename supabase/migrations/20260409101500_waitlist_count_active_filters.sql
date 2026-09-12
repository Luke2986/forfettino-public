-- Align waitlist social-proof count with active-only semantics:
-- - exclude revoked leads
-- - exclude unconfirmed leads

ALTER TABLE public.waitlist_leads
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Backfill legacy rows as confirmed at creation time.
UPDATE public.waitlist_leads
SET confirmed_at = COALESCE(confirmed_at, created_at)
WHERE confirmed_at IS NULL;

ALTER TABLE public.waitlist_leads
  ALTER COLUMN confirmed_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waitlist_leads_active
  ON public.waitlist_leads (revoked_at, confirmed_at);

CREATE OR REPLACE FUNCTION public.get_waitlist_active_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    SELECT count(*)::int
    FROM public.pro_waitlist pw
    WHERE pw.revoked_at IS NULL
  ) + (
    SELECT count(*)::int
    FROM public.waitlist_leads wl
    WHERE wl.revoked_at IS NULL
      AND wl.confirmed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.pro_waitlist pw
        WHERE lower(pw.email) = lower(wl.email)
          AND pw.revoked_at IS NULL
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_active_count() TO anon, authenticated;
