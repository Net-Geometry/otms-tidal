-- Add deleted_at column to profiles table for soft delete functionality
-- This allows tracking when employees are deleted without hard deleting the record
-- Preserves historical data for OT requests and audit trails

ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index on deleted_at for efficient filtering of active employees
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);

-- Add index for common query pattern: active employees
CREATE INDEX idx_profiles_active ON profiles(deleted_at) WHERE deleted_at IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when the employee was soft-deleted. NULL means employee is active/not deleted.';
