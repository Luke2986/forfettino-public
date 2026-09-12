-- Story 25.5: Feedback Loop Post-Scadenza
-- Tabella per raccogliere feedback utente dopo ogni scadenza fiscale

CREATE TABLE deadline_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_event_id UUID NOT NULL REFERENCES tax_schedule(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'dismissed')),
  reason TEXT CHECK (reason IN ('no_money', 'forgot', 'unclear_amount', 'other')),
  free_text TEXT CHECK (char_length(free_text) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, schedule_event_id)
);

-- RLS
ALTER TABLE deadline_feedback ENABLE ROW LEVEL SECURITY;

-- Users: INSERT e SELECT solo le proprie righe
CREATE POLICY "Users can insert own feedback"
  ON deadline_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON deadline_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Admin: SELECT tutte le righe (per analytics)
-- Usa public.has_role() definita in migration 20260208080932
CREATE POLICY "Admins can view all feedback"
  ON deadline_feedback FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index per query admin analytics aggregate
CREATE INDEX idx_deadline_feedback_created_at
  ON deadline_feedback(created_at DESC);

-- Index per dedup nella Edge Function
CREATE INDEX idx_deadline_feedback_user_schedule
  ON deadline_feedback(user_id, schedule_event_id);
