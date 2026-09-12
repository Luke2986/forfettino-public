-- Account Deletions Log
-- Tracks when users delete their account so admin can see churn.
-- No FK to auth.users (the user is deleted before this would be queried).
-- Populated by the delete-account Edge Function before CASCADE.

CREATE TABLE IF NOT EXISTS public.account_deletions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_code   TEXT,                          -- snapshot del codice utente
  user_email  TEXT,                          -- snapshot email (per debug)
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service role should write; admin reads via admin-stats (service role).
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no access via anon/authenticated.
-- Service role bypasses RLS automatically.

COMMENT ON TABLE public.account_deletions IS 'Log of account deletions for admin churn tracking';
