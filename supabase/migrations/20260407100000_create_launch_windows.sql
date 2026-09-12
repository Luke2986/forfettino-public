-- Migration: create launch_windows table
-- Story: 72-1 Backend Cap Enforcement Atomico
-- Purpose: Stores PRO launch windows with atomic cap enforcement

CREATE TABLE public.launch_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  lifetime_ends_at timestamptz,
  cap_total int NOT NULL,
  cap_remaining int NOT NULL,
  prices jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cap_remaining_non_negative CHECK (cap_remaining >= 0),
  CONSTRAINT cap_remaining_lte_total CHECK (cap_remaining <= cap_total)
);

-- Index for active window lookups
CREATE INDEX idx_launch_windows_active ON public.launch_windows (is_active, starts_at, ends_at)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.launch_windows ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active windows
CREATE POLICY "Authenticated users can read active launch windows"
  ON public.launch_windows
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admin full access (INSERT/UPDATE/DELETE) via has_role
CREATE POLICY "Admin full access to launch windows"
  ON public.launch_windows
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- service_role bypasses RLS by default, no explicit policy needed
