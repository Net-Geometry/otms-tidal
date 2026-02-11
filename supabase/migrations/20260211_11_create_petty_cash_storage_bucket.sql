-- Finance: storage bucket for petty cash receipts

INSERT INTO storage.buckets (id, name, public)
VALUES ('petty-cash-receipts', 'petty-cash-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "PettyCash: upload own folder" ON storage.objects;
CREATE POLICY "PettyCash: upload own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'petty-cash-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "PettyCash: public read" ON storage.objects;
CREATE POLICY "PettyCash: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'petty-cash-receipts');

DROP POLICY IF EXISTS "PettyCash: delete own files" ON storage.objects;
CREATE POLICY "PettyCash: delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'petty-cash-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
