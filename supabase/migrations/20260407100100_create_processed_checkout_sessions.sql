-- Migration: create processed_checkout_sessions table
-- Story: 72-1 Backend Cap Enforcement Atomico
-- Purpose: Idempotency tracking for launch cap decrements

CREATE TABLE public.processed_checkout_sessions (
  checkout_session_id text PRIMARY KEY,
  window_id uuid NOT NULL REFERENCES public.launch_windows(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for window lookups
CREATE INDEX idx_pcs_window_id ON public.processed_checkout_sessions (window_id);

-- Enable RLS — only service_role can access
ALTER TABLE public.processed_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role (which bypasses RLS) can read/write

-- TODO(GDPR): Verificare che questa tabella sia coperta dalla data retention policy
-- (20260327100000_data_retention_policy_cleanup.sql). Contiene user_id → soggetta a GDPR.
-- ON DELETE CASCADE su user_id garantisce pulizia alla cancellazione account.
