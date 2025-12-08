-- Migration: Refactor OT Status Enum - Clean Route B Workflow
-- Date: 2025-12-10
-- Description: Replace 16-value enum with streamlined 9-value enum for cleaner Route A/B separation

-- Step 1: Create new enum with clean set of values
CREATE TYPE ot_status_new AS ENUM (
  'pending_verification',
  'supervisor_confirmed',
  'pending_respective_supervisor_confirmation',
  'respective_supervisor_confirmed',
  'pending_supervisor_verification',
  'supervisor_verified',
  'hr_certified',
  'management_approved',
  'rejected'
);

-- Step 2: Add new column for safe migration
ALTER TABLE ot_requests ADD COLUMN status_new ot_status_new;

-- Step 3: Create migration function that respects Route A vs Route B
CREATE OR REPLACE FUNCTION migrate_status(
  old_status TEXT,
  has_respective_sv BOOLEAN
) RETURNS ot_status_new AS $$
BEGIN
  -- Route A: No respective supervisor
  IF NOT has_respective_sv THEN
    CASE old_status
      WHEN 'pending_verification' THEN RETURN 'pending_verification'::ot_status_new;
      WHEN 'verified', 'supervisor_verified' THEN RETURN 'supervisor_confirmed'::ot_status_new;
      WHEN 'pending_supervisor_confirmation' THEN RETURN 'supervisor_confirmed'::ot_status_new;
      WHEN 'supervisor_confirmed' THEN RETURN 'supervisor_confirmed'::ot_status_new;
      WHEN 'approved', 'hr_certified' THEN RETURN 'hr_certified'::ot_status_new;
      WHEN 'bod_approved', 'management_approved' THEN RETURN 'management_approved'::ot_status_new;
      WHEN 'reviewed' THEN RETURN 'management_approved'::ot_status_new;
      WHEN 'rejected' THEN RETURN 'rejected'::ot_status_new;
      WHEN 'pending_hr_recertification' THEN RETURN 'hr_certified'::ot_status_new;
      ELSE RETURN 'pending_verification'::ot_status_new;
    END CASE;
  END IF;

  -- Route B: With respective supervisor
  IF has_respective_sv THEN
    CASE old_status
      WHEN 'pending_verification' THEN RETURN 'pending_respective_supervisor_confirmation'::ot_status_new;
      WHEN 'pending_supervisor_confirmation' THEN RETURN 'pending_respective_supervisor_confirmation'::ot_status_new;
      WHEN 'pending_respective_supervisor_confirmation' THEN RETURN 'pending_respective_supervisor_confirmation'::ot_status_new;
      WHEN 'respective_supervisor_confirmed' THEN RETURN 'pending_supervisor_verification'::ot_status_new;
      WHEN 'pending_supervisor_verification' THEN RETURN 'pending_supervisor_verification'::ot_status_new;
      WHEN 'supervisor_verified', 'verified' THEN RETURN 'supervisor_verified'::ot_status_new;
      WHEN 'supervisor_confirmed' THEN RETURN 'supervisor_verified'::ot_status_new;
      WHEN 'approved', 'hr_certified' THEN RETURN 'hr_certified'::ot_status_new;
      WHEN 'bod_approved', 'management_approved' THEN RETURN 'management_approved'::ot_status_new;
      WHEN 'reviewed' THEN RETURN 'management_approved'::ot_status_new;
      WHEN 'rejected' THEN RETURN 'rejected'::ot_status_new;
      WHEN 'pending_hr_recertification' THEN RETURN 'hr_certified'::ot_status_new;
      WHEN 'pending_supervisor_review' THEN RETURN 'rejected'::ot_status_new;
      ELSE RETURN 'pending_respective_supervisor_confirmation'::ot_status_new;
    END CASE;
  END IF;

  RETURN 'rejected'::ot_status_new;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Apply migration to all existing records
UPDATE ot_requests
SET status_new = migrate_status(status, respective_supervisor_id IS NOT NULL)
WHERE status_new IS NULL;

-- Step 5: Verify migration (count records by new status)
-- This helps identify any migration issues
DO $$
DECLARE
  route_a_count INT;
  route_b_count INT;
  total_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM ot_requests;
  SELECT COUNT(*) INTO route_a_count FROM ot_requests WHERE status_new IS NOT NULL AND respective_supervisor_id IS NULL;
  SELECT COUNT(*) INTO route_b_count FROM ot_requests WHERE status_new IS NOT NULL AND respective_supervisor_id IS NOT NULL;

  RAISE NOTICE 'Migration Summary: Total=%, RouteA=%, RouteB=%', total_count, route_a_count, route_b_count;
END $$;

-- Step 6: Drop old constraints and column
ALTER TABLE ot_requests DROP CONSTRAINT IF EXISTS check_valid_status;
ALTER TABLE ot_requests DROP COLUMN status;

-- Step 7: Rename new column to status
ALTER TABLE ot_requests RENAME COLUMN status_new TO status;

-- Step 8: Set NOT NULL constraint
ALTER TABLE ot_requests ALTER COLUMN status SET NOT NULL;

-- Step 9: Add constraint for the new enum
ALTER TABLE ot_requests ADD CONSTRAINT check_valid_status CHECK (status::text IN (
  'pending_verification',
  'supervisor_confirmed',
  'pending_respective_supervisor_confirmation',
  'respective_supervisor_confirmed',
  'pending_supervisor_verification',
  'supervisor_verified',
  'hr_certified',
  'management_approved',
  'rejected'
));

-- Step 10: Drop old enum
DROP TYPE IF EXISTS ot_status;

-- Step 11: Rename new enum to original name
ALTER TYPE ot_status_new RENAME TO ot_status;

-- Step 12: Clean up migration function (no longer needed)
DROP FUNCTION IF EXISTS migrate_status(TEXT, BOOLEAN);
