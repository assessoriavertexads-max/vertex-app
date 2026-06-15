-- Create storage buckets for image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('form-images', 'form-images', true, 5242880,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml']),
  ('branding', 'branding', true, 5242880,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- form-images policies
DROP POLICY IF EXISTS "Public read form-images"    ON storage.objects;
DROP POLICY IF EXISTS "Auth insert form-images"    ON storage.objects;
DROP POLICY IF EXISTS "Auth update form-images"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete form-images"    ON storage.objects;

CREATE POLICY "Public read form-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'form-images');

CREATE POLICY "Auth insert form-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth update form-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth delete form-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'form-images' AND auth.uid() IS NOT NULL);

-- branding policies
DROP POLICY IF EXISTS "Public read branding"    ON storage.objects;
DROP POLICY IF EXISTS "Auth insert branding"    ON storage.objects;
DROP POLICY IF EXISTS "Auth update branding"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete branding"    ON storage.objects;

CREATE POLICY "Public read branding"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

CREATE POLICY "Auth insert branding"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'branding' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth update branding"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'branding' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth delete branding"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'branding' AND auth.uid() IS NOT NULL);
