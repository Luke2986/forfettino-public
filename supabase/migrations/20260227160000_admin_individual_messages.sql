-- Story 25.6: Add individual message columns to admin_announcements
ALTER TABLE admin_announcements
  ADD COLUMN target_type TEXT NOT NULL DEFAULT 'broadcast'
    CHECK (target_type IN ('broadcast', 'individual')),
  ADD COLUMN target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN delivery_type TEXT NOT NULL DEFAULT 'sidebar'
    CHECK (delivery_type IN ('sidebar', 'popup'));

-- Index for user message history queries (AC #4)
CREATE INDEX idx_admin_announcements_target_user
  ON admin_announcements(target_user_id, created_at DESC)
  WHERE target_type = 'individual';

-- Index for notification metadata queries on admin_individual type (mirrors admin_announcement index)
CREATE INDEX idx_notifications_metadata_announcement_id_individual
  ON public.notifications ((metadata->>'announcement_id'))
  WHERE type = 'admin_individual';

-- Existing records: defaults match (broadcast, NULL user_id, sidebar) — no data migration needed
