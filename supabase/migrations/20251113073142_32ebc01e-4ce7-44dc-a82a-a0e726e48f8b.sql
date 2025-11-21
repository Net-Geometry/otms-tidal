-- Create sequence for ticket numbers if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'ot_ticket_seq') THEN
    CREATE SEQUENCE ot_ticket_seq START WITH 1;
  END IF;
END $$;

-- Create or replace function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ot_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'OT' || LPAD(nextval('ot_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create it
DROP TRIGGER IF EXISTS set_ot_ticket_number ON ot_requests;
CREATE TRIGGER set_ot_ticket_number
  BEFORE INSERT ON ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_ot_ticket_number();

-- Backfill existing records with ticket numbers (only null ones)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT id FROM ot_requests 
    WHERE ticket_number IS NULL 
    ORDER BY created_at ASC
  LOOP
    UPDATE ot_requests 
    SET ticket_number = 'OT' || LPAD(nextval('ot_ticket_seq')::TEXT, 4, '0')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- Make column NOT NULL if not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ot_requests' 
    AND column_name = 'ticket_number' 
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE ot_requests ALTER COLUMN ticket_number SET NOT NULL;
  END IF;
END $$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ot_requests_ticket_number_unique'
  ) THEN
    ALTER TABLE ot_requests ADD CONSTRAINT ot_requests_ticket_number_unique UNIQUE (ticket_number);
  END IF;
END $$;