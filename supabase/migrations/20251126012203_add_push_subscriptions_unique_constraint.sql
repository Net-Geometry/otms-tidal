-- Migration: Migrate push_subscriptions table from Web Push API to Firebase Cloud Messaging
-- Date: 2025-11-26
-- Description: Transforms push_subscriptions table to store FCM tokens instead of Web Push API
--              subscriptions. Removes old Web Push API columns and adds FCM-compatible columns.
--              This completes the transition from infrastructure to active FCM notification support.

-- Delete all existing Web Push subscriptions (as they are no longer usable)
DELETE FROM public.push_subscriptions;

-- Drop the old UNIQUE constraint
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT uq_push_subscriptions_user_endpoint;

-- Drop Web Push API specific columns
ALTER TABLE public.push_subscriptions
  DROP COLUMN endpoint,
  DROP COLUMN p256dh_key,
  DROP COLUMN auth_key;

-- Add FCM-compatible columns
ALTER TABLE public.push_subscriptions
  ADD COLUMN fcm_token text NOT NULL,
  ADD COLUMN device_name text,
  ADD COLUMN device_type text;

-- Create new UNIQUE constraint for FCM tokens
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT uq_push_subscriptions_user_token UNIQUE(user_id, fcm_token);

-- Update table comments
COMMENT ON TABLE public.push_subscriptions IS 'Stores Firebase Cloud Messaging (FCM) push notification subscriptions for PWA push notification feature';

-- Update column comments
COMMENT ON COLUMN public.push_subscriptions.fcm_token IS 'Firebase Cloud Messaging device token for sending push notifications';
COMMENT ON COLUMN public.push_subscriptions.device_name IS 'Human-readable device name (e.g., "Chrome - Nov 26, 2025") for user identification';
COMMENT ON COLUMN public.push_subscriptions.device_type IS 'Device type identifier (e.g., "web", "mobile", "desktop") for filtering';
COMMENT ON COLUMN public.push_subscriptions.is_active IS 'Enables disabling subscriptions without deletion (GDPR-friendly, used for invalid token cleanup)';

-- Create index on fcm_token for faster lookups
CREATE INDEX idx_push_subscriptions_fcm_token
  ON public.push_subscriptions(fcm_token);

-- Note: The following already exist from previous migration:
-- - idx_push_subscriptions_user_id (used for fetching user's tokens)
-- - idx_push_subscriptions_active (used for checking active subscriptions)
-- - update trigger (upd_push_subscriptions)
-- - RLS policies (unchanged, still based on user_id)
