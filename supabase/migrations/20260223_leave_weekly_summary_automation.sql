-- Leave Notification & Reporting (HR-02-11, HR-02-12)
-- Friday: generate weekly leave summary
-- Monday: distribute summary as in-app notifications to all staff

-------------------------------------------------------
-- 1. Function: generate_weekly_leave_summary()
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_weekly_leave_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start date;
  v_week_end date;
  v_summary jsonb;
BEGIN
  -- Upcoming Monday to Sunday
  v_week_start := date_trunc('week', now() + interval '3 days')::date;
  v_week_end := v_week_start + interval '6 days';

  -- Build summary grouped by department then leave type
  WITH leave_data AS (
    SELECT
      lr.id AS request_id,
      lr.employee_id,
      lr.leave_type_id,
      lr.total_days,
      p.full_name,
      p.department_id,
      COALESCE(d.name, 'Unassigned') AS department_name,
      lt.name AS leave_type_name
    FROM leave_requests lr
    JOIN profiles p ON p.id = lr.employee_id
    LEFT JOIN departments d ON d.id = p.department_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status = 'management_approved'
      AND lr.start_date <= v_week_end
      AND lr.end_date >= v_week_start
  ),
  dept_leave_type_agg AS (
    SELECT
      department_id,
      department_name,
      leave_type_id,
      leave_type_name,
      count(*) AS request_count,
      sum(total_days) AS total_days,
      array_agg(full_name ORDER BY full_name) AS employees
    FROM leave_data
    GROUP BY department_id, department_name, leave_type_id, leave_type_name
  ),
  dept_agg AS (
    SELECT
      department_id,
      department_name,
      jsonb_object_agg(
        leave_type_id::text,
        jsonb_build_object(
          'leave_type_name', leave_type_name,
          'count', request_count,
          'total_days', total_days,
          'employees', to_jsonb(employees)
        )
      ) AS by_leave_type
    FROM dept_leave_type_agg
    GROUP BY department_id, department_name
  )
  SELECT
    jsonb_build_object(
      'week_start', v_week_start,
      'week_end', v_week_end,
      'total_requests', COALESCE((SELECT count(*) FROM leave_data), 0),
      'departments', COALESCE(
        jsonb_object_agg(
          department_id::text,
          jsonb_build_object(
            'department_name', department_name,
            'by_leave_type', by_leave_type
          )
        ),
        '{}'::jsonb
      )
    )
  INTO v_summary
  FROM dept_agg;

  -- Handle case with zero leave requests
  IF v_summary IS NULL THEN
    v_summary := jsonb_build_object(
      'week_start', v_week_start,
      'week_end', v_week_end,
      'total_requests', 0,
      'departments', '{}'::jsonb
    );
  END IF;

  -- Upsert (idempotent)
  INSERT INTO leave_weekly_summaries (id, week_start, week_end, summary_data, generated_at)
  VALUES (gen_random_uuid(), v_week_start, v_week_end, v_summary, now())
  ON CONFLICT (week_start, week_end)
  DO UPDATE SET summary_data = EXCLUDED.summary_data, generated_at = EXCLUDED.generated_at;
END;
$$;

-------------------------------------------------------
-- 2. Function: distribute_leave_summary_notifications()
-------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distribute_leave_summary_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary RECORD;
  v_total int;
  v_week_label text;
BEGIN
  -- Get latest generated summary
  SELECT * INTO v_summary
  FROM leave_weekly_summaries
  ORDER BY week_start DESC
  LIMIT 1;

  IF v_summary IS NULL THEN
    RETURN;
  END IF;

  v_total := COALESCE((v_summary.summary_data->>'total_requests')::int, 0);
  v_week_label := to_char(v_summary.week_start, 'DD Mon') || ' - ' || to_char(v_summary.week_end, 'DD Mon YYYY');

  -- Insert notification for each active employee
  INSERT INTO notifications (id, user_id, title, message, notification_type, link, is_read, created_at)
  SELECT
    gen_random_uuid(),
    p.id,
    'Weekly Leave Summary',
    'Leave summary for ' || v_week_label || ': ' || v_total || ' approved request(s).',
    'leave_weekly_summary',
    '/leave',
    false,
    now()
  FROM profiles p
  WHERE p.status = 'active';
END;
$$;

-------------------------------------------------------
-- 3. Add leave_weekly_summary to notification type check constraint
-------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_notification_type_check CHECK (
  notification_type = ANY (ARRAY[
    'ot_approved'::text,
    'ot_rejected'::text,
    'ot_pending_review'::text,
    'ot_requests_new'::text,
    'ot_requests_approved'::text,
    'ot_requests_rejected'::text,
    'ot_pending_confirmation'::text,
    'ot_supervisor_confirmed'::text,
    'leave_pending_review'::text,
    'leave_approved'::text,
    'leave_rejected'::text,
    'leave_weekly_summary'::text,
    'claim_pending_review'::text,
    'claim_approved'::text,
    'claim_rejected'::text
  ])
);

-------------------------------------------------------
-- 4. Schedule cron jobs
-------------------------------------------------------
DO $outer$
BEGIN
  -- Friday 6pm MYT (UTC+8) = 10:00 UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-leave-summary-generate') THEN
    PERFORM cron.schedule(
      'weekly-leave-summary-generate',
      '0 10 * * 5',
      'SELECT public.generate_weekly_leave_summary();'
    );
  END IF;

  -- Monday 8am MYT (UTC+8) = 00:00 UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-leave-summary-distribute') THEN
    PERFORM cron.schedule(
      'weekly-leave-summary-distribute',
      '0 0 * * 1',
      'SELECT public.distribute_leave_summary_notifications();'
    );
  END IF;
END;
$outer$;
