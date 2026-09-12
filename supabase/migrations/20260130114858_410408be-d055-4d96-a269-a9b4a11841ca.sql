-- Add is_recurring column to tool_subscriptions for recurring renewals
ALTER TABLE tool_subscriptions 
ADD COLUMN is_recurring boolean NOT NULL DEFAULT true;