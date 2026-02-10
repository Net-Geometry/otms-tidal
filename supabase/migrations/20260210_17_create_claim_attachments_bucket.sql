-- Claims Management: storage bucket for claim receipts

INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-attachments', 'claim-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Policies (bucket-scoped)
DROP POLICY IF EXISTS "Claims: upload to own folder" ON storage.objects;
CREATE POLICY "Claims: upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Claims: public read" ON storage.objects;
CREATE POLICY "Claims: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'claim-attachments');

DROP POLICY IF EXISTS "Claims: delete own files" ON storage.objects;
CREATE POLICY "Claims: delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
