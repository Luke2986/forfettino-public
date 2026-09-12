-- Migration: admin_announcements table for Epic 14 — Admin Broadcast Notifications
-- Allows admin to compose and send broadcast announcements to users

CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  action_url      TEXT,
  action_label    TEXT,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'pro', 'free')),
  sent_count      INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_announcements_admin_user_id
  ON public.admin_announcements(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_announcements_created_at
  ON public.admin_announcements(created_at DESC);

-- RLS
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT announcements
CREATE POLICY "Admin can read announcements"
  ON public.admin_announcements
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE for authenticated users (only service_role via Edge Function)
-- Intentionally no policies for INSERT/UPDATE/DELETE — service_role bypasses RLS

-- Index on notifications.metadata for dedup queries on announcement_id (used by Edge Function)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_announcement_id
  ON public.notifications ((metadata->>'announcement_id'))
  WHERE type = 'admin_announcement';
