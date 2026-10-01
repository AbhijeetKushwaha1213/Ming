INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resource-files',
  'resource-files',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload own resource files" ON storage.objects;
CREATE POLICY "Authenticated users can upload own resource files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated users can view own resource files" ON storage.objects;
CREATE POLICY "Authenticated users can view own resource files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resource-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated users can delete own resource files" ON storage.objects;
CREATE POLICY "Authenticated users can delete own resource files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resource-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
