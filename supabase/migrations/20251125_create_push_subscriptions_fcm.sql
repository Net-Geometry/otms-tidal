-- Create FCM Push Subscriptions Table
-- Parallel to existing push_subscriptions (Web Push API)
-- Stores Firebase Cloud Messaging tokens instead of endpoints

CREATE TABLE IF NOT EXISTS public.push_subscriptions_fcm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  device_name text,
  device_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_push_subscriptions_fcm_user_token UNIQUE(user_id, fcm_token)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_user_id
  ON public.push_subscriptions_fcm(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_active
  ON public.push_subscriptions_fcm(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token
  ON public.push_subscriptions_fcm(fcm_token);

-- Enable RLS
ALTER TABLE public.push_subscriptions_fcm ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same as original push_subscriptions)
-- Users can view their own subscriptions
CREATE POLICY "Users can view own FCM subscriptions"
  ON public.push_subscriptions_fcm
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own FCM subscriptions"
  ON public.push_subscriptions_fcm
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own FCM subscriptions"
  ON public.push_subscriptions_fcm
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own FCM subscriptions"
  ON public.push_subscriptions_fcm
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscriptions_fcm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upd_push_subscriptions_fcm
  BEFORE UPDATE ON public.push_subscriptions_fcm
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_fcm_updated_at();
