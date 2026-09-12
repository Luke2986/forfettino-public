-- Epic 48, Story 48-2: DB Schema Calendario
-- Tabelle calendar_connections e calendar_events_cache con RLS

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL
    CONSTRAINT calendar_connections_provider_check CHECK (provider IN ('google', 'apple')),
  provider_email  TEXT,
  access_token    TEXT,
  refresh_token   TEXT,
  sync_token      TEXT,
  expires_at      TIMESTAMPTZ,
  last_synced_at  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT calendar_connections_status_check CHECK (status IN ('active', 'error', 'revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_calendar_connections_user_id
  ON public.calendar_connections (user_id);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar connections"
  ON public.calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar connections"
  ON public.calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar connections"
  ON public.calendar_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar connections"
  ON public.calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.calendar_events_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  external_id     TEXT NOT NULL,
  title           TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  all_day         BOOLEAN NOT NULL DEFAULT false,
  location        TEXT,
  description     TEXT,
  calendar_name   TEXT,
  color           TEXT,
  raw_data        JSONB,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);

CREATE INDEX idx_calendar_events_cache_user_id
  ON public.calendar_events_cache (user_id);

CREATE INDEX idx_calendar_events_cache_connection_id
  ON public.calendar_events_cache (connection_id);

CREATE INDEX idx_calendar_events_cache_start_at
  ON public.calendar_events_cache (user_id, start_at);

ALTER TABLE public.calendar_events_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
  ON public.calendar_events_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events"
  ON public.calendar_events_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON public.calendar_events_cache FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON public.calendar_events_cache FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_calendar_events_cache_updated_at
  BEFORE UPDATE ON public.calendar_events_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();