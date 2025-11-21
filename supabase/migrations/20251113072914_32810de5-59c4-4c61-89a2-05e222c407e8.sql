-- Add ticket_number column to ot_requests
ALTER TABLE ot_requests ADD COLUMN ticket_number TEXT;

-- Create sequence for ticket numbers
CREATE SEQUENCE ot_ticket_seq START WITH 1;

-- Create function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ot_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'OT' || LPAD(nextval('ot_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate ticket number on insert
CREATE TRIGGER set_ot_ticket_number
  BEFORE INSERT ON ot_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_ot_ticket_number();

-- Backfill existing records with ticket numbers
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

-- Make column NOT NULL after backfill
ALTER TABLE ot_requests ALTER COLUMN ticket_number SET NOT NULL;

-- Add unique constraint
ALTER TABLE ot_requests ADD CONSTRAINT ot_requests_ticket_number_unique UNIQUE (ticket_number);