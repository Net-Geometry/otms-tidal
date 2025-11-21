-- Force recalculation of all OT amounts by triggering the recalculate_daily_ot_trigger
-- This will correctly apply proportional distribution for multi-session days

UPDATE ot_requests
SET total_hours = total_hours
WHERE status <> 'rejected';