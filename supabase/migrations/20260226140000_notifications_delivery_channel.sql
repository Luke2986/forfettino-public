-- Story 25-1: Add delivery_channel and dismissed_at columns to notifications
-- delivery_channel discriminates sidebar vs popup delivery
-- dismissed_at tracks popup dismissal (distinct from read_at)

ALTER TABLE notifications
  ADD COLUMN delivery_channel TEXT NOT NULL DEFAULT 'sidebar'
    CHECK (delivery_channel IN ('sidebar', 'popup')),
  ADD COLUMN dismissed_at TIMESTAMPTZ;

-- Partial index for pending popup notifications (used by Story 25.2 BlockingModal queue)
CREATE INDEX idx_notifications_pending_popup
  ON notifications(user_id, created_at ASC)
  WHERE delivery_channel = 'popup' AND dismissed_at IS NULL;
